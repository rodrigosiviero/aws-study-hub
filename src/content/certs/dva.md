---
title: "AWS Certified Developer – Associate"
code: "DVA-C02"
status: "complete"
description: "A detailed beginner course for DVA-C02 v2.1: build, secure, deploy, observe, and optimize AWS applications."
order: 3
---

# AWS Certified Developer – Associate (DVA-C02)

This living course follows the **DVA-C02 Exam Guide v2.1**. The exam has **50 scored questions**, **15 unscored questions**, **130 minutes**, and a scaled passing score of **720** on a 100–1,000 scale. Questions are multiple choice or multiple response. An unanswered item is incorrect, so eliminate options that violate a stated constraint and make the best selection.

## How to use this course

A Developer Associate question is usually a miniature production incident or feature request. First identify the boundary: client-to-API, producer-to-worker, application-to-data, workload-to-AWS API, or deployment-to-observability. Then choose the smallest managed capability that protects that boundary. Every task below uses the same loop: requirement, architecture, implementation, failure modes, and distractors.

## Exam map

| Domain | Weight | Core question |
|---|---:|---|
| Development with AWS Services | 32% | How should the application be built, connected, and persisted? |
| Security | 26% | Who may call it, and how are data and credentials protected? |
| Deployment | 24% | How does a known version move safely to production? |
| Troubleshooting and Optimization | 18% | What evidence identifies the cause and smallest useful improvement? |

```mermaid
flowchart LR
  U[User] --> AG[API Gateway]
  AG --> L[Lambda]
  L --> D[(DynamoDB)]
  L --> EB[EventBridge]
  EB --> Q[SQS worker queue]
  Q --> W[Worker Lambda]
  L -.metrics logs traces.-> CW[CloudWatch and X-Ray]
```

**Beginner rule:** synchronous means the caller waits; asynchronous means the producer hands work off and can return. Authentication proves identity; authorization decides permission. Logs provide detailed events, metrics show a trend, and traces show the route taken by one request.

## Domain 1: Development with AWS Services (32%)
### Task 1: Develop code for applications hosted on AWS
**Plain-language goal.** Build APIs and service interactions that remain correct when traffic spikes, consumers change, or an external dependency is slow.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** An order endpoint validates a request, records an order, publishes `OrderCreated`, and returns quickly. Inventory, billing, and email process the event independently. A customer must never be charged twice merely because a retry occurred.
```mermaid
flowchart LR
 C[Client] --> API[Validated API]
 API --> O[(Order table + idempotency key)]
 O --> E[OrderCreated event]
 E --> I[Inventory]
 E --> B[Billing queue]
 E --> N[Notification]
 B --> P[Payment provider]
 P -->|timeout or 5xx| R[Backoff / circuit breaker]
 R --> DLQ[Failure queue]
```
#### Architecture concept studio
**Monolith.** One deployable application contains the order API, inventory logic, and billing logic. It is often the lowest-operational-overhead answer for a small, cohesive product and one release cadence. It becomes limiting only when components need independent ownership, scaling, or release schedules.

**Microservices.** Separate Orders, Inventory, and Billing services can deploy and scale independently, but every boundary now needs a network contract, authentication, observability, and failure handling. “Microservices” is not an automatic best practice; it is a trade for independent change.

**Event-driven architecture and choreography.** After the API persists an order, it publishes the fact `OrderCreated`. Inventory and Email react independently. This is choreography: no central coordinator tells them to run. It is ideal when a new consumer can be added without changing order acceptance.

**Orchestration with Step Functions.** When the business rule is *charge payment, then reserve inventory, then ship; otherwise compensate*, use a Step Functions state machine. It keeps durable workflow state, makes order/retry/catch behavior visible, and can invoke compensating work. Do not choose it merely to broadcast a notification.

**Pub/sub fanout.** SNS gives each subscription a copy of a message; EventBridge routes structured events to matching targets. One SQS queue instead load-balances each message to one worker. Attach SQS queues to fanout consumers that need buffering and independent retries.

| Comparison | State and coupling | Choose it when | Exam trap |
|---|---|---|---|
| Monolith | One deployment; in-process calls | One small cohesive application | Treating it as inherently obsolete |
| Microservices | Network contracts; separate deployment | Independent teams or scaling justify complexity | Ignoring service-to-service failures |
| Choreography | Event contracts; no central workflow state | Reactions are independent | Using it for strictly ordered steps |
| Step Functions orchestration | Central durable state machine | Ordered, retryable, compensating workflow | Calling it pub/sub |
| SNS/EventBridge fanout | Independent copies/targets | Many consumers need the same fact | Using one SQS queue for copies |

```mermaid
flowchart LR
 O[Order API] --> DB[(Order + idempotency record)]
 DB --> EV[OrderCreated]
 EV --> INV[Inventory reacts]
 EV --> MAIL[Email reacts]
 EV --> SF[Step Functions: payment then fulfillment]
 SF --> PAY[Payment]
 SF --> FUL[Fulfillment]
```

**Stateful versus stateless.** Keep compute **stateless**: do not put a cart, session, or workflow solely in Lambda/container memory. Persist it in DynamoDB, a session store, or Step Functions so any healthy instance can continue. A **stateful** workflow is valid when its durable state is deliberately owned and recoverable.

**Tightly versus loosely coupled; synchronous versus asynchronous.** An API → payment → email chain is tightly coupled and synchronous: the caller waits and every slow dependency can fail acceptance. A durable event/queue makes producer and consumer loosely coupled and asynchronous: the API can accept the order and consumers retry independently. Keep synchronous work only where the caller must know now, such as validation or a price; hand off slow/bursty work asynchronously.

**Idempotency and retries.** At-least-once delivery means duplicate requests/messages are expected. Store an idempotency key and prior business result before charging or writing. Retry transient timeout/5xx failures with a short timeout, bounded exponential backoff, and jitter; never retry malformed input. After attempts are exhausted, preserve work in a DLQ or failure workflow.

#### Decision table
| Requirement cue | Select | Reason |
|---|---|---|
| Caller needs result now | API Gateway + synchronous Lambda/service | HTTP response is part of the contract |
| Durable background work, one worker group | SQS | Buffers bursts and isolates worker failures |
| One business event, content-based routes | EventBridge | Rules route structured events to many targets |
| Simple push notification to many subscribers | SNS | Pub/sub fanout; pair subscriptions with SQS for durability |
| Stateful multi-step business process | Step Functions | Visible orchestration, state, retries, catches |
| Continuous ordered records | Kinesis | Stream processing and consumer checkpoints |
#### Implementation walkthrough
1. Define a request schema and validate it at API Gateway and in code. Return 400 for invalid client input; do not retry a malformed request.
2. Use an idempotency key stored with the business result. On a duplicate request, return the prior outcome instead of repeating the side effect.
3. Persist the accepted order before publishing follow-up work, or use a deliberate transactional/outbox-style design so a successful response does not silently lose the event.
4. Publish a stable event envelope: source, detail-type, timestamp, correlation ID, version, and detail. Consumers must tolerate additive fields.
5. Use SDK clients with the runtime role. Set short timeouts, retry only transient errors with exponential backoff and jitter, and bound attempts.
6. For a third-party payment service, open a circuit after repeated failures; route recoverable work to a queue or failure workflow rather than holding the client request indefinitely.
7. Write unit tests with representative API and event payloads. Assert status code, validation, idempotency, and the outgoing event—not implementation details.
#### What fails in production, and how to respond
- **A worker crashes after receiving a message:** SQS visibility timeout returns the message. Make processing idempotent and send repeatedly failing messages to a DLQ for investigation.
- **The payment API slows down:** A timeout prevents thread or Lambda exhaustion. The circuit breaker and bounded retry prevent a retry storm.
- **A new consumer cannot parse an event:** Version the event contract and make consumers ignore unknown additive fields; do not silently repurpose an existing field.
#### Why tempting alternatives are wrong
- A synchronous chain API → inventory → billing → email makes order acceptance depend on all three services; it violates quick response and failure isolation.
- Using one SQS queue for unrelated independent consumers load-balances messages; it does not give each consumer a copy. Use fanout.
- Retrying every 4xx response repeats bad input. Client errors normally require correction, not backoff.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.1.5, 1.1.6, 1.1.7, 1.1.8, 1.1.9, 1.1.10, 1.1.11, 1.1.12, 1.1.13.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 1.1.1 | Architecture patterns: monoliths, services, events, orchestration, and fanout | Start with a monolith for one cohesive product and release cadence. Split only when independent ownership, scaling, or release schedules justify network complexity. | A synchronous API → payment → email chain fails order acceptance when email is slow. *Independent consumers* points to events/fanout; *ordered, stateful, compensating workflow* points to Step Functions. |
| 1.1.2 | Stateful and stateless application design | Keep handlers stateless when they must scale or be replaced transparently. Choose durable state when progress must survive a cold start, retry, or another instance. | A cart held only in Lambda memory disappears on cold start or a concurrent instance. *Any instance can continue* means stateless compute plus durable state, not sticky sessions. |
| 1.1.3 | Coupling and stable service contracts | Use direct calls only when an immediate answer is required. Use SQS, SNS, or EventBridge for independently retryable work or separately owned consumers. | Reusing a field with a new meaning breaks old consumers. Queues reduce runtime dependency but do not eliminate the contract. |
| 1.1.4 | Synchronous and asynchronous application flow | Keep validation, authorization, and an immediately required price synchronous. Hand off email, image processing, fulfillment, and bursty third-party work through SQS, SNS, or EventBridge. | A queue is wrong if the caller requires the computed response now. A long synchronous dependency chain exhausts concurrency during an outage. |
| 1.1.5 | Retries, idempotency, and controlled recovery | Retry timeouts, throttles, and selected 5xx responses with exponential backoff and jitter. Never retry malformed input or authorization failures. | Retrying every error causes a storm; a DLQ is terminal handling, not the retry policy. *At-least-once delivery* requires an idempotent consumer. |
| 1.1.6 | API design, validation, and HTTP contracts | Use API Gateway for managed HTTP routing, validation, throttling, and integration. Keep tenant/ownership decisions in application code when they need domain context. | Returning `200` for every fault hides responsibility; trusting a tenant ID in the body permits cross-tenant reads. API Gateway validation complements handler validation. |
| 1.1.7 | Unit tests and AWS SAM local Lambda invocation | A unit test proves one decision without AWS; SAM local invocation runs the packaged handler with a realistic event. Use both: one makes logic fast to test, the other catches handler/event wiring before deployment. | Unit tests cannot prove IAM, VPC, or API Gateway mapping; deployed integration tests cover those. A happy-path local invoke is not release evidence—also test invalid input and duplicate delivery. |
| 1.1.8 | SQS, SNS, and EventBridge messaging in code | SQS is a durable to-do list for one worker group. SNS pushes a copy to every subscription. | One SQS queue load-balances; it does not fan out. Set a visibility timeout longer than processing, a DLQ, and duplicate-safe consumers. |
| 1.1.9 | AWS SDK calls with temporary roles, pagination, and exceptions | Give an execution role only required actions/resources, use paginators for list APIs, and distinguish retryable throttling from access denied and invalid input. **Concrete implementation.** ```python import boto3 from botocore.exceptions import ClientError s3 = boto3.client("s3") try: for page in s3.get_paginator("list_objects_v2").paginate(Bucket="approved-artifacts"): for item in page.get("Contents", []): print(item["Key"]) except ClientError as err: if err.response["Error"]["Code"] == "AccessDenied": raise raise ``` Configure region/resource names externally; inspect service error code and request ID. | One list call silently misses later pages. Catching every exception and returning success hides outages. |
| 1.1.10 | Kinesis streams, checkpoints, batches, and duplicate-safe consumers | Choose Kinesis for ordered near-real-time stream processing, replay, and multiple consumers. Choose SQS for a simple durable worker queue without stream retention semantics. | A failed batch can replay already successful records; never charge per delivery without idempotency. Ordering is within the shard/partition-key path, not globally. |
| 1.1.11 | Safe use of Amazon Q Developer | Ask it for a test matrix, SDK-error explanation, or IaC draft after defining constraints. Never paste secrets, tokens, customer data, or a production payload into prompts. | Generated code can use broad permissions, static credentials, or a wrong event shape. Review and test it; “accept generated output without review” is never the safe answer. |
| 1.1.12 | EventBridge buses, rules, schemas, archives, and replay | Use a custom bus for application isolation, rules for content-based routing, archives/replay for historical reprocessing, and a queue DLQ for target delivery failure handling. | Replay re-delivers events, so consumers remain idempotent. A schema documents a contract; it is not authorization. |
| 1.1.13 | Resilience for third-party dependencies | Call synchronously only if the customer needs the answer now; otherwise queue work. Use a fallback only when it keeps the real business meaning, such as “payment pending,” never a fabricated “paid.” | Infinite retries amplify outages; retrying 4xx repeats bad requests. *Isolate external outage/graceful degradation/durable retry* is the resilience pattern. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Architecture patterns: monoliths, services, events, orchestration, and fanout | Start with a monolith for one cohesive product and release cadence. Split only when independent ownership, scaling, or release schedules justify network complexity. | A synchronous API → payment → email chain fails order acceptance when email is slow. *Independent consumers* points to events/fanout; *ordered, stateful, compensating workflow* points to Step Functions. |
| Stateful and stateless application design | Keep handlers stateless when they must scale or be replaced transparently. Choose durable state when progress must survive a cold start, retry, or another instance. | A cart held only in Lambda memory disappears on cold start or a concurrent instance. *Any instance can continue* means stateless compute plus durable state, not sticky sessions. |
| Coupling and stable service contracts | Use direct calls only when an immediate answer is required. Use SQS, SNS, or EventBridge for independently retryable work or separately owned consumers. | Reusing a field with a new meaning breaks old consumers. Queues reduce runtime dependency but do not eliminate the contract. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 1.1.1 — Architecture patterns: monoliths, services, events, orchestration, and fanout


**What it means**

A monolith is one deployment where code calls code locally. Microservices are independently deployed services joined by network contracts.

> **Why it matters / exam signal:** A synchronous API → payment → email chain fails order acceptance when email is slow. *Independent consumers* points to events/fanout; *ordered, stateful, compensating workflow* points to Step Functions.

**Build it**

1. Persist an order, publish a versioned `OrderCreated`, and route it to Inventory, Email, and Analytics: that is choreography and fanout. If payment must happen before fulfillment, a state machine does charge → reserve → fulfill with `Catch` compensation.
2. Verify **Architecture patterns: monoliths, services, events, orchestration, and fanout** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Start with a monolith for one cohesive product and release cadence. Split only when independent ownership, scaling, or release schedules justify network complexity.

**Avoid this**

- A synchronous API → payment → email chain fails order acceptance when email is slow. *Independent consumers* points to events/fanout; *ordered, stateful, compensating workflow* points to Step Functions.

#### Skill 1.1.2 — Stateful and stateless application design


**What it means**

Stateless compute remembers nothing between requests, so any healthy Lambda can serve the next one. Important state can still exist: place carts, sessions, idempotency outcomes, and workflow progress in DynamoDB, a deliberate session store, or Step Functions where it survives retries and replacement.

> **Why it matters / exam signal:** A cart held only in Lambda memory disappears on cold start or a concurrent instance. *Any instance can continue* means stateless compute plus durable state, not sticky sessions.

**Build it**

1. The API writes `{idempotencyKey, result}` to DynamoDB, then returns that stored result on a duplicate. A Step Functions execution owns workflow state; Lambda reads input, updates durable state, and exits.
2. Verify **Stateful and stateless application design** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Keep handlers stateless when they must scale or be replaced transparently. Choose durable state when progress must survive a cold start, retry, or another instance.

**Avoid this**

- A cart held only in Lambda memory disappears on cold start or a concurrent instance. *Any instance can continue* means stateless compute plus durable state, not sticky sessions.

#### Skill 1.1.3 — Coupling and stable service contracts


**What it means**

Tightly coupled parts must be available and agree at the same moment. Loosely coupled parts exchange a stable API or event contract, allowing a producer and consumer to deploy, scale, and recover independently.

> **Why it matters / exam signal:** Reusing a field with a new meaning breaks old consumers. Queues reduce runtime dependency but do not eliminate the contract.

**Build it**

1. Publish an envelope with `source`, `detail-type`, version, correlation ID, and additive detail fields. Consumers validate supported versions and ignore unknown additive fields.
2. Verify **Coupling and stable service contracts** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use direct calls only when an immediate answer is required. Use SQS, SNS, or EventBridge for independently retryable work or separately owned consumers.

**Avoid this**

- Reusing a field with a new meaning breaks old consumers. Queues reduce runtime dependency but do not eliminate the contract.

#### Skill 1.1.4 — Synchronous and asynchronous application flow


**What it means**

Synchronous work is a phone call: the caller waits. Asynchronous work is a tracked package: the producer makes a durable handoff and another worker completes it later.

> **Why it matters / exam signal:** A queue is wrong if the caller requires the computed response now. A long synchronous dependency chain exhausts concurrency during an outage.

**Build it**

1. API Gateway synchronously invokes Lambda to validate and save an order, then Lambda emits `OrderCreated`; an SQS-backed billing worker handles it later.
2. Verify **Synchronous and asynchronous application flow** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Keep validation, authorization, and an immediately required price synchronous. Hand off email, image processing, fulfillment, and bursty third-party work through SQS, SNS, or EventBridge.

**Avoid this**

- A queue is wrong if the caller requires the computed response now. A long synchronous dependency chain exhausts concurrency during an outage.

#### Skill 1.1.5 — Retries, idempotency, and controlled recovery


**What it means**

A network can lose the reply after a card was charged. Idempotency makes a duplicate return the original outcome instead of repeating the side effect; retries give temporary faults a bounded second chance.

> **Why it matters / exam signal:** Retrying every error causes a storm; a DLQ is terminal handling, not the retry policy. *At-least-once delivery* requires an idempotent consumer.

**Build it**

1. Atomically record the idempotency key and result in DynamoDB before or with the side effect. On duplicate, return the result.
2. Verify **Retries, idempotency, and controlled recovery** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Retry timeouts, throttles, and selected 5xx responses with exponential backoff and jitter. Never retry malformed input or authorization failures.

**Avoid this**

- Retrying every error causes a storm; a DLQ is terminal handling, not the retry policy. *At-least-once delivery* requires an idempotent consumer.

#### Skill 1.1.6 — API design, validation, and HTTP contracts


**What it means**

An API is an agreement about valid requests, responses, and status codes. Validation rejects malformed input before irreversible work; authorization still decides whether an authenticated caller may act.

> **Why it matters / exam signal:** Returning `200` for every fault hides responsibility; trusting a tenant ID in the body permits cross-tenant reads. API Gateway validation complements handler validation.

**Build it**

1. Define `POST /orders`, validate its JSON schema, derive tenant from a verified identity, then return `201` for creation, `400` for invalid input, `401/403` for identity/permission failures, and safe `5xx` errors for server faults. Carry a correlation ID into the event.
2. Verify **API design, validation, and HTTP contracts** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use API Gateway for managed HTTP routing, validation, throttling, and integration. Keep tenant/ownership decisions in application code when they need domain context.

**Avoid this**

- Returning `200` for every fault hides responsibility; trusting a tenant ID in the body permits cross-tenant reads. API Gateway validation complements handler validation.

#### Skill 1.1.7 — Unit tests and AWS SAM local Lambda invocation


**What it means**

A unit test proves one decision without AWS; SAM local invocation runs the packaged handler with a realistic event. Use both: one makes logic fast to test, the other catches handler/event wiring before deployment.

> **Why it matters / exam signal:** Unit tests cannot prove IAM, VPC, or API Gateway mapping; deployed integration tests cover those. A happy-path local invoke is not release evidence—also test invalid input and duplicate delivery.

**Build it**

1. Separate business logic from the handler: ```python # app.py def total(quantity, unit_price): if quantity < 1: raise ValueError("quantity must be positive") return quantity * unit_price def handler(event, _context): try: return {"statusCode": 200, "body": str(total(event["body"]["quantity"], event["body"]["unitPrice"]))} except (KeyError, ValueError): return {"statusCode": 400, "body": "invalid order"} ``` ```python # test_app.py from app import handler, total def test_total_and_bad_request(): assert total(2, 7) == 14 assert handler({"body": {"quantity": 0, "unitPrice": 7}}, None)["statusCode"] == 400 ``` Save a realistic payload as `events/order.json`, then run `sam local invoke OrderFunction --event events/order.json`. The fixture must be the actual API Gateway/SQS/EventBridge envelope, not an invented bare body.
2. Verify **Unit tests and AWS SAM local Lambda invocation** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- A unit test proves one decision without AWS; SAM local invocation runs the packaged handler with a realistic event. Use both: one makes logic fast to test, the other catches handler/event wiring before deployment.

**Avoid this**

- Unit tests cannot prove IAM, VPC, or API Gateway mapping; deployed integration tests cover those. A happy-path local invoke is not release evidence—also test invalid input and duplicate delivery.

#### Skill 1.1.8 — SQS, SNS, and EventBridge messaging in code


**What it means**

SQS is a durable to-do list for one worker group. SNS pushes a copy to every subscription.

> **Why it matters / exam signal:** One SQS queue load-balances; it does not fan out. Set a visibility timeout longer than processing, a DLQ, and duplicate-safe consumers.

**Build it**

1. The order API publishes `OrderCreated` to EventBridge; a rule sends billing work to SQS while analytics receives another target. Use SNS for simple push fanout, commonly with an SQS subscription when a consumer needs buffering.
2. Verify **SQS, SNS, and EventBridge messaging in code** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- SQS is a durable to-do list for one worker group. SNS pushes a copy to every subscription.

**Avoid this**

- One SQS queue load-balances; it does not fan out. Set a visibility timeout longer than processing, a DLQ, and duplicate-safe consumers.

#### Skill 1.1.9 — AWS SDK calls with temporary roles, pagination, and exceptions


**What it means**

The SDK is application code’s AWS control panel. The default credential provider obtains short-lived credentials from the Lambda/EC2 role.

> **Why it matters / exam signal:** One list call silently misses later pages. Catching every exception and returning success hides outages.

