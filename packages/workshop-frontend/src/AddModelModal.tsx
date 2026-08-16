import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, Button, Input, Select, SensitiveInput, Collapsible, useKumoToastManager } from '@cloudflare/kumo'
import {
  AiChatAuthorInfo,
  AiModelConfig,
  AnyRouterDeviceLoginStart,
  AnyRouterSuggestedModel,
  SUGGESTED_MODELS,
  defaultDirectModelApiUrl,
} from '@gadgets/workshop-shared/api'
import { RpcStub } from 'capnweb'
import { AuthenticatedApi } from '@gadgets/workshop-shared/api'

interface AddModelModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  authenticatedApi: RpcStub<AuthenticatedApi>
}

// AnyRouter is the only model provider. Models come from the live AnyRouter catalog
// (listAnyRouterSuggestedModels), plus a "custom model id" escape hatch.
const CUSTOM_VALUE = 'custom'

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

export default function AddModelModal({ visible, onCancel, onSuccess, authenticatedApi }: AddModelModalProps) {
  const toasts = useKumoToastManager()

  const [loading, setLoading] = useState(false)
  const [selectValue, setSelectValue] = useState<string | undefined>(undefined)

  // Form fields (used for custom models)
  const [modelId, setModelId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [apiUrl, setApiUrl] = useState(defaultDirectModelApiUrl('anyrouter') ?? '')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [keyOptionsOpen, setKeyOptionsOpen] = useState(false)

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

  const isCustom = selectValue === CUSTOM_VALUE
  const selectedModel = !isCustom && selectValue
    ? anyRouterModels.find((m) => m.id === selectValue) ?? null
    : null

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
      setSelectValue(undefined)
      setModelId('')
      setDisplayName('')
      setApiToken('')
      setApiUrl(defaultDirectModelApiUrl('anyrouter') ?? '')
      setErrors({})
      setKeyOptionsOpen(false)
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
            setErrors((prev) => ({ ...prev, apiToken: '' }))
            setAnyRouterLogin({ phase: 'connected' })
            toasts.add({
              title: 'AnyRouter connected — pick a model and add it',
              variant: 'success',
            })
            break
          case 'denied':
          case 'expired':
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
    if (value === CUSTOM_VALUE) {
      setModelId('')
      setDisplayName('')
    } else {
      const model = anyRouterModels.find((m) => m.id === value)
      setModelId(value)
      setDisplayName(model?.name ?? value)
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!selectValue) {
      newErrors.selection = 'Please select a model'
    }
    if (isCustom) {
      if (!modelId.trim()) newErrors.modelId = 'Please enter the model ID'
      if (!displayName.trim()) newErrors.displayName = 'Please enter a display name'
    }
    // No key required up front: the deployment mints one automatically when it can
    // (provisionAnyRouterKey); otherwise submit surfaces the connect/paste options.

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      // The user's key, or an automatically minted one when the deployment supports it.
      let finalToken = apiToken.trim()
      if (!finalToken) {
        const provisioned = await authenticatedApi.provisionAnyRouterKey().catch((err) => {
          console.error('AnyRouter key provisioning failed:', err)
          return null
        })
        if (!provisioned) {
          setErrors((prev) => ({
            ...prev,
            apiToken: 'Connect with AnyRouter or paste an API key',
          }))
          setKeyOptionsOpen(true)
          return
        }
        finalToken = provisioned.apiToken
        setApiToken(finalToken)
      }

      const finalModelId = isCustom ? modelId.trim() : selectValue!
      const finalDisplayName = isCustom ? displayName.trim() : (selectedModel?.name ?? selectValue!)

      const profile: AiChatAuthorInfo = {
        type: 'agent',
        id: finalModelId,
        name: finalDisplayName,
      }

      const config: AiModelConfig = {
        provider: 'anyrouter',
        model: finalModelId,
        apiToken: finalToken,
        ...(apiUrl.trim() && { apiUrl: apiUrl.trim() }),
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

  return (
    <Dialog.Root open={visible} onOpenChange={(open) => { if (!open) onCancel() }}>
      <Dialog className="p-6" size="lg">
        <Dialog.Title className="text-lg font-semibold mb-4">
          Add AI Model
        </Dialog.Title>

        <div className="space-y-4">
          {/* Model selection — the AnyRouter catalog is the only source of models. */}
          <Select
            label="Select Model"
            className="w-full text-sm"
            placeholder="Choose an AnyRouter model..."
            value={selectValue}
            onValueChange={(v) => handleModelSelect(v as string)}
            error={errors.selection}
            renderValue={(v) => {
              if (v === CUSTOM_VALUE) return 'Other AnyRouter model...'
              const model = anyRouterModels.find((m) => m.id === v)
              return model ? `${model.name} · ${model.id}` : String(v)
            }}
          >
            {anyRouterModels.map((model) => (
              <Select.Option key={model.id} value={model.id}>
                {model.name} · {model.id}
              </Select.Option>
            ))}
            <div className="h-px bg-kumo-line my-1 mx-2" />
            <Select.Option value={CUSTOM_VALUE}>
              Other AnyRouter model...
            </Select.Option>
          </Select>

          {/* Custom model fields */}
          {isCustom && (
            <>
              <Input
                label="Model ID"
                placeholder={`e.g., ${anyRouterModels[0]?.id ?? 'z-ai/glm-5.2'}`}
                description="The AnyRouter catalog id, in provider/model form"
                value={modelId}
                onChange={(e) => { setModelId(e.target.value); setErrors(prev => ({ ...prev, modelId: '' })) }}
                error={errors.modelId}
                variant={errors.modelId ? 'error' : 'default'}
              />

              <Input
                label="Display Name"
                placeholder={`e.g., ${anyRouterModels[0]?.name ?? 'GLM-5.2 (AnyRouter)'}`}
                description="Human-readable name shown in the UI"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setErrors(prev => ({ ...prev, displayName: '' })) }}
                error={errors.displayName}
                variant={errors.displayName ? 'error' : 'default'}
              />
            </>
          )}

          {/* API key: minted automatically on add when the deployment supports it; the options
              below cover using your own key instead. */}
          <Collapsible.Root open={keyOptionsOpen} onOpenChange={setKeyOptionsOpen}>
            <Collapsible.DefaultTrigger>
              {anyRouterLogin.phase === 'connected' || apiToken
                ? 'API key: using your own key'
                : 'API key: created automatically (or use your own)'}
            </Collapsible.DefaultTrigger>
            <Collapsible.DefaultPanel>
              <div className="space-y-3 rounded-lg border border-kumo-line bg-kumo-tint/40 p-3">
                <p className="text-[12px] leading-[16px] tracking-[-0.2px] text-kumo-subtle">
                  Leave empty to have a key minted for you automatically. To bill your own
                  AnyRouter account instead, sign in with AnyRouter to pick or create a key, or
                  paste one below.
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
                    variant="secondary"
                    onClick={startAnyRouterConnect}
                    loading={anyRouterLogin.phase === 'starting'}
                  >
                    Connect with AnyRouter
                  </Button>
                )}

                <SensitiveInput
                  label="API Token"
                  placeholder="sk-ar-..."
                  description="From https://anyrouter.dev/dashboard (starts with sk-ar-)"
                  value={apiToken}
                  onValueChange={(v) => {
                    setApiToken(v)
                    setErrors((prev) => ({ ...prev, apiToken: '' }))
                  }}
                  error={errors.apiToken}
                  variant={errors.apiToken ? 'error' : 'default'}
                />

                <Input
                  label="API URL"
                  placeholder="https://anyrouter.dev/api/v1"
                  description="AnyRouter OpenAI-compatible base URL (model ids use provider/model form)"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>
            </Collapsible.DefaultPanel>
          </Collapsible.Root>

          {errors.apiToken && !keyOptionsOpen && (
            <p className="text-[12px] text-red-600">{errors.apiToken}</p>
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
            disabled={!selectValue}
          >
            Add Model
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
