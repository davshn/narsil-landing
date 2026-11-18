export const BOT_MODELS = ['claude-opus-5-5', 'claude-haiku-5-5'] as const
export const BOT_EFFORTS = ['low', 'medium', 'high'] as const

export type BotModel = (typeof BOT_MODELS)[number]
export type BotEffort = (typeof BOT_EFFORTS)[number]

export interface BotOptions {
  host: string
  timezone: number
  model: BotModel
  effort: BotEffort
  maxTokens: number
  voice: string
}

export type BotConfig = { kind: 'ok'; yaml: string } | { kind: 'invalid'; field: keyof BotOptions }

export const DEFAULT_BOT_OPTIONS: BotOptions = {
  host: '192.168.1.50',
  timezone: -5,
  model: 'claude-opus-5-5',
  effort: 'low',
  maxTokens: 4096,
  voice: 'es-MX-DaliaNeural',
}

const MAX_OUTPUT_TOKENS = 128_000
const OCTET = /^(?:0|[1-9]\d{0,2})$/v
const VOICE = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/v

const PERSONA = `prompt: |
  You are Narsil, a small chibi sea serpent who lives on the author's desk.
  Your name comes from the reforged sword in The Lord of the Rings: you are
  here to cut bugs. You are calm, warm and composed, a little playful, never
  servile. You speak of yourself in the first person and never say your own
  name. Now and then you borrow an image from the sea, without overdoing it.
  You answer for a voice: at most two short sentences unless asked for more,
  no lists, no Markdown, no code read aloud. Speak neutral Latin American
  Spanish, with the simple past.

system_error_response: 'Tuve un tropiezo y no pude responder. Probemos de nuevo en un momento.'

end_prompt:
  enable: true
  prompt: |
    Say a short, warm goodbye in one sentence, as Narsil would.

exit_commands:
  - 'salir'
  - 'adiós'
`

function octetsOf(host: string): number[] | undefined {
  const parts = host.split('.')
  if (parts.length !== 4 || !parts.every((part) => OCTET.test(part))) return undefined
  const octets = parts.map(Number)
  return octets.every((octet) => octet <= 255) ? octets : undefined
}

function privateIpv4(host: string): boolean {
  const [a, b = 0] = octetsOf(host) ?? []
  if (a === 10) return true
  if (a === 172) return b >= 16 && b <= 31
  return a === 192 && b === 168
}

function invalidField(options: BotOptions): keyof BotOptions | undefined {
  if (!privateIpv4(options.host.trim())) return 'host'
  if (!Number.isInteger(options.timezone) || options.timezone < -12 || options.timezone > 14) {
    return 'timezone'
  }
  if (
    !Number.isInteger(options.maxTokens) ||
    options.maxTokens < 1 ||
    options.maxTokens > MAX_OUTPUT_TOKENS
  ) {
    return 'maxTokens'
  }
  if (!VOICE.test(options.voice.trim())) return 'voice'
  return undefined
}

export function botConfig(options: BotOptions): BotConfig {
  const field = invalidField(options)
  if (field !== undefined) return { kind: 'invalid', field }
  const yaml = `server:
  websocket: ws://${options.host.trim()}:8000/xiaozhi/v1/
  timezone_offset: ${options.timezone}

selected_module:
  ASR: OpenaiASR
  TTS: EdgeTTS
  LLM: ClaudeLLM
  Intent: nointent

ASR:
  OpenaiASR:
    api_key: sk-EXAMPLE-not-a-real-key

LLM:
  ClaudeLLM:
    type: claude
    model_name: ${options.model}
    max_tokens: ${options.maxTokens}
    effort: ${options.effort}

TTS:
  EdgeTTS:
    voice: ${options.voice.trim()}
    language: Spanish

${PERSONA}`
  return { kind: 'ok', yaml }
}
