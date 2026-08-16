import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, Button, Input, Select, SensitiveInput, Collapsible, useKumoToastManager } from '@cloudflare/kumo'
import {
  AiChatAuthorInfo,
  AiModelConfig,
  AnyRouterConnectionStatus,
  AnyRouterSuggestedModel,
  SUGGESTED_MODELS,
  ANYROUTER_DEFAULT_API_URL,
} from '@gadgets/workshop-shared/api'
import { RpcStub } from 'capnweb'
import { AuthenticatedApi } from '@gadgets/workshop-shared/api'
import { useServerConfig } from './ServerConfigContext'
import {
  ANYROUTER_OAUTH_CHANNEL,
  beginAnyRouterOAuth,
  isAnyRouterGrantExpired,
} from './anyrouterOAuth'

interface AddModelModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  authenticatedApi: RpcStub<AuthenticatedApi>
}

// AnyRouter is the only model provider. Models come from the live AnyRouter catalog
// (listAnyRouterSuggestedModels), plus a "custom model id" escape hatch. The key comes from the
// account's AnyRouter grant (connected via "Sign in with AnyRouter") unless the user pastes one.
const CUSTOM_VALUE = 'custom'

type ConnectionUi =
  | { phase: 'loading' }
  | { phase: 'status'; connection: AnyRouterConnectionStatus }
  | { phase: 'waiting' }
  | { phase: 'error'; message: string }

