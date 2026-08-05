import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, Button, Input, Select, SensitiveInput, Collapsible, useKumoToastManager } from '@cloudflare/kumo'
import {
  AiChatAuthorInfo,
  AiModelConfig,
  AiModelProvider,
  AiGatewayInfo,
  AnyRouterDeviceLoginStart,
  AnyRouterSuggestedModel,
  SUGGESTED_MODELS,
} from '@gadgets/workshop-shared/api'
import { RpcStub } from 'capnweb'
import { AuthenticatedApi } from '@gadgets/workshop-shared/api'

interface AddModelModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  authenticatedApi: RpcStub<AuthenticatedApi>
  aiConfig: AiGatewayInfo | null
}

type SelectionType =
  | { type: 'suggested', provider: AiModelProvider, modelId: string, displayName: string }
  | { type: 'custom', provider: AiModelProvider }

const PROVIDER_LABELS: Record<AiModelProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  cloudflare: 'Cloudflare Workers AI',
  ollama: 'Ollama',
  anyrouter: 'AnyRouter',
}

// Providers that never go through Cloudflare AI Gateway — always offer them in the picker and
// always collect their own credentials, even when the deployment is in gateway mode. Keep in
// sync with isDirectModelProvider() in workshop-backend/src/ai-models.ts.
const DIRECT_MODEL_PROVIDERS = new Set<AiModelProvider>(['ollama', 'anyrouter'])

function isDirectModelProvider(provider: AiModelProvider): boolean {
  return DIRECT_MODEL_PROVIDERS.has(provider)
}

// Placeholder hinting at the shape of each provider's API token.
const API_TOKEN_PLACEHOLDERS: Record<AiModelProvider, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
  google: 'AIza...',
  cloudflare: 'Cloudflare API token',
  ollama: '(optional)',
  anyrouter: 'sk-ar-...',
}

// Example used in the custom-model placeholders for providers that have no suggested models
// (currently Ollama, which serves whatever the user has pulled locally).
const FALLBACK_EXAMPLE_MODEL = { modelId: 'gemma4:31b', name: 'Gemma 4 31B' }

// Pick an example model to show in the custom-model placeholders for the given provider.
function exampleModel(
  provider: AiModelProvider,
  anyRouterModels: AnyRouterSuggestedModel[],
): { modelId: string, name: string } {
  if (provider === 'anyrouter' && anyRouterModels[0]) {
    return { modelId: anyRouterModels[0].id, name: anyRouterModels[0].name }
  }
  const first = Object.entries(SUGGESTED_MODELS[provider])[0]
  return first ? { modelId: first[0], name: first[1].name } : FALLBACK_EXAMPLE_MODEL
}

// Encode a selection into a string value for the Select component.
function encodeSelection(provider: AiModelProvider, modelId?: string): string {
  return modelId ? `${provider}:${modelId}` : `other-${provider}`
}

// Decode a Select value back into a SelectionType.
function decodeSelection(
  value: string,
  anyRouterById: Record<string, AnyRouterSuggestedModel>,
): SelectionType {
  if (value.startsWith('other-')) {
    return { type: 'custom', provider: value.substring(6) as AiModelProvider }
  }
  const colonIndex = value.indexOf(':')
  const provider = value.substring(0, colonIndex) as AiModelProvider
  const modelId = value.substring(colonIndex + 1)
  if (provider === 'anyrouter') {
    const live = anyRouterById[modelId]
    if (live) {
      return { type: 'suggested', provider, modelId, displayName: live.name }
    }
    const staticName = SUGGESTED_MODELS.anyrouter[modelId]?.name
    if (staticName) {
      return { type: 'suggested', provider, modelId, displayName: staticName }
    }
    return { type: 'suggested', provider, modelId, displayName: modelId }
  }
  const displayName = SUGGESTED_MODELS[provider][modelId].name
  return { type: 'suggested', provider, modelId, displayName }
}

