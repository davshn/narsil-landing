import { describe, expect, it } from 'vitest'

import { botConfig, DEFAULT_BOT_OPTIONS, type BotOptions } from '../bot-config'

const build = (change: Partial<BotOptions> = {}): ReturnType<typeof botConfig> =>
  botConfig({ ...DEFAULT_BOT_OPTIONS, ...change })

const yamlOf = (change: Partial<BotOptions> = {}): string => {
  const result = build(change)
  if (result.kind !== 'ok') throw new Error(`Expected a configuration, got ${result.field}`)
  return result.yaml
}

describe('botConfig', () => {
  it('writes the server, the modules, Claude and the voice from guides 4 to 6', () => {
    const yaml = yamlOf()
    expect(yaml).toContain('  websocket: ws://192.168.1.50:8000/xiaozhi/v1/\n')
    expect(yaml).toContain('  timezone_offset: -5\n')
    expect(yaml).toContain(
      'selected_module:\n  ASR: OpenaiASR\n  TTS: EdgeTTS\n  LLM: ClaudeLLM\n  Intent: nointent\n',
    )
    expect(yaml).toContain(
      'LLM:\n  ClaudeLLM:\n    type: claude\n    model_name: claude-opus-5-5\n    max_tokens: 4096\n    effort: low\n',
    )
    expect(yaml).toContain(
      'TTS:\n  EdgeTTS:\n    voice: es-MX-DaliaNeural\n    language: Spanish\n',
    )
    expect(yaml).toContain('prompt: |\n  You are Narsil, a small chibi sea serpent')
    expect(yaml).toContain("exit_commands:\n  - 'salir'\n  - 'adiós'\n")
  })

  it('never carries a real key: only the placeholder for speech recognition', () => {
    const yaml = yamlOf()
    expect(yaml).toContain('    api_key: sk-EXAMPLE-not-a-real-key\n')
    expect(yaml).not.toMatch(/sk-ant-/v)
    expect(yaml).not.toMatch(/ANTHROPIC_API_KEY/v)
  })

  it('takes the chosen model, effort, ceiling, voice, address and time zone', () => {
    const yaml = yamlOf({
      model: 'claude-haiku-5-5',
      effort: 'medium',
      maxTokens: 1024,
      voice: 'es-ES-ElviraNeural',
      host: '10.0.0.7',
      timezone: 1,
    })
    expect(yaml).toContain('    model_name: claude-haiku-5-5\n')
    expect(yaml).toContain('    effort: medium\n')
    expect(yaml).toContain('    max_tokens: 1024\n')
    expect(yaml).toContain('    voice: es-ES-ElviraNeural\n')
    expect(yaml).toContain('  websocket: ws://10.0.0.7:8000/xiaozhi/v1/\n')
    expect(yaml).toContain('  timezone_offset: 1\n')
  })

  it('rejects a value that would break the file or leave the network', () => {
    expect(build({ host: 'example.com' })).toEqual({ kind: 'invalid', field: 'host' })
    expect(build({ host: '192.168.1.300' })).toEqual({ kind: 'invalid', field: 'host' })
    expect(build({ host: '8.8.8.8' })).toEqual({ kind: 'invalid', field: 'host' })
    expect(build({ voice: 'es-MX-Dalia: x' })).toEqual({ kind: 'invalid', field: 'voice' })
    expect(build({ timezone: 15 })).toEqual({ kind: 'invalid', field: 'timezone' })
    expect(build({ timezone: 1.5 })).toEqual({ kind: 'invalid', field: 'timezone' })
    expect(build({ maxTokens: 0 })).toEqual({ kind: 'invalid', field: 'maxTokens' })
    expect(build({ maxTokens: 200_000 })).toEqual({ kind: 'invalid', field: 'maxTokens' })
  })

  it('accepts every private IPv4 range', () => {
    ;['10.1.2.3', '172.16.0.4', '172.31.255.1', '192.168.0.10'].forEach((host) => {
      expect(build({ host }).kind).toBe('ok')
    })
    expect(build({ host: '172.32.0.1' })).toEqual({ kind: 'invalid', field: 'host' })
  })
})
