export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(?<key>\w+)\}/gv, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  )
}
