export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="staff-page-header">
      <div className="staff-page-header__text">
        <h1 className="staff-page-header__title">{title}</h1>
        {subtitle && <p className="staff-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="staff-page-header__actions">{actions}</div>}
    </div>
  )
}
