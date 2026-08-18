// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '../ThemeContext'
import ThemeModeButton from './ThemeModeButton'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('ThemeModeButton', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  beforeEach(() => {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false },
      onchange: null,
    })
  })

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
  })

  function render(size?: 'sm' | 'lg') {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root!.render(
      <ThemeProvider>
        <ThemeModeButton size={size} />
      </ThemeProvider>,
    ))
  }

  it('uses a 32px target in the authenticated shell', () => {
    render()
    const button = container!.querySelector('button')
    expect(button?.className).toContain('h-8')
    expect(button?.className).toContain('w-8')
  })

  it('uses a 44px target on the public sign-in card', () => {
    render('lg')
    const button = container!.querySelector('button')
    expect(button?.className).toContain('h-11')
    expect(button?.className).toContain('w-11')
  })
})