// Build the flat list of options for the Select dropdown.
function buildOptions(
  gatewayMode: boolean,
  enabledProviders: Set<string> | null,
  anyRouterModels: AnyRouterSuggestedModel[],
) {
  const options: { value: string; label: string; provider: string }[] = []
  const providerOrder = Object.keys(SUGGESTED_MODELS) as AiModelProvider[]

  for (const provider of providerOrder) {
    const direct = isDirectModelProvider(provider)
    // Gateway mode only lists CF AI Gateway providers — plus direct-only providers (AnyRouter,
    // Ollama), which users always add with their own tokens.
    if (enabledProviders && !enabledProviders.has(provider) && !direct) continue

    // In gateway mode, gateway-served suggested models are already built-in, so don't list them.
    // Direct providers still list suggestions (they are never "built-in" via the gateway).
    if (!gatewayMode || direct) {
      if (provider === 'anyrouter') {
        for (const model of anyRouterModels) {
          options.push({
            value: encodeSelection(provider, model.id),
            label: `${model.name} · ${model.id}`,
            provider,
          })
        }
      } else {
        for (const [modelId, model] of Object.entries(SUGGESTED_MODELS[provider])) {
          options.push({
            value: encodeSelection(provider, modelId),
            label: model.name,
            provider,
          })
        }
      }
    }

    options.push({
      value: encodeSelection(provider),
      label: `Other ${PROVIDER_LABELS[provider] || provider}...`,
      provider,
    })
  }

  return options
}

type AnyRouterLoginUi =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | {
      phase: 'waiting'
      start: AnyRouterDeviceLoginStart
      statusText: string
    }
  | { phase: 'connected' }
  | { phase: 'error'; message: string }

