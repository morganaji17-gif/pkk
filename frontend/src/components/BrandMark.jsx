/**
 * Mark Pesanin — hasil trace logo Canva (12 Nov 2026):
 * bar atas mengalir ke ujung D, bar bawah menggantung, ekor stem turun.
 * Satu sumber geometri untuk semua permukaan: sidebar, login, struk, favicon.
 * Grid 24×24, stroke 1.74, ujung bulat.
 */
export const BRAND_MARK_PATH =
  'M2.78 19.58 V5.72 A1.3 1.3 0 0 1 4.08 4.42 H17.67 A3.48 3.48 0 0 1 17.67 11.38 H6.91'

export default function BrandMark({
  size = 24,
  strokeWidth = 1.74,
  className,
  title,
  ...rest
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={BRAND_MARK_PATH} />
    </svg>
  )
}