**Build it**

1. The SDK is application code’s AWS control panel. The default credential provider obtains short-lived credentials from the Lambda/EC2 role.
2. Verify **AWS SDK calls with temporary roles, pagination, and exceptions** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Give an execution role only required actions/resources, use paginators for list APIs, and distinguish retryable throttling from access denied and invalid input. **Concrete implementation.** ```python import boto3 from botocore.exceptions import ClientError s3 = boto3.client("s3") try: for page in s3.get_paginator("list_objects_v2").paginate(Bucket="approved-artifacts"): for item in page.get("Contents", []): print(item["Key"]) except ClientError as err: if err.response["Error"]["Code"] == "AccessDenied": raise raise ``` Configure region/resource names externally; inspect service error code and request ID.

**Avoid this**

- One list call silently misses later pages. Catching every exception and returning success hides outages.

#### Skill 1.1.10 — Kinesis streams, checkpoints, batches, and duplicate-safe consumers


**What it means**

Kinesis is an ordered, durable log divided into shards. A consumer reads batches and checkpoints progress, but a retry can replay records, so business effects must tolerate duplicates.

> **Why it matters / exam signal:** A failed batch can replay already successful records; never charge per delivery without idempotency. Ordering is within the shard/partition-key path, not globally.

**Build it**

1. Producers choose a partition key so related order updates share a shard. A consumer records an event ID idempotently, writes output, then checkpoints after safe handling.
2. Verify **Kinesis streams, checkpoints, batches, and duplicate-safe consumers** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Choose Kinesis for ordered near-real-time stream processing, replay, and multiple consumers. Choose SQS for a simple durable worker queue without stream retention semantics.

**Avoid this**

- A failed batch can replay already successful records; never charge per delivery without idempotency. Ordering is within the shard/partition-key path, not globally.

#### Skill 1.1.11 — Safe use of Amazon Q Developer


**What it means**

Amazon Q Developer can draft code, tests, and explanations, but it cannot approve its own output. Treat it like a fast new teammate whose pull request needs review.

> **Why it matters / exam signal:** Generated code can use broad permissions, static credentials, or a wrong event shape. Review and test it; “accept generated output without review” is never the safe answer.

**Build it**

1. Ask for a test against a stated handler contract, review permissions/dependencies, run the test and `sam local invoke` using safe fixtures, and compare output to documentation and least-privilege needs.
2. Verify **Safe use of Amazon Q Developer** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Ask it for a test matrix, SDK-error explanation, or IaC draft after defining constraints. Never paste secrets, tokens, customer data, or a production payload into prompts.

**Avoid this**

- Generated code can use broad permissions, static credentials, or a wrong event shape. Review and test it; “accept generated output without review” is never the safe answer.

#### Skill 1.1.12 — EventBridge buses, rules, schemas, archives, and replay


**What it means**

A bus receives application facts; rules inspect event fields and deliver matching events. Schemas document shape, and archives retain events for a bounded replay after a consumer is repaired.

> **Why it matters / exam signal:** Replay re-delivers events, so consumers remain idempotent. A schema documents a contract; it is not authorization.

**Build it**

1. Put `OrderCreated` with `source: shop.orders` and a versioned detail on the `shop` bus. A rule matching source/region routes to fulfillment.
2. Verify **EventBridge buses, rules, schemas, archives, and replay** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use a custom bus for application isolation, rules for content-based routing, archives/replay for historical reprocessing, and a queue DLQ for target delivery failure handling.

**Avoid this**

- Replay re-delivers events, so consumers remain idempotent. A schema documents a contract; it is not authorization.

#### Skill 1.1.13 — Resilience for third-party dependencies


**What it means**

A third-party API is outside your control. Short timeouts, bounded retries, circuit breaking, and durable handoff stop its outage from consuming every application request slot.

> **Why it matters / exam signal:** Infinite retries amplify outages; retrying 4xx repeats bad requests. *Isolate external outage/graceful degradation/durable retry* is the resilience pattern.

**Build it**

1. A billing worker receives a durable message, calls the provider with connection/read timeouts and an idempotency key, retries transient errors with jitter, opens a circuit after repeated failures, and alarms on provider error rate.
2. Verify **Resilience for third-party dependencies** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Call synchronously only if the customer needs the answer now; otherwise queue work. Use a fallback only when it keeps the real business meaning, such as “payment pending,” never a fabricated “paid.”

**Avoid this**

- Infinite retries amplify outages; retrying 4xx repeats bad requests. *Isolate external outage/graceful degradation/durable retry* is the resilience pattern.

### Task 2: Develop code for AWS Lambda
**Plain-language goal.** Configure event-driven functions so their networking, permissions, scaling, and failure behavior match the trigger.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** An image upload to S3 starts a Lambda that validates metadata, writes a DynamoDB record, and emits a notification. A separate SQS consumer resizes images. Both functions must reach a private database, but only one needs public internet egress.
```mermaid
flowchart TD
 E[Async event] --> L[Lambda]
 L -->|success| OK[Destination success]
 L -->|error| R{Retries remain?}
 R -->|yes| L
 R -->|no| F[On-failure destination / DLQ]
 Q[SQS mapping] --> L
 L -->|partial batch response| Q
```
#### Decision table
| Situation | Configuration | Why |
|---|---|---|
| Lambda reaches private RDS | VPC private subnets + security group | Creates network path to private resource |
| VPC Lambda calls public API | NAT path from private subnet | VPC attachment alone has no internet access |
| Async invoke fails | Destination or DLQ | Captures terminal invocation outcome |
| SQS event source fails | Visibility timeout, retries, DLQ, partial batch response | Source mapping controls redelivery |
| Protect downstream database | Reserved concurrency | Caps this function's parallelism |
| Reduce cold-start impact | Provisioned concurrency after measurement | Keeps environments initialized |
#### Implementation walkthrough
1. Start with the event source: API Gateway is synchronous; EventBridge and S3 invoke asynchronously; SQS, Kinesis, and DynamoDB Streams use event source mappings. Their retry ownership differs.
2. Grant the execution role only the S3, DynamoDB, KMS, or log permissions the handler needs. Environment variables configure names and endpoints; they are not a substitute for secret storage.
3. Set timeout slightly above measured normal duration but below the caller or queue visibility design. Increase memory after measuring because Lambda memory also changes CPU allocation.
4. Put SDK clients and database connection initialization outside the handler when reusable. Reuse connections, but still handle a stale connection on the next invocation.
5. For batch sources, make each record independently safe to retry. Report failed item identifiers when partial batch response is supported so successful records are not needlessly repeated.
6. Use test events matching the real trigger shape. A hand-written JSON body is not equivalent to an SQS Records envelope or API Gateway request context.
#### Configuration mechanics
| Knob | Primary effect | Common mistake |
|---|---|---|
| Memory | Memory and CPU allocation | Increasing it without measuring duration/cost |
| Timeout | Maximum invocation time | Making it longer than upstream timeouts |
| Reserved concurrency | Ceiling and isolation | Starving other functions unintentionally |
| Batch size | Throughput per invoke | Making retries replay too much work |
| Visibility timeout | Time before SQS redelivery | Setting it shorter than Lambda runtime |
#### What fails in production, and how to respond
- **Timeout while processing an event:** The invocation may be retried. Make writes idempotent, set a safe timeout, inspect duration, and send terminal failures to the configured destination.
- **Database connection exhaustion:** Limit concurrency, use RDS Proxy when appropriate, reuse connections, and avoid opening one connection per record.
- **Function cannot reach the internet:** Check subnet route tables and NAT. A security group permits traffic but does not create an egress route.
#### Why tempting alternatives are wrong
- Putting a Lambda in a public subnet does not assign it a public IP or magically provide internet egress.
- Raising timeout alone does not fix CPU-bound work; measure and tune memory or redesign the work.
- A DLQ is not a retry policy. It receives exhausted failures; configure source and function behavior first.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5, 1.2.6, 1.2.7.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 1.2.1 | Understanding Lambda access to private VPC resources through subnets, security groups, DNS, and routes | VPC attachment is for private-resource access; it is not required for ordinary public AWS API calls. | A Lambda in a public subnet receives no public IP; a private-subnet function needs NAT plus a route for public internet egress. |
| 1.2.2 | Configuring environment variables, memory, concurrency, timeout, runtime, handler, layers, extensions, triggers, and destinations | Put nonsecret names in environment variables and runtime flags in AppConfig; use Secrets Manager for rotating secrets. | Raising timeout does not cure CPU pressure or downstream overload, and provisioned concurrency is for initialization latency rather than a queue backlog. |
| 1.2.3 | Handling event lifecycle and errors with code, Lambda Destinations, dead-letter queues, and source-specific retry behavior | Use Lambda Destinations when the receiver needs invocation metadata; use an SQS DLQ to isolate exhausted source records. | A DLQ is where terminal failures land, not a substitute for configuring retries or a visibility timeout. |
| 1.2.4 | Testing Lambda test code using AWS services and tools such as SAM | SAM local catches handler/package/event-shape mistakes; it cannot prove a VPC route or resource policy. | A bare JSON body is not an SQS `Records` event, so a happy-path local invoke is insufficient evidence. |
| 1.2.5 | Integrate Lambda with API Gateway, S3, EventBridge, SQS, DynamoDB Streams, and other AWS services using least privilege | Match the trigger to the caller contract and grant the function only its needed action on the specific bucket, table, queue, or bus. | Giving Lambda an IAM role does not automatically permit S3 or EventBridge to invoke it. |
| 1.2.6 | Tune Lambda by measuring duration, errors, throttles, memory use, initialization cost, and downstream limits | Increase memory for measured CPU-bound work; cap reserved concurrency or buffer with SQS when a database/provider is the bottleneck. | More provisioned concurrency reduces cold-start exposure but cannot make a slow SQL query fast. |
| 1.2.7 | Using Lambda for near-real-time transformation, validation, enrichment, and routing of event or stream records | Use Lambda for short near-real-time per-record work; use a durable workflow or larger processing service when work exceeds Lambda’s event/runtime model. | A failed batch can be replayed, so enrichment writes cannot assume exactly-once delivery. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Understanding Lambda access to private VPC resources through subnets, security groups, DNS, and routes | VPC attachment is for private-resource access; it is not required for ordinary public AWS API calls. | A Lambda in a public subnet receives no public IP; a private-subnet function needs NAT plus a route for public internet egress. |
| Configuring environment variables, memory, concurrency, timeout, runtime, handler, layers, extensions, triggers, and destinations | Put nonsecret names in environment variables and runtime flags in AppConfig; use Secrets Manager for rotating secrets. | Raising timeout does not cure CPU pressure or downstream overload, and provisioned concurrency is for initialization latency rather than a queue backlog. |
| Handling event lifecycle and errors with code, Lambda Destinations, dead-letter queues, and source-specific retry behavior | Use Lambda Destinations when the receiver needs invocation metadata; use an SQS DLQ to isolate exhausted source records. | A DLQ is where terminal failures land, not a substitute for configuring retries or a visibility timeout. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 1.2.1 — Understanding Lambda access to private VPC resources through subnets, security groups, DNS, and routes


**What it means**

Attach the Lambda to private subnets that can route to the database, allow the Lambda security group to reach the database security group on its port, and ensure VPC DNS can resolve the private endpoint.

> **Why it matters / exam signal:** A Lambda in a public subnet receives no public IP; a private-subnet function needs NAT plus a route for public internet egress.

**Build it**

1. Test one database query from the deployed function and inspect subnet routes, security-group rules, and DNS if it fails.
2. Verify **Understanding Lambda access to private VPC resources through subnets, security groups, DNS, and routes** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- VPC attachment is for private-resource access; it is not required for ordinary public AWS API calls.

**Avoid this**

- A Lambda in a public subnet receives no public IP; a private-subnet function needs NAT plus a route for public internet egress.

#### Skill 1.2.2 — Configuring environment variables, memory, concurrency, timeout, runtime, handler, layers, extensions, triggers, and destinations


**What it means**

Lambda memory also allocates CPU; timeout caps one invocation; reserved concurrency caps or reserves concurrent executions; layers add shared runtime dependencies; destinations receive asynchronous outcomes.

> **Why it matters / exam signal:** Raising timeout does not cure CPU pressure or downstream overload, and provisioned concurrency is for initialization latency rather than a queue backlog.

**Build it**

1. Declare handler, runtime, memory, timeout, trigger, and destination in SAM/CloudFormation, then invoke a real trigger-shaped fixture.
2. Verify **Configuring environment variables, memory, concurrency, timeout, runtime, handler, layers, extensions, triggers, and destinations** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Put nonsecret names in environment variables and runtime flags in AppConfig; use Secrets Manager for rotating secrets.

**Avoid this**

- Raising timeout does not cure CPU pressure or downstream overload, and provisioned concurrency is for initialization latency rather than a queue backlog.

#### Skill 1.2.3 — Handling event lifecycle and errors with code, Lambda Destinations, dead-letter queues, and source-specific retry behavior


**What it means**

API Gateway synchronous errors return to the caller; asynchronous Lambda invokes retry before an on-failure destination or DLQ; SQS/Kinesis/DynamoDB stream mappings own source retry and redelivery.

> **Why it matters / exam signal:** A DLQ is where terminal failures land, not a substitute for configuring retries or a visibility timeout.

**Build it**

1. Make each record idempotent and return `batchItemFailures` for supported partial-batch processing.
2. Verify **Handling event lifecycle and errors with code, Lambda Destinations, dead-letter queues, and source-specific retry behavior** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use Lambda Destinations when the receiver needs invocation metadata; use an SQS DLQ to isolate exhausted source records.

**Avoid this**

- A DLQ is where terminal failures land, not a substitute for configuring retries or a visibility timeout.

#### Skill 1.2.4 — Testing Lambda test code using AWS services and tools such as SAM


**What it means**

Unit-test business logic with fake dependencies, use `sam local invoke` with the actual API Gateway/SQS/EventBridge envelope, and run deployed integration tests for IAM and networking.

> **Why it matters / exam signal:** A bare JSON body is not an SQS `Records` event, so a happy-path local invoke is insufficient evidence.

**Build it**

1. Store a valid event and an invalid/duplicate event under `events/`, run both, and assert response plus durable state.
2. Verify **Testing Lambda test code using AWS services and tools such as SAM** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- SAM local catches handler/package/event-shape mistakes; it cannot prove a VPC route or resource policy.

**Avoid this**

- A bare JSON body is not an SQS `Records` event, so a happy-path local invoke is insufficient evidence.

#### Skill 1.2.5 — Integrate Lambda with API Gateway, S3, EventBridge, SQS, DynamoDB Streams, and other AWS services using least privilege


**What it means**

API Gateway invokes Lambda synchronously; S3 and EventBridge are asynchronous; SQS, DynamoDB Streams, and Kinesis use event source mappings that poll and batch.

> **Why it matters / exam signal:** Giving Lambda an IAM role does not automatically permit S3 or EventBridge to invoke it.

**Build it**

1. In IaC, add both the trigger permission/resource policy and the execution-role permission, then send a representative event.
2. Verify **Integrate Lambda with API Gateway, S3, EventBridge, SQS, DynamoDB Streams, and other AWS services using least privilege** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Match the trigger to the caller contract and grant the function only its needed action on the specific bucket, table, queue, or bus.

**Avoid this**

- Giving Lambda an IAM role does not automatically permit S3 or EventBridge to invoke it.

#### Skill 1.2.6 — Tune Lambda by measuring duration, errors, throttles, memory use, initialization cost, and downstream limits


**What it means**

Compare Duration, Errors, Throttles, ConcurrentExecutions, Max Memory Used, init duration, and downstream latency before changing a Lambda setting.

> **Why it matters / exam signal:** More provisioned concurrency reduces cold-start exposure but cannot make a slow SQL query fast.

**Build it**

1. Load-test two memory settings with the same payload and compare p95 duration and cost.
2. Verify **Tune Lambda by measuring duration, errors, throttles, memory use, initialization cost, and downstream limits** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Increase memory for measured CPU-bound work; cap reserved concurrency or buffer with SQS when a database/provider is the bottleneck.

**Avoid this**

- More provisioned concurrency reduces cold-start exposure but cannot make a slow SQL query fast.

#### Skill 1.2.7 — Using Lambda for near-real-time transformation, validation, enrichment, and routing of event or stream records


**What it means**

An event-source mapping batches stream or queue records into Lambda; the handler validates, enriches from an approved store, transforms, and routes only safe output.

> **Why it matters / exam signal:** A failed batch can be replayed, so enrichment writes cannot assume exactly-once delivery. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Decode each record, attach an idempotency/event ID, return partial failures, and publish a versioned output event.
2. Verify **Using Lambda for near-real-time transformation, validation, enrichment, and routing of event or stream records** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use Lambda for short near-real-time per-record work; use a durable workflow or larger processing service when work exceeds Lambda’s event/runtime model.

**Avoid this**

- A failed batch can be replayed, so enrichment writes cannot assume exactly-once delivery. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 3: Use data stores in application development
**Plain-language goal.** Choose a store and data model from the reads and writes the application must perform, then make cost and latency predictable.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A marketplace needs product lookup by ID, a seller’s products ordered by update time, popular-product reads under low latency, automatic expiration for temporary carts, and full-text product search.
```mermaid
flowchart LR
 A[Product API] --> C{Cache hit?}
 C -->|yes| R[Return product]
 C -->|no| D[(DynamoDB productId)]
 D --> C
 D --> G[GSI: category / updatedAt]
 D --> S[Stream or event]
 S --> O[OpenSearch index]
```
#### Decision table
| Access pattern | Model or service | Explanation |
|---|---|---|
| One item by known key | DynamoDB GetItem | Direct primary-key lookup |
| All seller products newest first | Partition key sellerId, sort key updatedAt; Query | Targeted partition and ordered range |
| Lookup by category | GSI with category key | Alternate access pattern needs alternate index |
| Search words/relevance | OpenSearch Service | Inverted-index search, not transactional source of truth |
| Repeated safe reads | ElastiCache | Low-latency cache with expiry/invalidation |
| Expire temporary data | DynamoDB TTL / S3 lifecycle | Managed lifecycle, not a cron deletion loop |
#### Implementation walkthrough
1. Write the access patterns before declaring a DynamoDB key. A partition key selects a collection; a sort key orders and filters within that collection.
2. Use a high-cardinality partition key such as seller ID or a deliberately distributed key. Avoid a low-cardinality key such as `status` when it concentrates writes.
3. Use Query when you know the partition key. Use Scan only for intentional table-wide work; a filter expression removes returned items after capacity has been consumed.
4. Create a GSI when the application must query a different partition key. A GSI has its own keys and can be eventually consistent; project only attributes the index needs.
5. Serialize application objects deliberately: preserve numeric/string types, validate input, use a schema version for evolving objects, and tolerate missing old fields.
6. Use cache-aside for safe repeated reads: read cache, load miss from authoritative store, populate cache, and invalidate or expire after a write.
#### Configuration mechanics
| Operation | Needs partition key? | Reads broad data? | Typical use |
|---|---:|---:|---|
| GetItem | Yes | No | Exact primary key |
| Query | Yes | No | One key collection/range |
| Scan | No | Yes | Administrative or exceptional bulk work |
| GSI Query | GSI partition key | No | Alternate lookup |
| Filter expression | Depends | It can | Refine result, not avoid reads |
#### What fails in production, and how to respond
- **Hot partition throttles:** Redistribute key design, add write sharding when genuinely required, and use SDK backoff. Increasing total capacity does not cure one hot key.
- **Customer sees stale value:** Choose strongly consistent DynamoDB reads only where the immediate latest value is required; otherwise eventual reads and cache expiry may be acceptable.
- **Expired cart still appears briefly:** TTL is asynchronous cleanup. The application should treat an item past its expiry timestamp as absent if immediate behavior matters.
#### Why tempting alternatives are wrong
- A Scan plus filter is not a substitute for a Query or GSI; it still reads broadly.
- OpenSearch is not normally the source of truth for transactions; synchronize it from a durable system of record.
- Caching every response without a safe key or invalidation plan can return another user’s data.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.3.5, 1.3.6, 1.3.7, 1.3.8, 1.3.9.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 1.3.1 | Understanding high-cardinality partition keys and balanced partition access | Design a key from the write/read access pattern; add deliberate write sharding only after a measured hot key. | More table capacity does not solve a single hot partition. |
| 1.3.2 | Understanding strongly consistent and eventually consistent database reads and their trade-offs | Request strong consistency only for an explicit read-after-write requirement such as an account-state confirmation. | GSIs do not provide strongly consistent reads, so an index cannot meet an immediate-latest-read requirement. |
| 1.3.3 | Understanding Query versus Scan operations and their capacity implications | Query a primary key or GSI for application traffic; reserve Scan for deliberate administrative/bulk work. | A filter expression is not an index and does not make a Scan inexpensive. |
| 1.3.4 | Understanding DynamoDB primary keys, sort keys, and secondary indexes from access patterns | Model each known access pattern before creating the table, using a GSI only when the application must query another partition dimension. | You cannot query a GSI with the base table’s key unless that key is in the index design. |
| 1.3.5 | Serialize and deserialize persistence data safely across application and schema changes | Use backward-compatible additive changes before destructive renames; migrate only when a new reader cannot safely support both shapes. | JSON-looking data can still lose numeric/type semantics if an SDK marshaller is used incorrectly. |
| 1.3.6 | Managing appropriate data stores with SDK operations, permissions, capacity, backups, and error handling | Use on-demand capacity for unpredictable traffic and provisioned/autoscaled capacity when the workload is known; use managed backups/PITR instead of application-copy scripts. | Broad `dynamodb:*` permissions are not a fix for an access pattern or capacity problem. |
| 1.3.7 | Managing data lifecycle with DynamoDB TTL, S3 lifecycle rules, and retention requirements | Use TTL for temporary items such as carts and S3 lifecycle for object retention/cost tiering. | TTL deletion is not immediate and is not a scheduling guarantee. |
| 1.3.8 | Using data caching services with safe keys, expiration, and invalidation | Cache repeated data that can be briefly stale; do not cache authorization-sensitive output without every response-varying dimension in the key. | A cache improves latency but does not replace DynamoDB as the source of truth. |
| 1.3.9 | Choose specialized stores such as OpenSearch Service based on search access patterns | Use OpenSearch for words/relevance/facets, not for a transactional GetItem lookup. | Search results can be stale or incomplete during indexing, so do not make the index the only transactional authority. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Understanding high-cardinality partition keys and balanced partition access | Design a key from the write/read access pattern; add deliberate write sharding only after a measured hot key. | More table capacity does not solve a single hot partition. |
| Understanding strongly consistent and eventually consistent database reads and their trade-offs | Request strong consistency only for an explicit read-after-write requirement such as an account-state confirmation. | GSIs do not provide strongly consistent reads, so an index cannot meet an immediate-latest-read requirement. |
| Understanding Query versus Scan operations and their capacity implications | Query a primary key or GSI for application traffic; reserve Scan for deliberate administrative/bulk work. | A filter expression is not an index and does not make a Scan inexpensive. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 1.3.1 — Understanding high-cardinality partition keys and balanced partition access


