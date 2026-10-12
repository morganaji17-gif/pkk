export default function EmptyState({ icon = 'cart', title, message }) {
  const paths = {
    cart: (
      <>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </>
    ),
    menu: (
      <>
        <path d="M6 2v14" />
        <path d="M6 6c0-2 2-3 4-3s4 1 4 3-2 3-4 3" />
        <path d="M14 2v14" />
        <path d="M14 6c0-2 2-3 4-3s4 1 4 3-2 3-4 3" />
        <path d="M4 22h16" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  }
  return (
    <div className="state">
      <div className="state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
          {paths[icon]}
        </svg>
      </div>
      <h2 className="state__title">{title}</h2>
      {message && <p className="state__label">{message}</p>}
    </div>
  )
}
