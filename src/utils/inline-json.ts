const UNSAFE_CHARACTERS = /<|>|&|\u2028|\u2029/gv

const ESCAPES: Readonly<Record<string, string>> = {
  '<': String.raw`\u003c`,
  '>': String.raw`\u003e`,
  '&': String.raw`\u0026`,
  '\u2028': String.raw`\u2028`,
  '\u2029': String.raw`\u2029`,
}

export function serializeForInlineScript(value: object | string): string {
  return JSON.stringify(value).replace(UNSAFE_CHARACTERS, (char) => ESCAPES[char] ?? char)
}