**What it means**

DynamoDB distributes a partition key’s items together, so a high-cardinality key such as `customerId` spreads load better than `status`.

> **Why it matters / exam signal:** More table capacity does not solve a single hot partition.

**Build it**

1. Graph consumed capacity and throttles by key pattern, then test a synthetic burst against the candidate key.
2. Verify **Understanding high-cardinality partition keys and balanced partition access** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Design a key from the write/read access pattern; add deliberate write sharding only after a measured hot key.

**Avoid this**

- More table capacity does not solve a single hot partition.

#### Skill 1.3.2 — Understanding strongly consistent and eventually consistent database reads and their trade-offs


**What it means**

A strongly consistent DynamoDB read returns the latest successful write from the table, while eventually consistent reads can briefly return an older replica value and cost less.

> **Why it matters / exam signal:** GSIs do not provide strongly consistent reads, so an index cannot meet an immediate-latest-read requirement.

**Build it**

1. Set `ConsistentRead=True` on the required base-table GetItem/Query path and test immediately after a write.
2. Verify **Understanding strongly consistent and eventually consistent database reads and their trade-offs** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Request strong consistency only for an explicit read-after-write requirement such as an account-state confirmation.

**Avoid this**

- GSIs do not provide strongly consistent reads, so an index cannot meet an immediate-latest-read requirement.

#### Skill 1.3.3 — Understanding Query versus Scan operations and their capacity implications


**What it means**

`Query` targets one partition key and can use a sort-key condition; `Scan` examines every item, and a filter removes results only after reads consume capacity.

> **Why it matters / exam signal:** A filter expression is not an index and does not make a Scan inexpensive.

**Build it**

1. Write the key condition first and examine `ConsumedCapacity` under realistic data volume.
2. Verify **Understanding Query versus Scan operations and their capacity implications** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Query a primary key or GSI for application traffic; reserve Scan for deliberate administrative/bulk work.

**Avoid this**

- A filter expression is not an index and does not make a Scan inexpensive.

#### Skill 1.3.4 — Understanding DynamoDB primary keys, sort keys, and secondary indexes from access patterns


**What it means**

A composite primary key groups related items by partition key and orders them by sort key; a GSI creates a separately queryable alternate key.

> **Why it matters / exam signal:** You cannot query a GSI with the base table’s key unless that key is in the index design.

**Build it**

1. For seller history, use `sellerId` plus `updatedAt` and query a date range; project only required GSI fields.
2. Verify **Understanding DynamoDB primary keys, sort keys, and secondary indexes from access patterns** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Model each known access pattern before creating the table, using a GSI only when the application must query another partition dimension.

**Avoid this**

- You cannot query a GSI with the base table’s key unless that key is in the index design.

#### Skill 1.3.5 — Serialize and deserialize persistence data safely across application and schema changes


**What it means**

Persist explicit types and a schema/version attribute so newer code can accept missing legacy fields and readers do not reinterpret old data.

> **Why it matters / exam signal:** JSON-looking data can still lose numeric/type semantics if an SDK marshaller is used incorrectly.

**Build it**

1. Round-trip a current object and a saved old-version fixture through serializer/deserializer tests.
2. Verify **Serialize and deserialize persistence data safely across application and schema changes** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use backward-compatible additive changes before destructive renames; migrate only when a new reader cannot safely support both shapes.

**Avoid this**

- JSON-looking data can still lose numeric/type semantics if an SDK marshaller is used incorrectly.

#### Skill 1.3.6 — Managing appropriate data stores with SDK operations, permissions, capacity, backups, and error handling


**What it means**

Application SDK calls require scoped IAM, chosen capacity mode, error handling, backups/recovery, and metrics that match the store.

> **Why it matters / exam signal:** Broad `dynamodb:*` permissions are not a fix for an access pattern or capacity problem.

**Build it**

1. Test an allowed operation, an intentional denied operation, and a throttled retry path.
2. Verify **Managing appropriate data stores with SDK operations, permissions, capacity, backups, and error handling** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use on-demand capacity for unpredictable traffic and provisioned/autoscaled capacity when the workload is known; use managed backups/PITR instead of application-copy scripts.

**Avoid this**

- Broad `dynamodb:*` permissions are not a fix for an access pattern or capacity problem.

#### Skill 1.3.7 — Managing data lifecycle with DynamoDB TTL, S3 lifecycle rules, and retention requirements


**What it means**

DynamoDB TTL marks items for asynchronous expiry from an epoch timestamp; S3 lifecycle rules transition or expire objects by age, prefix, or tag.

> **Why it matters / exam signal:** TTL deletion is not immediate and is not a scheduling guarantee.

**Build it**

1. Store an application expiry timestamp too when an expired cart must disappear immediately, and test lifecycle rules on a nonproduction prefix.
2. Verify **Managing data lifecycle with DynamoDB TTL, S3 lifecycle rules, and retention requirements** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use TTL for temporary items such as carts and S3 lifecycle for object retention/cost tiering.

**Avoid this**

- TTL deletion is not immediate and is not a scheduling guarantee.

#### Skill 1.3.8 — Using data caching services with safe keys, expiration, and invalidation


**What it means**

Cache-aside reads a tenant-safe key, loads a miss from the authoritative store, writes a bounded-TTL cache entry, and invalidates/updates after a write.

> **Why it matters / exam signal:** A cache improves latency but does not replace DynamoDB as the source of truth.

**Build it**

1. Track hit rate, miss latency, and stale-read behavior while exercising write invalidation.
2. Verify **Using data caching services with safe keys, expiration, and invalidation** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Cache repeated data that can be briefly stale; do not cache authorization-sensitive output without every response-varying dimension in the key.

**Avoid this**

- A cache improves latency but does not replace DynamoDB as the source of truth.

#### Skill 1.3.9 — Choose specialized stores such as OpenSearch Service based on search access patterns


**What it means**

OpenSearch indexes analyzed text for relevance, token matching, filters, and aggregations; DynamoDB is the system of record for predictable key access.

> **Why it matters / exam signal:** Search results can be stale or incomplete during indexing, so do not make the index the only transactional authority. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Replicate versioned product changes from the durable source to an index and tolerate index lag in the UI.
2. Verify **Choose specialized stores such as OpenSearch Service based on search access patterns** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use OpenSearch for words/relevance/facets, not for a transactional GetItem lookup.

**Avoid this**

- Search results can be stale or incomplete during indexing, so do not make the index the only transactional authority. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

## Domain 2: Security (26%)
### Task 1: Implement authentication and/or authorization for applications and AWS services
**Plain-language goal.** Prove identity, authorize the requested action, and use temporary AWS credentials instead of long-lived keys.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A customer signs in to a shopping application through Cognito. The browser sends a JWT to API Gateway. The API must only return records for the customer’s tenant. The Lambda uses its execution role to read DynamoDB, and a reporting service in another account assumes a narrowly scoped role.
```mermaid
sequenceDiagram
 participant User
 participant Cognito
 participant API as API Gateway
 participant Fn as Lambda
 participant DB as DynamoDB
 User->>Cognito: Sign in
 Cognito-->>User: JWT
 User->>API: HTTPS + Bearer JWT
 API->>API: Validate issuer/audience/signature
 API->>Fn: Claims and request
 Fn->>Fn: Authorize tenant/action
 Fn->>DB: Query with execution role
 DB-->>Fn: Tenant-scoped data
```
#### Decision table
| Need | Correct control | Why |
|---|---|---|
| Application-user sign-in | Cognito user pool / federation | Issues user identity tokens |
| API caller proof | Validate JWT or API authorizer | Token must be valid before handler trusts claims |
| Workload calls AWS | IAM execution role | Temporary credentials supplied automatically |
| Cross-account workload access | STS AssumeRole + trust policy | Temporary delegated credentials |
| Tenant record isolation | Claim-aware application authorization and data condition | Authentication alone is not permission to all records |
| Service-to-service call | Service role / signed AWS request | Avoid passing user secrets between services |
#### Implementation walkthrough
1. Separate authentication from authorization. Authentication establishes a principal; authorization checks action, resource, tenant, ownership, and context.
2. Validate bearer token signature, issuer, audience, expiry, and relevant claims at a trusted boundary. Use HTTPS because anyone holding an unprotected bearer token can present it.
3. Use the SDK default credential provider chain in AWS. Lambda and EC2 should receive temporary role credentials; do not embed access key pairs.
4. For AssumeRole, configure both sides: the target role trust policy allows the caller, and the caller has permission to call `sts:AssumeRole`.
5. Tie DynamoDB keys or query conditions to a verified tenant claim. Never accept a tenant identifier from an untrusted request body without comparing it to the authenticated context.
6. Use least privilege with action, resource, and condition. Test denied cases as carefully as allowed cases.
#### Configuration mechanics
| Identity | Used by | Credential lifetime model | Do not confuse with |
|---|---|---|---|
| Cognito user token | Application user | Expiring JWT | AWS workload role |
| Lambda execution role | Lambda code | Temporary AWS credentials | End-user identity |
| STS assumed role | Delegated/cross-account caller | Temporary AWS credentials | IAM user access key |
| Resource policy | Resource-side trust | Grants/limits principal | Application tenant check |
#### What fails in production, and how to respond
- **Valid user reads another tenant:** The token only proves identity. Enforce tenant ownership in authorization and the data access pattern.
- **Cross-account AssumeRole is denied:** Inspect target trust policy and caller identity policy; both must permit the relationship.
- **Leaked access key in source:** Revoke or rotate it, remove it from history where required, and migrate workload code to a role.
#### Why tempting alternatives are wrong
- An IAM user for every mobile app user is an operational and security anti-pattern; use application identity/federation.
- A valid JWT does not automatically grant DynamoDB access or tenant-level authorization.
- Putting AWS keys in a browser, Lambda code, or repository creates long-lived credentials outside AWS rotation controls.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5, 2.1.6, 2.1.7, 2.1.8.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 2.1.1 | Using identity providers such as Amazon Cognito and IAM federation for federated access | Use Cognito/federation for browser or mobile users and IAM roles for workloads calling AWS APIs. | Creating IAM users for every app customer is not the scalable application-authentication design. |
| 2.1.2 | Secure applications with bearer-token validation and protected transport | Use an API Gateway/Cognito authorizer for boundary validation and retain application authorization for tenant ownership decisions. | Decoding a JWT without verifying its signature is not authentication, and TLS does not authorize the caller. |
| 2.1.3 | Configuring programmatic AWS access with credential providers and temporary credentials | Use the default provider chain in workloads; use a profile only for local development, never hard-coded access keys in deployed code. | Environment variables can carry temporary credentials locally but are not a reason to store long-lived IAM user keys. |
| 2.1.4 | Make authenticated AWS service calls with valid signed requests and scoped permissions | Use SDK/service integrations for AWS calls rather than inventing shared API secrets. | A valid signature proves the caller identity; it does not bypass an explicit deny or missing resource permission. |
| 2.1.5 | Assume IAM roles through STS using a matching trust policy and caller permission | Use AssumeRole for cross-account delegation or a distinct privilege boundary, not copied credentials. | Adding only `sts:AssumeRole` to the caller cannot overcome a missing target trust relationship. |
| 2.1.6 | Understanding least-privilege permissions for IAM principals with identity and resource policies | Grant the smallest action/resource/condition set and use a resource policy for cross-account/resource-side access. | `Action: *` or `Resource: *` is rarely least privilege and can conceal the missing condition the question tests. |
| 2.1.7 | Implementing fine-grained application authorization using claims, ownership, tenant context, and resource checks | Enforce ownership/tenant rules in the backend even if the UI hides another tenant’s controls. | A valid JWT is not permission to read every record. |
| 2.1.8 | Handling cross-service authentication in microservices through service identities and signed AWS calls | Use service roles/SigV4 for AWS-to-AWS access; propagate only minimal user claims when downstream authorization truly needs them. | Passing a shared static secret between services defeats rotation and audit boundaries. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Using identity providers such as Amazon Cognito and IAM federation for federated access | Use Cognito/federation for browser or mobile users and IAM roles for workloads calling AWS APIs. | Creating IAM users for every app customer is not the scalable application-authentication design. |
| Secure applications with bearer-token validation and protected transport | Use an API Gateway/Cognito authorizer for boundary validation and retain application authorization for tenant ownership decisions. | Decoding a JWT without verifying its signature is not authentication, and TLS does not authorize the caller. |
| Configuring programmatic AWS access with credential providers and temporary credentials | Use the default provider chain in workloads; use a profile only for local development, never hard-coded access keys in deployed code. | Environment variables can carry temporary credentials locally but are not a reason to store long-lived IAM user keys. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 2.1.1 — Using identity providers such as Amazon Cognito and IAM federation for federated access


**What it means**

Cognito user pools authenticate application users and issue JWTs; federation maps an external identity provider into an AWS-recognized identity flow.

> **Why it matters / exam signal:** Creating IAM users for every app customer is not the scalable application-authentication design.

**Build it**

1. Configure redirect/callback URLs and token validation, then test both a signed-in user and a denied unauthenticated request.
2. Verify **Using identity providers such as Amazon Cognito and IAM federation for federated access** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use Cognito/federation for browser or mobile users and IAM roles for workloads calling AWS APIs.

**Avoid this**

- Creating IAM users for every app customer is not the scalable application-authentication design.

#### Skill 2.1.2 — Secure applications with bearer-token validation and protected transport


**What it means**

A bearer JWT must be validated for signature, issuer, audience, expiry, and relevant claims before the handler treats it as identity; HTTPS protects its transport.

> **Why it matters / exam signal:** Decoding a JWT without verifying its signature is not authentication, and TLS does not authorize the caller.

**Build it**

1. Reject an expired, wrong-audience, and missing token in integration tests.
2. Verify **Secure applications with bearer-token validation and protected transport** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use an API Gateway/Cognito authorizer for boundary validation and retain application authorization for tenant ownership decisions.

**Avoid this**

- Decoding a JWT without verifying its signature is not authentication, and TLS does not authorize the caller.

#### Skill 2.1.3 — Configuring programmatic AWS access with credential providers and temporary credentials


**What it means**

AWS SDK credential providers obtain temporary credentials from Lambda/EC2/ECS roles or STS and refresh them automatically.

> **Why it matters / exam signal:** Environment variables can carry temporary credentials locally but are not a reason to store long-lived IAM user keys.

**Build it**

1. Remove explicit credential arguments, attach the narrow execution role, and test with `sts:GetCallerIdentity`.
2. Verify **Configuring programmatic AWS access with credential providers and temporary credentials** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use the default provider chain in workloads; use a profile only for local development, never hard-coded access keys in deployed code.

**Avoid this**

- Environment variables can carry temporary credentials locally but are not a reason to store long-lived IAM user keys.

#### Skill 2.1.4 — Make authenticated AWS service calls with valid signed requests and scoped permissions


**What it means**

AWS SDKs sign requests with SigV4 using the active role credentials, and IAM evaluates action, resource, and conditions.

> **Why it matters / exam signal:** A valid signature proves the caller identity; it does not bypass an explicit deny or missing resource permission.

**Build it**

1. Scope a role to an exact S3 prefix or DynamoDB table and verify both permitted and forbidden calls.
2. Verify **Make authenticated AWS service calls with valid signed requests and scoped permissions** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use SDK/service integrations for AWS calls rather than inventing shared API secrets.

**Avoid this**

- A valid signature proves the caller identity; it does not bypass an explicit deny or missing resource permission.

#### Skill 2.1.5 — Assume IAM roles through STS using a matching trust policy and caller permission


**What it means**

`sts:AssumeRole` issues temporary credentials only when the caller policy permits assume-role and the target role trust policy trusts that caller.

> **Why it matters / exam signal:** Adding only `sts:AssumeRole` to the caller cannot overcome a missing target trust relationship.

**Build it**

1. Set a specific principal/condition in the target trust policy, call STS, then use the returned session for the target action.
2. Verify **Assume IAM roles through STS using a matching trust policy and caller permission** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use AssumeRole for cross-account delegation or a distinct privilege boundary, not copied credentials.

**Avoid this**

- Adding only `sts:AssumeRole` to the caller cannot overcome a missing target trust relationship.

#### Skill 2.1.6 — Understanding least-privilege permissions for IAM principals with identity and resource policies


**What it means**

Identity policies grant a principal actions, while resource policies can grant or restrict access at S3, SQS, KMS, and similar resource boundaries; explicit deny wins.

> **Why it matters / exam signal:** `Action: *` or `Resource: *` is rarely least privilege and can conceal the missing condition the question tests.

**Build it**

1. Use IAM policy simulation or a denied integration test before broadening a statement.
2. Verify **Understanding least-privilege permissions for IAM principals with identity and resource policies** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Grant the smallest action/resource/condition set and use a resource policy for cross-account/resource-side access.

**Avoid this**

- `Action: *` or `Resource: *` is rarely least privilege and can conceal the missing condition the question tests.

#### Skill 2.1.7 — Implementing fine-grained application authorization using claims, ownership, tenant context, and resource checks


**What it means**

Authentication supplies claims; authorization maps those claims to an action and resource, such as requiring `tenantId` from the verified token to equal the item’s tenant partition.

> **Why it matters / exam signal:** A valid JWT is not permission to read every record.

**Build it**

1. Derive the partition key from claims, reject a body/path tenant mismatch, and test cross-tenant access returns 403/empty by policy.
2. Verify **Implementing fine-grained application authorization using claims, ownership, tenant context, and resource checks** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Enforce ownership/tenant rules in the backend even if the UI hides another tenant’s controls.

**Avoid this**

- A valid JWT is not permission to read every record.

#### Skill 2.1.8 — Handling cross-service authentication in microservices through service identities and signed AWS calls


**What it means**

Each microservice calls AWS with its own execution/task role and signed request, leaving user JWTs for user context rather than workload credentials.

> **Why it matters / exam signal:** Passing a shared static secret between services defeats rotation and audit boundaries. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Give the producer permission to publish to its bus/queue and the consumer its own data permission, then test each boundary.
2. Verify **Handling cross-service authentication in microservices through service identities and signed AWS calls** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use service roles/SigV4 for AWS-to-AWS access; propagate only minimal user claims when downstream authorization truly needs them.

**Avoid this**

- Passing a shared static secret between services defeats rotation and audit boundaries. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 2: Implement encryption by using AWS services
**Plain-language goal.** Protect data in transit and at rest, then ensure the right principal can use the key or certificate without exposing key material.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A document API accepts HTTPS uploads, stores objects with SSE-KMS, and lets a compliance role in another AWS account decrypt approved files. Internal services use private certificates for mutual trust.

