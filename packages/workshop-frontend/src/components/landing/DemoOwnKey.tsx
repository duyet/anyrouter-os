import { Key } from '@phosphor-icons/react'
import { SUGGESTED_MODELS } from '@gadgets/workshop-shared/api'
import { anyrouterProviderLogo } from '../../anyrouterMark'
import { DemoFrame, LandingSection } from './tokens'
import { useDemoStep } from './useDemoStep'

const MODEL_LOGOS: Record<string, { file: string; invert?: boolean }> = {
  'z-ai/glm-5.2': { file: 'z-ai.svg', invert: true },
  'moonshotai/kimi-k3': { file: 'moonshotai-color.svg' },
  'stepfun-ai/step-3.7-flash': { file: 'stepfun-color.svg' },
  'meituan/longcat-2.0': { file: 'longcat.svg', invert: true },
}

// Pulled from the same catalog `OnboardingWizard` offers, rather than a hand-picked list, so this
// never drifts from what the product actually suggests.
const MODELS = Object.entries(SUGGESTED_MODELS.anyrouter).map(([id, model]) => ({ id, ...model }))

const INTERVAL_MS = 750

/**
 * Third demo: cycles the highlight across a few real AnyRouter catalog models to carry the
 * "own key, own bill, any model" idea — grounded in `OnboardingWizard`'s connect step and
 * `deploy/anyrouter-os.md` (inference-only key, billed to the user, revocable from their own
 * AnyRouter dashboard).
 */
export default function DemoOwnKey() {
  const { step, containerRef } = useDemoStep(MODELS.length, INTERVAL_MS, 0)

  return (
    <LandingSection
      eyebrow="Demo — your own key"
      title="Your models, your bill"
      body="Inference runs on your own AnyRouter key, not a shared deployment credential — usage is billed to you, and you can pick any model in its catalog."
    >
      <DemoFrame>
        <div ref={containerRef} aria-hidden="true" className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-3 sm:w-40">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
              <Key size={18} weight="duotone" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">Your AnyRouter key</p>
              <p className="text-[11px] text-muted-foreground">Billed to you</p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap gap-2">
            {MODELS.map((model, index) => {
              const active = index === step
              const logo = MODEL_LOGOS[model.id]
              return (
                <div
                  key={model.id}
                  className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 transition-colors duration-150 ${
                    active ? 'border-primary bg-primary/5' : 'border-border bg-background'
                  }`}
                >
                  {logo ? (
                    <img
                      src={anyrouterProviderLogo(logo.file)}
                      alt=""
                      width={14}
                      height={14}
                      decoding="async"
                      className={`size-3.5 shrink-0 object-contain ${logo.invert ? 'dark:invert' : ''}`}
                    />
                  ) : (
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-border'}`} />
                  )}
                  <span className="truncate text-[12px] font-medium text-foreground">{model.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </DemoFrame>
    </LandingSection>
  )
}