export default function AddModelModal({ visible, onCancel, onSuccess, authenticatedApi, aiConfig }: AddModelModalProps) {
  const toasts = useKumoToastManager()

  const [loading, setLoading] = useState(false)
  const [selection, setSelection] = useState<SelectionType | null>(null)
  const [selectValue, setSelectValue] = useState<string | undefined>(undefined)

  // Form fields (used for custom models)
  const [modelId, setModelId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [accountId, setAccountId] = useState('')
  const [apiUrl, setApiUrl] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Advanced settings collapsible state
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [pasteKeyOpen, setPasteKeyOpen] = useState(false)

  // Live AnyRouter suggestions + device login
  const [anyRouterModels, setAnyRouterModels] = useState<AnyRouterSuggestedModel[]>(() =>
    Object.entries(SUGGESTED_MODELS.anyrouter).map(([id, m]) => ({
      id,
      name: m.name,
      contextWindow: m.contextWindow,
    })),
  )
  const [anyRouterLogin, setAnyRouterLogin] = useState<AnyRouterLoginUi>({ phase: 'idle' })
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeDeviceCodeRef = useRef<string | null>(null)

  const gatewayMode = aiConfig?.enabled === true
  const enabledProviders: Set<string> | null = gatewayMode
    ? new Set(aiConfig.enabledProviders)
    : null

  const anyRouterById = Object.fromEntries(anyRouterModels.map((m) => [m.id, m]))

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const stopAnyRouterLogin = useCallback(() => {
    clearPollTimer()
    activeDeviceCodeRef.current = null
    setAnyRouterLogin({ phase: 'idle' })
  }, [clearPollTimer])

  // Load live top-usage models when the dialog opens.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    authenticatedApi.listAnyRouterSuggestedModels()
      .then((models) => {
        if (!cancelled && models.length > 0) setAnyRouterModels(models)
      })
      .catch((err) => {
        console.warn('Failed to load AnyRouter top models:', err)
      })
    return () => { cancelled = true }
  }, [visible, authenticatedApi])

  // Reset all state when dialog closes
  useEffect(() => {
    if (!visible) {
      setSelection(null)
      setSelectValue(undefined)
      setModelId('')
      setDisplayName('')
      setApiToken('')
      setAccountId('')
      setApiUrl('')
      setErrors({})
      setAdvancedOpen(false)
      setPasteKeyOpen(false)
      stopAnyRouterLogin()
    }
  }, [visible, stopAnyRouterLogin])

  // Cleanup poll on unmount
  useEffect(() => () => clearPollTimer(), [clearPollTimer])

  const schedulePoll = useCallback((deviceCode: string, intervalSec: number) => {
    clearPollTimer()
    pollTimerRef.current = setTimeout(async () => {
      if (activeDeviceCodeRef.current !== deviceCode) return
      try {
        const result = await authenticatedApi.pollAnyRouterDeviceLogin(deviceCode)
        if (activeDeviceCodeRef.current !== deviceCode) return

        switch (result.status) {
          case 'pending':
            setAnyRouterLogin((prev) =>
              prev.phase === 'waiting'
                ? { ...prev, statusText: 'Waiting for approval in the AnyRouter tab…' }
                : prev,
            )
            schedulePoll(deviceCode, result.interval)
            break
          case 'slow_down':
            setAnyRouterLogin((prev) =>
              prev.phase === 'waiting'
                ? { ...prev, statusText: 'Slowing poll rate…' }
                : prev,
            )
            schedulePoll(deviceCode, result.interval)
            break
          case 'ready':
            clearPollTimer()
            activeDeviceCodeRef.current = null
            setApiToken(result.accessToken)
            setPasteKeyOpen(false)
            setErrors((prev) => ({ ...prev, apiToken: '' }))
            setAnyRouterLogin({ phase: 'connected' })
            toasts.add({
              title: 'AnyRouter connected — pick a model and add it',
              variant: 'success',
            })
            break
          case 'denied':
            clearPollTimer()
            activeDeviceCodeRef.current = null
            setAnyRouterLogin({ phase: 'error', message: result.message })
            break
          case 'expired':
            clearPollTimer()
            activeDeviceCodeRef.current = null
            setAnyRouterLogin({ phase: 'error', message: result.message })
            break
          case 'error':
            clearPollTimer()
            activeDeviceCodeRef.current = null
            setAnyRouterLogin({ phase: 'error', message: result.message })
            break
        }
      } catch (err) {
        console.error('AnyRouter poll failed:', err)
        if (activeDeviceCodeRef.current === deviceCode) {
          // Transient network blip — keep trying.
          schedulePoll(deviceCode, Math.max(intervalSec, 5))
        }
      }
    }, Math.max(intervalSec, 1) * 1000)
  }, [authenticatedApi, clearPollTimer, toasts])

  const startAnyRouterConnect = async () => {
    setAnyRouterLogin({ phase: 'starting' })
    setErrors((prev) => ({ ...prev, apiToken: '' }))
    try {
      const start = await authenticatedApi.startAnyRouterDeviceLogin()
      activeDeviceCodeRef.current = start.deviceCode
      setAnyRouterLogin({
        phase: 'waiting',
        start,
        statusText: 'Complete sign-in in the AnyRouter tab. You can pick an existing key or create a new one.',
      })
      // Open consent page (user picks existing key or generates a new one).
      window.open(start.verificationUriComplete, '_blank', 'noopener,noreferrer')
      schedulePoll(start.deviceCode, start.interval)
    } catch (err) {
      console.error('AnyRouter device login failed:', err)
      setAnyRouterLogin({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Failed to start AnyRouter login',
      })
    }
  }

  const handleModelSelect = (value: string) => {
    setSelectValue(value)
    setErrors({})
    const sel = decodeSelection(value, anyRouterById)
    setSelection(sel)

    if (sel.type === 'custom') {
      setModelId('')
      setDisplayName('')
    } else {
      setModelId(sel.modelId)
      setDisplayName(sel.displayName)
    }
    // Keep a connected AnyRouter token when switching models under the same provider.
    if (sel.provider !== 'anyrouter') {
      setApiToken('')
      stopAnyRouterLogin()
    } else if (anyRouterLogin.phase !== 'connected') {
      setApiToken('')
    }
    setAccountId('')
    setApiUrl(
      sel.provider === 'ollama' ? 'http://localhost:11434' :
      sel.provider === 'anyrouter' ? 'https://anyrouter.dev/api/v1' :
      '',
    )
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!selection) {
      newErrors.selection = gatewayMode ? 'Please select a provider' : 'Please select a model'
    }

    if (selection?.type === 'custom') {
      if (!modelId.trim()) newErrors.modelId = 'Please enter the model ID'
      if (!displayName.trim()) newErrors.displayName = 'Please enter a display name'
    }

    const isOllama = selection?.provider === 'ollama'
    const isCloudflare = selection?.provider === 'cloudflare'
    const direct = selection ? isDirectModelProvider(selection.provider) : false
    // Direct providers always need their own credentials, including under AI Gateway mode.
    const showCredentials = !gatewayMode || direct

    if (showCredentials && selection && !isOllama && !apiToken.trim()) {
      newErrors.apiToken = selection.provider === 'anyrouter'
        ? 'Connect with AnyRouter or paste an API key'
        : 'Please enter your API token'
    }

    if (showCredentials && isCloudflare && !accountId.trim()) {
      newErrors.accountId = 'Please enter your Cloudflare account ID'
    }

    if (showCredentials && isOllama && !apiUrl.trim()) {
      newErrors.apiUrl = 'Please enter the Ollama API URL'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      const isSuggested = selection!.type === 'suggested'
      const finalModelId = isSuggested ? selection!.modelId : modelId.trim()
      const finalDisplayName = isSuggested ? selection!.displayName : displayName.trim()
      const direct = isDirectModelProvider(selection!.provider)
      // Platform AI Gateway ignores apiToken/apiUrl for gateway-served providers; direct-only
      // providers always store and use the user's own credentials.
      const collectCredentials = !gatewayMode || direct

      const profile: AiChatAuthorInfo = {
        type: 'agent',
        id: finalModelId,
        name: finalDisplayName,
      }

      const config: AiModelConfig = {
        provider: selection!.provider,
        model: finalModelId,
        apiToken: collectCredentials ? apiToken.trim() : '',
        ...(collectCredentials && accountId.trim() && { accountId: accountId.trim() }),
        ...(collectCredentials && apiUrl.trim() && { apiUrl: apiUrl.trim() }),
      }

      await authenticatedApi.addModel(profile, config)
      toasts.add({ title: 'AI model added successfully', variant: 'success' })
      onSuccess()
    } catch (error: any) {
      console.error('Failed to add model:', error)
      toasts.add({ title: 'Failed to add model', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const options = buildOptions(gatewayMode, enabledProviders, anyRouterModels)
  const showCustomFields = selection?.type === 'custom'
  const example = selection ? exampleModel(selection.provider, anyRouterModels) : null
  const isOllama = selection?.provider === 'ollama'
  const isCloudflare = selection?.provider === 'cloudflare'
  const isAnyRouter = selection?.provider === 'anyrouter'
  const showCredentials = !gatewayMode || (selection != null && isDirectModelProvider(selection.provider))

  // Group options by provider for rendering with visual separators.
  const groupedOptions: { provider: string; items: typeof options }[] = []
  for (const opt of options) {
    const last = groupedOptions[groupedOptions.length - 1]
    if (last && last.provider === opt.provider) {
      last.items.push(opt)
    } else {
      groupedOptions.push({ provider: opt.provider, items: [opt] })
    }
  }

  return (
    <Dialog.Root open={visible} onOpenChange={(open) => { if (!open) onCancel() }}>
      <Dialog className="p-6" size="lg">
        <Dialog.Title className="text-lg font-semibold mb-4">
          Add AI Model
        </Dialog.Title>

        <div className="space-y-4">
          {/* Model / Provider selection */}
          <Select
            label={gatewayMode ? 'Select Provider' : 'Select Model'}
            className="w-full text-sm"
            placeholder={gatewayMode ? 'Choose a provider...' : 'Choose an AI model...'}
            value={selectValue}
            onValueChange={(v) => handleModelSelect(v as string)}
            error={errors.selection}
            renderValue={(v) => {
              const opt = options.find(o => o.value === v)
              return opt?.label ?? String(v)
            }}
          >
            {groupedOptions.map((group, groupIndex) => (
              <div key={group.provider}>
                {groupIndex > 0 && (
                  <div className="h-px bg-kumo-line my-1 mx-2" />
                )}
                <div className="px-3 py-1.5 text-xs font-medium text-kumo-subtle select-none">
                  {PROVIDER_LABELS[group.provider as AiModelProvider] || group.provider}
                </div>
                {group.items.map(opt => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </div>
            ))}
          </Select>

          {/* Custom model fields */}
          {showCustomFields && (
            <>
              <Input
                label="Model ID"
                placeholder={`e.g., ${example!.modelId}`}
                description={`The model identifier as specified by the provider (e.g., '${example!.modelId}')`}
                value={modelId}
                onChange={(e) => { setModelId(e.target.value); setErrors(prev => ({ ...prev, modelId: '' })) }}
                error={errors.modelId}
                variant={errors.modelId ? 'error' : 'default'}
              />

              <Input
                label="Display Name"
                placeholder={`e.g., ${example!.name}`}
                description="Human-readable name shown in the UI"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setErrors(prev => ({ ...prev, displayName: '' })) }}
                error={errors.displayName}
                variant={errors.displayName ? 'error' : 'default'}
              />
            </>
          )}

          {/* Cloudflare account ID (the Workers AI REST endpoint is account-scoped) */}
          {showCredentials && isCloudflare && (
            <Input
              label="Cloudflare Account ID"
              placeholder="e.g., 0123456789abcdef0123456789abcdef"
              description="The Cloudflare account to bill for Workers AI usage"
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setErrors(prev => ({ ...prev, accountId: '' })) }}
              error={errors.accountId}
              variant={errors.accountId ? 'error' : 'default'}
            />
          )}

          {/* AnyRouter: device login (pick existing key or mint new) + optional paste */}
          {showCredentials && isAnyRouter && (
            <div className="space-y-3 rounded-lg border border-kumo-line bg-kumo-tint/40 p-3">
              <div className="text-sm font-medium tracking-[-0.25px] text-kumo-default">
                AnyRouter API key
              </div>
              <p className="text-[12px] leading-[16px] tracking-[-0.2px] text-kumo-subtle">
                Sign in with AnyRouter to pick an existing key or create a new one. Your key stays
                on this deployment and is never shared with AnyRouter again after connect.
              </p>

              {anyRouterLogin.phase === 'connected' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-emerald-700">
                    Connected
                  </span>
                  <span className="text-[12px] text-kumo-subtle">
                    Key ready · {apiToken ? `${apiToken.slice(0, 10)}…` : 'stored'}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setApiToken('')
                      stopAnyRouterLogin()
                      setPasteKeyOpen(false)
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : anyRouterLogin.phase === 'waiting' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-md border border-kumo-line bg-kumo-base px-3 py-2 font-mono text-lg font-semibold tracking-[0.15em] text-kumo-default">
                      {anyRouterLogin.start.userCode}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        window.open(
                          anyRouterLogin.start.verificationUriComplete,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      Open AnyRouter
                    </Button>
                    <Button variant="secondary" onClick={stopAnyRouterLogin}>
                      Cancel
                    </Button>
                  </div>
                  <p className="text-[12px] text-kumo-subtle">{anyRouterLogin.statusText}</p>
                </div>
              ) : anyRouterLogin.phase === 'error' ? (
                <div className="space-y-2">
                  <p className="text-[12px] text-red-600">{anyRouterLogin.message}</p>
                  <Button variant="primary" onClick={startAnyRouterConnect}>
                    Try again
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={startAnyRouterConnect}
                  loading={anyRouterLogin.phase === 'starting'}
                >
                  Connect with AnyRouter
                </Button>
              )}

              {errors.apiToken && (
                <p className="text-[12px] text-red-600">{errors.apiToken}</p>
              )}

              <Collapsible.Root open={pasteKeyOpen} onOpenChange={setPasteKeyOpen}>
                <Collapsible.DefaultTrigger>
                  Or paste an API key manually
                </Collapsible.DefaultTrigger>
                <Collapsible.DefaultPanel>
                  <SensitiveInput
                    label="API Token"
                    placeholder={API_TOKEN_PLACEHOLDERS.anyrouter}
                    description="From https://anyrouter.dev/dashboard (starts with sk-ar-)"
                    value={apiToken}
                    onValueChange={(v) => {
                      setApiToken(v)
                      setErrors((prev) => ({ ...prev, apiToken: '' }))
                      if (v.trim()) {
                        setAnyRouterLogin({ phase: 'connected' })
                      }
                    }}
                    error={errors.apiToken}
                    variant={errors.apiToken ? 'error' : 'default'}
                  />
                </Collapsible.DefaultPanel>
              </Collapsible.Root>
            </div>
          )}

          {/* API Token (non-AnyRouter providers) */}
          {showCredentials && selection && !isAnyRouter && (
            <SensitiveInput
              label="API Token"
              placeholder={API_TOKEN_PLACEHOLDERS[selection.provider]}
              description={
                isOllama
                  ? 'Optional for local Ollama access'
                  : isCloudflare
                  ? 'An API token with Workers AI Read + Edit permissions (in the dashboard: Workers AI > Use REST API > Create a Workers AI API Token)'
                  : `Your ${PROVIDER_LABELS[selection.provider]} API token for billing`
              }
              value={apiToken}
              onValueChange={(v) => { setApiToken(v); setErrors(prev => ({ ...prev, apiToken: '' })) }}
              error={errors.apiToken}
              variant={errors.apiToken ? 'error' : 'default'}
            />
          )}

          {/* Ollama API URL (always visible for Ollama) */}
          {showCredentials && isOllama && (
            <Input
              label="API URL"
              placeholder="http://localhost:11434"
              description="URL of your Ollama server"
              value={apiUrl}
              onChange={(e) => { setApiUrl(e.target.value); setErrors(prev => ({ ...prev, apiUrl: '' })) }}
              error={errors.apiUrl}
              variant={errors.apiUrl ? 'error' : 'default'}
            />
          )}

          {/* AnyRouter API URL (default prefilled; always visible so users can override) */}
          {showCredentials && isAnyRouter && (
            <Input
              label="API URL"
              placeholder="https://anyrouter.dev/api/v1"
              description="AnyRouter OpenAI-compatible base URL (model ids use provider/model form)"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          )}

          {/* Advanced Settings for non-Ollama, non-Cloudflare, non-AnyRouter providers */}
          {showCredentials && selection && !isOllama && !isCloudflare && !isAnyRouter && (
            <Collapsible.Root
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
            >
              <Collapsible.DefaultTrigger>Advanced Settings</Collapsible.DefaultTrigger>
              <Collapsible.DefaultPanel>
                <Input
                  label="API URL"
                  placeholder="https://..."
                  description="Override the default API endpoint (useful for proxies like Cloudflare AI Gateway)"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </Collapsible.DefaultPanel>
            </Collapsible.Root>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-2">
          <Dialog.Close render={(props) => (
            <Button variant="secondary" {...props} disabled={loading}>
              Cancel
            </Button>
          )} />
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={!selection}
          >
            Add Model
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