```mermaid
flowchart LR
 C[Client over TLS] --> S3[S3 object encrypted with SSE-KMS]
 R[Compliance role in Account B] -->|s3:GetObject| S3
 R -->|kms:Decrypt: IAM + key policy| K[KMS key in Account A]
 I[Internal service] --> PCA[Private CA certificate]
```
#### Decision table
| Requirement | Choose | Why |
|---|---|---|
| Protect network traffic | TLS/HTTPS | Encrypts data while moving |
| Encrypt object after AWS receives it | Server-side encryption, often SSE-KMS | Service performs encryption and integrates with KMS |
| Encrypt before cloud receives plaintext | Client-side encryption | Application controls plaintext boundary |
| Private internal PKI | AWS Private CA | Issues and manages private certificates |
| Cross-account KMS use | Key policy plus caller IAM permission | KMS authorization needs both sides considered |
| Planned KMS key lifecycle | Rotation configuration | New key material/managed rotation behavior, not application rewrite |
#### Implementation walkthrough
1. Use TLS for every client and service endpoint that carries sensitive data. Encryption at rest does not encrypt traffic; TLS does not encrypt stored copies.
2. Choose server-side encryption when AWS can handle plaintext within the service boundary and you need managed integration. Choose client-side encryption when plaintext must never reach the service unencrypted.
3. For SSE-KMS, give the application role access to the S3 object and required KMS action. KMS permissions and S3 permissions solve different gates.
4. A key policy controls key access. Cross-account designs must explicitly permit the external principal or account path and the caller also needs a suitable IAM policy.
5. Use ACM for appropriate public certificate management and AWS Private CA concepts for private certificates. Store private keys safely and never commit SSH keys.
6. Understand rotation as a key management control. Rotating material does not retroactively turn an unauthorized principal into an authorized one.
#### What fails in production, and how to respond
- **S3 read works but decrypt is denied:** The caller may have S3 permission without KMS permission; inspect IAM policy and KMS key policy.
- **HTTPS client rejects certificate:** Check certificate trust chain, hostname, validity, and whether public versus private trust is appropriate.
- **Sensitive data crosses a service in plaintext:** Add TLS; at-rest encryption only protects media after persistence.
#### Why tempting alternatives are wrong
- SSE-S3, SSE-KMS, and client-side encryption are not interchangeable when the question requires control of KMS keys or no plaintext at the service boundary.
- A KMS key policy alone does not grant S3 object access.
- A certificate is not an encryption-at-rest mechanism, and an SSH key is not a TLS certificate.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.2.7.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 2.2.1 | Understanding encryption at rest and in transit as separate protections | Apply both when the requirement says protect uploads/downloads and stored objects. | SSE-KMS does not encrypt traffic, and a TLS certificate does not encrypt an object at rest. |
| 2.2.2 | Understanding certificate issuance, trust, renewal, and private certificate management including AWS Private CA | Use ACM/public trust for public endpoints and Private CA for internal PKI/mTLS scenarios. | An SSH key pair is for administrative access, not a substitute for a TLS certificate. |
| 2.2.3 | Compare client-side encryption with server-side encryption | Prefer SSE-S3/SSE-KMS for managed service integration; choose client-side encryption when plaintext must not cross the cloud service boundary. | Choosing client-side encryption adds key distribution/rotation complexity and is not required merely because data is sensitive. |
| 2.2.4 | Using encryption keys to encrypt or decrypt data through AWS KMS APIs and permissions | Use service-integrated SSE-KMS for supported storage and direct KMS APIs/envelope encryption only when application-side control is needed. | S3 permission and KMS permission are separate authorization checks. |
| 2.2.5 | Generate and manage certificates and SSH keys securely for development | **ACM** for AWS-integrated public TLS where managed issuance/renewal is available. | Base64 encoding is not encryption or key management. Do not commit certificates, SSH private keys, or a “temporary” key file; use scoped access, audited rotation, and a tested replacement workflow instead. |
| 2.2.6 | Using encryption across account boundaries with KMS key policy and IAM permission design | Grant the specific external role/account rather than making a key broadly usable. | Bucket access alone produces AccessDenied when KMS decryption is not authorized. |
| 2.2.7 | Enable and disable key rotation according to the key and compliance requirement | Enable rotation when policy/compliance requires periodic material rotation; do not confuse it with deleting/recreating a key. | Rotation does not grant a new principal access or repair a missing key policy. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Understanding encryption at rest and in transit as separate protections | Apply both when the requirement says protect uploads/downloads and stored objects. | SSE-KMS does not encrypt traffic, and a TLS certificate does not encrypt an object at rest. |
| Understanding certificate issuance, trust, renewal, and private certificate management including AWS Private CA | Use ACM/public trust for public endpoints and Private CA for internal PKI/mTLS scenarios. | An SSH key pair is for administrative access, not a substitute for a TLS certificate. |
| Compare client-side encryption with server-side encryption | Prefer SSE-S3/SSE-KMS for managed service integration; choose client-side encryption when plaintext must not cross the cloud service boundary. | Choosing client-side encryption adds key distribution/rotation complexity and is not required merely because data is sensitive. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 2.2.1 — Understanding encryption at rest and in transit as separate protections


**What it means**

TLS encrypts data while it moves over a connection; server-side/client-side encryption protects persisted bytes, with distinct controls and threats.

> **Why it matters / exam signal:** SSE-KMS does not encrypt traffic, and a TLS certificate does not encrypt an object at rest.

**Build it**

1. Enforce HTTPS at the endpoint and set bucket/table encryption, then verify a non-TLS request is rejected where policy requires it.
2. Verify **Understanding encryption at rest and in transit as separate protections** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Apply both when the requirement says protect uploads/downloads and stored objects.

**Avoid this**

- SSE-KMS does not encrypt traffic, and a TLS certificate does not encrypt an object at rest.

#### Skill 2.2.2 — Understanding certificate issuance, trust, renewal, and private certificate management including AWS Private CA


**What it means**

A certificate binds a public key to a hostname/identity through a trusted issuer; clients validate hostname, validity period, and chain. AWS Private CA issues certificates trusted only by managed internal trust stores.

> **Why it matters / exam signal:** An SSH key pair is for administrative access, not a substitute for a TLS certificate.

**Build it**

1. Automate renewal/deployment and test a client with the intended trust chain.
2. Verify **Understanding certificate issuance, trust, renewal, and private certificate management including AWS Private CA** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use ACM/public trust for public endpoints and Private CA for internal PKI/mTLS scenarios.

**Avoid this**

- An SSH key pair is for administrative access, not a substitute for a TLS certificate.

#### Skill 2.2.3 — Compare client-side encryption with server-side encryption


**What it means**

Server-side encryption lets AWS service receive plaintext then encrypt it; client-side encryption encrypts before the service receives data and leaves key/material handling to the application.

> **Why it matters / exam signal:** Choosing client-side encryption adds key distribution/rotation complexity and is not required merely because data is sensitive.

**Build it**

1. For SSE-KMS, set the key and test object read plus decrypt permissions.
2. Verify **Compare client-side encryption with server-side encryption** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Prefer SSE-S3/SSE-KMS for managed service integration; choose client-side encryption when plaintext must not cross the cloud service boundary.

**Avoid this**

- Choosing client-side encryption adds key distribution/rotation complexity and is not required merely because data is sensitive.

#### Skill 2.2.4 — Using encryption keys to encrypt or decrypt data through AWS KMS APIs and permissions


**What it means**

KMS encrypt/decrypt APIs use keys without exposing key material; envelope encryption commonly encrypts data with a data key protected by a KMS key.

> **Why it matters / exam signal:** S3 permission and KMS permission are separate authorization checks.

**Build it**

1. Grant the role `kms:Decrypt`/`GenerateDataKey` as needed and include an encryption context consistently.
2. Verify **Using encryption keys to encrypt or decrypt data through AWS KMS APIs and permissions** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use service-integrated SSE-KMS for supported storage and direct KMS APIs/envelope encryption only when application-side control is needed.

**Avoid this**

- S3 permission and KMS permission are separate authorization checks.

#### Skill 2.2.5 — Generate and manage certificates and SSH keys securely for development

**What it means**

TLS certificates prove that a hostname is controlled by the server presenting it. A browser trusts the certificate only when it can validate the hostname and chain through a trusted issuing CA; the certificate's private key must never be exposed. SSH uses a separate public/private key pair to authenticate an administrator or automation client.

> **Why it matters / exam signal:** “Public HTTPS endpoint with automatic renewal” points to ACM on an integrated AWS endpoint. “Private internal PKI” points to ACM Private CA. An imported certificate can be used when an external CA issued it, but AWS cannot automatically renew that imported certificate.

```mermaid
flowchart LR
  B[Browser] -->|TLS for api.example.com| CF[CloudFront or ALB]
  CF -->|ACM public certificate| TLS[Managed TLS termination]
  TLS --> API[API Gateway / application]
  API -->|runtime role| SM[Secrets Manager]
  Admin[Administrator] -->|public key authorized| Host[EC2 or bastion]
  Admin -.private SSH key stays on approved client.-> Host
```

**HTTPS and key choice**

| Requirement | Choose | Operational result | Avoid |
|---|---|---|---|
| Public ALB, CloudFront, or API endpoint | ACM public certificate in the required integration Region | ACM provisions and renews eligible public certificates | Manually copying a public certificate and key into source control |
| Private service names and internal trust chain | ACM Private CA | Your organization issues and revokes private certificates | Treating a private CA certificate as browser-public trust |
| Existing certificate from an external CA | Import into ACM | AWS endpoint can use it, but you own renewal and replacement | Assuming ACM renews an imported certificate |
| Administrative host access | SSH public key on the host; private key in an approved user/device key store | Server verifies possession without receiving the private key | Sharing one private key or placing it in a repository |

**Build it**

1. Request or import a certificate for the exact DNS name. Validate public-domain control, attach the ACM certificate to the CloudFront distribution, ALB listener, or API custom domain, and test the hostname and full chain from a client.
2. For internal service TLS, issue from ACM Private CA only when the organization needs its own private trust hierarchy; distribute the private root/intermediate trust only to managed clients that must trust it.
3. Rotate before expiry. For imported certificates, monitor the expiration date, import the replacement, update the endpoint association if required, and test the new chain. For SSH, create distinct user or automation key pairs, authorize only public keys, remove a departed user's public key, and rotate immediately after suspected exposure.
4. During an incident such as a browser hostname error or a leaked SSH private key, first remove the affected endpoint/key authorization, issue a replacement, validate access with the new material, and inspect logs for unauthorized use. Never paste a private key into tickets, environment files, or logs.

**Choose this**

- **ACM** for AWS-integrated public TLS where managed issuance/renewal is available.
- **ACM Private CA** for an internal PKI, private names, and controlled client trust.
- **Imported ACM certificate** when an external CA must remain the issuer and the team accepts the renewal runbook.
- **SSH key pairs** for host administration: public material on the host, private material protected by the individual operator or approved secret/key-management process.

**Avoid this**

- Base64 encoding is not encryption or key management. Do not commit certificates, SSH private keys, or a “temporary” key file; use scoped access, audited rotation, and a tested replacement workflow instead.

#### Skill 2.2.6 — Using encryption across account boundaries with KMS key policy and IAM permission design


**What it means**

Cross-account SSE-KMS access requires an S3/bucket permission path and KMS authorization via the key policy plus appropriate IAM permission for the external role.

> **Why it matters / exam signal:** Bucket access alone produces AccessDenied when KMS decryption is not authorized.

**Build it**

1. Test `GetObject` and decrypt as the target role and inspect CloudTrail/KMS errors for the failed gate.
2. Verify **Using encryption across account boundaries with KMS key policy and IAM permission design** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Grant the specific external role/account rather than making a key broadly usable.

**Avoid this**

- Bucket access alone produces AccessDenied when KMS decryption is not authorized.

#### Skill 2.2.7 — Enable and disable key rotation according to the key and compliance requirement


**What it means**

KMS rotation changes backing key material according to the key type/configuration while preserving the logical key identifier used by applications.

> **Why it matters / exam signal:** Rotation does not grant a new principal access or repair a missing key policy. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Document the key owner, rotation setting, grants/policies, and recovery plan, then verify the application still decrypts existing data.
2. Verify **Enable and disable key rotation according to the key and compliance requirement** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Enable rotation when policy/compliance requires periodic material rotation; do not confuse it with deleting/recreating a key.

**Avoid this**

- Rotation does not grant a new principal access or repair a missing key policy. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 3: Manage sensitive data in application code
**Plain-language goal.** Classify sensitive values, retrieve secrets at runtime, prevent disclosure, and enforce tenant boundaries in the backend.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A healthcare scheduling service stores database credentials in Secrets Manager, logs request IDs but not patient notes, shows only the last four digits of an insurance identifier, and requires every query to use the tenant from a verified user claim.
#### Decision table
| Data/control | Correct action | Why |
|---|---|---|
| Database password/API token | Secrets Manager | Central retrieval and rotation workflows |
| Sensitive configuration | Encrypted environment variable with restricted access | Configuration is not source code, but still needs protection |
| PII/PHI in logs | Sanitize or omit | Logs spread to operators and tools |
| User-facing confirmation | Mask value | Reveal minimum useful portion |
| Multi-tenant record | Bind query to verified tenant claim | Prevent horizontal access |
| Nonsecret config | Parameter/AppConfig where suitable | Do not use a secret store for every ordinary setting |
#### Implementation walkthrough
1. Classify fields before coding: PII identifies a person; PHI is health-related protected information. Classification changes access, logging, encryption, retention, and response design.
2. Retrieve secrets at runtime through a permitted role. Cache safely only as long as rotation and outage requirements allow; never print the fetched object on errors.
3. Treat environment variables as configuration. Encrypt sensitive values with KMS and restrict who can view function configuration or decrypt the key.
4. Create a logging allowlist: request ID, route, safe outcome, duration, and error class. Redact tokens, passwords, full identifiers, and payload fields not needed for diagnosis.
5. Mask for display, sanitize for output/logging, and authorize for access. These are three distinct controls.
6. Make the tenant context server-derived from a validated identity and include it in the partition key, condition, or query constraint.
#### What fails in production, and how to respond
- **Secret appears in a stack trace:** Remove it from error serialization, rotate it, and review logs/observability pipelines for disclosure.
- **Tenant ID is supplied in JSON body:** Treat it as untrusted; compare or replace it with token-derived tenant context.
- **Rotated database secret breaks clients:** Use a retrieval/refresh strategy and managed rotation-compatible connection handling rather than hard-coding a cached password forever.
#### Why tempting alternatives are wrong
- Base64 encoding is not encryption.
- Masking a response does not stop an unauthorized backend read.
- A secret in source control is not made safe by adding an environment variable with the same value.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 2.3.1, 2.3.2, 2.3.3, 2.3.4, 2.3.5, 2.3.6.

```mermaid
flowchart LR
  Dev[Developer] -->|runtime role| App[Application]
  App --> SM[Secrets Manager]
  App --> PS[Parameter Store SecureString]
  SM -->|rotation| DB[(Database credential)]
  App -.never logs.-> Logs[CloudWatch Logs]
```

#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 2.3.1 | Understanding classification including PII and PHI | Classify before selecting logs, retention, access, and encryption controls. | A field can be sensitive even when it is not a password, so ‘not a secret’ does not mean safe to log. |
| 2.3.2 | Encrypt environment variables containing sensitive data and restrict their access | Put rotating credentials in Secrets Manager; use encrypted environment variables for sensitive configuration that fits their lifecycle. | Encryption at rest does not make a secret safe if broad console/API read permission remains. |
| 2.3.3 | Using secret management services to secure sensitive data | Use it for database credentials/API tokens that rotate; use Parameter Store/AppConfig for ordinary nonsecret configuration where appropriate. | A secret copied into code or a deployment template is no longer managed securely. |
| 2.3.4 | Sanitize sensitive data before logs, errors, analytics, or external calls | Sanitize before the logger, analytics client, exception serializer, or external webhook—not after a sink already received the value. | Debug logging is not exempt from privacy controls. |
| 2.3.5 | Implementing application-level masking and sanitization for least disclosure | Mask an insurance identifier in confirmation UI and omit it entirely from an operator log unless needed. | Masking output cannot repair an unauthorized database query. |
| 2.3.6 | Implementing multi-tenant access patterns that bind authorization and data access to verified tenant context | Use a tenant-prefixed partition key or policy condition aligned to the verified tenant; do not rely on separate frontend routes. | UI filtering and client-provided tenant IDs are not authorization controls. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Understanding classification including PII and PHI | Classify before selecting logs, retention, access, and encryption controls. | A field can be sensitive even when it is not a password, so ‘not a secret’ does not mean safe to log. |
| Encrypt environment variables containing sensitive data and restrict their access | Put rotating credentials in Secrets Manager; use encrypted environment variables for sensitive configuration that fits their lifecycle. | Encryption at rest does not make a secret safe if broad console/API read permission remains. |
| Using secret management services to secure sensitive data | Use it for database credentials/API tokens that rotate; use Parameter Store/AppConfig for ordinary nonsecret configuration where appropriate. | A secret copied into code or a deployment template is no longer managed securely. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 2.3.1 — Understanding classification including PII and PHI


**What it means**

PII identifies or can identify a person; PHI is health information tied to a person and carries stricter handling obligations in relevant systems.

> **Why it matters / exam signal:** A field can be sensitive even when it is not a password, so ‘not a secret’ does not mean safe to log.

**Build it**

1. Maintain a field inventory marking identifiers, health fields, secrets, and safe operational fields; test serializers/loggers against it.
2. Verify **Understanding classification including PII and PHI** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Classify before selecting logs, retention, access, and encryption controls.

**Avoid this**

- A field can be sensitive even when it is not a password, so ‘not a secret’ does not mean safe to log.

#### Skill 2.3.2 — Encrypt environment variables containing sensitive data and restrict their access


**What it means**

Lambda environment variables are encrypted at rest with a KMS key, but principals able to read configuration or decrypt can still obtain values.

> **Why it matters / exam signal:** Encryption at rest does not make a secret safe if broad console/API read permission remains.

**Build it**

1. Restrict `lambda:GetFunctionConfiguration` and KMS decrypt, and confirm logs/error handling never echo variables.
2. Verify **Encrypt environment variables containing sensitive data and restrict their access** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Put rotating credentials in Secrets Manager; use encrypted environment variables for sensitive configuration that fits their lifecycle.

**Avoid this**

- Encryption at rest does not make a secret safe if broad console/API read permission remains.

#### Skill 2.3.3 — Using secret management services to secure sensitive data


**What it means**

Secrets Manager stores sensitive values, applies resource/KMS controls, and supports rotation workflows; the workload role retrieves the current version at runtime.

> **Why it matters / exam signal:** A secret copied into code or a deployment template is no longer managed securely.

**Build it**

1. Call `GetSecretValue` through the role, cache with a rotation-aware TTL, and test refresh after rotation.
2. Verify **Using secret management services to secure sensitive data** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use it for database credentials/API tokens that rotate; use Parameter Store/AppConfig for ordinary nonsecret configuration where appropriate.

**Avoid this**

- A secret copied into code or a deployment template is no longer managed securely.

#### Skill 2.3.4 — Sanitize sensitive data before logs, errors, analytics, or external calls


**What it means**

A logging boundary should emit an allowlist such as request ID, route, outcome, duration, and safe error class, while redacting tokens, passwords, and payload fields.

> **Why it matters / exam signal:** Debug logging is not exempt from privacy controls.

**Build it**

1. Add a test that sends a token/identifier and asserts it does not appear in captured logs.
2. Verify **Sanitize sensitive data before logs, errors, analytics, or external calls** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Sanitize before the logger, analytics client, exception serializer, or external webhook—not after a sink already received the value.

**Avoid this**

- Debug logging is not exempt from privacy controls.

#### Skill 2.3.5 — Implementing application-level masking and sanitization for least disclosure


**What it means**

Masking shows a minimum useful portion to a legitimate viewer; sanitization removes/escapes dangerous or private content; authorization decides whether data may be read at all.

> **Why it matters / exam signal:** Masking output cannot repair an unauthorized database query.

**Build it**

1. Centralize response/log formatting and test that full identifiers and tokens never leave the boundary.
2. Verify **Implementing application-level masking and sanitization for least disclosure** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Mask an insurance identifier in confirmation UI and omit it entirely from an operator log unless needed.

**Avoid this**

- Masking output cannot repair an unauthorized database query.

#### Skill 2.3.6 — Implementing multi-tenant access patterns that bind authorization and data access to verified tenant context


**What it means**

The service derives tenant context from validated claims and constrains data keys/conditions to that value, preventing a caller-chosen ID from crossing tenants.

> **Why it matters / exam signal:** UI filtering and client-provided tenant IDs are not authorization controls. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Replace body `tenantId` with token context and run a negative test requesting another tenant’s item.
2. Verify **Implementing multi-tenant access patterns that bind authorization and data access to verified tenant context** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use a tenant-prefixed partition key or policy condition aligned to the verified tenant; do not rely on separate frontend routes.

**Avoid this**

- UI filtering and client-provided tenant IDs are not authorization controls. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

## Domain 3: Deployment (24%)
### Task 1: Prepare application artifacts to be deployed to AWS
**Plain-language goal.** Produce an immutable, repeatable artifact containing only required code and dependencies, while keeping environment values outside it.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A Python API is packaged for Lambda. The same source moves through test and production, while URLs and feature flags differ. A native image dependency may require a container-image package in ECR.
#### Decision table
| Need | Packaging choice | Reason |
|---|---|---|
| Small handler + dependencies | ZIP archive | Simple Lambda artifact |
| Shared dependency used by functions | Layer | Reuse compatible dependency bundle |
| Native/large dependency or container workflow | Container image in ECR | Container packaging model |
| Runtime feature flag | AppConfig | Controlled dynamic configuration |
| Environment endpoint/name | Parameter/environment configuration | Keep artifact portable |
| Reproducible infrastructure | SAM/CloudFormation template | Versioned desired state |
#### Implementation walkthrough
1. Keep source, tests, templates, and build output distinct. The handler path in the package must match the runtime configuration.
2. Pin dependency versions and build in an environment compatible with the Lambda runtime architecture. Do not assume a developer laptop binary will run in Lambda.
3. Tag artifacts immutably or with a traceable commit identifier. “latest” makes an integration test impossible to reproduce.
4. Declare memory, timeout, architecture, and required permissions in IaC rather than clicking a different configuration in each environment.
5. Keep secrets out of the artifact. Supply environment-specific endpoints and feature settings through approved configuration mechanisms.
6. Push container images to ECR and deploy the exact approved digest/tag; scan and test before promotion.
#### Configuration mechanics
| Artifact | What is versioned | What stays external |
|---|---|---|
| Lambda ZIP | Handler and dependencies | Environment names, secrets, flags |
| Layer | Shared dependency bundle | Function-specific config |
| ECR image | Image digest/tag | Runtime variables and role |
| SAM/CloudFormation | Desired infrastructure | Parameter values/secrets references |
#### What fails in production, and how to respond
- **Handler not found after deploy:** Inspect package directory and handler declaration; source layout differs from runtime import path.
- **Native library fails only in Lambda:** Build against a compatible Linux/runtime architecture or choose an appropriate container image workflow.
- **Production URL baked into code:** The same artifact cannot safely move through environments; externalize nonsecret configuration.
#### Why tempting alternatives are wrong
- A layer is not always a speed optimization; it adds version and compatibility management.
- Using an untagged/latest container image defeats approved-version testing.
- Putting a production secret in `template.yaml` or a repository is not environment management.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5.

```mermaid
flowchart LR
  Src[Versioned source] --> Build[CodeBuild]
  Build --> Scan[Dependency and image scan]
  Scan --> Artifact[Immutable ZIP or ECR digest]
  Artifact --> Store[S3 artifact bucket / ECR]
  Store --> Deploy[Deployment stage]
```

