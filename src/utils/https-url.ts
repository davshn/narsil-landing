export function isHttpsUrl(value: string): boolean {
  if (!URL.canParse(value)) return false
  return new URL(value).protocol === 'https:'
}
