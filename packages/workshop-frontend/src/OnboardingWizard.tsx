import { useState, useEffect, useRef, useCallback } from 'react'
import { useKumoToastManager } from '@cloudflare/kumo'
import { useAuthenticatedApi } from './AuthContext'
import {
  AiChatAuthorInfo,
  AnyRouterDeviceLoginStart,
  AnyRouterSuggestedModel,
  SUGGESTED_MODELS,
} from '@gadgets/workshop-shared/api'
import { ArrowRight, Check, Hexagon } from '@phosphor-icons/react'
import { persistSelectedModel } from './modelSelection'
import { useSiteName } from './ServerConfigContext'
import SiteLogo from './components/SiteLogo'
import { useDocumentTitle } from './useDocumentTitle'

// ─── component ──────────────────────────────────────────────────────────────────
//
// Onboarding is deliberately minimal: sign-in already happened (Clerk), and the deployment
// provisions the user's AnyRouter key automatically when it can — so all that's left is picking
// which AnyRouter model(s) to use. The device-login flow is the fallback when the deployment
// can't mint keys server-side.

type KeyState =
  | { phase: 'checking' }
  | { phase: 'ready'; apiToken: string }
  // The user already has configured models; no key or model-adding needed, just pick a default.
  | { phase: 'existing-models' }
  // Server-side minting unavailable: fall back to the AnyRouter device login.
  | { phase: 'device-idle' }
  | { phase: 'device-waiting'; start: AnyRouterDeviceLoginStart; statusText: string }
  | { phase: 'device-error'; message: string }

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: () => void
}) {
  const { authenticatedApi } = useAuthenticatedApi()
  const toasts = useKumoToastManager()
  const siteName = useSiteName()
  useDocumentTitle('Setup')

  const [mounted, setMounted] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const [keyState, setKeyState] = useState<KeyState>({ phase: 'checking' })

  // Model pick state. In 'existing-models' mode these are the user's configured models and
  // exactly one is chosen as the default; otherwise they are AnyRouter catalog suggestions and
  // the user may pick several (the first pick becomes the default).
  const [existingModels, setExistingModels] = useState<AiChatAuthorInfo[]>([])
  const [suggestedModels, setSuggestedModels] = useState<AnyRouterSuggestedModel[]>(() =>
    Object.entries(SUGGESTED_MODELS.anyrouter).map(([id, m]) => ({
      id,
      name: m.name,
      contextWindow: m.contextWindow,
    })),
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeDeviceCodeRef = useRef<string | null>(null)

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearPollTimer(), [clearPollTimer])

  // Bootstrap: load live suggestions, and either reuse existing models, take an automatically
  // minted key, or fall back to the device login.
  useEffect(() => {
    let cancelled = false

    authenticatedApi.listAnyRouterSuggestedModels()
      .then((models) => {
        if (!cancelled && models.length > 0) setSuggestedModels(models)
      })
      .catch((err) => console.warn('Failed to load AnyRouter top models:', err))

    ;(async () => {
      try {
        const models = await authenticatedApi.listModels()
        if (cancelled) return
        if (models.length > 0) {
          setExistingModels(models)
          setSelectedIds([models[0].id])
          setKeyState({ phase: 'existing-models' })
          return
        }
        const provisioned = await authenticatedApi.provisionAnyRouterKey().catch((err) => {
          console.error('AnyRouter key provisioning failed:', err)
          return null
        })
        if (cancelled) return
        setKeyState(provisioned ? { phase: 'ready', apiToken: provisioned.apiToken }
                                : { phase: 'device-idle' })
      } catch (err) {
        console.error('Failed to bootstrap onboarding:', err)
        if (!cancelled) setKeyState({ phase: 'device-idle' })
      }
    })()

    return () => { cancelled = true }
  }, [authenticatedApi])

  // ── device-login fallback ─────────────────────────────────────────────────────

  const schedulePoll = useCallback((deviceCode: string, intervalSec: number) => {
    clearPollTimer()
    pollTimerRef.current = setTimeout(async () => {
      if (activeDeviceCodeRef.current !== deviceCode) return
      try {
        const result = await authenticatedApi.pollAnyRouterDeviceLogin(deviceCode)
        if (activeDeviceCodeRef.current !== deviceCode) return
        switch (result.status) {
          case 'pending':
          case 'slow_down':
            schedulePoll(deviceCode, result.interval)
            break
          case 'ready':
            clearPollTimer()
            activeDeviceCodeRef.current = null
            setKeyState({ phase: 'ready', apiToken: result.accessToken })
            break
          default:
            clearPollTimer()
            activeDeviceCodeRef.current = null
            setKeyState({ phase: 'device-error', message: result.message })
        }
      } catch (err) {
        console.error('AnyRouter poll failed:', err)
        if (activeDeviceCodeRef.current === deviceCode) {
          schedulePoll(deviceCode, Math.max(intervalSec, 5))
        }
      }
    }, Math.max(intervalSec, 1) * 1000)
  }, [authenticatedApi, clearPollTimer])

  const startDeviceLogin = async () => {
    try {
      const start = await authenticatedApi.startAnyRouterDeviceLogin()
      activeDeviceCodeRef.current = start.deviceCode
      setKeyState({
        phase: 'device-waiting',
        start,
        statusText: 'Approve access in the AnyRouter tab — you can pick an existing key or create a new one.',
      })
      window.open(start.verificationUriComplete, '_blank', 'noopener,noreferrer')
      schedulePoll(start.deviceCode, start.interval)
    } catch (err) {
      console.error('AnyRouter device login failed:', err)
      setKeyState({
        phase: 'device-error',
        message: err instanceof Error ? err.message : 'Failed to start AnyRouter login',
      })
    }
  }

  // ── model selection ───────────────────────────────────────────────────────────

  const existingMode = keyState.phase === 'existing-models'
  const pickReady = existingMode || keyState.phase === 'ready'

  const toggleModel = (id: string) => {
    if (existingMode) {
      // One default among the models the user already has.
      setSelectedIds([id])
      return
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleFinish = async () => {
    if (selectedIds.length === 0 || finishing) return
    setFinishing(true)
    try {
      if (!existingMode) {
        const apiToken = (keyState as Extract<KeyState, { phase: 'ready' }>).apiToken
        for (const id of selectedIds) {
          const model = suggestedModels.find((m) => m.id === id)
          await authenticatedApi.addModel(
            { type: 'agent', id, name: model?.name ?? id },
            { provider: 'anyrouter', model: id, apiToken },
          )
        }
      }
      const preferred = selectedIds[0]
      await authenticatedApi.setPreferredModel(preferred)
      persistSelectedModel(preferred)
      await authenticatedApi.completeOnboarding()
      onComplete()
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
      toasts.add({ title: 'Something went wrong. Please try again.', variant: 'error' })
      setFinishing(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────────

  const modelRows: { id: string; name: string; subtitle: string }[] = existingMode
    ? existingModels.map((m) => ({ id: m.id, name: m.name, subtitle: m.id }))
    : suggestedModels.map((m) => ({ id: m.id, name: m.name, subtitle: m.id }))

  return (
    <div className="fixed inset-0 bg-kumo-base dotted-bg flex items-center justify-center overflow-y-auto py-8">
      {/* Soft radial glow at the top for depth */}
      <div
        className="absolute inset-x-0 top-0 h-[50vh] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 0%, color-mix(in srgb, var(--color-kumo-brand) 8%, transparent) 0%, transparent 70%)',
        }}
      />

      <div
        className={`relative w-full max-w-lg mx-4 transition-all duration-500 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Brand */}
        <div
          className={`flex items-center justify-center gap-2 mb-10 transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          }`}
        >
          <SiteLogo size={22}>
            <Hexagon size={22} className="text-kumo-brand" weight="bold" />
          </SiteLogo>
          <span className="text-base font-semibold tracking-tight text-kumo-default">
            {siteName}
          </span>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className={`text-3xl font-semibold text-kumo-default tracking-tight transition-all duration-500 delay-100 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            Pick your models
          </h1>
          <p
            className={`mt-2 text-sm text-kumo-subtle transition-all duration-500 delay-200 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            {existingMode
              ? 'Choose your default model and start building'
              : 'Choose the AnyRouter models you want, and start building'}
          </p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-kumo-line bg-kumo-elevated shadow-xl shadow-black/[0.04]">
          <div className="p-8 min-h-[320px]">
            {keyState.phase === 'checking' ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-kumo-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : keyState.phase === 'device-idle'
              || keyState.phase === 'device-waiting'
              || keyState.phase === 'device-error' ? (
              <div className="flex flex-col items-center text-center py-8 gap-4">
                <h2 className="text-lg font-medium text-kumo-default">
                  Connect your AnyRouter account
                </h2>
                <p className="text-sm text-kumo-subtle max-w-sm">
                  One click grants {siteName} access to your AnyRouter models. You&apos;re
                  already signed in at anyrouter.dev, so this takes seconds.
                </p>
                {keyState.phase === 'device-waiting' ? (
                  <div className="space-y-3">
                    <div className="mx-auto w-fit rounded-md border border-kumo-line bg-kumo-base px-3 py-2 font-mono text-lg font-semibold tracking-[0.15em] text-kumo-default">
                      {keyState.start.userCode}
                    </div>
                    <p className="text-xs text-kumo-subtle">{keyState.statusText}</p>
                    <button
                      onClick={() =>
                        window.open(keyState.start.verificationUriComplete, '_blank', 'noopener,noreferrer')}
                      className="text-sm text-kumo-brand hover:underline"
                    >
                      Reopen the AnyRouter tab
                    </button>
                  </div>
                ) : (
                  <>
                    {keyState.phase === 'device-error' && (
                      <p className="text-sm text-kumo-danger max-w-sm">{keyState.message}</p>
                    )}
                    <button
                      onClick={startDeviceLogin}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg text-kumo-inverse bg-kumo-brand hover:bg-kumo-brand-hover transition-all duration-150"
                    >
                      Connect with AnyRouter
                      <ArrowRight size={14} weight="bold" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-lg font-medium text-kumo-default mb-1">
                  {existingMode ? 'Choose your default model' : 'Choose your models'}
                </h2>
                <p className="text-sm text-kumo-subtle mb-6">
                  {existingMode
                    ? 'Pick the model to use by default — you can change it any time'
                    : 'Pick one or more — the first pick becomes your default'}
                </p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {modelRows.map((model) => {
                    const selected = selectedIds.includes(model.id)
                    return (
                      <button
                        key={model.id}
                        onClick={() => toggleModel(model.id)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left
                          transition-all duration-150
                          ${selected
                            ? 'border-kumo-brand bg-kumo-brand/5 ring-1 ring-kumo-brand/20'
                            : 'border-kumo-line hover:border-kumo-fill hover:bg-kumo-tint'
                          }
                        `}
                      >
                        <div
                          className={`
                            w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                            transition-colors duration-150
                            ${selected
                              ? 'bg-kumo-brand text-kumo-inverse'
                              : 'bg-kumo-tint text-kumo-subtle'
                            }
                          `}
                        >
                          {model.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-kumo-default truncate">
                            {model.name}
                          </p>
                          <p className="text-xs text-kumo-subtle truncate">
                            {model.subtitle}
                          </p>
                        </div>
                        {selected && (
                          <Check
                            size={18}
                            weight="bold"
                            className="text-kumo-brand flex-shrink-0"
                          />
                        )}
                      </button>
                    )
                  })}

                  {modelRows.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-kumo-subtle">No models available right now</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {pickReady && (
            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-kumo-line bg-kumo-elevated">
              <button
                onClick={handleFinish}
                disabled={finishing || selectedIds.length === 0}
                className={`
                  flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg
                  transition-all duration-150
                  ${!finishing && selectedIds.length > 0
                    ? 'text-kumo-inverse bg-kumo-brand hover:bg-kumo-brand-hover'
                    : 'text-kumo-inactive bg-kumo-tint cursor-not-allowed'
                  }
                `}
              >
                {finishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-kumo-inverse/30 border-t-kumo-inverse rounded-full animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    Let&apos;s build
                    <ArrowRight size={14} weight="bold" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