#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 3.1.1 | Managing code-module dependencies, environment references, configuration files, and container images inside the package boundary | Use ZIP for ordinary functions, layers for genuinely shared dependencies, and an image for native/large/container-based requirements. | A layer is not automatically faster and a local native binary may fail in the Lambda runtime. |
| 3.1.2 | Organize deployment files and directories so tools find handlers, templates, tests, and artifacts predictably | Keep source, tests, templates, and build output separate so packaging does not accidentally include stale artifacts or omit the handler. | ‘Handler not found’ usually means package layout and configured module/function do not match. |
| 3.1.3 | Using code repositories as versioned deployment inputs | Trigger production from approved branches/tags and artifacts built from them, not a developer workstation. | A floating branch tip alone is weaker release evidence than a specific commit/tag. |
| 3.1.4 | Applying measured application resource requirements such as memory and cores | Raise Lambda memory when testing shows CPU-bound duration improves; choose container task CPU/memory reservations from observed usage. | Increasing timeout only permits a slow function to run longer. |
| 3.1.5 | Prepare environment-specific configuration, including AWS AppConfig where runtime rollout control is needed | Use environment variables/parameters for static environment references and AppConfig for safely rolled-out dynamic settings. | Baking the production URL or a secret into the artifact prevents safe promotion. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Managing code-module dependencies, environment references, configuration files, and container images inside the package boundary | Use ZIP for ordinary functions, layers for genuinely shared dependencies, and an image for native/large/container-based requirements. | A layer is not automatically faster and a local native binary may fail in the Lambda runtime. |
| Organize deployment files and directories so tools find handlers, templates, tests, and artifacts predictably | Keep source, tests, templates, and build output separate so packaging does not accidentally include stale artifacts or omit the handler. | ‘Handler not found’ usually means package layout and configured module/function do not match. |
| Using code repositories as versioned deployment inputs | Trigger production from approved branches/tags and artifacts built from them, not a developer workstation. | A floating branch tip alone is weaker release evidence than a specific commit/tag. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 3.1.1 — Managing code-module dependencies, environment references, configuration files, and container images inside the package boundary


**What it means**

A Lambda ZIP contains handler code and runtime-compatible dependencies; a layer supplies a shared compatible dependency bundle; an ECR image packages a container filesystem.

> **Why it matters / exam signal:** A layer is not automatically faster and a local native binary may fail in the Lambda runtime.

**Build it**

1. Pin dependencies, build for the target architecture, and deploy an immutable tag/digest.
2. Verify **Managing code-module dependencies, environment references, configuration files, and container images inside the package boundary** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use ZIP for ordinary functions, layers for genuinely shared dependencies, and an image for native/large/container-based requirements.

**Avoid this**

- A layer is not automatically faster and a local native binary may fail in the Lambda runtime.

#### Skill 3.1.2 — Organize deployment files and directories so tools find handlers, templates, tests, and artifacts predictably


**What it means**

SAM/CloudFormation resolves `CodeUri`, handler paths, templates, and artifacts relative to declared project structure; test fixtures must match the code’s expected event shape.

> **Why it matters / exam signal:** ‘Handler not found’ usually means package layout and configured module/function do not match.

**Build it**

1. Run `sam build` and inspect the built handler path before deployment.
2. Verify **Organize deployment files and directories so tools find handlers, templates, tests, and artifacts predictably** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Keep source, tests, templates, and build output separate so packaging does not accidentally include stale artifacts or omit the handler.

**Avoid this**

- ‘Handler not found’ usually means package layout and configured module/function do not match.

#### Skill 3.1.3 — Using code repositories as versioned deployment inputs


**What it means**

A repository commit/tag is an immutable-ish, reviewable deployment input that can start a pipeline and link a release to code.

> **Why it matters / exam signal:** A floating branch tip alone is weaker release evidence than a specific commit/tag.

**Build it**

1. Record commit SHA in the build/deployment metadata and require reviews/status checks on the release branch.
2. Verify **Using code repositories as versioned deployment inputs** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Trigger production from approved branches/tags and artifacts built from them, not a developer workstation.

**Avoid this**

- A floating branch tip alone is weaker release evidence than a specific commit/tag.

#### Skill 3.1.4 — Applying measured application resource requirements such as memory and cores


**What it means**

Runtime memory/CPU requirements come from measured peak memory, p95 duration, startup time, and CPU/I/O profile, not a guessed default.

> **Why it matters / exam signal:** Increasing timeout only permits a slow function to run longer.

**Build it**

1. Benchmark fixed representative load at two adjacent sizes and select the lowest setting meeting the SLO.
2. Verify **Applying measured application resource requirements such as memory and cores** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Raise Lambda memory when testing shows CPU-bound duration improves; choose container task CPU/memory reservations from observed usage.

**Avoid this**

- Increasing timeout only permits a slow function to run longer.

#### Skill 3.1.5 — Prepare environment-specific configuration, including AWS AppConfig where runtime rollout control is needed


**What it means**

One artifact promotes across environments while endpoint names, feature flags, and rollout rules remain external; AppConfig can validate and deploy runtime configuration progressively.

> **Why it matters / exam signal:** Baking the production URL or a secret into the artifact prevents safe promotion. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Give each environment a configuration profile, validate a schema, and test a bad configuration rollback.
2. Verify **Prepare environment-specific configuration, including AWS AppConfig where runtime rollout control is needed** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use environment variables/parameters for static environment references and AppConfig for safely rolled-out dynamic settings.

**Avoid this**

- Baking the production URL or a secret into the artifact prevents safe promotion. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 2: Test applications in development environments
**Plain-language goal.** Test deployed integration boundaries in a safe environment, not only pure functions on a laptop.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A staging API Gateway invokes a deployed Lambda, which calls a mocked payment endpoint, writes a test DynamoDB table, and publishes an EventBridge event captured by a test consumer.
#### Decision table
| Test level | Answers | AWS-oriented example |
|---|---|---|
| Unit | Does one code unit behave? | Handler validation with fake SDK client |
| Integration | Do components connect correctly? | Deployed Lambda + test table + IAM role |
| Contract/event | Is payload shape accepted? | EventBridge detail schema and consumer test |
| End-to-end | Does user flow succeed? | Staging API request through persistence |
| Mock | Can external dependency be deterministic? | Payment API error/timeout simulation |
#### Implementation walkthrough
1. Create a distinct development or staging endpoint/stage, account, or stack. Test code must not share production data or credentials.
2. Deploy the same IaC shape to staging with environment parameters. This catches IAM, mappings, event sources, and networking that unit tests cannot prove.
3. Mock nondeterministic or paid third-party APIs at their boundary. Test both their expected success shape and realistic timeout/error shapes.
4. For events, assert the producer envelope, routing rule, target permission, consumer processing, retry behavior, and failure destination.
5. Use test data with known assertions and cleanup/TTL. Make test output identify environment and version.
6. Promote only an artifact already tested; rebuilding during promotion changes the thing being approved.
#### What fails in production, and how to respond
- **Unit tests pass but API returns 502:** Inspect API Gateway integration/mapping, Lambda permission, deployed handler, and logs; unit tests did not exercise wiring.
- **Staging invokes production payment provider:** Use environment-specific endpoint configuration and network controls; test isolation is a design requirement.
- **Event reaches no consumer:** Check event pattern, bus, target permission, and dead-letter configuration—not just producer success.
#### Why tempting alternatives are wrong
- A local handler test cannot prove IAM permission or API Gateway mapping.
- Testing directly in production is not a substitute for a staging environment.
- Mocking every AWS service can hide deployment mistakes; deploy selected real integration paths.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5.

```mermaid
flowchart LR
  Commit[Commit] --> Unit[Unit tests]
  Unit --> SAM[SAM local / integration environment]
  SAM --> TestData[Test fixtures]
  TestData --> Verify[Assertions and contract checks]
  Verify --> Promote[Promote only passing artifact]
```

#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 3.2.1 | Testing deployed code with AWS services and tools | Keep pure logic tests fast locally, then run a narrow staging integration path against the packaged artifact. | A successful `sam build` or stack creation is not proof that an API integration works. |
| 3.2.2 | Writing integration tests and mock APIs for external dependencies | Mock external paid/nondeterministic systems while retaining selected AWS integrations in staging. | Mocking every dependency can hide IAM, mapping, and network misconfiguration. |
| 3.2.3 | Testing applications with development endpoints such as API Gateway stages | Use a development/staging stage for safe endpoint tests; do not aim test clients at production because code is shared. | Changing a Lambda alias alone does not create a distinct API stage or isolate stage variables. |
| 3.2.4 | Deploy application stack updates to existing staging/test environments using SAM or CloudFormation | Update the staging stack with version-controlled IaC rather than clicking console changes or recreating it manually. | A stack update can succeed while the application behavior or an integration permission remains wrong. |
| 3.2.5 | Testing event-driven applications through payload, routing, permissions, retries, and consumers | Test a real routed event when the risk is wiring, not only a consumer unit test. | Producer `PutEvents` success does not prove a rule matched or a target accepted delivery. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Testing deployed code with AWS services and tools | Keep pure logic tests fast locally, then run a narrow staging integration path against the packaged artifact. | A successful `sam build` or stack creation is not proof that an API integration works. |
| Writing integration tests and mock APIs for external dependencies | Mock external paid/nondeterministic systems while retaining selected AWS integrations in staging. | Mocking every dependency can hide IAM, mapping, and network misconfiguration. |
| Testing applications with development endpoints such as API Gateway stages | Use a development/staging stage for safe endpoint tests; do not aim test clients at production because code is shared. | Changing a Lambda alias alone does not create a distinct API stage or isolate stage variables. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 3.2.1 — Testing deployed code with AWS services and tools


**What it means**

Deployed tests exercise real IAM, event mappings, resource policies, and VPC paths that unit tests cannot see.

> **Why it matters / exam signal:** A successful `sam build` or stack creation is not proof that an API integration works.

**Build it**

1. Deploy a test stack, invoke its endpoint/event with a known ID, and assert response, persisted state, and logs.
2. Verify **Testing deployed code with AWS services and tools** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Keep pure logic tests fast locally, then run a narrow staging integration path against the packaged artifact.

**Avoid this**

- A successful `sam build` or stack creation is not proof that an API integration works.

#### Skill 3.2.2 — Writing integration tests and mock APIs for external dependencies


**What it means**

A mock API makes third-party success, throttling, malformed response, and timeout behavior deterministic; an integration test verifies the client contract at that boundary.

> **Why it matters / exam signal:** Mocking every dependency can hide IAM, mapping, and network misconfiguration.

**Build it**

1. Point the staging endpoint to a mock URL and assert timeout/retry/idempotency behavior as well as success.
2. Verify **Writing integration tests and mock APIs for external dependencies** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Mock external paid/nondeterministic systems while retaining selected AWS integrations in staging.

**Avoid this**

- Mocking every dependency can hide IAM, mapping, and network misconfiguration.

#### Skill 3.2.3 — Testing applications with development endpoints such as API Gateway stages


**What it means**

API Gateway stages provide separate deployment/configuration boundaries and URLs, while custom domains/base-path mappings can preserve a stable client hostname.

> **Why it matters / exam signal:** Changing a Lambda alias alone does not create a distinct API stage or isolate stage variables.

**Build it**

1. Invoke the stage URL with test credentials and assert the response includes a safe environment/version marker.
2. Verify **Testing applications with development endpoints such as API Gateway stages** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use a development/staging stage for safe endpoint tests; do not aim test clients at production because code is shared.

**Avoid this**

- Changing a Lambda alias alone does not create a distinct API stage or isolate stage variables.

#### Skill 3.2.4 — Deploy application stack updates to existing staging/test environments using SAM or CloudFormation


**What it means**

SAM transforms serverless shorthand into CloudFormation resources; CloudFormation updates an existing stack toward declared desired state.

> **Why it matters / exam signal:** A stack update can succeed while the application behavior or an integration permission remains wrong.

**Build it**

1. Review the change set/template diff, deploy parameters for test, then run a post-deploy smoke test.
2. Verify **Deploy application stack updates to existing staging/test environments using SAM or CloudFormation** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Update the staging stack with version-controlled IaC rather than clicking console changes or recreating it manually.

**Avoid this**

- A stack update can succeed while the application behavior or an integration permission remains wrong.

#### Skill 3.2.5 — Testing event-driven applications through payload, routing, permissions, retries, and consumers


**What it means**

Event-driven testing follows the full path: producer envelope, event pattern/subscription filter, target invocation permission, consumer result, retry, and DLQ/destination.

> **Why it matters / exam signal:** Producer `PutEvents` success does not prove a rule matched or a target accepted delivery. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Publish a known event ID, verify one expected consumer result, then send an invalid event and verify retry/failure handling.
2. Verify **Testing event-driven applications through payload, routing, permissions, retries, and consumers** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Test a real routed event when the risk is wiring, not only a consumer unit test.

**Avoid this**

- Producer `PutEvents` success does not prove a rule matched or a target accepted delivery. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 3: Automate deployment testing
**Plain-language goal.** Make test events, environments, infrastructure, and approved versions reproducible so a pipeline proves the same release each time.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A pipeline builds one commit, deploys a SAM stack to test, invokes saved API and SQS payloads, verifies an alias targets the approved Lambda version, and promotes the same artifact only after assertions pass.
#### Decision table
| Requirement | Mechanism | Why |
|---|---|---|
| Repeat input | Saved JSON event fixtures | Exercises success and failure paths consistently |
| Repeat infrastructure | SAM/CloudFormation | Desired state is reviewed and reproducible |
| Known function release | Lambda version + alias | Stable integration target, movable traffic |
| Known container release | Immutable image tag/digest | Avoids `latest` drift |
| Separate API behavior | API Gateway stage/environment | Isolated endpoint/configuration |
| Assisted test writing | Amazon Q Developer + review | Generate ideas, then validate assertions |
#### Implementation walkthrough
1. Keep representative test events in source control. Include invalid input, duplicate delivery, timeout, and authorization-denied cases—not only happy paths.
2. Build once and attach an immutable identity to the artifact. A pipeline should deploy that same identity through environments.
3. Use IaC change sets/review where appropriate, then update the existing test stack rather than manually recreating resources.
4. Point integration clients to aliases, immutable image references, or approved branches. An alias permits a stable name while the version changes under controlled deployment.
5. Run post-deploy smoke tests against the actual test endpoint and query expected state. Fail the pipeline on an assertion, not merely on deployment completion.
6. Use Amazon Q Developer-generated tests as draft material; inspect fixtures, security assumptions, and expected results before accepting them.
#### Configuration mechanics
| SAM/CloudFormation concern | Testable evidence |
|---|---|
| Parameters/environment | Test endpoint returns expected environment marker, not secret |
| IAM role | Allowed call succeeds and denied call remains denied |
| Event source | Saved event reaches handler and expected state changes |
| Lambda alias | Deployment output shows approved version |
| API stage | Test uses intended stage URL/custom domain mapping |
#### What fails in production, and how to respond
- **Test passes against a different image:** Record and assert deployed image digest/version in test output.
- **IaC deploy succeeds but feature is broken:** Run API/event smoke assertions after deploy; stack success only means resources reached desired state.
- **Manual change causes drift:** Bring the change back into IaC and use drift detection/change review rather than treating console state as canonical.
#### Why tempting alternatives are wrong
- A Lambda alias without a published version does not create a reproducible release.
- A pipeline that rebuilds from a floating dependency can test a different artifact than it promotes.
- Infrastructure as code alone is not test automation; it needs invocation and assertions.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.5, 3.3.6.

```mermaid
flowchart LR
  Artifact[Immutable artifact] --> Stage[Staging deployment]
  Stage --> Smoke[Smoke and integration tests]
  Smoke --> Alarm[Metric / synthetic alarm]
  Alarm -->|pass| Prod[Production promotion]
  Alarm -->|fail| Rollback[Automatic rollback]
```

#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 3.3.1 | Creating application test events including JSON for Lambda, API Gateway, and SAM resources | Save captured or documented representative fixtures rather than inventing a simplified body. | A test that omits `Records`, base64 payloads, or API request context cannot catch trigger-specific parsing defects. |
| 3.3.2 | Deploy API resources to various environments | Promote the same API definition with environment parameters, keeping dev/test/prod dependencies separated. | Updating source without deploying the API/stage leaves clients on the old configuration. |
| 3.3.3 | Creating integration environments using approved versions such as Lambda aliases, image tags, Amplify branches, or Copilot environments | Use immutable approved identities for integration tests rather than `$LATEST` or `latest`. | Rebuilding in production can deploy different dependencies than the tested release. |
| 3.3.4 | Implementing and deploy IaC templates with AWS SAM or CloudFormation | Use IaC for repeatable stack updates; use a change set when impact review matters. | Manual console fixes create drift and are not captured for the next environment. |
| 3.3.5 | Managing service-specific development, test, and production environments | Isolate accounts or stacks according to risk, while sharing only deliberate artifacts and templates. | Same source code does not imply shared credentials, endpoints, or data are safe. |
| 3.3.6 | Using Amazon Q Developer to generate automated tests, then review and validate them | Use it to accelerate a test matrix or boilerplate, not to replace review of event shapes and expected outcomes. | Generated code is not evidence of correctness until it executes against controlled inputs. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Creating application test events including JSON for Lambda, API Gateway, and SAM resources | Save captured or documented representative fixtures rather than inventing a simplified body. | A test that omits `Records`, base64 payloads, or API request context cannot catch trigger-specific parsing defects. |
| Deploy API resources to various environments | Promote the same API definition with environment parameters, keeping dev/test/prod dependencies separated. | Updating source without deploying the API/stage leaves clients on the old configuration. |
| Creating integration environments using approved versions such as Lambda aliases, image tags, Amplify branches, or Copilot environments | Use immutable approved identities for integration tests rather than `$LATEST` or `latest`. | Rebuilding in production can deploy different dependencies than the tested release. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 3.3.1 — Creating application test events including JSON for Lambda, API Gateway, and SAM resources


**What it means**

Lambda, API Gateway, and SAM each expect a structured event envelope with headers/context/records that handler code must parse correctly.

> **Why it matters / exam signal:** A test that omits `Records`, base64 payloads, or API request context cannot catch trigger-specific parsing defects.

**Build it**

1. Version success, invalid, authorization-denied, and duplicate fixtures and run them in pipeline tests.
2. Verify **Creating application test events including JSON for Lambda, API Gateway, and SAM resources** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Save captured or documented representative fixtures rather than inventing a simplified body.

**Avoid this**

- A test that omits `Records`, base64 payloads, or API request context cannot catch trigger-specific parsing defects.

#### Skill 3.3.2 — Deploy API resources to various environments


**What it means**

API deployments bind routes/integrations to a stage whose variables, authorizer, throttling, and endpoint are environment-specific.

> **Why it matters / exam signal:** Updating source without deploying the API/stage leaves clients on the old configuration.

**Build it**

1. Deploy to the intended stage, call its URL, and assert the route reaches the expected alias/backend.
2. Verify **Deploy API resources to various environments** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Promote the same API definition with environment parameters, keeping dev/test/prod dependencies separated.

**Avoid this**

- Updating source without deploying the API/stage leaves clients on the old configuration.

#### Skill 3.3.3 — Creating integration environments using approved versions such as Lambda aliases, image tags, Amplify branches, or Copilot environments


**What it means**

A Lambda alias points to a published version, an image digest identifies exact container bits, and deployment branches/environments isolate test traffic/configuration.

> **Why it matters / exam signal:** Rebuilding in production can deploy different dependencies than the tested release.

**Build it**

1. Capture the alias version/image digest in test output and verify promotion reuses it.
2. Verify **Creating integration environments using approved versions such as Lambda aliases, image tags, Amplify branches, or Copilot environments** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use immutable approved identities for integration tests rather than `$LATEST` or `latest`.

**Avoid this**

- Rebuilding in production can deploy different dependencies than the tested release.

#### Skill 3.3.4 — Implementing and deploy IaC templates with AWS SAM or CloudFormation


**What it means**

SAM/CloudFormation describe resources, dependencies, permissions, and configuration as reviewed desired state.

> **Why it matters / exam signal:** Manual console fixes create drift and are not captured for the next environment.

**Build it**

1. Parameterize environment names, validate/build the template, deploy an existing test stack, and assert a real behavior afterward.
2. Verify **Implementing and deploy IaC templates with AWS SAM or CloudFormation** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use IaC for repeatable stack updates; use a change set when impact review matters.

**Avoid this**

- Manual console fixes create drift and are not captured for the next environment.

#### Skill 3.3.5 — Managing service-specific development, test, and production environments


**What it means**

Each service has environment-scoped resources/configuration: separate API stages, Lambda aliases/variables, tables/buckets, queues/buses, and roles as needed.

> **Why it matters / exam signal:** Same source code does not imply shared credentials, endpoints, or data are safe.

**Build it**

1. Add an environment tag/name to resources and test that staging cannot write to production data.
2. Verify **Managing service-specific development, test, and production environments** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Isolate accounts or stacks according to risk, while sharing only deliberate artifacts and templates.

**Avoid this**

- Same source code does not imply shared credentials, endpoints, or data are safe.

#### Skill 3.3.6 — Using Amazon Q Developer to generate automated tests, then review and validate them


**What it means**

Amazon Q Developer may draft test cases, but fixtures and assertions still need human validation against the actual handler contract and security policy.

> **Why it matters / exam signal:** Generated code is not evidence of correctness until it executes against controlled inputs. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Run generated tests, add a negative authorization/duplicate case, and inspect for static credentials or broad permissions.
2. Verify **Using Amazon Q Developer to generate automated tests, then review and validate them** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use it to accelerate a test matrix or boilerplate, not to replace review of event shapes and expected outcomes.

**Avoid this**

