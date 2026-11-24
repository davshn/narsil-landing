export const REPOSITORIES = {
  pet: 'https://github.com/davshn/narsil-pet',
  check: 'https://github.com/davshn/narsil-check',
  android: 'https://github.com/davshn/narsil-android',
  watch: 'https://github.com/davshn/narsil-watch',
} as const

export type RepositoryKey = keyof typeof REPOSITORIES

export const REPOSITORY_LICENSES: Record<RepositoryKey, string> = {
  pet: 'GPL v3',
  check: 'GPL v3',
  android: 'MIT',
  watch: 'GPL v3',
}
