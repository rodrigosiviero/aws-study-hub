import { defineCollection, z } from 'astro:content';

const certs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    code: z.string().optional(),
    status: z.enum(['complete', 'coming-soon']).default('coming-soon'),
    // Short description used on the home page cert cards.
    description: z.string().optional(),
    // Order in the header nav / home grid.
    order: z.number().default(99),
  }),
});

export const collections = { certs };
