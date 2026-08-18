// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomeTaskSuggestions, {
  SUGGESTIONS,
  VISIBLE_SUGGESTIONS,
  pickSuggestions,
  type SuggestionDomain,
} from './HomeTaskSuggestions'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const DOMAINS: SuggestionDomain[] = [
  'writing',
  'data',
  'agents',
  'tools',
  'research',
  'ops',
]

describe('Home task suggestion pool', () => {
  it('is a rich, unique pool across domains, not five generic office rows', () => {
    expect(SUGGESTIONS.length).toBeGreaterThanOrEqual(16)
    expect(VISIBLE_SUGGESTIONS).toBe(3)
    expect(SUGGESTIONS.length).toBeGreaterThan(VISIBLE_SUGGESTIONS)

    const ids = SUGGESTIONS.map((s) => s.id)
    const labels = SUGGESTIONS.map((s) => s.label)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)

    for (const suggestion of SUGGESTIONS) {
      expect(suggestion.label.trim().length).toBeGreaterThan(8)
      expect(suggestion.description.trim().length).toBeGreaterThan(12)
      expect(suggestion.prompt.trim().length).toBeGreaterThan(suggestion.label.length)
      expect(DOMAINS).toContain(suggestion.domain)
    }

    const domains = new Set(SUGGESTIONS.map((s) => s.domain))
    expect(domains).toEqual(new Set(DOMAINS))
    expect(SUGGESTIONS.filter((s) => s.domain === 'writing').length).toBeLessThan(
      SUGGESTIONS.length / 2,
    )
  })

  it('shuffles so different visits can show different rows', () => {
    const identity = pickSuggestions(() => 0.999)
    expect(identity).toHaveLength(VISIBLE_SUGGESTIONS)
    expect(identity.map((s) => s.id)).toEqual(
      SUGGESTIONS.slice(0, VISIBLE_SUGGESTIONS).map((s) => s.id),
    )

    const reversed = pickSuggestions(() => 0)
    expect(reversed).toHaveLength(VISIBLE_SUGGESTIONS)
    expect(reversed.every((s) => SUGGESTIONS.some((row) => row.id === s.id))).toBe(true)
    expect(reversed.map((s) => s.id)).not.toEqual(identity.map((s) => s.id))

    const seen = new Set<string>()
    let sequence = 0
    for (let n = 0; n < 24; n++) {
      const picked = pickSuggestions(() => {
        sequence += 1
        return (sequence * 0.37) % 1
      })
      seen.add(picked.map((s) => s.id).join('|'))
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('HomeTaskSuggestions', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
  })

  function render(onPick: (prompt: string) => void = () => {}) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root!.render(<HomeTaskSuggestions onPick={onPick} />))
  }

  it('shows three shuffled rows with visible labels and 44px hits', () => {
    render()
    const buttons = [...container!.querySelectorAll('button')]
    expect(buttons).toHaveLength(VISIBLE_SUGGESTIONS)
    expect(container!.textContent).toContain('Get started')

    for (const button of buttons) {
      expect(button.className).toContain('min-h-11')
      const [labelEl, descriptionEl] = button.querySelectorAll('.min-w-0 > span')
      const label = labelEl?.textContent?.trim() ?? ''
      const description = descriptionEl?.textContent?.trim() ?? ''
      expect(label.length).toBeGreaterThan(0)
      expect(description.length).toBeGreaterThan(0)
      expect(SUGGESTIONS.some((s) => s.label === label && s.description === description)).toBe(
        true,
      )
      expect(labelEl?.className).not.toContain('truncate')
      expect(descriptionEl?.className).not.toContain('truncate')
    }
  })

  it('fills the composer on click and does not auto-send', () => {
    const onPick = vi.fn<(prompt: string) => void>()
    render(onPick)

    const button = container!.querySelector('button')!
    const label = button.querySelector('.min-w-0 > span')?.textContent?.trim()
    const suggestion = SUGGESTIONS.find((s) => s.label === label)
    expect(suggestion).toBeDefined()

    act(() => button.click())
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(suggestion!.prompt)
  })
})
