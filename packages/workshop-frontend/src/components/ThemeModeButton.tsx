import { Desktop, Moon, Sun } from '@phosphor-icons/react'
import { Tooltip } from '@cloudflare/kumo'
import { useTheme } from '../ThemeContext'
import type { ThemeMode } from '../theme'

const THEME_SEQUENCE: ThemeMode[] = ['system', 'light', 'dark']

function nextThemeMode(mode: ThemeMode): ThemeMode {
  return THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(mode) + 1) % THEME_SEQUENCE.length]
}

const SIZE_CLASS = {
  sm: 'h-8 w-8 focus-visible:ring-offset-kumo-elevated',
  // 44×44 touch target on the public sign-in card (WCAG 2.5.5).
  lg: 'h-11 w-11 focus-visible:ring-offset-kumo-base',
} as const

const ICON_SIZE = {
  sm: 15,
  lg: 20,
} as const

export default function ThemeModeButton({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const { themeMode, resolvedThemeMode, setThemeMode } = useTheme()
  const label = themeMode === 'system'
    ? `Theme: system (${resolvedThemeMode})`
    : `Theme: ${themeMode}`
  const nextMode = nextThemeMode(themeMode)
  const iconSize = ICON_SIZE[size]

  return (
    <Tooltip
      content={`${label}. Switch to ${nextMode}.`}
      render={(
        <button
          type="button"
          aria-label={`${label}. Switch to ${nextMode}.`}
          onClick={() => setThemeMode(nextMode)}
          className={`flex ${SIZE_CLASS[size]} cursor-pointer items-center justify-center rounded-md text-kumo-inactive transition-colors hover:bg-kumo-tint hover:text-kumo-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-ring focus-visible:ring-offset-2`}
        >
          {themeMode === 'system' ? (
            <Desktop size={iconSize} />
          ) : themeMode === 'dark' ? (
            <Moon size={iconSize} />
          ) : (
            <Sun size={iconSize} />
          )}
        </button>
      )}
    />
  )
}
