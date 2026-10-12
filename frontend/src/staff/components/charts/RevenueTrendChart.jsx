import { formatRupiah, localDateStr } from '../../../utils/format'

const CHART_W = 700
const CHART_H = 140
const PAD = { top: 20, right: 12, bottom: 24, left: 52 }

function niceMaxFor(max) {
  if (max <= 0) return 0
  const exp = Math.floor(Math.log10(max))
  const pow10 = Math.pow(10, exp)
  const frac = max / pow10
  let niceFrac
  if (frac <= 1) niceFrac = 1
  else if (frac <= 2) niceFrac = 2
  else if (frac <= 5) niceFrac = 5
  else niceFrac = 10
  return niceFrac * pow10
}

function formatTick(value) {
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}jt`
  if (value >= 1000) return `Rp ${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}rb`
  return formatRupiah(value)
}

export default function RevenueTrendChart({ series }) {
  if (!Array.isArray(series) || series.length === 0) {
    return <p className="chart-empty">Belum ada data pendapatan.</p>
  }

  const hasData = series.some((s) => s.value > 0)
  if (!hasData) {
    return <p className="chart-empty chart-empty--compact">Belum ada pendapatan.</p>
  }

  const rawMax = Math.max(...series.map((s) => s.value), 0)
  const niceMax = niceMaxFor(rawMax)
  const innerW = CHART_W - PAD.left - PAD.right
  const innerH = CHART_H - PAD.top - PAD.bottom
  const slot = innerW / series.length
  const barW = Math.min(44, slot * 0.6)
  const baseline = PAD.top + innerH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f))

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="chart-svg"
      role="img"
      aria-label="Grafik pendapatan 7 hari terakhir"
    >
      {ticks.map((v, idx) => {
        const y = baseline - (niceMax > 0 ? (v / niceMax) * innerH : 0)
        return (
          <g key={idx}>
            <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y} y2={y} className="chart-gridline" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="chart-tick">
              {formatTick(v)}
            </text>
          </g>
        )
      })}
      {series.map((s, i) => {
        const h = niceMax > 0 ? (s.value / niceMax) * innerH : 0
        const x = PAD.left + slot * i + (slot - barW) / 2
        const y = baseline - h
        const isToday = s.key === localDateStr()
        const showValue = s.value > 0 && h > 18
        return (
          <g key={s.key}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0)}
              rx="2"
              className={`chart-bar${isToday && s.value > 0 ? ' chart-bar--today' : ''}`}
            >
              <title>{`${s.label}: ${formatRupiah(s.value)}${isToday ? ' (hari ini)' : ''}`}</title>
            </rect>
            {showValue && (
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className={`chart-value${isToday ? ' chart-value--today' : ''}`}
              >
                {formatRupiah(s.value)}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={CHART_H - 6}
              textAnchor="middle"
              className={`chart-label${isToday ? ' chart-label--today' : ''}`}
            >
              {isToday ? 'Hari ini' : s.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
