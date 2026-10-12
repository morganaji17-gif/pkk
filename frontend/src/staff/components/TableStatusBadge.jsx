import { tableStatusInfo } from '../../utils/tableStatus'

const BADGE_CLASS = {
  available: 'staff-badge--served',
  occupied: 'staff-badge--pending',
  maintenance: 'staff-badge--cancelled',
}

export default function TableStatusBadge({ status }) {
  const info = tableStatusInfo(status)

  return (
    <span className={`staff-badge ${BADGE_CLASS[status] || ''}`}>
      {info.label}
    </span>
  )
}