- Generated code is not evidence of correctness until it executes against controlled inputs. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 4: Deploy code by using AWS CI/CD services
**Plain-language goal.** Promote a known release through source, build, test, deployment, health verification, and rollback with the existing workflow.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A commit to the approved branch triggers CodePipeline. CodeBuild tests and packages a SAM application. CodeDeploy shifts 10% of a Lambda alias’s traffic, CloudWatch alarms watch errors and latency, and the prior version resumes traffic automatically if an alarm breaches.
```mermaid
flowchart LR
 G[Commit/tag] --> CP[CodePipeline]
 CP --> CB[CodeBuild: test/package]
 CB --> T[Deploy test stack]
 T --> V{Smoke tests pass?}
 V -->|no| Stop[Stop release]
 V -->|yes| CD[CodeDeploy canary]
 CD --> A[CloudWatch alarms]
 A -->|healthy| Full[100% traffic]
 A -->|breach| Rollback[Alias to prior version]
```
#### Decision table
| Service/cue | Responsibility | Exam selection rule |
|---|---|---|
| CodePipeline | Orchestrates stages | Use for source → build → test → deploy flow |
| CodeBuild | Builds and tests | Use for managed build commands/buildspec |
| CodeDeploy | Controlled deployment | Use for Lambda/ECS/EC2 deployment strategies |
| Canary | Small traffic first | Reduce blast radius with alarm rollback |
| Linear | Incremental traffic shifts | Gradual exposure over intervals |
| Blue/green | Replacement environment | Fast switch/rollback with extra capacity |
| Rolling | Batches on existing fleet | Update incrementally where appropriate |
#### Implementation walkthrough
1. Use a repository commit, tag, label, or branch as the auditable source trigger. The pipeline should receive the intended release, not a developer’s local directory.
2. CodeBuild runs tests and produces the deployable artifact. Store build specification and dependencies with the source so builds are repeatable.
3. Update the existing SAM/CloudFormation template rather than creating a parallel manual infrastructure path. Use environment-specific parameters/configuration.
4. For Lambda, publish a version, point an alias at it, and let deployment configuration shift alias traffic. Attach alarms that represent user harm, such as errors or latency.
5. Define rollback before release: known prior version, alarm criteria, and existing strategy. Verify rollback through post-deployment health signals.
6. Use API Gateway stages/custom domains and runtime configuration to retain stable client-facing addresses while environments differ.
#### Configuration mechanics
| Strategy | Initial exposure | Rollback shape | Best cue |
|---|---|---|---|
| Canary | Small percentage | Shift alias/traffic back | Minimize blast radius |
| Linear | Increasing percentages | Stop and return traffic | Gradual confidence |
| Blue/green | New environment | Switch back environment | Near-instant switch, spare capacity |
| Rolling | Batch of existing fleet | Replace/restore batches | Incremental fleet update |
#### What fails in production, and how to respond
- **Canary alarm breaches:** CodeDeploy stops/rolls back alias traffic to known good version; investigate with version-tagged logs and traces.
- **Build succeeds but wrong branch releases:** Restrict source trigger/branch rules and use immutable release labels.
- **Blue/green has no spare capacity:** It cannot meet a replacement-environment requirement without capacity; use canary/linear if the requirement favors traffic shifting instead.
#### Why tempting alternatives are wrong
- CodePipeline is orchestration, not the service that executes compilation; CodeBuild does builds/tests.
- Deploying all traffic at once is wrong when the prompt requires limited initial exposure and automatic rollback.
- Changing production configuration by hand is not a reliable rollback or CI/CD strategy.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 3.4.1, 3.4.2, 3.4.3, 3.4.4, 3.4.5, 3.4.6, 3.4.7, 3.4.8, 3.4.9, 3.4.10, 3.4.11.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 3.4.1 | Understanding Lambda ZIP archives, layers, and container-image deployment packages | Select the smallest package type meeting dependency/runtime needs; use a layer for shared libraries, not per-function configuration. | `$LATEST`/an unpinned image is not a reproducible deployment artifact. |
| 3.4.2 | Understanding API Gateway stages and custom domains | Use stages for dev/test/prod behavior and custom domains for client-facing URLs/certificates. | A custom domain does not by itself supply a separate deployment or environment. |
| 3.4.3 | Update existing SAM and CloudFormation templates | Modify the template and deploy the stack; avoid manual resource edits that introduce drift. | Replacing a stack to make a small change risks data/resource replacement when an in-place update was required. |
| 3.4.4 | Managing application environments using AWS services | Isolate production data and credentials from development; promote the same artifact with environment-specific parameters. | Copying production secrets into a dev environment is not environment management. |
| 3.4.5 | Deploy application versions with strategies that match risk and availability requirements | Choose canary/linear for gradual exposure with alarms, blue/green for rapid environment switch with capacity, and rolling for incremental fleet replacement. | All-at-once deployment cannot meet a limited-blast-radius requirement. |
| 3.4.6 | Commit code to repositories to invoke existing build, test, and deployment actions | Let the established pipeline consume the repository revision rather than manually uploading local code. | Pushing to any branch is not sufficient when the pipeline is configured for a specific branch or tag. |
| 3.4.7 | Using orchestrated workflows to deploy code through environments | Use orchestration when a release must pass ordered gates across environments, not a standalone build service. | CodePipeline does not compile the application itself, and CodeBuild does not provide canary traffic shifting. |
| 3.4.8 | Perform rollbacks through existing deployment strategies and known-good versions | Use automated rollback for breached canary/linear alarms; use controlled manual rollback only when the deployment type requires it. | Editing production source or console fields during an incident is not a reproducible rollback. |
| 3.4.9 | Using labels and branches for version and release management | Trigger release pipelines from protected release branches or tags when the requirement calls for controlled promotion. | A mutable branch name does not guarantee that tomorrow’s build uses the reviewed revision. |
| 3.4.10 | Using runtime configuration for dynamic deployments, such as API Gateway stage variables consumed by Lambda | Use stage variables/AppConfig for controlled environment/feature variation, not for secrets embedded in client-visible configuration. | Changing a stage variable changes routing/configuration but does not publish new Lambda code. |
| 3.4.11 | Configuring blue/green, canary, and rolling strategies for releases | Match the required rollback speed, spare capacity, and blast radius rather than selecting the fashionable strategy. | Blue/green needs replacement capacity; canary needs a version/traffic routing mechanism. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Understanding Lambda ZIP archives, layers, and container-image deployment packages | Select the smallest package type meeting dependency/runtime needs; use a layer for shared libraries, not per-function configuration. | `$LATEST`/an unpinned image is not a reproducible deployment artifact. |
| Understanding API Gateway stages and custom domains | Use stages for dev/test/prod behavior and custom domains for client-facing URLs/certificates. | A custom domain does not by itself supply a separate deployment or environment. |
| Update existing SAM and CloudFormation templates | Modify the template and deploy the stack; avoid manual resource edits that introduce drift. | Replacing a stack to make a small change risks data/resource replacement when an in-place update was required. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 3.4.1 — Understanding Lambda ZIP archives, layers, and container-image deployment packages


**What it means**

ZIP functions package code/dependencies, layers share compatible runtime libraries, and container-image functions pull a tagged/digested ECR image.

> **Why it matters / exam signal:** `$LATEST`/an unpinned image is not a reproducible deployment artifact.

**Build it**

1. Build the exact package, run it in a Lambda-compatible test, and record ZIP hash or image digest.
2. Verify **Understanding Lambda ZIP archives, layers, and container-image deployment packages** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Select the smallest package type meeting dependency/runtime needs; use a layer for shared libraries, not per-function configuration.

**Avoid this**

- `$LATEST`/an unpinned image is not a reproducible deployment artifact.

#### Skill 3.4.2 — Understanding API Gateway stages and custom domains


**What it means**

API Gateway stages expose deployments under distinct configuration contexts; a custom domain/base-path mapping gives clients a stable public name while routing to an API/stage.

> **Why it matters / exam signal:** A custom domain does not by itself supply a separate deployment or environment.

**Build it**

1. Map the intended base path, configure its certificate, and invoke each stage-specific endpoint in a test.
2. Verify **Understanding API Gateway stages and custom domains** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use stages for dev/test/prod behavior and custom domains for client-facing URLs/certificates.

**Avoid this**

- A custom domain does not by itself supply a separate deployment or environment.

#### Skill 3.4.3 — Update existing SAM and CloudFormation templates


**What it means**

Updating an existing SAM/CloudFormation template applies a reviewed diff to the stack and preserves declarative ownership of resources.

> **Why it matters / exam signal:** Replacing a stack to make a small change risks data/resource replacement when an in-place update was required.

**Build it**

1. Generate/review a change set, update test first, and inspect first-failed events on error.
2. Verify **Update existing SAM and CloudFormation templates** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Modify the template and deploy the stack; avoid manual resource edits that introduce drift.

**Avoid this**

- Replacing a stack to make a small change risks data/resource replacement when an in-place update was required.

#### Skill 3.4.4 — Managing application environments using AWS services


**What it means**

Environment management combines separate resource names/accounts/stacks with external configuration, roles, and deployment controls.

> **Why it matters / exam signal:** Copying production secrets into a dev environment is not environment management.

**Build it**

1. Use IaC parameters/tags and least-privilege roles, then prove a staging request reaches only staging resources.
2. Verify **Managing application environments using AWS services** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Isolate production data and credentials from development; promote the same artifact with environment-specific parameters.

**Avoid this**

- Copying production secrets into a dev environment is not environment management.

#### Skill 3.4.5 — Deploy application versions with strategies that match risk and availability requirements


**What it means**

Canary sends a small initial percentage, linear increases traffic in steps, blue/green switches to a replacement environment, and rolling replaces batches.

> **Why it matters / exam signal:** All-at-once deployment cannot meet a limited-blast-radius requirement.

**Build it**

1. Attach user-impact alarms and preserve a known-good version before shifting traffic.
2. Verify **Deploy application versions with strategies that match risk and availability requirements** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Choose canary/linear for gradual exposure with alarms, blue/green for rapid environment switch with capacity, and rolling for incremental fleet replacement.

**Avoid this**

- All-at-once deployment cannot meet a limited-blast-radius requirement.

#### Skill 3.4.6 — Commit code to repositories to invoke existing build, test, and deployment actions


**What it means**

A commit to an approved branch/tag can trigger existing CodePipeline source, CodeBuild test, and deployment actions.

> **Why it matters / exam signal:** Pushing to any branch is not sufficient when the pipeline is configured for a specific branch or tag.

**Build it**

1. Enforce branch protection/source filters, include buildspec in source, and record the source revision in the release.
2. Verify **Commit code to repositories to invoke existing build, test, and deployment actions** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Let the established pipeline consume the repository revision rather than manually uploading local code.

**Avoid this**

- Pushing to any branch is not sufficient when the pipeline is configured for a specific branch or tag.

#### Skill 3.4.7 — Using orchestrated workflows to deploy code through environments


**What it means**

CodePipeline coordinates source, build, test, approval, and deploy stages; CodeBuild executes build commands; CodeDeploy manages supported controlled deployments.

> **Why it matters / exam signal:** CodePipeline does not compile the application itself, and CodeBuild does not provide canary traffic shifting.

**Build it**

1. Define artifact handoff, failure stop behavior, and post-deploy tests in the pipeline.
2. Verify **Using orchestrated workflows to deploy code through environments** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use orchestration when a release must pass ordered gates across environments, not a standalone build service.

**Avoid this**

- CodePipeline does not compile the application itself, and CodeBuild does not provide canary traffic shifting.

#### Skill 3.4.8 — Perform rollbacks through existing deployment strategies and known-good versions


**What it means**

Rollback returns traffic/configuration to a recorded known-good Lambda version, task set, or environment using the deployment strategy and health alarms.

> **Why it matters / exam signal:** Editing production source or console fields during an incident is not a reproducible rollback.

**Build it**

1. Record prior version and alarm state, trigger a controlled failure in staging, and verify traffic/logs identify the restored release.
2. Verify **Perform rollbacks through existing deployment strategies and known-good versions** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use automated rollback for breached canary/linear alarms; use controlled manual rollback only when the deployment type requires it.

**Avoid this**

- Editing production source or console fields during an incident is not a reproducible rollback.

#### Skill 3.4.9 — Using labels and branches for version and release management


**What it means**

Branches organize ongoing work, tags/labels identify a release candidate, and immutable artifact metadata ties a deployment back to source.

> **Why it matters / exam signal:** A mutable branch name does not guarantee that tomorrow’s build uses the reviewed revision.

**Build it**

1. Tag the approved commit, build once, and persist SHA/tag/digest in the deployment record.
2. Verify **Using labels and branches for version and release management** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Trigger release pipelines from protected release branches or tags when the requirement calls for controlled promotion.

**Avoid this**

- A mutable branch name does not guarantee that tomorrow’s build uses the reviewed revision.

#### Skill 3.4.10 — Using runtime configuration for dynamic deployments, such as API Gateway stage variables consumed by Lambda


**What it means**

Runtime configuration separates behavior from deployed code; API Gateway stage variables can select a Lambda alias or backend parameter at request time.

> **Why it matters / exam signal:** Changing a stage variable changes routing/configuration but does not publish new Lambda code.

**Build it**

1. Set a stage variable to an approved alias, invoke the stage, and log the safe selected version.
2. Verify **Using runtime configuration for dynamic deployments, such as API Gateway stage variables consumed by Lambda** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use stage variables/AppConfig for controlled environment/feature variation, not for secrets embedded in client-visible configuration.

**Avoid this**

- Changing a stage variable changes routing/configuration but does not publish new Lambda code.

#### Skill 3.4.11 — Configuring blue/green, canary, and rolling strategies for releases


**What it means**

Blue/green maintains old and replacement environments, canary shifts a small percentage before full rollout, and rolling updates batches of an existing fleet.

> **Why it matters / exam signal:** Blue/green needs replacement capacity; canary needs a version/traffic routing mechanism. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Configure CodeDeploy/SAM traffic shifting plus CloudWatch alarms and test an alarm-driven rollback.
2. Verify **Configuring blue/green, canary, and rolling strategies for releases** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Match the required rollback speed, spare capacity, and blast radius rather than selecting the fashionable strategy.

**Avoid this**

- Blue/green needs replacement capacity; canary needs a version/traffic routing mechanism. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

## Domain 4: Troubleshooting and Optimization (18%)
### Task 1: Assist in a root cause analysis
**Plain-language goal.** Use time-correlated evidence to identify the failing condition, then prove a targeted fix rather than guessing from a single alarm.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** Checkout latency rises after a release. A dashboard shows Lambda duration rose at the same time. X-Ray traces identify an external-payment segment, and structured logs for the same trace IDs show repeated connection timeouts.
#### Decision table
| Signal | Best question answered | Tool/example |
|---|---|---|
| Metric | When, how much, how widespread? | CloudWatch duration/error/throttle graph |
| Log | What happened in one execution? | CloudWatch Logs Insights query |
| Trace | Which hop was slow or failed? | X-Ray service map/segments |
| Deployment event | Which resource/change failed? | CloudFormation/SAM/service output |
| Dashboard | What changed across components? | Correlated health view |
| EMF metric | What business signal changed? | CheckoutFailures by safe dimension |
#### Implementation walkthrough
1. Start with the symptom, affected scope, and time window. Compare a baseline to the degraded interval and annotate deployment/version changes.
2. Use metrics to identify the component and whether errors, duration, throttles, or dependency latency moved first. Metrics establish correlation, not proof.
3. Query structured logs by request ID, trace ID, route, version, and error class. Avoid searching a huge log group with unstructured text alone.
4. Use traces to find the slow segment and inspect annotations/metadata that are safe to record. Follow the request across API, Lambda, queue, and downstream calls.
5. For deployment failures, read stack events/service output from the first failed resource; later failures can be consequences.
6. Form a hypothesis, reproduce or compare evidence, apply one narrow change, and verify metrics return toward baseline.
#### What fails in production, and how to respond
- **Error graph spikes but no root cause:** Correlate logs/traces and release history; the graph only says the symptom exists.
- **CloudFormation update rolls back:** Find the earliest failed resource event, then inspect IAM, quota, template property, or dependency output.
- **Integration returns 403 or timeout:** Check identity/permissions separately from endpoint, DNS/network path, event shape, and timeout settings.
#### Why tempting alternatives are wrong
- Changing Lambda memory before locating the slow trace segment may hide the symptom and spend more without fixing a downstream timeout.
- Searching logs without a bounded time range or correlation field is slow and produces false leads.
- Treating the latest visible stack error as root cause ignores cascade failures.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5, 4.1.6, 4.1.7.

```mermaid
flowchart LR
  Alarm[CloudWatch alarm] --> Metric[Metric anomaly]
  Metric --> Trace[X-Ray trace]
  Trace --> Logs[Correlated logs]
  Logs --> Change[Recent deployment / config change]
  Change --> Fix[Smallest verified remediation]
```

#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 4.1.1 | Debugging code to identify reproducible defects | Start from evidence and a deterministic fixture, not a speculative rewrite. | A symptom that disappears after random configuration changes is not a demonstrated root cause. |
| 4.1.2 | Interpret application metrics, logs, and traces together | Use metrics to bound the incident, trace a slow/failed request, then query logs by trace/request ID. | An error-rate dashboard alone cannot locate a latency bottleneck. |
| 4.1.3 | Query logs to find relevant data efficiently | Query by request ID, trace ID, route, version, and error class; use metrics/traces first when the failing scope is unknown. | Searching every log group for one vague exception can find unrelated historical failures. |
| 4.1.4 | Implementing custom metrics such as CloudWatch EMF | Emit EMF for business signals such as `PaymentFailures` when Lambda Errors cannot explain user impact. | High-cardinality IDs as metric dimensions create excessive cost and unusable cardinality. |
| 4.1.5 | Reviewing application health through dashboards and insights | Use a dashboard for ongoing visibility and alarms/notifications for required action. | A dashboard does not wake an on-call responder and is not an alerting mechanism by itself. |
| 4.1.6 | Troubleshoot deployment failures from service output logs and first failed resources | Fix the root resource failure before chasing rollback/cascade events. | The final rollback message is often a consequence, not the original failure. |
| 4.1.7 | Debugging service integration issues across endpoint, identity, network, payload, timeout, and error handling | Test one layer at a time from caller to target instead of widening IAM immediately. | A 403 indicates an authorization path; a timeout usually requires network/dependency/timeout analysis, not the same fix. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Debugging code to identify reproducible defects | Start from evidence and a deterministic fixture, not a speculative rewrite. | A symptom that disappears after random configuration changes is not a demonstrated root cause. |
| Interpret application metrics, logs, and traces together | Use metrics to bound the incident, trace a slow/failed request, then query logs by trace/request ID. | An error-rate dashboard alone cannot locate a latency bottleneck. |
| Query logs to find relevant data efficiently | Query by request ID, trace ID, route, version, and error class; use metrics/traces first when the failing scope is unknown. | Searching every log group for one vague exception can find unrelated historical failures. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 4.1.1 — Debugging code to identify reproducible defects


**What it means**

Reproduce a defect with fixed input, version, environment, and time window, then reduce it to the smallest failing path before changing code.

> **Why it matters / exam signal:** A symptom that disappears after random configuration changes is not a demonstrated root cause.

**Build it**

1. Capture request/trace ID and release version, write a failing regression test, fix one cause, and rerun the same fixture.
2. Verify **Debugging code to identify reproducible defects** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Start from evidence and a deterministic fixture, not a speculative rewrite.

**Avoid this**

- A symptom that disappears after random configuration changes is not a demonstrated root cause.

#### Skill 4.1.2 — Interpret application metrics, logs, and traces together


**What it means**

Metrics reveal timing/scale, logs reveal event detail, and traces reveal the hop-by-hop request path; together they turn correlation into a testable hypothesis.

> **Why it matters / exam signal:** An error-rate dashboard alone cannot locate a latency bottleneck.

**Build it**

1. Compare baseline and degraded windows with version annotations and identify the first moving dependency.
2. Verify **Interpret application metrics, logs, and traces together** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use metrics to bound the incident, trace a slow/failed request, then query logs by trace/request ID.

**Avoid this**

- An error-rate dashboard alone cannot locate a latency bottleneck.

#### Skill 4.1.3 — Query logs to find relevant data efficiently


**What it means**

CloudWatch Logs Insights filters and aggregates structured fields over a bounded time range, reducing cost/noise versus broad text search.

> **Why it matters / exam signal:** Searching every log group for one vague exception can find unrelated historical failures.

**Build it**

1. Filter the incident window, project safe fields, sort by timestamp, and correlate a result to a trace.
2. Verify **Query logs to find relevant data efficiently** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Query by request ID, trace ID, route, version, and error class; use metrics/traces first when the failing scope is unknown.

**Avoid this**

- Searching every log group for one vague exception can find unrelated historical failures.

#### Skill 4.1.4 — Implementing custom metrics such as CloudWatch EMF


**What it means**

Embedded Metric Format writes a JSON log event containing `_aws` metric metadata so CloudWatch extracts a metric without a separate PutMetricData call.

> **Why it matters / exam signal:** High-cardinality IDs as metric dimensions create excessive cost and unusable cardinality.

**Build it**

1. Use low-cardinality safe dimensions (for example route/environment), graph the result, and alarm on a tested threshold.
2. Verify **Implementing custom metrics such as CloudWatch EMF** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Emit EMF for business signals such as `PaymentFailures` when Lambda Errors cannot explain user impact.

**Avoid this**

- High-cardinality IDs as metric dimensions create excessive cost and unusable cardinality.

#### Skill 4.1.5 — Reviewing application health through dashboards and insights


**What it means**

A dashboard combines service and business metrics into a shared health view; Insights/queries let operators drill from a symptom to evidence.

> **Why it matters / exam signal:** A dashboard does not wake an on-call responder and is not an alerting mechanism by itself.

**Build it**

1. Place traffic, error rate, p95 latency, throttles, dependency metrics, and deployment annotations on one incident view.
2. Verify **Reviewing application health through dashboards and insights** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use a dashboard for ongoing visibility and alarms/notifications for required action.

**Avoid this**

- A dashboard does not wake an on-call responder and is not an alerting mechanism by itself.

#### Skill 4.1.6 — Troubleshoot deployment failures from service output logs and first failed resources


**What it means**

CloudFormation/SAM failure investigation starts with the earliest failed resource event, then checks its service logs, permissions, quota, property, and dependency.

> **Why it matters / exam signal:** The final rollback message is often a consequence, not the original failure.

**Build it**

1. Read stack events in timestamp order, reproduce with the template/change set, and verify the stack plus application smoke test.
2. Verify **Troubleshoot deployment failures from service output logs and first failed resources** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Fix the root resource failure before chasing rollback/cascade events.

**Avoid this**

- The final rollback message is often a consequence, not the original failure.

#### Skill 4.1.7 — Debugging service integration issues across endpoint, identity, network, payload, timeout, and error handling


**What it means**

Integration diagnosis separates endpoint/DNS/route reachability, identity/resource policy, payload contract, timeout budget, and downstream error handling.

