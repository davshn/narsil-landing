import { z } from 'astro/zod'

export const guideRoutes = ['mods', 'pet', 'check', 'bot', 'claude'] as const
export type GuideRoute = (typeof guideRoutes)[number]

export const sourceRepositories = ['pet', 'check'] as const
export type SourceRepository = (typeof sourceRepositories)[number]

export const guideSourceSchema = z.object({
  repo: z.enum(sourceRepositories),
  path: z
    .string()
    .regex(
      /^(?!(?:.*\/)?\.\.?(?:\/|$))[\w.\-]+(?:\/[\w.\-]+)*$/v,
      'Use a repository-relative path such as hooks/register.tsx',
    ),
})

export const guideSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(200),
  route: z.enum(guideRoutes),
  order: z.number().int().positive(),
  updated: z.coerce.date(),
  verifiedWith: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/v, 'Use the Claude Code version the guide was checked against')
    .optional(),
  sources: z.array(guideSourceSchema).default([]),
  draft: z.boolean().default(false),
})

export type GuideSource = z.infer<typeof guideSourceSchema>
export type GuideData = z.infer<typeof guideSchema>
