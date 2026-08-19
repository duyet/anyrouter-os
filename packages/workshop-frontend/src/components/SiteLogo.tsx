import { useEffect, useState, type ReactNode } from 'react'
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
  // The secondary mark only applies to the live config, never to the Admin upload/reset preview.
  const secondarySrc = srcOverride === undefined ? serverConfig?.siteLogo?.secondary?.url : undefined
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
  return (
    <span className={`flex items-center gap-1.5 ${className ?? ''}`}>
      {/* The configured mark leads the lockup; the deployment's own mark follows it. */}
      {!secondaryFailed && (
        <img
          src={secondarySrc}
          alt=""
          style={markStyle}
          className="object-contain"
          onError={() => setSecondaryFailed(true)}
        />
      )}
      {!src || failed ? children : (
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