> **Why it matters / exam signal:** A 403 indicates an authorization path; a timeout usually requires network/dependency/timeout analysis, not the same fix. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Correlate a request ID, verify endpoint resolution/connectivity, validate signed identity, then replay the exact payload.
2. Verify **Debugging service integration issues across endpoint, identity, network, payload, timeout, and error handling** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Test one layer at a time from caller to target instead of widening IAM immediately.

**Avoid this**

- A 403 indicates an authorization path; a timeout usually requires network/dependency/timeout analysis, not the same fix. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 2: Instrument code for observability
**Plain-language goal.** Design safe logs, metrics, traces, health signals, and alerts before an incident so operators can explain unexpected behavior.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A checkout Lambda emits a structured log with request ID, route, deployment version, outcome, and safe duration; it emits an EMF payment-failure metric; X-Ray annotations make a tenant and feature path searchable; alarms notify the on-call team when failures cross an actionable threshold.
```mermaid
flowchart LR
 R[Request ID] --> API[API Gateway]
 API --> L[Lambda structured log]
 L --> X[X-Ray segment]
 L --> M[EMF custom metric]
 L --> D[(Dependency)]
 M --> A[CloudWatch alarm]
 A --> N[Notification]
 X --> T[Trace service map]
```
#### Decision table
| Instrument | Purpose | Safe field example |
|---|---|---|
| Structured log | Detailed event record | requestId, route, outcome, durationMs |
| Metric | Numeric trend/alert | OrdersAccepted, PaymentFailure count |
| Trace | Request path and latency | segment for payment dependency |
| Annotation | Indexed trace dimension | tenantTier, featureFlag—not a secret |
| Health/readiness | Traffic eligibility | database dependency ready |
| Alarm/notification | Actionable response | error rate beyond threshold |
#### Implementation walkthrough
1. Define an event schema before logging: timestamp, level, request/correlation ID, operation, safe subject identifier, outcome, duration, version, and error class.
2. Use structured JSON so Logs Insights can filter and aggregate fields. Do not force investigators to parse prose strings.
3. Emit custom metrics for application behavior that infrastructure metrics cannot express, such as orders accepted or validation failures. EMF can create metrics from log events.
4. Enable tracing and create segments around meaningful downstream work. Add safe annotations used for filtering; put sensitive/high-cardinality diagnostic detail in nonindexed metadata only when appropriate.
5. Configure alarms only for conditions with an owner and response. Notification without a useful threshold creates alert fatigue.
6. Distinguish liveness from readiness: a process can be running but not ready to accept traffic because a required dependency is unavailable.
#### What fails in production, and how to respond
- **Logs contain authorization header:** Sanitize at the logging boundary, rotate exposed credentials, and review retention/access.
- **Alarm fires continuously on normal noise:** Choose baseline-informed, actionable threshold/evaluation periods rather than alerting every transient error.
- **Trace lacks downstream visibility:** Instrument the client call/propagate context and ensure supported service integrations are configured.
#### Why tempting alternatives are wrong
- More logs are not automatically better; noisy or secret-bearing logs reduce diagnosability and create risk.
- A dashboard is not an alert; it shows information but does not notify responders.
- A health endpoint returning 200 while dependencies are unusable is liveness only, not readiness.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5, 4.2.6, 4.2.7, 4.2.8.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 4.2.1 | Understanding differences among logging, monitoring, and observability | Emit all three forms for distributed flows: structured logs for details, metrics for trends, traces for paths. | More raw log lines are not observability if they cannot be queried or correlated. |
| 4.2.2 | Implementing effective logs for application behavior and state | Log state transitions and boundary failures, not entire request bodies or secrets. | Free-form strings and unbounded debug payloads make Logs Insights and incident privacy worse. |
| 4.2.3 | Emitting custom application metrics | Add custom metrics when infrastructure metrics cannot state the business symptom. | Per-user/request-ID dimensions make metrics expensive and cannot replace logs for individual records. |
| 4.2.4 | Adding trace annotations for searchable safe dimensions | Put safe, low-cardinality fields such as environment, route, or tenant tier in annotations; keep secrets and high-cardinality identifiers out. | An annotation is searchable observability data, not a secure store for customer identifiers. |
| 4.2.5 | Implementing notification alerts for actions such as quota risk or deployment completion | Alert only when a named owner can take a documented action; use a dashboard for passive information. | Alerting on every transient error creates noise and does not meet an actionable-alert requirement. |
| 4.2.6 | Implementing tracing with AWS services and tools | Use tracing to locate the slow hop in a distributed request; use logs for detailed values and metrics for fleet trend. | A trace without propagated context fragments the request and cannot prove end-to-end latency. |
| 4.2.7 | Implementing structured logging for application events and user actions | Standardize schema at the logger boundary and retain only safe user-action indicators. | Logging raw authorization headers or full user payloads turns observability into a data-disclosure risk. |
| 4.2.8 | Configuring health checks and readiness probes | Configure load balancer/container readiness checks when traffic must avoid instances that are starting or disconnected from a required dependency. | Returning HTTP 200 from a process that cannot serve requests is liveness only, not readiness. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Understanding differences among logging, monitoring, and observability | Emit all three forms for distributed flows: structured logs for details, metrics for trends, traces for paths. | More raw log lines are not observability if they cannot be queried or correlated. |
| Implementing effective logs for application behavior and state | Log state transitions and boundary failures, not entire request bodies or secrets. | Free-form strings and unbounded debug payloads make Logs Insights and incident privacy worse. |
| Emitting custom application metrics | Add custom metrics when infrastructure metrics cannot state the business symptom. | Per-user/request-ID dimensions make metrics expensive and cannot replace logs for individual records. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 4.2.1 — Understanding differences among logging, monitoring, and observability


**What it means**

Logging records individual events, monitoring tracks known metrics/alarms, and observability connects logs, metrics, traces, and context to answer new questions.

> **Why it matters / exam signal:** More raw log lines are not observability if they cannot be queried or correlated.

**Build it**

1. Propagate one correlation ID and verify an operator can move from an alarm to the request trace and logs.
2. Verify **Understanding differences among logging, monitoring, and observability** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Emit all three forms for distributed flows: structured logs for details, metrics for trends, traces for paths.

**Avoid this**

- More raw log lines are not observability if they cannot be queried or correlated.

#### Skill 4.2.2 — Implementing effective logs for application behavior and state


**What it means**

Effective application logs use structured JSON with timestamp, level, request ID, operation, outcome, duration, version, and safe error class.

> **Why it matters / exam signal:** Free-form strings and unbounded debug payloads make Logs Insights and incident privacy worse.

**Build it**

1. Define an allowlist schema and test that a failed request emits searchable fields without tokens/PII.
2. Verify **Implementing effective logs for application behavior and state** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Log state transitions and boundary failures, not entire request bodies or secrets.

**Avoid this**

- Free-form strings and unbounded debug payloads make Logs Insights and incident privacy worse.

#### Skill 4.2.3 — Emitting custom application metrics


**What it means**

Custom metrics turn domain outcomes—orders accepted, validation failures, queue-age breach—into count, gauge, or latency time series for dashboards/alarms.

> **Why it matters / exam signal:** Per-user/request-ID dimensions make metrics expensive and cannot replace logs for individual records.

**Build it**

1. Emit a metric with low-cardinality dimensions, compare it to a known test event, and attach an actionable alarm.
2. Verify **Emitting custom application metrics** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Add custom metrics when infrastructure metrics cannot state the business symptom.

**Avoid this**

- Per-user/request-ID dimensions make metrics expensive and cannot replace logs for individual records.

#### Skill 4.2.4 — Adding trace annotations for searchable safe dimensions


**What it means**

X-Ray annotations are indexed key/value dimensions for filtering traces; metadata is nonindexed detail.

> **Why it matters / exam signal:** An annotation is searchable observability data, not a secure store for customer identifiers.

**Build it**

1. Add an annotation around the dependency segment and query traces by it during a test incident.
2. Verify **Adding trace annotations for searchable safe dimensions** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Put safe, low-cardinality fields such as environment, route, or tenant tier in annotations; keep secrets and high-cardinality identifiers out.

**Avoid this**

- An annotation is searchable observability data, not a secure store for customer identifiers.

#### Skill 4.2.5 — Implementing notification alerts for actions such as quota risk or deployment completion


**What it means**

CloudWatch alarms evaluate a metric over defined periods and can notify SNS or trigger a deployment rollback; quota alarms use service usage/limit signals.

> **Why it matters / exam signal:** Alerting on every transient error creates noise and does not meet an actionable-alert requirement.

**Build it**

1. Set threshold/evaluation periods from baseline, test the alarm path, and include runbook/version context in notification.
2. Verify **Implementing notification alerts for actions such as quota risk or deployment completion** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Alert only when a named owner can take a documented action; use a dashboard for passive information.

**Avoid this**

- Alerting on every transient error creates noise and does not meet an actionable-alert requirement.

#### Skill 4.2.6 — Implementing tracing with AWS services and tools


**What it means**

X-Ray tracing propagates trace context across supported services and records segments/subsegments with timing and errors for downstream calls.

> **Why it matters / exam signal:** A trace without propagated context fragments the request and cannot prove end-to-end latency.

**Build it**

1. Enable active tracing, instrument an external/database call, and verify the service map shows the dependency.
2. Verify **Implementing tracing with AWS services and tools** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use tracing to locate the slow hop in a distributed request; use logs for detailed values and metrics for fleet trend.

**Avoid this**

- A trace without propagated context fragments the request and cannot prove end-to-end latency.

#### Skill 4.2.7 — Implementing structured logging for application events and user actions


**What it means**

Structured logging emits typed JSON fields so an operator can filter `requestId`, `route`, `outcome`, `durationMs`, and deployment version without parsing prose.

> **Why it matters / exam signal:** Logging raw authorization headers or full user payloads turns observability into a data-disclosure risk.

**Build it**

1. Run a Logs Insights aggregation for failures by route/version and verify sensitive fields are absent.
2. Verify **Implementing structured logging for application events and user actions** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Standardize schema at the logger boundary and retain only safe user-action indicators.

**Avoid this**

- Logging raw authorization headers or full user payloads turns observability into a data-disclosure risk.

#### Skill 4.2.8 — Configuring health checks and readiness probes


**What it means**

Liveness answers whether a process runs; readiness answers whether it can safely receive traffic because required dependencies/configuration are usable.

> **Why it matters / exam signal:** Returning HTTP 200 from a process that cannot serve requests is liveness only, not readiness. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Make readiness fail during a controlled dependency outage while liveness stays healthy, then verify traffic is withheld.
2. Verify **Configuring health checks and readiness probes** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Configure load balancer/container readiness checks when traffic must avoid instances that are starting or disconnected from a required dependency.

**Avoid this**

- Returning HTTP 200 from a process that cannot serve requests is liveness only, not readiness. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

### Task 3: Optimize applications by using AWS services and features
**Plain-language goal.** Measure the bottleneck, choose the smallest relevant resource, caching, filtering, or code change, and verify the improvement.
A strong answer begins by separating the business requirement from the AWS component. Name the required behavior first—durable handoff, verified identity, repeatable artifact, or evidence for an incident—then choose the managed feature that supplies it. The service name is the last step, not the first.
**End-to-end scenario.** A product API is slow during traffic peaks. Metrics show CPU-bound Lambda duration, traces show repeated product reads, and SNS subscribers receive many irrelevant messages. The team increases Lambda memory after a test, adds a safe cache-aside layer for products, and filters notifications by event type.
#### Decision table
| Evidence | Targeted optimization | Avoid |
|---|---|---|
| CPU-bound Lambda duration | Test higher memory | Blindly increasing timeout |
| Repeated identical safe reads | Application/ElastiCache cache | Caching personalized responses with shared key |
| Irrelevant SNS deliveries | Subscription filter policy | Filtering only after every consumer runs |
| Downstream overload | Reserved concurrency / queue | Unlimited parallelism |
| Variant response by header | Include necessary header in cache key | Serving one variant to all users |
| Slow unknown path | Profile/trace/log timing | Guessing based on cost alone |
#### Implementation walkthrough
1. Define concurrency as simultaneous units of work. In Lambda it affects downstream pressure, account limits, and throughput—not simply speed of one invocation.
2. Profile first: compare duration, initialization, memory use, downstream segment time, query count, and throttles. Change one variable and compare before/after.
3. For Lambda, test memory settings because more memory also grants more CPU. Choose the lowest setting that meets latency and reliability objectives after measurement.
4. Use SNS filter policies when a subscription only needs matching message attributes. This avoids delivery and processing work for irrelevant consumers.
5. Use cache-aside only for data that can safely be stale. Select a key that includes every request dimension that changes the response, define TTL, and invalidate/update after writes.
6. Read timestamps and duration fields in logs to locate bottlenecks; pair them with traces so a slow dependency is not mistaken for local code.
#### Configuration mechanics
| Cache choice | Best fit | Key rule |
|---|---|---|
| CloudFront/content cache | HTTP content variants | Include only headers/cookies/query values that vary response |
| ElastiCache | Shared low-latency data | Define invalidation and stale-data behavior |
| In-process cache | Short-lived reusable computation | It disappears with instance/Lambda lifecycle |
| DynamoDB DAX / store cache pattern | DynamoDB read acceleration | Do not bypass authorization/tenant keying |
#### What fails in production, and how to respond
- **Cache returns another user’s response:** The cache key omitted identity/tenant/variant. Purge, correct the key, and assess exposure.
- **Higher Lambda memory costs more but does not help:** Trace shows I/O or downstream dependency dominates; optimize connection/query/service path instead.
- **High concurrency overloads RDS:** Cap function concurrency, buffer through SQS, use connection management, and right-size based on downstream capacity.
#### Why tempting alternatives are wrong
- Increasing provisioned concurrency treats cold starts, not a slow database query.
- A subscription filter policy belongs on the subscription; filtering inside every consumer still spends delivery/compute.
- A global cache without invalidation/TTL is not a safe performance design.
> **Exam Tip:** Read qualifiers such as *independently*, *least operational overhead*, *private*, *automatic rollback*, and *near real time*. They eliminate otherwise valid services.
> **Trap:** Do not solve a requirement that was not stated. A sophisticated design with extra services is often wrong when a native managed feature answers the exact constraint.
**Keywords:** 4.3.1, 4.3.2, 4.3.3, 4.3.4, 4.3.5, 4.3.6, 4.3.7, 4.3.8, 4.3.9.
#### Skill learning matrix

| Skill | Architecture / service decision | Main decision | Main trap |
|---|---|---|---|
| 4.3.1 | Understanding concurrency and its throughput/downstream implications | Increase it only when the dependency capacity and account limits support it; cap reserved concurrency or buffer via SQS to protect a database/provider. | Higher concurrency can worsen an outage by overwhelming the already slow downstream service. |
| 4.3.2 | Profile application performance before changing resources | Optimize the measured dominant component, not the most familiar AWS setting. | Increasing Lambda memory cannot fix a third-party call that owns most of the trace time. |
| 4.3.3 | Choosing minimum memory and compute power through measured tests | Test adjacent sizes for CPU-bound code; investigate network/database time before increasing memory for I/O-bound work. | Selecting the largest memory value without measurement can increase cost with no user benefit. |
| 4.3.4 | Using SNS subscription filter policies to optimize messaging | Use a filter policy when one topic has consumers interested in different event types/regions; use EventBridge when rule-based event routing is the central requirement. | Filtering inside every Lambda after delivery still consumes invocation and downstream work. |
| 4.3.5 | Cache content based on request headers when those headers vary the response | Forward/include only required variant headers to preserve cache hit rate; do not share-cache personalized content unless the key is safe. | A product-only key for tenant pricing risks cross-tenant data exposure. |
| 4.3.6 | Implementing application-level caching with safe keys and expiry/invalidation | Cache repeated, safely stale reads in ElastiCache/DAX/application memory according to sharing and durability needs. | An in-process Lambda cache disappears on cold start and cannot be treated as shared durable state. |
| 4.3.7 | Optimize resource usage through right-sizing, reuse, batching, and controlled concurrency | Apply the smallest control identified by profile evidence: reuse SDK/database connections, tune batch size, or queue/cap work. | Larger batches can replay more successful records when one record fails. |
| 4.3.8 | Analyzing performance issues with baseline, evidence, and verified targeted changes | Fix the measured slow dependency, hot partition, cache miss pattern, or CPU limit rather than applying blanket scaling. | A lower average duration can hide worse tail latency or error rate, so compare the relevant SLO evidence. |
| 4.3.9 | Using application logs to identify bottlenecks through correlated timings and outcomes | Use logs to explain the slow request after metrics identify the affected interval and traces identify the likely hop. | An uncorrelated stack trace tells you an error happened but rarely identifies where total latency accumulated. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success. |

#### Service-choice table

| Requirement cue | Choose this | Avoid / main trap |
|---|---|---|
| Understanding concurrency and its throughput/downstream implications | Increase it only when the dependency capacity and account limits support it; cap reserved concurrency or buffer via SQS to protect a database/provider. | Higher concurrency can worsen an outage by overwhelming the already slow downstream service. |
| Profile application performance before changing resources | Optimize the measured dominant component, not the most familiar AWS setting. | Increasing Lambda memory cannot fix a third-party call that owns most of the trace time. |
| Choosing minimum memory and compute power through measured tests | Test adjacent sizes for CPU-bound code; investigate network/database time before increasing memory for I/O-bound work. | Selecting the largest memory value without measurement can increase cost with no user benefit. |

> **Exam Tip:** Start with the exact requirement cue in the matrix, then choose the native AWS capability named by that decision.
>
> **Trap:** Reject an option when it triggers one of this task's listed failure modes, even if the service is otherwise familiar.

#### Skill 4.3.1 — Understanding concurrency and its throughput/downstream implications


**What it means**

Concurrency is simultaneous work: Lambda executions, queue consumers, or container requests; it determines throughput and downstream pressure.

> **Why it matters / exam signal:** Higher concurrency can worsen an outage by overwhelming the already slow downstream service.

**Build it**

1. Load-test at a controlled concurrency and observe throttles, connection count, queue age, and p95 latency.
2. Verify **Understanding concurrency and its throughput/downstream implications** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Increase it only when the dependency capacity and account limits support it; cap reserved concurrency or buffer via SQS to protect a database/provider.

**Avoid this**

- Higher concurrency can worsen an outage by overwhelming the already slow downstream service.

#### Skill 4.3.2 — Profile application performance before changing resources


**What it means**

A profile combines p50/p95 duration, init time, CPU/memory, query count, dependency segments, cache hit rate, throttles, and cost before a change.

> **Why it matters / exam signal:** Increasing Lambda memory cannot fix a third-party call that owns most of the trace time.

**Build it**

1. Capture a baseline, change one variable, rerun the same load, and compare evidence.
2. Verify **Profile application performance before changing resources** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Optimize the measured dominant component, not the most familiar AWS setting.

**Avoid this**

- Increasing Lambda memory cannot fix a third-party call that owns most of the trace time.

#### Skill 4.3.3 — Choosing minimum memory and compute power through measured tests


**What it means**

Lambda memory selection changes memory and CPU, so the right value is the lowest measured setting that meets latency/reliability objectives at representative load.

> **Why it matters / exam signal:** Selecting the largest memory value without measurement can increase cost with no user benefit.

**Build it**

1. Record duration, Max Memory Used, throttles, and estimated cost for each run.
2. Verify **Choosing minimum memory and compute power through measured tests** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Test adjacent sizes for CPU-bound code; investigate network/database time before increasing memory for I/O-bound work.

**Avoid this**

- Selecting the largest memory value without measurement can increase cost with no user benefit.

#### Skill 4.3.4 — Using SNS subscription filter policies to optimize messaging


**What it means**

SNS subscription filter policies evaluate message attributes or body scope before delivery, so irrelevant subscribers do not receive/process the message.

> **Why it matters / exam signal:** Filtering inside every Lambda after delivery still consumes invocation and downstream work.

**Build it**

1. Publish messages with explicit attributes and test matching and nonmatching deliveries.
2. Verify **Using SNS subscription filter policies to optimize messaging** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use a filter policy when one topic has consumers interested in different event types/regions; use EventBridge when rule-based event routing is the central requirement.

**Avoid this**

- Filtering inside every Lambda after delivery still consumes invocation and downstream work.

#### Skill 4.3.5 — Cache content based on request headers when those headers vary the response


**What it means**

An HTTP cache key must include each header, cookie, query parameter, or identity dimension that changes the response, such as `Accept-Language` or tenant.

> **Why it matters / exam signal:** A product-only key for tenant pricing risks cross-tenant data exposure.

**Build it**

1. Request two language/tenant variants and confirm neither receives the other’s cached response.
2. Verify **Cache content based on request headers when those headers vary the response** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Forward/include only required variant headers to preserve cache hit rate; do not share-cache personalized content unless the key is safe.

**Avoid this**

- A product-only key for tenant pricing risks cross-tenant data exposure.

#### Skill 4.3.6 — Implementing application-level caching with safe keys and expiry/invalidation


**What it means**

Application cache-aside uses a complete key, bounded TTL, authoritative-store miss path, and write invalidation/update policy.

> **Why it matters / exam signal:** An in-process Lambda cache disappears on cold start and cannot be treated as shared durable state.

**Build it**

1. Test cold miss, hit, write invalidation, and expired entry behavior while monitoring hit rate and stale reads.
2. Verify **Implementing application-level caching with safe keys and expiry/invalidation** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Cache repeated, safely stale reads in ElastiCache/DAX/application memory according to sharing and durability needs.

**Avoid this**

- An in-process Lambda cache disappears on cold start and cannot be treated as shared durable state.

#### Skill 4.3.7 — Optimize resource usage through right-sizing, reuse, batching, and controlled concurrency


**What it means**

Right-sizing removes unused capacity, connection/client reuse avoids setup cost, batching balances throughput against retry blast radius, and concurrency caps protect downstream systems.

> **Why it matters / exam signal:** Larger batches can replay more successful records when one record fails.

**Build it**

