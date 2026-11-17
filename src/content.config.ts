import { glob } from 'astro/loaders'
import { defineCollection } from 'astro:content'

import { guideSchema } from '@content/schema'

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: guideSchema,
})

export const collections = { guides }
