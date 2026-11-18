import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { h } from 'preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BotConfigGenerator, type BotConfigCopy } from './BotConfigGenerator'

const copy: BotConfigCopy = {
  hostLabel: 'Your PC address on the network',
  timezoneLabel: 'Time zone offset (hours)',
  modelLabel: 'Model',
  models: { 'claude-opus-5-5': 'Claude Opus 5.5', 'claude-haiku-5-5': 'Claude Haiku 5.5' },
  effortLabel: 'Effort',
  efforts: { low: 'Low', medium: 'Medium', high: 'High' },
  maxTokensLabel: 'Max tokens',
  voiceLabel: 'Edge voice',
  resultLabel: 'data/.config.yaml',
  invalid: {
    host: 'Use a private address.',
    timezone: 'Use a whole offset.',
    model: 'Pick a model.',
    effort: 'Pick an effort.',
    maxTokens: 'Use 1 to 128000.',
    voice: 'Use an Edge voice name.',
  },
  copy: 'Copy',
  copied: 'Copied',
  keyNote: 'The key is a placeholder.',
}

const result = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('[data-bot-config-result]')
  if (element === null) throw new Error('No result')
  return element
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BotConfigGenerator', () => {
  it('starts with the configuration of guides 4 to 6', () => {
    render(h(BotConfigGenerator, { copy }))
    expect(result().textContent).toContain('websocket: ws://192.168.1.50:8000/xiaozhi/v1/')
    expect(result().textContent).toContain('model_name: claude-opus-5-5')
    expect(result().textContent).toContain('The key is a placeholder.')
  })

  it('updates the file as the options change', () => {
    render(h(BotConfigGenerator, { copy }))
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'claude-haiku-5-5' } })
    fireEvent.change(screen.getByLabelText('Effort'), { target: { value: 'medium' } })
    fireEvent.input(screen.getByLabelText('Max tokens'), { target: { value: '1024' } })
    fireEvent.input(screen.getByLabelText('Time zone offset (hours)'), { target: { value: '1' } })
    fireEvent.input(screen.getByLabelText('Edge voice'), {
      target: { value: 'es-ES-ElviraNeural' },
    })
    expect(result().textContent).toContain('model_name: claude-haiku-5-5')
    expect(result().textContent).toContain('effort: medium')
    expect(result().textContent).toContain('max_tokens: 1024')
    expect(result().textContent).toContain('timezone_offset: 1')
    expect(result().textContent).toContain('voice: es-ES-ElviraNeural')
  })

  it('shows why a value is refused instead of the file', () => {
    render(h(BotConfigGenerator, { copy }))
    fireEvent.input(screen.getByLabelText('Your PC address on the network'), {
      target: { value: '8.8.8.8' },
    })
    expect(screen.getByRole('status').textContent).toBe('Use a private address.')
    expect(result().querySelector('pre')).toBeNull()
    fireEvent.input(screen.getByLabelText('Your PC address on the network'), {
      target: { value: '192.168.1.50' },
    })
    fireEvent.input(screen.getByLabelText('Max tokens'), { target: { value: '' } })
    expect(result().textContent).toContain('Use 1 to 128000.')
  })

  it('keeps the copy button when the clipboard refuses', async () => {
    const writeText = vi.fn(async () => {
      await Promise.reject(new Error('denied'))
    })
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(h(BotConfigGenerator, { copy }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    expect(screen.getByRole('button', { name: 'Copy' })).not.toBeNull()
  })

  it('copies the file and says so until it changes', async () => {
    const writeText = vi.fn(async () => {
      await Promise.resolve()
    })
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(h(BotConfigGenerator, { copy }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('type: claude'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).not.toBeNull()
    })
    fireEvent.input(screen.getByLabelText('Max tokens'), { target: { value: '2048' } })
    expect(screen.getByRole('button', { name: 'Copy' })).not.toBeNull()
  })
})