1. Change one lever and compare latency, errors, throttles, and cost under identical load.
2. Verify **Optimize resource usage through right-sizing, reuse, batching, and controlled concurrency** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Apply the smallest control identified by profile evidence: reuse SDK/database connections, tune batch size, or queue/cap work.

**Avoid this**

- Larger batches can replay more successful records when one record fails.

#### Skill 4.3.8 — Analyzing performance issues with baseline, evidence, and verified targeted changes


**What it means**

Performance analysis starts with a baseline and a hypothesis tied to metrics, logs, and traces, then validates one targeted change against the same workload.

> **Why it matters / exam signal:** A lower average duration can hide worse tail latency or error rate, so compare the relevant SLO evidence.

**Build it**

1. Record before/after p95, errors, throughput, cost, and the changed version/configuration.
2. Verify **Analyzing performance issues with baseline, evidence, and verified targeted changes** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Fix the measured slow dependency, hot partition, cache miss pattern, or CPU limit rather than applying blanket scaling.

**Avoid this**

- A lower average duration can hide worse tail latency or error rate, so compare the relevant SLO evidence.

#### Skill 4.3.9 — Using application logs to identify bottlenecks through correlated timings and outcomes


**What it means**

Correlated structured logs expose per-step timestamps/durations, request ID, version, and safe outcome; joining them to trace IDs isolates a bottleneck.

> **Why it matters / exam signal:** An uncorrelated stack trace tells you an error happened but rarely identifies where total latency accumulated. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

**Build it**

1. Query a bounded window, calculate/inspect dependency timings, and compare a slow request to a healthy one.
2. Verify **Using application logs to identify bottlenecks through correlated timings and outcomes** with a representative success case and the failure condition named in the exam signal.

**Choose this**

- Use logs to explain the slow request after metrics identify the affected interval and traces identify the likely hop.

**Avoid this**

- An uncorrelated stack trace tells you an error happened but rarely identifies where total latency accumulated. **Checkpoint.** Explain the request path out loud: what starts the work, where durable state lives, which identity acts, how a failure is retried or surfaced, and what signal proves success.

## Appendix A: Service-selection decision tree

```mermaid
flowchart TD
 S[What must the application do?] --> A{Caller needs response now?}
 A -->|yes| B[API Gateway + Lambda/service]
 A -->|no| C{One consumer group or many?}
 C -->|one durable worker group| D[SQS]
 C -->|many independent consumers| E{Route by event content?}
 E -->|yes| F[EventBridge]
 E -->|simple pub/sub| G[SNS]
 B --> H{Need user sign-in?}
 H -->|yes| I[Cognito + JWT validation]
 H -->|no| J[Workload IAM role]
 D --> K{Complex stateful workflow?}
 K -->|yes| L[Step Functions]
 K -->|no| M[Worker Lambda]
```

| If the prompt says… | Favor | Anti-keyword / why not another |
|---|---|---|
| durable background work, smooth bursts | SQS | Not SNS alone: consumers need durable work queue |
| multiple independent reactions, event pattern | EventBridge | Not one SQS: it load-balances rather than fans out |
| notification fanout | SNS | Not Step Functions: no required coordinated state |
| user sign-in/JWT/federation | Cognito | Not IAM user: application users are not AWS operators |
| temporary workload credentials | IAM role / STS | Not access keys in source/environment |
| password/API-secret rotation | Secrets Manager | Not plaintext configuration |
| key-based millisecond lookup | DynamoDB | Not OpenSearch: transactional key access |
| words, relevance, faceting | OpenSearch | Not DynamoDB Query: no full-text relevance |
| trace one distributed request | X-Ray | Not metric alone: metrics lack request path |
| repeatable serverless IaC | SAM/CloudFormation | Not console-only configuration |

## Appendix B: Exam keywords, anti-keywords, and traps cheat sheet

| Keyword | Usually means | Anti-keyword |
|---|---|---|
| independently / decouple | Event, queue, fanout | synchronous chain |
| durable / retry later | SQS and idempotent worker | direct Lambda invocation only |
| immediate latest read | DynamoDB strong consistency when required | cache/eventual read |
| alternate DynamoDB lookup | GSI | Scan with filter |
| private database from Lambda | VPC subnet/SG | public subnet assumption |
| user identity | Cognito/JWT | Lambda execution role alone |
| temporary cross-account access | STS AssumeRole | copied static key |
| encrypt in transit | TLS | SSE alone |
| ciphertext before cloud | client-side encryption | server-side encryption |
| safe small release | canary/linear + alarms | all-at-once deploy |
| automatic rollback | known version + deployment/alarm | manual console edit |
| root cause | metric + log + trace correlation | one error chart |
| reduce irrelevant SNS work | subscription filter policy | filter after consumer invocation |

## Appendix C: Critical rules and numbers

| Remember | Rule |
|---|---|
| 32 / 26 / 24 / 18 | Domain weights: Development / Security / Deployment / Troubleshooting |
| 50 + 15 | Scored plus unscored question count |
| 130 minutes | Exam duration |
| 720 | Scaled passing score |
| Query before Scan | Model access pattern; a Scan filter still reads items |
| Roles before keys | AWS workloads use temporary role credentials |
| TLS + at-rest encryption | They protect separate threat paths |
| Idempotency before retry | Duplicate delivery is normal in distributed systems |
| VPC Lambda + NAT | NAT/route is needed for private-subnet internet egress |
| Canary | Small traffic first; alarms provide rollback signal |
| Metrics + logs + traces | Trend + detail + request path |

## Appendix D: Active recall — ten original practice scenarios

### 1. Order fanout
An order API must return after validation. Inventory, fulfillment, and analytics must independently receive the same business event, and a new consumer may be added later. What architecture fits best?

<details><summary>Answer and rationale</summary>Publish a versioned `OrderCreated` event to EventBridge and route it with rules to each consumer, adding SQS where a consumer needs durable buffering. EventBridge matches the independent, extensible, content-routed fanout requirement. One SQS queue would distribute each message to one consumer, not copy it to all. A synchronous API chain makes acceptance depend on every downstream service. SNS can fan out, but EventBridge is the more direct answer when structured event routing/rules are explicit.</details>

### 2. Lambda and private database
A Lambda connects to private RDS and calls a public shipping API. It is placed in private subnets but the shipping call times out. What is missing?

<details><summary>Answer and rationale</summary>Provide a valid egress route through NAT for the private subnets, in addition to appropriate security groups. VPC attachment enables private-resource connectivity; it does not give Lambda a public IP or internet route. Increasing timeout only makes the wait longer. Moving the database public expands exposure and does not address the stated design.</details>

### 3. DynamoDB access pattern
A service retrieves each customer’s recent invoices frequently and audits every invoice rarely. Which design is strongest?

<details><summary>Answer and rationale</summary>Use customer ID as a queryable partition key (or an index supporting it) with time as sort key, then Query recent invoices. A Scan with a filter wastes reads because filtering occurs after items are evaluated. OpenSearch is not the primary transactional answer for a predictable customer/time lookup.</details>

### 4. Tenant isolation
A JWT contains `tenantId`. The API request body also includes `tenantId`. What must code trust?

<details><summary>Answer and rationale</summary>Use the validated token claim as the authorization context and constrain the data access to that tenant. The request body is user-controlled and cannot grant access. Masking returned fields does not prevent an unauthorized read. A valid JWT alone is insufficient unless the code enforces the claim-to-resource relationship.</details>

### 5. Cross-account KMS object
Account B’s role can call `s3:GetObject` on an SSE-KMS object in Account A but gets access denied. What likely remains?

<details><summary>Answer and rationale</summary>Allow the cross-account principal to use the KMS key through the key policy and appropriate caller IAM permission. S3 object permission and KMS decrypt permission are separate gates. Turning off encryption violates the requirement; adding only more S3 permission does not authorize decrypt.</details>

### 6. Artifact reproducibility
A test pipeline passed yesterday, but today the same commit deploys a different container because it references `latest`. What change fits?

<details><summary>Answer and rationale</summary>Build and promote an immutable image tag or digest tied to the commit, and deploy that approved identity. `latest` is floating and makes tests nonreproducible. Rebuilding separately per environment can introduce different dependencies; use one artifact through promotion.</details>

### 7. Safe serverless release
A new Lambda release needs 10% traffic first and automatic recovery when error rate rises. What is required?

<details><summary>Answer and rationale</summary>Use a published Lambda version behind an alias with a canary or linear CodeDeploy strategy and CloudWatch alarms for rollback. An all-at-once alias update has no limited exposure. A DLQ handles invocation failures, not release traffic rollback.</details>

### 8. Failed event processing
An SQS-triggered Lambda succeeds for nine messages but fails one malformed record. How should repeat work be minimized?

<details><summary>Answer and rationale</summary>Validate records and use partial batch response where supported so only failed item identifiers are retried; send exhausted failures to a DLQ. Retrying a whole batch repeats successful work and requires stronger idempotency. Deleting the malformed message without a failure path loses evidence.</details>

### 9. Latency investigation
After deployment, duration rises but error rate stays low. Which evidence path most strongly finds the cause?

<details><summary>Answer and rationale</summary>Compare deployment/version and CloudWatch duration metrics over the affected window, inspect X-Ray traces for the slow segment, and query correlated structured logs by trace/request ID. An error-only alarm is insufficient because the symptom is latency. Raising memory before locating the slow hop is guessing.</details>

### 10. Cache safety
A CloudFront-backed endpoint varies by `Accept-Language` and authenticated tenant. What cache design principle matters?

<details><summary>Answer and rationale</summary>Include every dimension that changes the response in the cache key or do not cache the personalized response at that shared layer. Omitting tenant can expose data across tenants; omitting language returns the wrong variant. Caching is not automatically safe merely because it improves latency.</details>

## Appendix E: Four-week study plan

### Week 1 — Build request and event paths
- Study Domain 1 Task 1 and Task 2 first: sync versus async, queues, EventBridge, Step Functions, Lambda invocation modes, VPC networking, and retries.
- Draw the serverless API and Lambda failure diagrams from memory.
- Lab: API Gateway → Lambda → DynamoDB; publish one EventBridge event; add an SQS consumer and a DLQ.
- Recall prompt: explain why a queue needs idempotent consumers.

### Week 2 — Model data and protect it
- Study Domain 1 Task 3 and all Domain 2 tasks.
- Design three DynamoDB access patterns before choosing a key; practice Query versus Scan explanations.
- Lab: Cognito sign-in → API authorization → tenant-scoped DynamoDB query; retrieve a secret at runtime.
- Recall prompt: distinguish Cognito identity, execution role permissions, STS delegation, TLS, and SSE-KMS.

### Week 3 — Ship repeatably
- Study Domain 3 in order: artifact, deployed integration tests, automated fixtures/IaC, then CI/CD strategies.
- Lab: SAM template with dev/test parameters; deploy test stack; invoke saved events; promote one immutable artifact.
- Simulate a canary rollback with an alarm condition and explain the known-good version.
- Recall prompt: state what CodePipeline, CodeBuild, and CodeDeploy each own.

### Week 4 — Diagnose and decide
- Study Domain 4 and revisit every practice scenario without opening answers.
- Lab: add JSON logs, EMF metric, X-Ray trace/annotation, dashboard, and an actionable alarm to the Week 1 app.
- Introduce one controlled timeout or permission failure; write the metric → trace → log investigation sequence.
- Final review: recite the cheat sheet, critical rules, all task checkpoints, and choose the smallest service for each scenario.

## Final exam checklist

- Can you distinguish queue, pub/sub, event routing, stream, and stateful workflow from the requirement words?
- Can you explain Lambda invocation ownership, VPC networking, timeout/concurrency, and terminal failure handling?
- Can you model a DynamoDB key/index from an access pattern and reject Scan distractors?
- Can you separate authentication, authorization, workload roles, STS, secrets, TLS, and KMS?
- Can you promote one immutable artifact through test, canary/blue-green/rolling deployment, health verification, and rollback?
- Can you use metrics, logs, traces, dashboards, alarms, and readiness as complementary evidence?
## Appendix F: Task-by-task implementation drills
These drills turn each official task into a concrete review sequence. Read the prompt, describe the control boundary, then explain how you would test the design and recognize its failure signal.
### Drill for Task 1.1 Hosted applications
**Situation.** A request contains a valid idempotency key and two retryable downstream failures.

**Design response.** Validate before side effects; persist the idempotency outcome; publish a durable event; return the stable response.

**Evidence to capture.** Record request ID, idempotency key hash, event ID, dependency duration, retry count, and final outcome.

**Configuration rule.** Do not log the full request if it may contain private data.

**Distractor check.** A retry without an idempotency design is duplicate business work, not resilience.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 1.2 Lambda
**Situation.** An SQS batch contains eight valid records and one record that fails validation.

**Design response.** Process records independently, return partial batch failures where supported, and preserve terminal failure evidence in a DLQ.

**Evidence to capture.** Watch Errors, Throttles, Duration, IteratorAge where relevant, DLQ depth, and downstream connection failures.

**Configuration rule.** Set visibility timeout with enough margin for handler runtime and retries.

**Distractor check.** A larger batch improves throughput only if replay cost and downstream capacity remain safe.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 1.3 Data stores
**Situation.** The product endpoint needs lookup by product ID, seller history by date, and a category page.

**Design response.** Write these as three access patterns; use the primary key for ID, a seller/date query pattern, and a GSI for category.

**Evidence to capture.** Watch consumed capacity, throttles, latency, hot-key distribution, cache hit rate, and GSI lag.

**Configuration rule.** Use a schema/version attribute during serialization changes.

**Distractor check.** A filter expression is not an index and cannot make a Scan cheap.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 2.1 Identity and authorization
**Situation.** A signed-in user requests a record using a tenant ID supplied in the URL.

**Design response.** Validate the token at the boundary, derive tenant context from claims, and authorize the action before constructing the data query.

**Evidence to capture.** Record safe principal/tenant hash, authorization result, policy decision reason, request ID, and denied action.

**Configuration rule.** Use roles for AWS calls and user tokens for user identity; they are different identities.

**Distractor check.** A successful authentication result must never be treated as blanket resource permission.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 2.2 Encryption
**Situation.** A role from another account reads a KMS-encrypted object.

**Design response.** Test object access and decrypt permission separately; check caller IAM policy, bucket policy, and KMS key policy.

**Evidence to capture.** Record key identifier, encryption mode, request ID, and authorization result—but never plaintext or key material.

**Configuration rule.** Use TLS for upload/download even when the object uses SSE-KMS.

**Distractor check.** At-rest encryption cannot repair an unencrypted network hop.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 2.3 Sensitive data
**Situation.** A log line needs to help debug an insurance verification without exposing the identifier.

**Design response.** Create a field allowlist, mask the identifier to the last four characters when needed, and omit secret/token payloads.

**Evidence to capture.** Review log access, redaction tests, secret retrieval errors, rotation status, and tenant-denied attempts.

**Configuration rule.** Treat environment-variable readers as sensitive principals when variables contain secrets.

**Distractor check.** Display masking is not a substitute for backend authorization.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 3.1 Artifacts
**Situation.** A build works locally but fails after Lambda deployment due to a native dependency.

**Design response.** Build against the target runtime/architecture, package only required files, and test the exact ZIP or image artifact.

**Evidence to capture.** Record artifact digest, commit, dependency lock version, runtime, architecture, build result, and test result.

**Configuration rule.** Use external configuration for endpoints and feature flags so one artifact can progress.

**Distractor check.** Rebuilding an unpinned artifact for production breaks the approval chain.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 3.2 Development tests
**Situation.** A handler unit test passes but the deployed API returns a gateway error.

**Design response.** Invoke the stage endpoint and inspect API integration, Lambda permission, mapping, runtime logs, and deployed configuration.

**Evidence to capture.** Record stage, artifact version, test fixture ID, response code, trace ID, and expected persisted state.

**Configuration rule.** Mock third-party behavior, but keep selected AWS integration paths real in staging.

**Distractor check.** A local happy-path invocation cannot prove IAM or API Gateway wiring.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 3.3 Automated tests
**Situation.** A release must be tested with the exact same event and infrastructure every time.

**Design response.** Version JSON fixtures and IaC, deploy a test stack, invoke the fixture, assert output/state, and save the artifact identity.

**Evidence to capture.** Record template version, parameters excluding secrets, stack ID, fixture ID, alias/image digest, and assertion outcome.

**Configuration rule.** Use a Lambda alias or immutable image reference as an approved integration target.

**Distractor check.** Stack creation success does not prove the application behavior is correct.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 3.4 CI/CD
**Situation.** A canary must stop automatically when customer-visible errors increase.

**Design response.** Publish a version, shift alias traffic through the deployment strategy, attach relevant CloudWatch alarms, and verify rollback to prior version.

**Evidence to capture.** Record source revision, build ID, deployment ID, traffic percentage, alarm state, version, and rollback result.

**Configuration rule.** Use branch/tag controls to ensure the intended source starts the pipeline.

**Distractor check.** An all-at-once deployment has no initial blast-radius control.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 4.1 Root cause analysis
**Situation.** Latency increased after a release, but error rate is flat.

**Design response.** Bound the time window, compare metrics and release version, locate slow trace segment, then query correlated structured logs.

**Evidence to capture.** Record baseline/degraded duration, trace ID, dependency timing, deployment version, hypothesis, change, and verification.

**Configuration rule.** Read the first failed stack resource event during deployment diagnosis.

**Distractor check.** An error-rate graph alone does not identify a latency root cause.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 4.2 Observability
**Situation.** Operators need to search checkout requests and alert only on actionable payment failures.

**Design response.** Emit JSON logs and EMF metrics, propagate a correlation ID, trace dependency calls, and set alarm thresholds with an owner/runbook.

**Evidence to capture.** Record route, outcome, safe error class, duration, version, request ID, metric dimensions, and readiness state.

**Configuration rule.** Use indexed annotations only for safe, useful trace dimensions.

**Distractor check.** Logging everything creates privacy risk and makes signal harder to find.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
### Drill for Task 4.3 Optimization
**Situation.** A Lambda is slow, repeated reads dominate traces, and an SNS consumer receives irrelevant events.

**Design response.** Measure baseline; test memory settings; add cache-aside only for safe reads; apply subscription filter policy; compare results after one change at a time.

**Evidence to capture.** Record p50/p95 duration, memory setting, cache hit/miss, downstream calls, consumer deliveries, concurrency, and cost trend.

**Configuration rule.** Include every response-varying header or tenant dimension in a shared cache key.

**Distractor check.** Increasing memory cannot fix an I/O-bound dependency that dominates the trace.

**Hands-on sequence.**
1. Create a minimal development fixture with a known identifier and a deliberately expected outcome.
2. Configure the least-privilege role, template parameter, event source, or endpoint needed by the situation.
3. Exercise one successful path and one controlled failure path; do not stop after a successful deployment.
4. Use the listed evidence fields to correlate the request, deployed version, and downstream result.
5. Change one relevant variable only, repeat the test, and compare to the baseline.

**Exam narration.** State the business constraint first, then the AWS mechanism, then why a plausible alternative misses a stated requirement. This structure prevents answer choices from pulling you toward a familiar but unrelated service.

**Review questions.**
- Which component owns retry and when does it stop?
- Which identity authorizes this operation, and where is the decision enforced?
- What durable record or artifact lets you reproduce the result?
- Which metric, log field, or trace segment proves the expected behavior?
- What is the smallest rollback or recovery action if the test fails?

> **Exam Tip:** A correct design includes an observable outcome and a controlled failure path, not just a named AWS service.

---
## Appendix G: Rapid architecture decision practice
Use these compact drills after the detailed scenarios. Say the reason before the service name.
### API timeout versus queue
**Requirement:** A caller requires an immediate confirmed price, but a receipt email can arrive later.
**Decision:** Use synchronous API processing for price and asynchronous event/queue work for receipt.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not move the price calculation to an unobserved queue because the caller needs its answer.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### FIFO claim
**Requirement:** A workflow requires strict ordering within one customer order stream.
**Decision:** State the scope of ordering and choose FIFO only when that ordering/deduplication requirement is explicit.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not choose FIFO merely because it sounds safer; standard throughput and ordering may be sufficient.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### DynamoDB consistency
**Requirement:** A screen must display the just-written account status before the response returns.
**Decision:** Use the write result or a strongly consistent read when the stated immediate-read requirement applies.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not pay for strong consistency everywhere when normal eventual behavior is acceptable.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### Secret retrieval
**Requirement:** A database password is rotated by policy.
**Decision:** Retrieve it through Secrets Manager using the workload role and plan cache refresh.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not package the password or assume an old cached value remains valid forever.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### Certificate trust
**Requirement:** An internal service needs a certificate trusted only within the company.
**Decision:** Use a private certificate/PKI design appropriate to private trust.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not use a public certificate expectation for a hostname that external public clients do not need to trust.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### Stage endpoint
**Requirement:** A test team must validate a changed API mapping without disturbing production clients.
**Decision:** Deploy and invoke a separate API stage/environment with its own configuration.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not point test clients at production just because the Lambda source is shared.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### Rollback evidence
**Requirement:** A deployment alarm fires during traffic shifting.
**Decision:** Roll back to the recorded known-good version and compare version-tagged telemetry.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not edit source or console configuration during the incident before preserving evidence.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### Log query
**Requirement:** A single customer reports a failed checkout at a known time.
**Decision:** Bound Logs Insights by time and correlate request or trace ID before broad text search.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not search all logs for a vague exception string and call the first match root cause.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### Cache key
**Requirement:** Responses vary by locale and tenant.
**Decision:** Include both dimensions where cacheable, or avoid shared caching of personalized response.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not use a global product-only cache key for tenant-specific pricing.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.

### Concurrency
**Requirement:** A downstream API begins rejecting calls during a burst.
**Decision:** Bound Lambda concurrency or buffer through SQS, then retry safely within provider limits.
**Why:** The chosen control directly addresses the stated boundary while keeping failure behavior observable and reversible.
**Reject:** Do not increase concurrency because a backlog exists; that can amplify the downstream outage.
**Verification:** Use a representative test input, capture version and correlation ID, then confirm the relevant metric, log, trace, or durable state.
**Memory hook:** Constraints decide architecture; service names follow constraints.
