import {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { ANYROUTER_MARK_CDN } from '../anyrouterMark'
import { useServerConfig } from '../ServerConfigContext'

export default function SiteLogo({
  size,
  className,
  srcOverride,
  children,
}: {
  size: number
  className?: string
  srcOverride?: string | null
  children: ReactNode
}) {
  const serverConfig = useServerConfig()
  const configuredUrl = serverConfig?.siteLogo?.url
  const src = srcOverride === undefined ? configuredUrl : srcOverride ?? undefined
  // Paint the AnyRouter mark before RPC returns. Once config loads, honor whatever the
  // deployment set (including "no secondary"). Admin preview never uses the secondary.
  const secondarySrc = srcOverride === undefined
    ? (serverConfig ? serverConfig.siteLogo?.secondary?.url : ANYROUTER_MARK_CDN)
    : undefined
  const [failed, setFailed] = useState(false)
  const [secondaryFailed, setSecondaryFailed] = useState(false)

  useEffect(() => setFailed(false), [src, serverConfig])
  useEffect(() => setSecondaryFailed(false), [secondarySrc, serverConfig])

  if (!secondarySrc) {
    if (!src || failed) return children
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`object-contain ${className ?? ''}`}
        onError={() => setFailed(true)}
      />
    )
  }

  // In the lockup the marks sit side by side, so match them by HEIGHT and let each keep its own
  // width. Forcing a square box instead letterboxes a wide wordmark (e.g. the AnyRouter mark),
  // making it render shorter than the square OS mark beside it. An explicit inline height also
  // beats the framework's `img { height: auto }` reset, which would otherwise ignore the attribute.
  const markStyle = { height: size, width: 'auto' as const }
  // Strip any margin the caller's fallback mark carries (the default OS square uses `mb-3` for when
  // it stands alone): inside this centered flex a bottom margin shifts that mark up relative to the
  // image beside it, so despite equal heights the two look misaligned. An inline style beats the
  // class, keeping the marks the same height AND aligned.
  const alignedFallback = isValidElement(children)
    ? cloneElement(children as ReactElement<{ style?: CSSProperties }>, {
        style: { ...(children as ReactElement<{ style?: CSSProperties }>).props.style, margin: 0 },
      })
    : children
  return (
    <span className={`flex items-center gap-1.5 ${className ?? ''}`}>
      {/* The configured mark leads the lockup; the deployment's own mark follows it. */}
      {!secondaryFailed && (
        <img
          src={secondarySrc}
          alt=""
          style={markStyle}
          className="object-contain"
          fetchPriority="high"
          decoding="async"
          onError={() => setSecondaryFailed(true)}
        />
      )}
      {!src || failed ? alignedFallback : (
        <img
          src={src}
          alt=""
          style={markStyle}
          className="object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}
