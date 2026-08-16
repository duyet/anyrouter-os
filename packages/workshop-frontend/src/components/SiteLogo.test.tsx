// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ServerConfig } from '@gadgets/workshop-shared/api'
import { ServerConfigContext } from '../ServerConfigContext'
import SiteLogo from './SiteLogo'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('SiteLogo', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    vi.useRealTimers()
    act(() => root?.unmount())
    container?.remove()
  })

  function render(logoUrl?: string) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    let config = { siteLogo: logoUrl ? { url: logoUrl } : undefined } as ServerConfig
    act(() => root!.render(
      <ServerConfigContext.Provider value={config}>
        <SiteLogo size={20}><span data-fallback>fallback</span></SiteLogo>
      </ServerConfigContext.Provider>,
    ))
  }

  function rerender(logoUrl?: string) {
    let config = { siteLogo: logoUrl ? { url: logoUrl } : undefined } as ServerConfig
    act(() => root!.render(
      <ServerConfigContext.Provider value={config}>
        <SiteLogo size={20}><span data-fallback>fallback</span></SiteLogo>
      </ServerConfigContext.Provider>,
    ))
  }

  it('renders the configured logo as a decorative contained image', () => {
    render('/api/site-logo?v=revision')
    let image = container!.querySelector('img')!
    expect(image.getAttribute('src')).toBe('/api/site-logo?v=revision')
    expect(image.getAttribute('alt')).toBe('')
    expect(image.width).toBe(20)
    expect(image.height).toBe(20)
    expect(container!.querySelector('[data-fallback]')).toBeNull()
  })

  it('uses the supplied fallback when no logo is configured or loading fails', () => {
    render()
    expect(container!.querySelector('[data-fallback]')).not.toBeNull()

    act(() => root!.unmount())
    container!.remove()
    root = undefined
    container = undefined
    render('/api/site-logo?v=revision')
    act(() => container!.querySelector('img')!.dispatchEvent(new Event('error')))
    expect(container!.querySelector('img')).toBeNull()
    expect(container!.querySelector('[data-fallback]')).not.toBeNull()

    rerender('/api/site-logo?v=revision')
    expect(container!.querySelector('img')).not.toBeNull()
  })

  it('uses an explicit null override for the Admin reset preview', () => {
    render('/api/site-logo?v=configured')
    const config = { siteLogo: { url: '/api/site-logo?v=configured' } } as ServerConfig
    act(() => root!.render(
      <ServerConfigContext.Provider value={config}>
        <SiteLogo size={20} srcOverride={null}>
          <span data-fallback>fallback</span>
        </SiteLogo>
      </ServerConfigContext.Provider>,
    ))

    expect(container!.querySelector('img')).toBeNull()
    expect(container!.querySelector('[data-fallback]')).not.toBeNull()
  })

  it('renders a dual lockup when a secondary mark is configured', () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    const config = {
      siteLogo: { url: '/api/site-logo?v=revision', secondary: { url: '/favicon.svg' } },
    } as ServerConfig
    act(() => root!.render(
      <ServerConfigContext.Provider value={config}>
        <SiteLogo size={20}><span data-fallback>fallback</span></SiteLogo>
      </ServerConfigContext.Provider>,
    ))

    let images = container!.querySelectorAll('img')
    expect(images).toHaveLength(2)
    // The configured secondary mark leads the lockup, the deployment's own mark follows.
    expect(images[0].getAttribute('src')).toBe('/favicon.svg')
    expect(images[1].getAttribute('src')).toBe('/api/site-logo?v=revision')
    expect(container!.querySelector('[data-fallback]')).toBeNull()

    act(() => images[0].dispatchEvent(new Event('error')))
    expect(container!.querySelectorAll('img')).toHaveLength(1)
    expect(container!.querySelector('[data-fallback]')).toBeNull()
  })

  it('pairs the secondary mark with the fallback when no logo is uploaded', () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    const config = { siteLogo: { secondary: { url: '/anyrouter-logo.svg' } } } as ServerConfig
    act(() => root!.render(
      <ServerConfigContext.Provider value={config}>
        <SiteLogo size={20}><span data-fallback>fallback</span></SiteLogo>
      </ServerConfigContext.Provider>,
    ))

    let images = container!.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toBe('/anyrouter-logo.svg')
    expect(container!.querySelector('[data-fallback]')).not.toBeNull()
  })

  it('ignores the secondary mark during the Admin upload/reset preview override', () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    const config = {
      siteLogo: { url: '/api/site-logo?v=revision', secondary: { url: '/favicon.svg' } },
    } as ServerConfig
    act(() => root!.render(
      <ServerConfigContext.Provider value={config}>
        <SiteLogo size={20} srcOverride="/api/site-logo?v=preview">
          <span data-fallback>fallback</span>
        </SiteLogo>
      </ServerConfigContext.Provider>,
    ))

    let images = container!.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toBe('/api/site-logo?v=preview')
  })

})
