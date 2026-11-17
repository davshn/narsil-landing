import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Window } from 'happy-dom'

import type { HTMLElement } from 'happy-dom'

type AstroComponent = Parameters<AstroContainer['renderToString']>[0]

interface RenderOptions {
  props?: Record<string, unknown>
  slots?: Record<string, string>
}

const containerReady = AstroContainer.create()

export async function render(
  component: AstroComponent,
  { props = {}, slots = {} }: RenderOptions = {},
): Promise<HTMLElement> {
  const container = await containerReady
  const html = await container.renderToString(component, { props, slots })
  const { document } = new Window()
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}
