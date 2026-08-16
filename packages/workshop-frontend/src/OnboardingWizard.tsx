import { useState, useEffect, useCallback } from 'react'
import { useKumoToastManager } from '@cloudflare/kumo'
import { useAuthenticatedApi } from './AuthContext'
import {
  AiChatAuthorInfo,
  AnyRouterSuggestedModel,
  SUGGESTED_MODELS,
} from '@gadgets/workshop-shared/api'
import { ArrowRight, Check, Hexagon } from '@phosphor-icons/react'
import { persistSelectedModel } from './modelSelection'
import { useServerConfig, useSiteName } from './ServerConfigContext'
import SiteLogo from './components/SiteLogo'
import { useDocumentTitle } from './useDocumentTitle'
import { ANYROUTER_PRICING_URL, isAnyRouterGrantExpired } from './anyrouterOAuth'
import { useAnyRouterConnect } from './useAnyRouterConnect'

// Shown on the connect step, where there is nothing to configure yet and the user may never have
// seen the product before.
const WHAT_IT_DOES: { title: string; body: string }[] = [
  {
    title: 'Build by describing',
    body: 'Chat what you want and it writes, runs and iterates on the app or agent for you.',
  },
  {
    title: 'Sandboxed by default',
    body: 'Everything you build runs in its own isolate on Cloudflare, not on your machine.',
  },
  {
    title: 'Wire in your tools',
    body: 'Connect the services and MCP servers this deployment offers, and your agents can '
      + 'use them as granted resources.',
  },
  {
    title: 'Your models, your bill',
    body: 'Inference runs on your own AnyRouter key — pick any model in its catalog.',
  },
]

// ─── component ──────────────────────────────────────────────────────────────────
//
// Onboarding is deliberately minimal: sign-in already happened (Clerk), and connecting AnyRouter
// is one Approve click on its consent page (same Clerk session), which grants this account the
// user's own inference key. All that's left is picking which AnyRouter model(s) to use.

type KeyState =
  | { phase: 'checking' }
  // The account grant is in place; picked models are stored with an empty apiToken and resolve
  // to it at inference time.
  | { phase: 'connected' }
  // The user already has configured models; no connecting or model-adding needed, just pick a
  // default.
  | { phase: 'existing-models' }
  | { phase: 'disconnected' }
  | { phase: 'error'; message: string }

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: () => void
}) {
  const { authenticatedApi } = useAuthenticatedApi()
  const toasts = useKumoToastManager()
  const siteName = useSiteName()
  const serverConfig = useServerConfig()
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

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  // Bootstrap: load live suggestions, and either reuse existing models or check the AnyRouter
  // connection.
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
        const connection = await authenticatedApi.getAnyRouterConnection()
        if (cancelled) return
        setKeyState(
          connection.connected && !isAnyRouterGrantExpired(connection.expiresAt)
            ? { phase: 'connected' }
            : { phase: 'disconnected' })
      } catch (err) {
        console.error('Failed to bootstrap onboarding:', err)
        if (!cancelled) setKeyState({ phase: 'disconnected' })
      }
    })()

    return () => { cancelled = true }
  }, [authenticatedApi])

  // ── connect flow ──────────────────────────────────────────────────────────────

  const connect = useAnyRouterConnect({
    clientId: serverConfig?.anyrouterOauthClientId,
    read: useCallback(
      () => authenticatedApi.getAnyRouterConnection(),
      [authenticatedApi],
    ),
    onConnected: () => setKeyState({ phase: 'connected' }),
    onError: (message) => setKeyState({ phase: 'error', message }),
  })

  // ── model selection ───────────────────────────────────────────────────────────

  const existingMode = keyState.phase === 'existing-models'
  const pickReady = existingMode || keyState.phase === 'connected'

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
        for (const id of selectedIds) {
          const model = suggestedModels.find((m) => m.id === id)
          await authenticatedApi.addModel(
            { type: 'agent', id, name: model?.name ?? id },
            // Empty apiToken = use the account's AnyRouter grant (resolved server-side).
            { provider: 'anyrouter', model: id, apiToken: '' },
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

  // Before the AnyRouter grant exists there is nothing to pick yet, so the step introduces the
  // product instead: what it is on the left, the one-click connect on the right.
  const connectStep = keyState.phase === 'disconnected'
    || keyState.phase === 'error'

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
        className={`relative w-full mx-4 transition-all duration-500 ease-out ${
          connectStep ? 'max-w-4xl' : 'max-w-lg'
        } ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
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
            {connectStep ? `Welcome to ${siteName}` : 'Pick your models'}
          </h1>
          <p
            className={`mt-2 text-sm text-kumo-subtle transition-all duration-500 delay-200 ${
              connectStep ? 'max-w-xl mx-auto' : ''
            } ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          >
            {connectStep
              ? 'Describe the app or agent you want, and it gets built and run for you — '
                + 'each one sandboxed on Cloudflare, powered by models from your own AnyRouter '
                + 'account.'
              : existingMode
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
            ) : keyState.phase === 'disconnected' || keyState.phase === 'error' ? (
              <div className="grid md:grid-cols-2 gap-8 md:gap-10">
                {/* What this is */}
                <div>
                  <h2 className="text-lg font-medium text-kumo-default mb-4">
                    What {siteName} does
                  </h2>
                  <ul className="space-y-3.5">
                    {WHAT_IT_DOES.map(({ title, body }) => (
                      <li key={title} className="flex gap-3">
                        <Check
                          size={16}
                          weight="bold"
                          className="text-kumo-brand flex-shrink-0 mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-kumo-default">{title}</p>
                          <p className="text-sm text-kumo-subtle">{body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Connect */}
                <div className="flex flex-col justify-center rounded-xl border border-kumo-line bg-kumo-tint p-6 text-center">
                  <h2 className="text-lg font-medium text-kumo-default">
                    Connect your AnyRouter account to get started
                  </h2>
                  <p className="mt-2 text-sm text-kumo-subtle">
                    One click grants {siteName} a key on your own AnyRouter account — usage is
                    billed to you, and you can revoke it any time from the AnyRouter dashboard.
                  </p>
                  {connect.state === 'waiting' ? (
                    <div className="mt-5 flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-kumo-brand border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-kumo-subtle">
                        Approve access in the AnyRouter tab…
                      </p>
                      <button
                        onClick={() => connect.start()}
                        className="text-sm text-kumo-brand hover:underline"
                      >
                        Reopen the AnyRouter tab
                      </button>
                    </div>
                  ) : (
                    <>
                      {keyState.phase === 'error' && (
                        <p className="mt-3 text-sm text-kumo-danger">{keyState.message}</p>
                      )}
                      <button
                        onClick={() => connect.start()}
                        className="mt-5 self-center flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg text-kumo-inverse bg-kumo-brand hover:bg-kumo-brand-hover transition-all duration-150"
                      >
                        Connect with AnyRouter
                        <ArrowRight size={14} weight="bold" />
                      </button>
                    </>
                  )}
                  <p className="mt-5 text-xs text-kumo-subtle">
                    Needs an{' '}
                    <a
                      href={ANYROUTER_PRICING_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-kumo-brand hover:underline"
                    >
                      AnyRouter Go plan
                    </a>{' '}
                    or your own provider keys (BYOK).
                  </p>
                </div>
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