export default function AddModelModal({ visible, onCancel, onSuccess, authenticatedApi }: AddModelModalProps) {
  const toasts = useKumoToastManager()
  const serverConfig = useServerConfig()

  const [loading, setLoading] = useState(false)
  const [selectValue, setSelectValue] = useState<string | undefined>(undefined)

  // Form fields (used for custom models)
  const [modelId, setModelId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [apiUrl, setApiUrl] = useState(ANYROUTER_DEFAULT_API_URL)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [keyOptionsOpen, setKeyOptionsOpen] = useState(false)

  // Live AnyRouter suggestions + account connection status
  const [anyRouterModels, setAnyRouterModels] = useState<AnyRouterSuggestedModel[]>(() =>
    Object.entries(SUGGESTED_MODELS.anyrouter).map(([id, m]) => ({
      id,
      name: m.name,
      contextWindow: m.contextWindow,
    })),
  )
  const [connectionUi, setConnectionUi] = useState<ConnectionUi>({ phase: 'loading' })
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isCustom = selectValue === CUSTOM_VALUE
  const selectedModel = !isCustom && selectValue
    ? anyRouterModels.find((m) => m.id === selectValue) ?? null
    : null

  const grantUsable = connectionUi.phase === 'status'
    && connectionUi.connection.connected
    && !isAnyRouterGrantExpired(connectionUi.connection.expiresAt)

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const refreshConnection = useCallback(async (): Promise<AnyRouterConnectionStatus | null> => {
    try {
      const connection = await authenticatedApi.getAnyRouterConnection()
      setConnectionUi({ phase: 'status', connection })
      return connection
    } catch (err) {
      console.error('Failed to read AnyRouter connection:', err)
      setConnectionUi({ phase: 'error', message: 'Could not check your AnyRouter connection.' })
      return null
    }
  }, [authenticatedApi])

  // Load live top-usage models + the connection status when the dialog opens.
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
    refreshConnection()
    return () => { cancelled = true }
  }, [visible, authenticatedApi, refreshConnection])

  // Reset all state when dialog closes
  useEffect(() => {
    if (!visible) {
      setSelectValue(undefined)
      setModelId('')
      setDisplayName('')
      setApiToken('')
      setApiUrl(ANYROUTER_DEFAULT_API_URL)
      setErrors({})
      setKeyOptionsOpen(false)
      setConnectionUi({ phase: 'loading' })
      clearPollTimer()
    }
  }, [visible, clearPollTimer])

  useEffect(() => () => clearPollTimer(), [clearPollTimer])

  const startConnect = async () => {
    const clientId = serverConfig?.anyrouterOauthClientId
    if (!clientId) {
      setConnectionUi({
        phase: 'error',
        message: 'AnyRouter sign-in is not configured on this deployment '
          + '(ANYROUTER_OAUTH_CLIENT_ID is missing). Paste an API key instead.',
      })
      setKeyOptionsOpen(true)
      return
    }
    const popup = await beginAnyRouterOAuth(clientId)
    if (!popup) {
      setConnectionUi({
        phase: 'error',
        message: 'The browser blocked the AnyRouter window. Allow pop-ups and try again.',
      })
      return
    }
    setConnectionUi({ phase: 'waiting' })
    // Learn about the completed grant via the callback route's broadcast, with polling as the
    // fallback.
    const check = async () => {
      const connection = await refreshConnection()
      if (connection?.connected && !isAnyRouterGrantExpired(connection.expiresAt)) {
        clearPollTimer()
        setErrors((prev) => ({ ...prev, apiToken: '' }))
      } else if (connection) {
        // Still pending — keep the waiting UI (refreshConnection set 'status').
        setConnectionUi({ phase: 'waiting' })
      }
    }
    clearPollTimer()
    pollTimerRef.current = setInterval(check, 2500)
    try {
      const channel = new BroadcastChannel(ANYROUTER_OAUTH_CHANNEL)
      channel.onmessage = () => {
        channel.close()
        check()
      }
    } catch {
      // Polling covers it.
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
    // Key: either the account grant covers it, or the user pasted one.
    if (!apiToken.trim() && !grantUsable) {
      newErrors.apiToken = 'Connect your AnyRouter account or paste an API key'
    }

    setErrors(newErrors)
    if (newErrors.apiToken) setKeyOptionsOpen(true)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
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
        // Empty = use the account's AnyRouter grant (resolved server-side at inference time,
        // so a later re-connect refreshes this model too).
        apiToken: apiToken.trim(),
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

  const connectionSummary =
    connectionUi.phase === 'loading' ? 'checking connection…'
    : connectionUi.phase === 'waiting' ? 'waiting for approval…'
    : connectionUi.phase === 'error' ? 'connection unavailable'
    : grantUsable ? 'using your AnyRouter account'
    : connectionUi.connection.connected ? 'connection expired — reconnect'
    : 'not connected'

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

          {/* API key: the account's AnyRouter grant by default; paste your own to override. */}
          <Collapsible.Root open={keyOptionsOpen} onOpenChange={setKeyOptionsOpen}>
            <Collapsible.DefaultTrigger>
              {apiToken ? 'API key: using a pasted key' : `API key: ${connectionSummary}`}
            </Collapsible.DefaultTrigger>
            <Collapsible.DefaultPanel>
              <div className="space-y-3 rounded-lg border border-kumo-line bg-kumo-tint/40 p-3">
                <p className="text-[12px] leading-[16px] tracking-[-0.2px] text-kumo-subtle">
                  Models use the key granted by your AnyRouter account (billed to you, revocable
                  from the AnyRouter dashboard). Reconnect when it expires, or paste a key below
                  to use a specific one instead.
                </p>

                {connectionUi.phase === 'waiting' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-kumo-brand border-t-transparent rounded-full animate-spin" />
                    <span className="text-[12px] text-kumo-subtle">
                      Approve access in the AnyRouter tab…
                    </span>
                    <Button variant="secondary" onClick={startConnect}>
                      Reopen
                    </Button>
                  </div>
                ) : grantUsable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-emerald-700">
                      Connected
                    </span>
                    <span className="text-[12px] text-kumo-subtle">
                      AnyRouter account linked
                    </span>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await authenticatedApi.disconnectAnyRouter()
                        } finally {
                          refreshConnection()
                        }
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connectionUi.phase === 'error' && (
                      <p className="text-[12px] text-red-600">{connectionUi.message}</p>
                    )}
                    <Button variant="primary" onClick={startConnect}>
                      {connectionUi.phase === 'status' && connectionUi.connection.connected
                        ? 'Reconnect AnyRouter'
                        : 'Connect with AnyRouter'}
                    </Button>
                  </div>
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
