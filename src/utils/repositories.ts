export const REPOSITORIES = {
  pet: 'https://github.com/davshn/narsil-pet',
  check: 'https://github.com/davshn/narsil-check',
} as const

export type RepositoryKey = keyof typeof REPOSITORIES
