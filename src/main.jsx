import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import './style.css'
import './arrakis-testnet.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')
const REQUIRE_BETA_ACCESS = import.meta.env.VITE_REQUIRE_BETA_ACCESS === 'true'
const BETA_CODE_SESSION_KEY = 'arrakis-beta-access-code'
const BINANCE_SPOT = 'https://data-api.binance.vision/api/v3'

function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {})
  try {
    const betaCode = window.sessionStorage.getItem(BETA_CODE_SESSION_KEY)
    if (betaCode) headers.set('X-ARRAKIS-BETA-CODE', betaCode)
  } catch {
    // Session storage can be disabled; the API will return its normal authorization error.
  }
  return fetch(url, { ...options, headers })
}

function TokenIcon({ asset, size = 32 }) {
  const token = String(asset || '').toUpperCase()
  const common = { width: size, height: size, viewBox: '0 0 36 36', className: `arrakis-token-icon token-icon-${token.toLowerCase()}`, role: 'img', 'aria-label': `${token} token logo`, focusable: 'false' }
  if (token === 'USDC') return (
    <svg {...common}>
      <circle cx="18" cy="18" r="18" fill="#2775CA" />
      <path d="M23.4 11.1c-1.55-.9-3.35-1.4-5.4-1.4-4.65 0-8.4 3.75-8.4 8.4s3.75 8.4 8.4 8.4c2.05 0 3.85-.5 5.4-1.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18 11.6v12.8m-2.5-9.9h4.2c2.8 0 2.8 3.4 0 3.4h-3.4c-2.8 0-2.8 3.4 0 3.4h4.2" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
  if (token === 'ETH') return (
    <svg {...common}>
      <circle cx="18" cy="18" r="18" fill="#222630" />
      <path d="M18 4.7 9.2 18 18 22.1 26.8 18Z" fill="#DDE1E8" />
      <path d="M18 4.7 18 22.1 26.8 18Z" fill="#929BAA" />
      <path d="m9.2 20 8.8 11.2L26.8 20 18 25.1Z" fill="#AAB2C1" />
      <path d="M18 25.1v6.1L26.8 20Z" fill="#70798A" />
    </svg>
  )
  if (token === 'SOL') return (
    <svg {...common}>
      <circle cx="18" cy="18" r="18" fill="#101113" />
      <path d="M10 9.2h17l-3.1 4H6.9Z" fill="#A18BFA" />
      <path d="M9.1 16h17l-3.2 4H5.9Z" fill="#66E3C4" />
      <path d="M10 22.8h17l-3.1 4H6.9Z" fill="#A18BFA" />
    </svg>
  )
  if (token === 'BNB') return (
    <svg {...common}>
      <circle cx="18" cy="18" r="18" fill="#F3BA2F" />
      <path d="m18 6.8 4.1 4.1-2.6 2.6-1.5-1.5-1.5 1.5-2.6-2.6Z" fill="#fff" />
      <path d="m10.5 14.3 2.6 2.6-2.6 2.6-2.6-2.6Z" fill="#fff" />
      <path d="m25.5 14.3 2.6 2.6-2.6 2.6-2.6-2.6Z" fill="#fff" />
      <path d="m18 15.4 2.6 2.6-2.6 2.6-2.6-2.6Z" fill="#fff" />
      <path d="m18 22.7 1.5-1.5 2.6 2.6-4.1 4.1-4.1-4.1 2.6-2.6Z" fill="#fff" />
    </svg>
  )
  return <svg {...common}><circle cx="18" cy="18" r="18" fill="#373737" /><text x="18" y="23" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{token.slice(0, 1)}</text></svg>
}

const money = (value, digits = 2) =>
  Number.isFinite(Number(value))
    ? Number(value).toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '—'

function useReferenceData(selectedVenue) {
  const [marketPrice, setMarketPrice] = useState(null)
  const [marketChange, setMarketChange] = useState(null)
  const [marketStatus, setMarketStatus] = useState('Connecting to ARRAKIS')

  const [fundingRate, setFundingRate] = useState(null)
  const [fundingStatus, setFundingStatus] = useState('Loading')

  const [openInterest, setOpenInterest] = useState(null)
  const [openInterestStatus, setOpenInterestStatus] = useState('Loading')
  const [openInterestHistory, setOpenInterestHistory] = useState([])
  const [openInterestHistoryStatus] = useState('Not provided by backend')

  
  useEffect(() => {
    let cancelled = false

    async function loadMarketData() {
      try {
        const response = await apiFetch(
          `${API_BASE}/api/markets?venue=${selectedVenue}`,
        )
        if (!response.ok) throw new Error('Market API request failed')

        const result = await response.json()
        const markets = Array.isArray(result.markets) ? result.markets : []

        const sol = markets.find(
          (market) =>
            market.baseAsset?.toUpperCase() === 'SOL' ||
            market.symbol?.toUpperCase().startsWith('SOL-'),
        )

        if (cancelled) return

        const venueName =
          selectedVenue === 'all'
            ? 'All venues'
            : selectedVenue === 'dydx'
              ? 'dYdX reference data'
              : 'Hyperliquid reference data'

        if (!sol) {
          setMarketPrice(null)
          setFundingRate(null)
          setOpenInterest(null)
          setMarketStatus(`SOL unavailable · ${venueName}`)
          setFundingStatus('Unavailable')
          setOpenInterestStatus('Unavailable')
          setOpenInterestHistory([])
          return
        }

        const toValidNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const price = toValidNumber(sol.markPrice)
const funding = toValidNumber(sol.fundingRate)
const interest = toValidNumber(sol.openInterest)

        setMarketPrice(price)
setMarketStatus(
  price === null ? 'Price unavailable' : venueName
)

setFundingRate(funding)
setFundingStatus(
  funding === null ? 'Funding unavailable' : venueName
)

setOpenInterest(interest)
setOpenInterestStatus(
  interest === null ? 'Open interest unavailable' : venueName
)
      } catch {
        if (!cancelled) {
          setMarketPrice(null)
          setFundingRate(null)
          setOpenInterest(null)
          setMarketStatus('Market data unavailable')
          setFundingStatus('Market data unavailable')
          setOpenInterestStatus('Market data unavailable')
        }
      }
    }

    loadMarketData()
    const timer = setInterval(loadMarketData, 15000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [selectedVenue])


  useEffect(() => {
    let cancelled = false

    async function load24HourChange() {
      try {
        const response = await fetch(
          `${BINANCE_SPOT}/ticker/24hr?symbol=SOLUSDT`,
        )

        if (!response.ok) {
          throw new Error('Binance 24-hour ticker request failed')
        }

        const result = await response.json()
        const change = Number(result.priceChangePercent)

        if (!cancelled && Number.isFinite(change)) {
          setMarketChange(change)
        }
      } catch (error) {
        console.error('Failed to load Binance 24-hour change:', error)
      }
    }

    load24HourChange()
    const timer = setInterval(load24HourChange, 15000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return {
    marketPrice,
    marketChange,
    marketStatus,
    fundingRate,
    fundingStatus,
    openInterest,
    openInterestStatus,
    openInterestHistory,
    openInterestHistoryStatus,
  }
}


function SolChart({ asset = 'SOL' }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const [timeframe, setTimeframe] = useState('1d')
  const [chartStatus, setChartStatus] = useState('Loading Binance spot candles')

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: '#111318' },
        textColor: '#9296A0',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#20232A' },
        horzLines: { color: '#20232A' },
      },
      rightPriceScale: { borderColor: '#282B32' },
      timeScale: {
        borderColor: '#282B32',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: '#8A6528', labelBackgroundColor: '#8A6528' },
        horzLine: { color: '#8A6528', labelBackgroundColor: '#8A6528' },
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#14F195',
      downColor: '#F06464',
      borderUpColor: '#14F195',
      borderDownColor: '#F06464',
      wickUpColor: '#14F195',
      wickDownColor: '#F06464',
    })

    chartRef.current = chart
    seriesRef.current = series

    const resizeObserver = new ResizeObserver(() => {
      chart.timeScale().fitContent()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCandles() {
      setChartStatus('Loading Binance spot candles')

      try {
        const response = await fetch(
          `${BINANCE_SPOT}/klines?symbol=${asset}USDT&interval=${timeframe}&limit=${timeframe === '1d' ? 90 : 100}`,
        )
        if (!response.ok) throw new Error('Chart request failed')

        const rows = await response.json()
        if (cancelled || !seriesRef.current) return

        const candles = rows.map((row) => ({
          time: Math.floor(Number(row[0]) / 1000),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
        }))

        seriesRef.current.setData(candles)
        chartRef.current?.timeScale().fitContent()
        setChartStatus('Binance spot reference')
      } catch {
        if (!cancelled) setChartStatus('Chart data unavailable')
      }
    }

    loadCandles()
    const timer = setInterval(loadCandles, 15000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [timeframe, asset])

  return (
    <section className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div>
          <div className="eyebrow">MARKET CHART</div>
          <h2>{asset} / USDT</h2>
          <p className="muted small">Live spot reference candles · Sandbox settlement</p>
        </div>

        <div className="timeframes" aria-label="Chart timeframe">
          {['1m', '5m', '15m', '1h', '1d'].map((frame) => (
            <button
              key={frame}
              type="button"
              className={timeframe === frame ? 'timeframe active' : 'timeframe'}
              onClick={() => setTimeframe(frame)}
            >
              {frame}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-canvas" ref={containerRef} />

      <div className="chart-footnote">
        <span className="live-dot" />
        {chartStatus}
        <span className="muted"> · Reference data only</span>
      </div>
    </section>
  )
}

function StatCard({ label, value, detail, className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}

function StyledDropdown({ label, value, options, onChange, ariaLabel, variant = 'default' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div
      className={`custom-select custom-select--${variant}${open ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? label}</span>
      </button>

      {open && (
        <div className="custom-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={
                  selected
                    ? 'custom-select-option selected'
                    : 'custom-select-option'
                }
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
              >
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RouteComparison() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [spreadHistory, setSpreadHistory] = useState([])
  const [fillVenue, setFillVenue] = useState('hyperliquid')
  const [fillSide, setFillSide] = useState('buy')
  const [fillSize, setFillSize] = useState('10')
  const [fillFeeBps, setFillFeeBps] = useState('5')
  const [fillEstimate, setFillEstimate] = useState(null)
  const [fillEstimateLoading, setFillEstimateLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadRouteComparison() {
      try {
        const response = await apiFetch(`${API_BASE}/api/routes?symbol=SOL`, {
          cache: 'no-store',
        })
        const result = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            result?.detail || result?.error || `Route API returned ${response.status}`,
          )
        }

        if (cancelled) return
        setPayload(result)
        setSpreadHistory(
          Array.isArray(result?.spreadHistory)
            ? result.spreadHistory
                .filter((point) =>
                  Number.isFinite(Number(point?.time)) &&
                  Number.isFinite(Number(point?.spreadPct)) &&
                  Number(point.spreadPct) >= 0,
                )
                .slice(-96)
            : [],
        )
        setError('')
        setLastUpdated(new Date())
      } catch (requestError) {
        if (cancelled) return
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load route comparison.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRouteComparison()
    const timer = setInterval(loadRouteComparison, 15000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let controller = null

    const requestedSize = fillSize.trim() === '' ? NaN : Number(fillSize)
    const assumedFeeBps = fillFeeBps.trim() === '' ? NaN : Number(fillFeeBps)

    if (
      !Number.isFinite(requestedSize) ||
      requestedSize <= 0 ||
      !Number.isFinite(assumedFeeBps) ||
      assumedFeeBps < 0
    ) {
      setFillEstimate(null)
      setFillEstimateLoading(false)
      return () => {
        cancelled = true
      }
    }

    setFillEstimate(null)
    setFillEstimateLoading(true)

    const timer = setTimeout(async () => {
      controller = new AbortController()

      try {
        const response = await apiFetch(`${API_BASE}/api/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify({
            symbol: 'SOL',
            venue: fillVenue,
            side: fillSide,
            size: requestedSize,
            assumedFeeBps,
          }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(
            result?.detail || result?.error || `Estimate API returned ${response.status}`,
          )
        }

        if (!cancelled) {
          setFillEstimate(result?.estimate ?? { error: 'The API returned no estimate.' })
        }
      } catch (requestError) {
        if (cancelled || requestError?.name === 'AbortError') return
        setFillEstimate({
          error: requestError instanceof Error
            ? requestError.message
            : 'Unable to calculate the estimate on the backend.',
        })
      } finally {
        if (!cancelled) setFillEstimateLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller?.abort()
    }
  }, [fillVenue, fillSide, fillSize, fillFeeBps, lastUpdated])

  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : []
  const sources = Array.isArray(payload?.sources) ? payload.sources : []
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : []
const latestSpreadPoint = spreadHistory[spreadHistory.length - 1]
const previousSpreadPoint = spreadHistory[spreadHistory.length - 2]

const spreadTrend =
  !previousSpreadPoint
    ? 'Collecting history'
    : latestSpreadPoint.spreadPct > previousSpreadPoint.spreadPct
      ? 'Widening'
      : latestSpreadPoint.spreadPct < previousSpreadPoint.spreadPct
        ? 'Narrowing'
        : 'Stable'

const spreadValues = spreadHistory.map((point) => point.spreadPct)
const spreadMin = spreadValues.length ? Math.min(...spreadValues) : 0
const spreadMax = spreadValues.length ? Math.max(...spreadValues) : 0
const spreadRange = spreadMax - spreadMin || 1

const spreadPolyline = spreadHistory
  .map((point, index) => {
    const x = spreadHistory.length < 2
      ? 50
      : (index / (spreadHistory.length - 1)) * 100

    const y = 28 - ((point.spreadPct - spreadMin) / spreadRange) * 24

    return `${x},${y}`
  })
  .join(' ')

  const venueLabel = (venue) =>
    venue === 'hyperliquid' ? 'Hyperliquid' : venue === 'dydx' ? 'dYdX' : venue

  const formatNullable = (value, digits = 2) =>
    value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
      ? 'Unavailable'
      : money(Number(value), digits)

        const hyperliquidCandidate = candidates.find(
    (candidate) => candidate.venue === 'hyperliquid',
  )

  const dydxCandidate = candidates.find(
    (candidate) => candidate.venue === 'dydx',
  )

  const getValidPrice = (candidate) => {
    if (
      !candidate ||
      candidate.markPrice === null ||
      candidate.markPrice === undefined ||
      candidate.markPrice === ''
    ) {
      return null
    }

    const price = Number(candidate.markPrice)
    return Number.isFinite(price) && price > 0 ? price : null
  }

  const hyperliquidPrice = getValidPrice(hyperliquidCandidate)
  const dydxPrice = getValidPrice(dydxCandidate)

  const hasComparablePrices =
    hyperliquidPrice !== null && dydxPrice !== null

  const spreadAbs = hasComparablePrices
    ? Math.abs(hyperliquidPrice - dydxPrice)
    : null

  const averageMarkPrice = hasComparablePrices
    ? (hyperliquidPrice + dydxPrice) / 2
    : null

  const spreadPct =
    spreadAbs !== null && averageMarkPrice > 0
      ? (spreadAbs / averageMarkPrice) * 100
      : null

  const higherVenue =
    hasComparablePrices && hyperliquidPrice !== dydxPrice
      ? hyperliquidPrice > dydxPrice
        ? 'Hyperliquid'
        : 'dYdX'
      : null

  const lowerVenue =
    higherVenue === 'Hyperliquid'
      ? 'dYdX'
      : higherVenue === 'dYdX'
        ? 'Hyperliquid'
        : null

  const requestedFillSize = fillSize.trim() === '' ? NaN : Number(fillSize)
  const assumedFeeBps = fillFeeBps.trim() === '' ? NaN : Number(fillFeeBps)
  const fillSizeIsValid =
    fillSize.trim() !== '' &&
    Number.isFinite(requestedFillSize) &&
    requestedFillSize > 0
  const fillFeeIsValid =
    fillFeeBps.trim() !== '' &&
    Number.isFinite(assumedFeeBps) &&
    assumedFeeBps >= 0

  return (
    <section className="panel" style={{ padding: 20, marginTop: 18 }}>
      <div className="panel-heading" style={{ marginBottom: 16 }}>
        <div>
          <div className="eyebrow">ROUTE INTELLIGENCE</div>
          <h2>SOL venue comparison</h2>
          <p className="muted small">Reference market data · Refreshes every 15 seconds</p>
        </div>
        <span className="tag">
          {loading ? 'UPDATING' : error ? 'API ISSUE' : 'REFERENCE ONLY'}
        </span>
      </div>

      {loading && !payload && <p className="muted">Loading markets...</p>}

      {error && (
        <p className="muted small" style={{ marginBottom: 14 }}>
          Couldn't refresh market data: {error}
        </p>
      )}

      {hasComparablePrices && spreadAbs !== null && spreadPct !== null && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            padding: '14px 16px',
            marginBottom: 14,
            background: '#15171D',
            border: '1px solid #282B32',
            borderRadius: 10,
          }}
        >
          <div>
            <div className="eyebrow">MARK PRICE SPREAD</div>
            <div style={{ fontSize: 24, fontWeight: 650, marginTop: 5 }}>
              ${money(spreadAbs, 2)}
            </div>
            <div className="muted tiny">
              {money(spreadPct, 3)}% difference
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600 }}>
              {higherVenue ? `${higherVenue} mark higher` : 'Marks aligned'}
            </div>
            <div className="muted tiny" style={{ marginTop: 5 }}>
              {lowerVenue ? `${lowerVenue} mark lower` : 'Same reference price'}
            </div>
          </div>
        </div>
      )}

{spreadHistory.length > 0 && (
  <div
    style={{
      padding: '12px 16px',
      marginBottom: 14,
      background: '#111318',
      border: '1px solid #282B32',
      borderRadius: 10,
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div>
        <div className="eyebrow">SPREAD HISTORY</div>
        <div style={{ fontWeight: 600, marginTop: 5 }}>
          {spreadTrend}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 650 }}>
          {money(latestSpreadPoint.spreadPct, 3)}%
        </div>
        <div className="muted tiny">Reference spread</div>
      </div>
    </div>

    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      width="100%"
      height="44"
      role="img"
      aria-label="Recent reference spread history"
      style={{ display: 'block', marginTop: 8, overflow: 'visible' }}
    >
      <polyline
        points={spreadPolyline}
        fill="none"
        stroke="#14F195"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>

    <div className="muted tiny">
      Last {spreadHistory.length} updates · Approximately {Math.max(1, Math.round((spreadHistory.length * 15) / 60))} min · Loaded from backend history
    </div>
  </div>
)}
      {candidates.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {candidates.map((candidate) => (
            <article
              key={`${candidate.venue}-${candidate.network}`}
              style={{
                background: '#111318',
                border: '1px solid #282B32',
                borderRadius: 10,
                padding: 16,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 18,
                }}
              >
                <div>
                  <div className="eyebrow">{venueLabel(candidate.venue)}</div>
                  <div className="muted tiny">{candidate.network || 'Unknown network'}</div>
                </div>
                <span className="tag">
                  {candidate.executable ? 'EXECUTABLE' : 'REFERENCE'}
                </span>
              </div>

              <div style={{ fontSize: 28, fontWeight: 650, lineHeight: 1.2 }}>
                {candidate.markPrice == null
                  ? '—'
                  : `$${money(
                      candidate.markPrice,
                      Number(candidate.markPrice) < 1 ? 5 : 2,
                    )}`}
              </div>
              <div className="muted tiny" style={{ marginTop: 5, marginBottom: 16 }}>
                Mark price
              </div>

              <div className="data-row">
                <span>Funding rate</span>
                <strong>
                  {candidate.fundingRate == null
                    ? '—'
                    : `${money(Number(candidate.fundingRate) * 100, 4)}%`}
                </strong>
              </div>
              <div className="data-row">
                <span>Open interest</span>
                <strong>{formatNullable(candidate.openInterest)}</strong>
              </div>
              <div className="data-row">
                <span>24h volume</span>
                <strong>{formatNullable(candidate.volume24h)}</strong>
              </div>
                            <div className="data-row">
                <span>Best bid / ask</span>
                <strong>
                  {candidate.bestBid == null || candidate.bestAsk == null
                    ? '—'
                    : `$${money(Number(candidate.bestBid), 2)} / $${money(Number(candidate.bestAsk), 2)}`}
                </strong>
              </div>

              <div className="data-row">
                <span>Bid–ask spread</span>
                <strong>
                  {candidate.orderbookSpreadBps == null
                    ? '—'
                    : `${money(Number(candidate.orderbookSpreadBps), 2)} bps`}
                </strong>
              </div>

              <div className="data-row">
                <span>Top-five bid depth</span>
                <strong>
                  {candidate.bidDepthUsdTop5 == null
                    ? '—'
                    : `$${money(Number(candidate.bidDepthUsdTop5), 0)}`}
                </strong>
              </div>

              <div className="data-row">
                <span>Top-five ask depth</span>
                <strong>
                  {candidate.askDepthUsdTop5 == null
                    ? '—'
                    : `$${money(Number(candidate.askDepthUsdTop5), 0)}`}
                </strong>
              </div>

              <div className="data-row">
                <span>Order book</span>
                <strong>
                  {candidate.orderbookStatus === 'available'
                    ? 'Available'
                    : 'Unavailable'}
                </strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !loading && (
          <p className="muted small">
            {error ? 'Market data is currently unavailable.' : 'No SOL markets found.'}
          </p>
        )
      )}

      {candidates.length > 0 && (
        <section
          className="panel"
          style={{
            marginTop: 16,
            padding: 16,
            background: '#111318',
            border: '1px solid #282B32',
          }}
        >
          <div
            className="panel-heading"
            style={{ marginBottom: 14 }}
          >
            <div>
              <div className="eyebrow">PAPER FILL ESTIMATE</div>
              <h3 style={{ margin: '5px 0 0' }}>Estimate a market order</h3>
            </div>
            <span className="tag">NO ORDERS SENT</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
            }}
          >
            <div className="field-label">
              Venue
              <StyledDropdown
                label="Choose venue"
                value={fillVenue}
                onChange={setFillVenue}
                ariaLabel="Venue for fill estimate"
                options={[
                  { value: 'hyperliquid', label: 'Hyperliquid · Reference only' },
                  { value: 'dydx', label: 'dYdX · Mainnet' },
                ]}
              />
            </div>

            <div className="field-label">
              Side
              <StyledDropdown
                label="Choose side"
                value={fillSide}
                onChange={setFillSide}
                ariaLabel="Order side for fill estimate"
                options={[
                  { value: 'buy', label: 'Buy · consume asks' },
                  { value: 'sell', label: 'Sell · consume bids' },
                ]}
              />
            </div>

            <label className="field-label">
              Order size (SOL)
              <input
                type="number"
                min="0"
                step="any"
                value={fillSize}
                onChange={(event) => setFillSize(event.target.value)}
                aria-label="Order size in SOL"
                className="fill-number-input"
              />
            </label>

            <label className="field-label">
              Assumed taker fee (bps)
              <input
                type="number"
                min="0"
                step="0.1"
                value={fillFeeBps}
                onChange={(event) => setFillFeeBps(event.target.value)}
                aria-label="Assumed taker fee in basis points"
                className="fill-number-input"
              />
            </label>
          </div>

          {!fillSizeIsValid ? (
            <p className="muted small" style={{ marginTop: 14 }}>
              Enter a positive order size to estimate the visible fill.
            </p>
          ) : !fillFeeIsValid ? (
            <p className="muted small" style={{ marginTop: 14 }}>
              Enter a non-negative assumed taker fee in basis points.
            </p>
          ) : fillEstimateLoading || !fillEstimate ? (
            <p className="muted small" style={{ marginTop: 14 }}>
              Fetching a fresh order-book snapshot and calculating on the backend…
            </p>
          ) : fillEstimate?.error ? (
            <p className="muted small" style={{ marginTop: 14 }}>
              {fillEstimate.error}
            </p>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <div className="stat-card">
                  <div className="stat-label">Average fill price</div>
                  <div className="stat-value">
                    {fillEstimate.averageFillPrice == null
                      ? '—'
                      : `$${money(fillEstimate.averageFillPrice, 4)}`}
                  </div>
                  <div className="stat-detail">
                    Filled amount only
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Filled notional</div>
                  <div className="stat-value">
                    ${money(fillEstimate.filledNotional, 2)}
                  </div>
                  <div className="stat-detail">
                    Before fees
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Estimated taker fee</div>
                  <div className="stat-value">
                    ${money(fillEstimate.estimatedFee, 2)}
                  </div>
                  <div className="stat-detail">
                    {money(fillEstimate.assumedFeeBps, 2)} bps assumed
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">
                    {fillSide === 'buy' ? 'Total estimated outlay' : 'Net estimated proceeds'}
                  </div>
                  <div className="stat-value">
                    ${money(fillEstimate.totalCashflow, 2)}
                  </div>
                  <div className="stat-detail">
                    Filled amount, including assumed fee
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Slippage vs best price</div>
                  <div className="stat-value">
                    {fillEstimate.slippageBps == null
                      ? '—'
                      : `${money(fillEstimate.slippageBps, 2)} bps`}
                  </div>
                  <div className="stat-detail">
                    Visible levels only
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Visible depth</div>
                  <div className="stat-value">
                    {money(fillEstimate.visibleSize, 4)} SOL
                  </div>
                  <div className="stat-detail">
                    Top five levels
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginTop: 14,
                  padding: '10px 12px',
                  background: '#15171D',
                  borderRadius: 8,
                }}
              >
                <span className="muted small">
                  Requested {money(fillEstimate.requestedSize, 4)} SOL ·
                  Filled {money(fillEstimate.filledSize, 4)} SOL
                </span>
                <strong
                  style={{
                    fontSize: 12,
                    color: fillEstimate.fullyFilled ? '#14F195' : '#D4A54A',
                  }}
                >
                  {fillEstimate.fullyFilled
                    ? `FULLY COVERED · ${fillEstimate.levelsUsed} level${fillEstimate.levelsUsed === 1 ? '' : 's'}`
                    : `PARTIAL DEPTH · ${money(fillEstimate.unfilledSize, 4)} SOL unfilled`}
                </strong>
              </div>
            </>
          )}

          <p className="muted tiny" style={{ margin: '12px 0 0', lineHeight: 1.6 }}>
            Indicative simulation using the current top-five order-book levels. The fee rate is an editable assumption,
            not a verified venue/account rate. Latency, changing liquidity and depth beyond those levels are excluded.
            Venue values are reference-only; no order is submitted.
          </p>
        </section>
      )}

      {payload && (
        <>
          <div
            className="muted tiny"
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid #282B32',
              lineHeight: 1.7,
            }}
          >
            Reference prices only. Bid/ask, depth, fees and slippage are unverified. No orders are submitted.
          </div>

          <div className="muted tiny" style={{ marginTop: 8 }}>
            {sources.map((source) => `${venueLabel(source.venue)}: ${source.status}`).join(' · ')}
            {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}
          </div>

          {warnings.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {warnings.map((warning, index) => (
                <p className="muted tiny" key={`${warning}-${index}`}>
                  {warning}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Overview({ account, prices, onNavigate }) {
  const solChange = prices.SOL?.change24h
  const positions = account.positions || []
  const unrealized = positions.reduce((total, position) => total + positionPnl(position, prices), 0)
  const margin = availableMargin(account)

  return (
    <div className="page-stack sandbox-page">
      <section className="welcome-row">
        <div><div className="eyebrow">ARRAKIS SIMULATION ENVIRONMENT</div><h1>Overview<span className="accent-period">.</span></h1><p className="muted">The same workspace. Test assets. Risk-free sandbox settlement.</p></div>
        <button type="button" className="button button-primary trade-cta" onClick={() => onNavigate('trade')}>Open Trade <span aria-hidden="true">↗</span></button>
      </section>

      <section className="stats-grid">
        <StatCard label="TEST ACCOUNT EQUITY" value={usd(accountEquity(account, prices))} detail="Test token balances + unrealized PnL" />
        <StatCard label="AVAILABLE MARGIN" value={usd(Math.max(0, margin))} detail={`${usd(usedMargin(account))} used across open positions`} />
        <StatCard label="OPEN POSITIONS" value={String(positions.length)} detail={`${account.orders.filter((order) => order.status === 'OPEN').length} pending limit orders`} />
        <StatCard label="SOL 24H CHANGE" value={solChange == null ? '—' : `${Number(solChange) >= 0 ? '+' : ''}${money(solChange, 2)}%`} detail="Public spot reference" className={solChange == null ? '' : Number(solChange) >= 0 ? 'stat-positive' : 'stat-negative'} />
      </section>

      <section className="panel sandbox-orders-panel">
        <div className="sandbox-section-heading"><div><div className="eyebrow">AVAILABLE MARKETS</div><h2>Choose your market</h2></div><span className="sandbox-muted-pill">Live price references</span></div>
        <div className="sandbox-home-markets">
          {Object.keys(MARKET_ASSETS).map((asset) => <button type="button" className="sandbox-home-market" key={asset} onClick={() => onNavigate('trade')}><TokenIcon asset={asset} size={36} /><span className="sandbox-market-tab-copy"><strong>{asset}-PERP</strong><span>{MARKET_ASSETS[asset].name} perpetual</span></span><span className="sandbox-market-tab-price">{prices[asset]?.price ? usd(prices[asset].price) : '—'}<small className={Number(prices[asset]?.change24h) >= 0 ? 'positive' : 'negative'}>{prices[asset] ? `${Number(prices[asset].change24h) >= 0 ? '+' : ''}${money(prices[asset].change24h, 2)}%` : 'Loading'}</small></span><span className="quick-arrow" aria-hidden="true">↗</span></button>)}
        </div>
      </section>

      <section className="panel sandbox-orders-panel">
        <div className="sandbox-section-heading"><div><div className="eyebrow">ACCOUNT SNAPSHOT</div><h2>Test balances</h2></div><button type="button" className="button button-secondary" onClick={() => onNavigate('portfolio')}>Open Portfolio</button></div>
        <div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Asset</th><th>Available test balance</th><th>Reference price</th><th>Approx. value</th></tr></thead><tbody>{['USDC', 'ETH', 'SOL', 'BNB'].map((asset) => <tr key={asset}><td><span className="sandbox-asset-cell"><TokenIcon asset={asset} size={24} /><strong>{asset}</strong></span></td><td>{tokenAmount(account.balances[asset] || 0)}</td><td>{usd(prices[asset]?.price ?? (asset === 'USDC' ? 1 : 0))}</td><td>{usd(Number(account.balances[asset] || 0) * Number(prices[asset]?.price ?? (asset === 'USDC' ? 1 : 0)))}</td></tr>)}</tbody></table></div>
        {positions.length > 0 && <p className="sandbox-footnote">Unrealized position PnL: <strong className={unrealized >= 0 ? 'positive' : 'negative'}>{unrealized >= 0 ? '+' : ''}{usd(unrealized)}</strong>. Open positions are managed under Portfolio or Trade.</p>}
      </section>

      <section className="panel quick-actions">
        <div><div className="eyebrow">EXPLORE ARRAKIS</div><h2>One workspace, all the way through.</h2></div>
        <div className="quick-action-list">
          {[
            ['trade', 'Trade', 'Open and manage test perpetual positions'],
            ['swap', 'Swap', 'Convert test tokens into USDC collateral'],
            ['portfolio', 'Portfolio', 'Balances, margin, positions and history'],
            ['intelligence', 'Intelligence', 'Market reference and risk context'],
          ].map(([page, title, description]) => <button key={page} className="quick-action" type="button" onClick={() => onNavigate(page)}><span className="quick-action-copy"><strong>{title}</strong><span className="muted tiny">{description}</span></span><span className="quick-arrow" aria-hidden="true">↗</span></button>)}
        </div>
      </section>
    </div>
  )
}

const MARKET_ASSETS = {
  ETH: { symbol: 'ETH', name: 'Ethereum', pair: 'ETH/USDC', binanceSymbol: 'ETHUSDT' },
  SOL: { symbol: 'SOL', name: 'Solana', pair: 'SOL/USDC', binanceSymbol: 'SOLUSDT' },
  BNB: { symbol: 'BNB', name: 'BNB', pair: 'BNB/USDC', binanceSymbol: 'BNBUSDT' },
}

const SANDBOX_STORAGE_KEY = 'arrakis-integrated-testnet-v2' // Keep the storage key stable so existing local sandbox history is preserved.
const SANDBOX_FEE_RATE = 0.0005
const INITIAL_TEST_BALANCES = { USDC: 10000, ETH: 0.25, SOL: 5, BNB: 0.5 }
const EMPTY_ACCOUNT = () => ({
  balances: { ...INITIAL_TEST_BALANCES },
  positions: [],
  orders: [],
  fills: [],
})

function useReferencePrices() {
  const [prices, setPrices] = useState({
    USDC: { price: 1, change24h: 0, bid: 1, ask: 1 },
  })
  const [status, setStatus] = useState('Connecting to reference markets…')
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadPrices() {
      try {
        const results = await Promise.allSettled(
          Object.keys(MARKET_ASSETS).map(async (asset) => {
            const symbol = MARKET_ASSETS[asset].binanceSymbol
            const response = await fetch(`${BINANCE_SPOT}/ticker/24hr?symbol=${symbol}`)
            if (!response.ok) throw new Error(`Could not load ${symbol}`)
            const result = await response.json()
            const price = Number(result.lastPrice)
            const bid = Number(result.bidPrice)
            const ask = Number(result.askPrice)
            if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid ${symbol} price`)
            return [asset, {
              price,
              change24h: Number.isFinite(Number(result.priceChangePercent)) ? Number(result.priceChangePercent) : 0,
              bid: Number.isFinite(bid) ? bid : price,
              ask: Number.isFinite(ask) ? ask : price,
            }]
          }),
        )
        if (cancelled) return
        const entries = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
        if (!entries.length) throw new Error('No reference markets returned a valid price')
        setPrices((previous) => ({ ...previous, USDC: { price: 1, change24h: 0, bid: 1, ask: 1 }, ...Object.fromEntries(entries) }))
        setStatus(entries.length === Object.keys(MARKET_ASSETS).length ? 'Live reference prices connected' : 'Partial market data connected')
        setLastUpdated(new Date().toISOString())
      } catch (error) {
        if (!cancelled) setStatus('Reference prices unavailable · retrying')
        console.warn('ARRAKIS sandbox price refresh failed:', error)
      }
    }
    loadPrices()
    const timer = setInterval(loadPrices, 15000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  return { prices, status, lastUpdated }
}

function useSandboxAccount() {
  const [account, setAccount] = useState(() => {
    try {
      const saved = localStorage.getItem(SANDBOX_STORAGE_KEY)
      if (!saved) return EMPTY_ACCOUNT()
      const parsed = JSON.parse(saved)
      return {
        balances: { ...INITIAL_TEST_BALANCES, ...(parsed.balances || {}) },
        positions: Array.isArray(parsed.positions) ? parsed.positions : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        fills: Array.isArray(parsed.fills) ? parsed.fills : [],
      }
    } catch {
      return EMPTY_ACCOUNT()
    }
  })

  useEffect(() => {
    try { localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(account)) }
    catch (error) { console.warn('Could not persist ARRAKIS sandbox account:', error) }
  }, [account])

  return [account, setAccount]
}

const usd = (value) => `$${money(value, 2)}`
const tokenAmount = (value) => money(value, Math.abs(Number(value)) < 1 ? 6 : 4)
const nowIso = () => new Date().toISOString()
const shortTime = (value) => value ? new Date(value).toLocaleString() : '—'
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function positionPnl(position, prices) {
  const mark = Number(prices[position.asset]?.price)
  if (!Number.isFinite(mark) || mark <= 0) return 0
  const delta = position.side === 'LONG' ? mark - Number(position.entryPrice) : Number(position.entryPrice) - mark
  return delta * Number(position.quantity)
}

function usedMargin(account) {
  return account.positions.reduce((total, position) => total + Number(position.margin || 0), 0)
}

function orderReservedMargin(account) {
  return account.orders.reduce((total, order) => {
    if (order.status !== 'OPEN') return total
    return total + Number(order.reservedMargin || 0) + Number(order.reservedFee || 0)
  }, 0)
}

function accountEquity(account, prices) {
  const tokenValue = Object.entries(account.balances).reduce((total, [asset, amount]) => {
    return total + Number(amount || 0) * Number(prices[asset]?.price ?? (asset === 'USDC' ? 1 : 0))
  }, 0)
  const lockedPositionMargin = usedMargin(account)
  const lockedOrderFunds = orderReservedMargin(account)
  const unrealizedPnl = account.positions.reduce((total, position) => total + positionPnl(position, prices), 0)
  return tokenValue + lockedPositionMargin + lockedOrderFunds + unrealizedPnl
}

// This sandbox uses isolated margin: position margin and limit-order reservations
// are removed from free USDC and displayed separately as locked funds.
function availableMargin(account) {
  return Number(account.balances.USDC || 0)
}

function makePosition({ id, asset, side, quantity, entryPrice, leverage, takeProfit, stopLoss, margin, createdAt }) {
  return { id, asset, pair: `${asset}-PERP`, side, quantity, entryPrice, leverage, takeProfit: Number(takeProfit) || null, stopLoss: Number(stopLoss) || null, margin, createdAt }
}

function AccountBalanceStrip({ account, prices, onClaimFunds }) {
  return (
    <div className="sandbox-account-strip">
      <div className="sandbox-equity">
        <span className="sandbox-label">SANDBOX EQUITY · LOCAL</span>
        <strong>{usd(accountEquity(account, prices))}</strong>
      </div>
      <div className="sandbox-balance-items">
        {['USDC', 'ETH', 'SOL', 'BNB'].map((asset) => (
          <div className="sandbox-balance-item" key={asset}>
            <span className="sandbox-balance-asset"><TokenIcon asset={asset} size={22} />{asset}</span>
            <strong>{tokenAmount(account.balances[asset] || 0)}</strong>
          </div>
        ))}
      </div>
      <button type="button" className="sandbox-faucet-button" onClick={onClaimFunds}>
        + Get test funds
      </button>
    </div>
  )
}

function OrderBookPanel({ asset }) {
  const [book, setBook] = useState({ bids: [], asks: [] })
  const [status, setStatus] = useState('Loading order book…')

  useEffect(() => {
    let cancelled = false
    async function loadBook() {
      try {
        const symbol = MARKET_ASSETS[asset].binanceSymbol
        const response = await fetch(`${BINANCE_SPOT}/depth?symbol=${symbol}&limit=5`)
        if (!response.ok) throw new Error('Order book unavailable')
        const result = await response.json()
        if (cancelled) return
        setBook({ bids: result.bids || [], asks: result.asks || [] })
        setStatus('Live reference depth')
      } catch {
        if (!cancelled) setStatus('Order book unavailable')
      }
    }
    loadBook()
    const timer = setInterval(loadBook, 10000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [asset])

  const asks = [...book.asks].reverse()
  const bids = book.bids
  const bestAsk = book.asks?.[0] ? Number(book.asks[0][0]) : null
  const bestBid = book.bids?.[0] ? Number(book.bids[0][0]) : null
  const spread = bestAsk && bestBid ? ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 10000 : null

  return (
    <section className="panel sandbox-orderbook">
      <div className="sandbox-section-heading">
        <div><div className="eyebrow">MARKET DEPTH</div><h3>Order book</h3></div>
        <span className="sandbox-muted-pill">{status}</span>
      </div>
      <div className="sandbox-book-header"><span>Price (USDC)</span><span>Size</span><span>Total</span></div>
      <div className="sandbox-book-levels sandbox-asks">
        {asks.map((row, index) => <div className="sandbox-book-row" key={`a-${index}`}><span>{money(Number(row[0]), 2)}</span><span>{tokenAmount(Number(row[1]))}</span><span>{usd(Number(row[0]) * Number(row[1]))}</span></div>)}
        {!asks.length && <div className="sandbox-empty-line">No ask levels available</div>}
      </div>
      <div className="sandbox-book-mid">
        <strong>{bestAsk != null ? money(bestAsk, 2) : '—'}</strong>
        <span>Spread {spread != null ? `${money(spread, 2)} bps` : '—'}</span>
      </div>
      <div className="sandbox-book-levels sandbox-bids">
        {bids.map((row, index) => <div className="sandbox-book-row" key={`b-${index}`}><span>{money(Number(row[0]), 2)}</span><span>{tokenAmount(Number(row[1]))}</span><span>{usd(Number(row[0]) * Number(row[1]))}</span></div>)}
        {!bids.length && <div className="sandbox-empty-line">No bid levels available</div>}
      </div>
      <p className="sandbox-footnote">Real market reference only. Orders submitted here fill inside the ARRAKIS sandbox, not on Binance.</p>
    </section>
  )
}

function TradePage({ account, setAccount, prices, priceStatus }) {
  const [asset, setAsset] = useState('SOL')
  const [side, setSide] = useState('LONG')
  const [orderType, setOrderType] = useState('MARKET')
  const [size, setSize] = useState('1')
  const [leverage, setLeverage] = useState('3')
  const [limitPrice, setLimitPrice] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [notice, setNotice] = useState(null)
  const market = prices[asset]
  const price = Number(market?.price)
  const quantity = Number(size)
  const selectedLeverage = Number(leverage)
  const plannedEntry = orderType === 'LIMIT' ? Number(limitPrice) : price
  const validationEntry = orderType === 'LIMIT' && ((side === 'LONG' && plannedEntry >= price) || (side === 'SHORT' && plannedEntry <= price)) ? price : plannedEntry
  const notional = quantity * validationEntry
  const margin = selectedLeverage > 0 ? notional / selectedLeverage : Infinity
  const fee = notional * SANDBOX_FEE_RATE
  const marginAvailable = availableMargin(account)

  useEffect(() => {
    if (market?.price && (!limitPrice || Number(limitPrice) <= 0)) setLimitPrice(String(market.price))
  }, [asset, market?.price, limitPrice])

  useEffect(() => {
    if (!market?.price) return
    const mark = Number(market.price)
    setTakeProfit((current) => current || String(side === 'LONG' ? mark * 1.03 : mark * 0.97))
    setStopLoss((current) => current || String(side === 'LONG' ? mark * 0.98 : mark * 1.02))
  }, [asset, market?.price, side])

  const numericTP = Number(takeProfit)
  const numericSL = Number(stopLoss)
  const levelsValid = side === 'LONG'
    ? numericTP > validationEntry && numericSL < validationEntry
    : numericTP < validationEntry && numericSL > validationEntry
  const validationMessage = !Number.isFinite(quantity) || quantity <= 0
    ? 'Enter a position size greater than zero.'
    : !Number.isFinite(price) || price <= 0
      ? 'Wait for a reference price before trading.'
      : !Number.isFinite(selectedLeverage) || selectedLeverage < 1 || selectedLeverage > 10
        ? 'Choose leverage from 1x to 10x.'
        : orderType === 'LIMIT' && (!Number.isFinite(Number(limitPrice)) || Number(limitPrice) <= 0)
          ? 'Enter a valid limit price.'
          : !levelsValid || !Number.isFinite(numericTP) || !Number.isFinite(numericSL) || numericTP <= 0 || numericSL <= 0
            ? side === 'LONG' ? 'For a long, take-profit must be above entry and stop-loss below entry.' : 'For a short, take-profit must be below entry and stop-loss above entry.'
            : margin + fee > marginAvailable
              ? `Not enough available test USDC margin. Available: ${usd(Math.max(0, marginAvailable))}.`
              : ''

  function recordOpenPosition({ entryPrice, isLimit = false, orderId = null }) {
    const positionId = newId()
    const notionalValue = quantity * entryPrice
    const requiredMargin = notionalValue / selectedLeverage
    const openFee = notionalValue * SANDBOX_FEE_RATE
    const createdAt = nowIso()
    const position = makePosition({ id: positionId, asset, side, quantity, entryPrice, leverage: selectedLeverage, takeProfit: numericTP, stopLoss: numericSL, margin: requiredMargin, createdAt })
    setAccount((previous) => ({
      ...previous,
      balances: { ...previous.balances, USDC: Number(previous.balances.USDC || 0) - requiredMargin - openFee },
      positions: [position, ...previous.positions],
      orders: orderId ? previous.orders.map((order) => order.id === orderId ? { ...order, status: 'FILLED', filledAt: createdAt, filledPrice: entryPrice } : order) : previous.orders,
      fills: [{ id: newId(), asset, pair: `${asset}-PERP`, side: `OPEN ${side}`, type: isLimit ? 'LIMIT' : 'MARKET', quantity, price: entryPrice, notional: notionalValue, fee: openFee, createdAt, status: 'FILLED', leverage: selectedLeverage }, ...previous.fills].slice(0, 200),
    }))
    setNotice({ kind: 'success', text: `${side} ${tokenAmount(quantity)} ${asset}-PERP opened at ${usd(entryPrice)} · ${selectedLeverage}x · margin ${usd(requiredMargin)} · fee ${usd(openFee)}.` })
  }

  function submitOrder(event) {
    event.preventDefault()
    if (validationMessage) { setNotice({ kind: 'error', text: validationMessage }); return }
    const planned = orderType === 'MARKET' ? price : Number(limitPrice)
    const isPassiveLimit = orderType === 'LIMIT' && ((side === 'LONG' && planned < price) || (side === 'SHORT' && planned > price))
    if (isPassiveLimit) {
      const requiredMargin = quantity * planned / selectedLeverage
      const requiredFee = quantity * planned * SANDBOX_FEE_RATE
      const id = newId()
      setAccount((previous) => ({
        ...previous,
        balances: { ...previous.balances, USDC: Number(previous.balances.USDC || 0) - requiredMargin - requiredFee },
        orders: [{ id, asset, side, type: 'LIMIT', quantity, leverage: selectedLeverage, limitPrice: planned, takeProfit: numericTP, stopLoss: numericSL, reservedMargin: requiredMargin, reservedFee: requiredFee, createdAt: nowIso(), status: 'OPEN' }, ...previous.orders],
      }))
      setNotice({ kind: 'success', text: `${side} limit order placed. ${usd(requiredMargin)} margin is reserved until it fills or is cancelled.` })
      return
    }
    recordOpenPosition({ entryPrice: price, isLimit: orderType === 'LIMIT' })
  }

  function closePosition(position, reason = 'MANUAL CLOSE') {
    const mark = Number(prices[position.asset]?.price)
    if (!Number.isFinite(mark) || mark <= 0) { setNotice({ kind: 'error', text: 'Cannot close while this market price is unavailable.' }); return }
    const pnl = position.side === 'LONG' ? (mark - position.entryPrice) * position.quantity : (position.entryPrice - mark) * position.quantity
    const closeFee = mark * position.quantity * SANDBOX_FEE_RATE
    const realizedPnl = Math.max(-Number(position.margin || 0), pnl)
    setAccount((previous) => {
      if (!previous.positions.some((item) => item.id === position.id)) return previous
      return {
        ...previous,
        balances: { ...previous.balances, USDC: Math.max(0, Number(previous.balances.USDC || 0) + Number(position.margin || 0) + realizedPnl - closeFee) },
        positions: previous.positions.filter((item) => item.id !== position.id),
        fills: [{ id: newId(), asset: position.asset, pair: `${position.asset}-PERP`, side: reason, type: 'CLOSE', quantity: position.quantity, price: mark, notional: mark * position.quantity, fee: closeFee, pnl: realizedPnl, createdAt: nowIso(), status: 'CLOSED', leverage: position.leverage }, ...previous.fills].slice(0, 200),
      }
    })
    setNotice({ kind: 'success', text: `${position.asset}-PERP closed. Realized PnL: ${realizedPnl >= 0 ? '+' : ''}${usd(realizedPnl)} before ${usd(closeFee)} closing fee.` })
  }

  function cancelOrder(order) {
    setAccount((previous) => {
      const target = previous.orders.find((item) => item.id === order.id)
      if (!target || target.status !== 'OPEN') return previous
      const refund = Number(target.reservedMargin || 0) + Number(target.reservedFee || 0)
      return {
        ...previous,
        balances: { ...previous.balances, USDC: Number(previous.balances.USDC || 0) + refund },
        orders: previous.orders.map((item) => item.id === target.id ? { ...item, status: 'CANCELLED', cancelledAt: nowIso() } : item),
      }
    })
    setNotice({ kind: 'success', text: `Order ${order.id.slice(-6)} cancelled. Reserved margin released.` })
  }

  const openOrders = account.orders.filter((order) => order.status === 'OPEN')
  const positions = account.positions
  const recentFills = account.fills.slice(0, 5)
  const markToMarket = (position) => positionPnl(position, prices)

  return (
    <div className="page-stack sandbox-page">
      <section className="welcome-row"><div><div className="eyebrow">ARRAKIS SIMULATED EXCHANGE</div><h1>Trade<span className="accent-period">.</span></h1><p className="muted">Trade ETH, SOL and BNB perpetuals with test balances and live public reference prices.</p></div><div className="sandbox-status"><span className="sandbox-status-dot" /> ARRAKIS SANDBOX <span className="sandbox-muted-pill">{priceStatus}</span></div></section>

      <>
      <div className="sandbox-market-tabs" aria-label="Choose perpetual market">
        {Object.keys(MARKET_ASSETS).map((symbol) => <button key={symbol} type="button" className={asset === symbol ? 'sandbox-market-tab active' : 'sandbox-market-tab'} onClick={() => { setAsset(symbol); setNotice(null); setLimitPrice(String(prices[symbol]?.price || '')); setTakeProfit(''); setStopLoss(''); }}><TokenIcon asset={symbol} size={36} /><span className="sandbox-market-tab-copy"><strong>{symbol}-PERP</strong><span>{MARKET_ASSETS[symbol].name} perpetual</span></span><span className="sandbox-market-tab-price">{prices[symbol]?.price ? usd(prices[symbol].price) : '—'}<small className={Number(prices[symbol]?.change24h) >= 0 ? 'positive' : 'negative'}>{prices[symbol] ? `${Number(prices[symbol].change24h) >= 0 ? '+' : ''}${money(prices[symbol].change24h, 2)}%` : 'Loading'}</small></span></button>)}
      </div>

      <div className="sandbox-terminal-grid">
        <div className="sandbox-terminal-main">
          <section className="panel sandbox-chart-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">PERPETUAL REFERENCE</div><h2>{MARKET_ASSETS[asset].name} / USDC</h2></div><div className="sandbox-market-head-price"><strong>{prices[asset]?.price ? usd(prices[asset].price) : '—'}</strong><span className={Number(prices[asset]?.change24h) >= 0 ? 'positive' : 'negative'}>{prices[asset] ? `${Number(prices[asset].change24h) >= 0 ? '+' : ''}${money(prices[asset].change24h, 2)}% 24h` : priceStatus}</span></div></div><SolChart asset={asset} /></section>
          <OrderBookPanel asset={asset} />
        </div>

        <aside className="panel sandbox-order-ticket">
          <div className="sandbox-section-heading"><div><div className="eyebrow">ORDER TICKET</div><h2>Open a position</h2></div><span className="sandbox-muted-pill">Test USDC</span></div>
          <div className="sandbox-side-switch"><button type="button" className={side === 'LONG' ? 'buy active' : 'buy'} onClick={() => { setSide('LONG'); setNotice(null); setTakeProfit(price ? String(price * 1.03) : ''); setStopLoss(price ? String(price * 0.98) : ''); }}>Long</button><button type="button" className={side === 'SHORT' ? 'sell active' : 'sell'} onClick={() => { setSide('SHORT'); setNotice(null); setTakeProfit(price ? String(price * 0.97) : ''); setStopLoss(price ? String(price * 1.02) : ''); }}>Short</button></div>
          <div className="sandbox-order-types"><button type="button" className={orderType === 'MARKET' ? 'active' : ''} onClick={() => { setOrderType('MARKET'); setNotice(null); }}>Market</button><button type="button" className={orderType === 'LIMIT' ? 'active' : ''} onClick={() => { setOrderType('LIMIT'); setLimitPrice(String(price || '')); setNotice(null); }}>Limit</button></div>
          <form onSubmit={submitOrder} className="sandbox-order-form">
            <label className="field-label">Position size ({asset})<input type="number" min="0.000001" step="any" value={size} onChange={(event) => setSize(event.target.value)} /></label>
            {orderType === 'LIMIT' && <label className="field-label">Limit price (USDC)<input type="number" min="0.000001" step="any" value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} /></label>}
            <label className="field-label">Leverage<select value={leverage} onChange={(event) => setLeverage(event.target.value)}>{['1', '2', '3', '5', '10'].map((value) => <option key={value} value={value}>{value}x</option>)}</select></label>
            <div className="sandbox-size-chips">{(asset === 'ETH' ? ['0.01', '0.1', '0.5', '1'] : asset === 'SOL' ? ['0.1', '1', '5', '10'] : ['0.1', '1', '5', '10']).map((amount) => <button key={amount} type="button" onClick={() => setSize(amount)}>{amount}</button>)}</div>
            <label className="field-label">Take-profit (USDC)<input type="number" min="0.000001" step="any" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} /></label>
            <label className="field-label">Stop-loss (USDC)<input type="number" min="0.000001" step="any" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} /></label>
            <div className="sandbox-estimate-lines"><div><span>Available margin</span><strong>{usd(Math.max(0, marginAvailable))}</strong></div><div><span>Reference price</span><strong>{price > 0 ? usd(price) : '—'}</strong></div><div><span>Position notional</span><strong>{Number.isFinite(notional) && notional > 0 ? usd(notional) : '—'}</strong></div><div><span>Initial margin</span><strong>{Number.isFinite(margin) && margin > 0 ? usd(margin) : '—'} · {leverage}x</strong></div><div><span>Open fee (0.05%)</span><strong>{Number.isFinite(fee) && fee > 0 ? usd(fee) : '—'}</strong></div></div>
            {validationMessage && <p className="sandbox-validation">{validationMessage}</p>}
            <button type="submit" className={`button button-full sandbox-submit ${side === 'LONG' ? 'buy' : 'sell'}`} disabled={!market?.price}>{orderType === 'LIMIT' ? 'Place limit' : 'Open'} {side === 'LONG' ? 'Long' : 'Short'} {asset}</button>
            {notice && <p role="status" className={`sandbox-notice ${notice.kind}`}>{notice.text}</p>}
          </form>
          <div className="sandbox-risk-note"><strong>Sandbox settlement</strong><p>Test orders open simulated perpetual positions using your test USDC. TP/SL is monitored against reference prices. No real assets or blockchain transactions are involved.</p></div>
        </aside>
      </div>

      <section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">POSITION MANAGEMENT</div><h2>Open positions <span className="sandbox-count">{positions.length}</span></h2></div></div>
        {positions.length ? <div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Market</th><th>Side</th><th>Size</th><th>Entry</th><th>Mark</th><th>Leverage</th><th>Margin</th><th>Unrealized PnL</th><th>TP / SL</th><th /></tr></thead><tbody>{positions.map((position) => { const mark = Number(prices[position.asset]?.price || position.entryPrice); const pnl = markToMarket(position); return <tr key={position.id}><td><span className="sandbox-asset-cell"><TokenIcon asset={position.asset} size={22} />{position.asset}-PERP</span></td><td className={position.side === 'LONG' ? 'positive' : 'negative'}>{position.side}</td><td>{tokenAmount(position.quantity)} {position.asset}</td><td>{usd(position.entryPrice)}</td><td>{usd(mark)}</td><td>{position.leverage}x</td><td>{usd(position.margin)}</td><td className={pnl >= 0 ? 'positive' : 'negative'}>{pnl >= 0 ? '+' : ''}{usd(pnl)}</td><td>{position.takeProfit ? usd(position.takeProfit) : '—'} / {position.stopLoss ? usd(position.stopLoss) : '—'}</td><td><button type="button" className="sandbox-cancel-button" onClick={() => closePosition(position)}>Close</button></td></tr>})}</tbody></table></div> : <div className="sandbox-empty-state"><strong>No open positions</strong><p>Choose ETH, SOL or BNB above and open a test long or short. Positions and PnL will appear here.</p></div>}
      </section>

      <section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">ORDER MANAGEMENT</div><h2>Open orders <span className="sandbox-count">{openOrders.length}</span></h2></div></div>{openOrders.length ? <div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Market</th><th>Direction</th><th>Size</th><th>Limit</th><th>Leverage</th><th>Reserved margin</th><th /></tr></thead><tbody>{openOrders.map((order) => <tr key={order.id}><td><span className="sandbox-asset-cell"><TokenIcon asset={order.asset} size={22} />{order.asset}-PERP</span></td><td>{order.side}</td><td>{tokenAmount(order.quantity)} {order.asset}</td><td>{usd(order.limitPrice)}</td><td>{order.leverage}x</td><td>{usd(Number(order.reservedMargin || 0) + Number(order.reservedFee || 0))}</td><td><button type="button" className="sandbox-cancel-button" onClick={() => cancelOrder(order)}>Cancel</button></td></tr>)}</tbody></table></div> : <div className="sandbox-empty-state"><strong>No open orders</strong><p>Non-marketable limit orders will stay here until the reference price reaches your limit or you cancel.</p></div>}</section>

      <section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Trade history</h2></div><span className="sandbox-muted-pill">Stored in this browser</span></div>{recentFills.length ? <div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Time</th><th>Market</th><th>Event</th><th>Amount</th><th>Price</th><th>Fee</th><th>Realized PnL</th></tr></thead><tbody>{recentFills.map((fill) => <tr key={fill.id}><td>{shortTime(fill.createdAt)}</td><td>{fill.pair || `${fill.asset || 'TEST'}-PERP`}</td><td>{fill.side || fill.event || '—'}</td><td>{fill.quantity ? `${tokenAmount(fill.quantity)} ${fill.asset}` : '—'}</td><td>{fill.price ? usd(fill.price) : '—'}</td><td>{fill.fee != null ? usd(fill.fee) : '—'}</td><td className={Number(fill.pnl || 0) >= 0 ? 'positive' : 'negative'}>{fill.pnl != null ? `${Number(fill.pnl) >= 0 ? '+' : ''}${usd(fill.pnl)}` : '—'}</td></tr>)}</tbody></table></div> : <div className="sandbox-empty-state"><strong>No trades yet</strong><p>Position opens, closes and test-fund claims will be recorded here.</p></div>}</section>
      </>
    </div>
  )
}


function AssistantConsole({ account, prices, priceStatus, data }) {
  const quickPrompts = [
    'Analyze current SOL market context and identify risks before a simulated trade.',
    'Assess the risk of a hypothetical 10 SOL long and explain what data is missing.',
    'Review my current sandbox positions, available margin and portfolio exposure.',
    'Summarize recent sandbox activity and explain what the results can and cannot tell me.',
  ]
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [statusChecked, setStatusChecked] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'I’m ARRAKIS Analyst. Ask me to analyze market context, assess a hypothetical trade, inspect risk flags, or review your sandbox activity. I use read-only analysis tools and explain the evidence. I never place trades.',
    },
  ])
  const transcriptRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function checkAssistant() {
      try {
        const response = await apiFetch(`${API_BASE}/api/assistant/status`)
        const payload = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) setStatus(payload)
      } catch {
        // The chat request itself will give a clearer connection error if the backend is offline.
      } finally {
        if (!cancelled) setStatusChecked(true)
      }
    }
    checkAssistant()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const node = transcriptRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, busy])

  function getAnswer(payload) {
    if (typeof payload === 'string') return payload
    const candidates = [payload?.answer, payload?.response, payload?.text, payload?.outputText, payload?.result?.answer, payload?.result?.text, payload?.data?.answer]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate
      if (candidate && typeof candidate === 'object') {
        const nested = candidate.text || candidate.content || candidate.message
        if (typeof nested === 'string' && nested.trim()) return nested
      }
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message
    return ''
  }

  async function sendMessage(value) {
    const text = String(value || input).trim()
    if (!text || busy) return
    setInput('')
    setError('')
    setMessages((previous) => [...previous, { role: 'user', content: text }])
    setBusy(true)
    const safeAccount = {
      balances: account.balances,
      openPositions: (account.positions || []).map((position) => ({
        asset: position.asset, side: position.side, quantity: position.quantity,
        entryPrice: position.entryPrice, leverage: position.leverage,
        margin: position.margin, takeProfit: position.takeProfit, stopLoss: position.stopLoss,
      })),
      pendingOrders: (account.orders || []).filter((order) => order.status === 'OPEN').map((order) => ({
        asset: order.asset, side: order.side, quantity: order.quantity,
        limitPrice: order.limitPrice, leverage: order.leverage,
      })),
      recentActivity: (account.fills || []).slice(0, 8).map((fill) => ({
        pair: fill.pair, side: fill.side || fill.event, quantity: fill.quantity,
        price: fill.price, pnl: fill.pnl, createdAt: fill.createdAt,
      })),
    }
    const conversationHistory = messages.slice(-8)
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
      .map((message) => ({ role: message.role, content: String(message.content || '').slice(0, 3000) }))
    const context = {
      mode: 'ARRAKIS sandbox is the only trading mode in this release. Orders, positions, swaps and test balances are simulated locally. Market prices are public reference data. The assistant is read-only and must not place orders.',
      priceStatus,
      marketReferences: Object.fromEntries(['ETH', 'SOL', 'BNB'].map((asset) => [asset, prices[asset] || null])),
      adapterMetrics: {
        marketPrice: data?.marketPrice ?? null,
        marketStatus: data?.marketStatus ?? 'unknown',
        fundingRate: data?.fundingRate ?? null,
        openInterest: data?.openInterest ?? null,
      },
      account: safeAccount,
    }
    try {
      const response = await apiFetch(`${API_BASE}/api/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          question: text,
          prompt: text,
          messages: conversationHistory,
          conversation: conversationHistory,
          history: conversationHistory,
          context,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = payload.error || payload.message || payload.details || `Assistant API returned HTTP ${response.status}.`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      const answer = getAnswer(payload)
      if (!answer) throw new Error('The assistant endpoint responded, but no answer text was found in its response. Check the /api/assistant response shape.')
      setMessages((previous) => [...previous, {
        role: 'assistant', content: answer,
        toolsUsed: Array.isArray(payload.toolsUsed) ? payload.toolsUsed : (Array.isArray(payload.toolCalls) ? payload.toolCalls : []),
        provider: payload.provider, model: payload.model,
        decisionReadiness: payload.decisionReadiness,
      }])
      if (payload.provider || payload.model || payload.configured != null) {
        setStatus((previous) => ({ ...(previous || {}), ...payload }))
      }
    } catch (requestError) {
      const reason = requestError instanceof Error ? requestError.message : 'Unknown assistant error.'
      setError(reason)
      setMessages((previous) => [...previous, {
        role: 'assistant',
        content: `I couldn’t complete that request. ${reason}\n\nCheck that the ARRAKIS backend is running and that its AI provider is configured in server/.env. The API key must stay on the backend, never in frontend files.`,
        isError: true,
      }])
    } finally {
      setBusy(false)
    }
  }

  const setupRequired = status?.configured === false || status?.ready === false
  const statusLabel = setupRequired ? 'SETUP REQUIRED' : (status?.configured || status?.ready ? 'AI CONNECTED' : (statusChecked ? 'BACKEND CHECK' : 'CONNECTING'))

  return (
    <section className="panel arrakis-ai-console">
      <div className="sandbox-section-heading">
        <div><div className="eyebrow">ANALYST CONSOLE</div><h2>Ask ARRAKIS<span className="accent-period">.</span></h2></div>
        <span className={`ai-status-pill ${setupRequired ? 'needs-setup' : ((status?.configured || status?.ready) ? 'connected' : '')}`}>{statusLabel}</span>
      </div>
      {setupRequired && <div className="ai-setup-notice"><strong>Connect the language model</strong><p>Configure your provider in <code>server/.env</code> and restart the backend. Keep the API key on the server; never put it in frontend files or Vite environment variables. Without a key, the rest of ARRAKIS can continue to work.</p></div>}
      <div className="ai-intro-card"><div className="eyebrow">ARRAKIS ANALYST</div><p>I can help compare venue data, assess a hypothetical trade, examine risk flags and summarize saved analysis. I use ARRAKIS’s analysis tools where available and explain the evidence. I cannot execute or approve trades.</p></div>
      <div className="ai-quick-prompts" aria-label="Example analyst questions">
        {quickPrompts.map((prompt) => <button type="button" key={prompt} disabled={busy} onClick={() => sendMessage(prompt)}>{prompt}</button>)}
      </div>
      <div className="ai-transcript" ref={transcriptRef} aria-live="polite">
        {messages.map((message, index) => <article key={`${message.role}-${index}`} className={`ai-message ${message.role === 'user' ? 'user-message' : 'assistant-message'} ${message.isError ? 'error-message' : ''}`}>
          <div className="ai-message-label">{message.role === 'user' ? 'YOU' : 'ARRAKIS ANALYST'}</div>
          <div className="ai-message-content">{message.content}</div>
          {!!message.toolsUsed?.length && <div className="ai-tools-used"><span>Analysis tools</span>{message.toolsUsed.map((tool, toolIndex) => <code key={`${tool}-${toolIndex}`}>{typeof tool === 'string' ? tool : (tool.name || tool.toolName || 'analysis tool')}</code>)}</div>}
          {(message.provider || message.model) && <div className="ai-model-meta">{[message.provider, message.model].filter(Boolean).join(' · ')}</div>}
        </article>)}
        {busy && <article className="ai-message assistant-message"><div className="ai-message-label">ARRAKIS ANALYST</div><div className="ai-pending-dots">Analyzing current context and available evidence…</div></article>}
      </div>
      {error && <p className="ai-inline-error" role="status">Last request failed: {error}</p>}
      <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(input) }}>
        <label htmlFor="arrakis-ai-question">Message</label>
        <textarea id="arrakis-ai-question" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about venue comparisons, risk flags, liquidity or historical replay…" rows={3} disabled={busy} />
        <div className="ai-composer-footer"><span>Read-only analysis · No trade execution</span><button type="submit" className="button button-primary" disabled={busy || !input.trim()}>{busy ? 'Analyzing…' : 'Ask Analyst ↗'}</button></div>
      </form>
      <p className="sandbox-footnote">Analysis uses the configured ARRAKIS backend and its available read-only tools. Sandbox balances and simulated trades are supplied as context only; the assistant cannot sign transactions or execute orders.</p>
    </section>
  )
}

function FoundationPage({ page, data, account, setAccount, prices, onNavigate }) {
  const [swapFrom, setSwapFrom] = useState('USDC')
  const [swapTo, setSwapTo] = useState('SOL')
  const [swapAmount, setSwapAmount] = useState('100')
  const [swapNotice, setSwapNotice] = useState(null)
  const configs = {
    overview: { eyebrow: 'YOUR WORKSPACE', title: 'Overview', description: 'Your simulated exchange workspace for checking markets, trading test assets and tracking your account.' },
    swap: { eyebrow: 'ASSET CONVERSION', title: 'Swap', description: 'Convert between test assets using live market references and sandbox settlement.' },
    portfolio: { eyebrow: 'YOUR EXPOSURE', title: 'Portfolio', description: 'Your balances, pending orders and completed activity in one account.' },
    intelligence: { eyebrow: 'MARKET CONTEXT', title: 'Intelligence', description: 'Reference metrics from connected ARRAKIS market adapters.' },
  }
  const config = configs[page] || configs.overview
  const equity = accountEquity(account, prices)
  const assets = ['USDC', 'ETH', 'SOL', 'BNB']
  const pending = account.orders.filter((order) => order.status === 'OPEN')

  function executeSwap(event) {
    event.preventDefault()
    const amount = Number(swapAmount)
    const fromPrice = Number(prices[swapFrom]?.price ?? (swapFrom === 'USDC' ? 1 : 0))
    const toPrice = Number(prices[swapTo]?.price ?? (swapTo === 'USDC' ? 1 : 0))
    if (swapFrom === swapTo) { setSwapNotice({ kind: 'error', text: 'Choose two different assets.' }); return }
    if (!Number.isFinite(amount) || amount <= 0) { setSwapNotice({ kind: 'error', text: 'Enter an amount greater than zero.' }); return }
    if (!fromPrice || !toPrice) { setSwapNotice({ kind: 'error', text: 'Reference price unavailable. Try again shortly.' }); return }
    if (amount > Number(account.balances[swapFrom] || 0)) { setSwapNotice({ kind: 'error', text: `Insufficient ${swapFrom} test balance.` }); return }
    if (swapFrom === 'USDC' && amount > availableMargin(account)) { setSwapNotice({ kind: 'error', text: `That would use collateral reserved for open positions or limit orders. Available margin: ${usd(Math.max(0, availableMargin(account)))}.` }); return }
    const grossValue = amount * fromPrice
    const fee = grossValue * SANDBOX_FEE_RATE
    const received = (grossValue - fee) / toPrice
    const id = newId()
    setAccount((previous) => ({
      ...previous,
      balances: { ...previous.balances, [swapFrom]: Number(previous.balances[swapFrom] || 0) - amount, [swapTo]: Number(previous.balances[swapTo] || 0) + received },
      fills: [{ id, asset: swapFrom, pair: `${swapFrom}/${swapTo}`, side: 'SWAP', type: 'SWAP', quantity: amount, price: fromPrice, notional: grossValue, fee, createdAt: nowIso(), status: 'FILLED', received, receiveAsset: swapTo }, ...previous.fills].slice(0, 200),
    }))
    setSwapNotice({ kind: 'success', text: `Swapped ${tokenAmount(amount)} ${swapFrom} for approximately ${tokenAmount(received)} ${swapTo}. Fee: ${usd(fee)}.` })
  }

  if (page === 'swap') {
    const fromPrice = Number(prices[swapFrom]?.price ?? (swapFrom === 'USDC' ? 1 : 0))
    const toPrice = Number(prices[swapTo]?.price ?? (swapTo === 'USDC' ? 1 : 0))
    const amount = Number(swapAmount)
    const quote = amount > 0 && fromPrice > 0 && toPrice > 0 ? (amount * fromPrice * (1 - SANDBOX_FEE_RATE)) / toPrice : 0
    return <div className="page-stack sandbox-page"><section className="welcome-row"><div><div className="eyebrow">{config.eyebrow}</div><h1>Swap<span className="accent-period">.</span></h1><p className="muted">{config.description}</p></div><span className="tag">SIMULATED ACCOUNT</span></section><div className="sandbox-swap-layout"><section className="panel sandbox-swap-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">CONVERSION</div><h2>Swap test assets</h2></div></div><form onSubmit={executeSwap} className="sandbox-order-form"><label className="field-label">You pay<select value={swapFrom} onChange={(event) => { setSwapFrom(event.target.value); setSwapNotice(null); }}>{assets.map((asset) => <option value={asset} key={asset}>{asset}</option>)}</select></label><label className="field-label">Amount<input type="number" min="0.000001" step="any" value={swapAmount} onChange={(event) => setSwapAmount(event.target.value)} /></label><button type="button" className="sandbox-reverse-button" onClick={() => { setSwapFrom(swapTo); setSwapTo(swapFrom); setSwapNotice(null); }}>↓ Swap direction</button><label className="field-label">You receive<select value={swapTo} onChange={(event) => { setSwapTo(event.target.value); setSwapNotice(null); }}>{assets.map((asset) => <option value={asset} key={asset}>{asset}</option>)}</select></label><div className="sandbox-swap-quote"><div><span>Estimated receive</span><strong>{quote > 0 ? `${tokenAmount(quote)} ${swapTo}` : '—'}</strong></div><div><span>Fee</span><strong>{amount > 0 && fromPrice > 0 ? usd(amount * fromPrice * SANDBOX_FEE_RATE) : '—'}</strong></div><div><span>Rate</span><strong>{fromPrice && toPrice ? `1 ${swapFrom} ≈ ${tokenAmount(fromPrice / toPrice)} ${swapTo}` : '—'}</strong></div><div><span>Settlement</span><strong>ARRAKIS sandbox</strong></div></div><button className="button button-primary button-full sandbox-submit" type="submit">Confirm test swap</button>{swapNotice && <p role="status" className={`sandbox-notice ${swapNotice.kind}`}>{swapNotice.text}</p>}</form><p className="sandbox-footnote">Swaps update only the local test account. Prices use public market references; no wallet signature or blockchain transaction occurs.</p></section><section className="panel sandbox-swap-panel"><div className="eyebrow">ACCOUNT</div><h2>Your test balances</h2>{assets.map((asset) => <div className="sandbox-balance-row" key={asset}><span className="sandbox-balance-asset"><TokenIcon asset={asset} size={24} />{asset}</span><strong>{tokenAmount(account.balances[asset] || 0)}</strong><span>{usd((account.balances[asset] || 0) * (prices[asset]?.price ?? (asset === 'USDC' ? 1 : 0)))}</span></div>)}</section></div></div>
  }

  if (page === 'portfolio') {
    return <div className="page-stack sandbox-page"><section className="welcome-row"><div><div className="eyebrow">{config.eyebrow}</div><h1>Portfolio<span className="accent-period">.</span></h1><p className="muted">{config.description}</p></div><span className="tag">SANDBOX ACCOUNT</span></section><div className="sandbox-portfolio-summary"><article className="panel"><span className="sandbox-label">TOTAL TEST EQUITY</span><strong>{usd(equity)}</strong><span className="sandbox-footnote">Marked using current reference prices</span></article><article className="panel"><span className="sandbox-label">OPEN ORDERS</span><strong>{pending.length}</strong><span className="sandbox-footnote">Reserved balances are excluded from available balances</span></article><article className="panel"><span className="sandbox-label">COMPLETED EVENTS</span><strong>{account.fills.length}</strong><span className="sandbox-footnote">Stored locally in this browser</span></article></div><section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">PERPETUAL EXPOSURE</div><h2>Open positions</h2></div><button type="button" className="button button-secondary" onClick={() => onNavigate('trade')}>Manage trades</button></div>{account.positions.length ? <div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Market</th><th>Direction</th><th>Size</th><th>Entry</th><th>Mark</th><th>Margin</th><th>uPnL</th></tr></thead><tbody>{account.positions.map((position) => { const mark = Number(prices[position.asset]?.price || position.entryPrice); const pnl = positionPnl(position, prices); return <tr key={position.id}><td><span className="sandbox-asset-cell"><TokenIcon asset={position.asset} size={22} />{position.asset}-PERP</span></td><td className={position.side === 'LONG' ? 'positive' : 'negative'}>{position.side}</td><td>{tokenAmount(position.quantity)} {position.asset}</td><td>{usd(position.entryPrice)}</td><td>{usd(mark)}</td><td>{usd(position.margin)}</td><td className={pnl >= 0 ? 'positive' : 'negative'}>{pnl >= 0 ? '+' : ''}{usd(pnl)}</td></tr>})}</tbody></table></div> : <div className="sandbox-empty-state">No open positions in this test account.</div>}</section><section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">ASSET BREAKDOWN</div><h2>Balances</h2></div></div><div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Asset</th><th>Available balance</th><th>Reference price</th><th>Value (USDC)</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset}><td><span className="sandbox-asset-cell"><TokenIcon asset={asset} size={24} /><strong>{asset}</strong></span></td><td>{tokenAmount(account.balances[asset] || 0)}</td><td>{usd(prices[asset]?.price ?? (asset === 'USDC' ? 1 : 0))}</td><td>{usd((account.balances[asset] || 0) * (prices[asset]?.price ?? (asset === 'USDC' ? 1 : 0)))}</td></tr>)}</tbody></table></div></section><section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">PENDING</div><h2>Open orders</h2></div><button type="button" className="button button-secondary" onClick={() => onNavigate('trade')}>Go to Trade</button></div>{pending.length ? <div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Market</th><th>Side</th><th>Amount</th><th>Limit</th><th>Status</th></tr></thead><tbody>{pending.map((order) => <tr key={order.id}><td><span className="sandbox-asset-cell"><TokenIcon asset={order.asset} size={22} />{order.asset}-PERP</span></td><td>{order.side}</td><td>{tokenAmount(order.quantity)} {order.asset}</td><td>{usd(order.limitPrice)}</td><td><span className="sandbox-filled-tag">{order.status}</span></td></tr>)}</tbody></table></div> : <div className="sandbox-empty-state">No open orders. Place a limit order from the Trade workspace.</div>}</section><section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">HISTORY</div><h2>Latest activity</h2></div></div>{account.fills.length ? <div className="sandbox-table-wrap"><table className="sandbox-table"><thead><tr><th>Time</th><th>Event</th><th>Quantity</th><th>Price</th><th>Fee</th></tr></thead><tbody>{account.fills.slice(0, 20).map((fill) => <tr key={fill.id}><td>{shortTime(fill.createdAt)}</td><td>{fill.side || fill.event} · {fill.pair || fill.asset}</td><td>{fill.quantity ? `${tokenAmount(fill.quantity)} ${fill.asset}` : '—'}</td><td>{fill.price ? usd(fill.price) : '—'}</td><td>{fill.fee != null ? usd(fill.fee) : '—'}</td></tr>)}</tbody></table></div> : <div className="sandbox-empty-state">No completed activity yet.</div>}</section></div>
  }

  if (page === 'intelligence') {
    return <div className="page-stack sandbox-page"><section className="welcome-row"><div><div className="eyebrow">{config.eyebrow}</div><h1>Intelligence<span className="accent-period">.</span></h1><p className="muted">AI-assisted DeFi analysis, execution-risk review and current market context.</p></div><span className="tag">AI ANALYST + MARKET DATA</span></section><AssistantConsole account={account} prices={prices} priceStatus={data.marketStatus} data={data} /><section className="sandbox-portfolio-summary">{assets.slice(1).map((asset) => <article className="panel" key={asset}><span className="sandbox-label">{asset}/USDC</span><strong>{prices[asset]?.price ? usd(prices[asset].price) : '—'}</strong><span className={Number(prices[asset]?.change24h) >= 0 ? 'positive' : 'negative'}>{prices[asset] ? `${Number(prices[asset].change24h) >= 0 ? '+' : ''}${money(prices[asset].change24h, 2)}% (24h)` : 'Loading'}</span></article>)}</section><section className="panel sandbox-orders-panel"><div className="sandbox-section-heading"><div><div className="eyebrow">TRADING GUARDRAILS</div><h2>How ARRAKIS operates</h2></div><span className="sandbox-muted-pill">Simulation only</span></div><div className="sandbox-intel-grid"><div><span>Execution</span><strong>Local simulation</strong></div><div><span>Balances</span><strong>Test assets</strong></div><div><span>Market prices</span><strong>Public references</strong></div><div><span>AI Analyst</span><strong>Read-only</strong></div></div><p className="sandbox-footnote">Orders and swaps update your ARRAKIS sandbox account only. No wallet connection, venue order submission or blockchain transaction is part of this release.</p></section></div>
  }

  return <div className="page-stack sandbox-page"><section className="welcome-row"><div><div className="eyebrow">{config.eyebrow}</div><h1>{config.title}<span className="accent-period">.</span></h1><p className="muted">{config.description}</p></div><button type="button" className="button button-primary" onClick={() => onNavigate('trade')}>Open trading terminal ↗</button></section></div>
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'trade', label: 'Trade', icon: '↗' },
  { id: 'swap', label: 'Swap', icon: '⇄' },
  { id: 'portfolio', label: 'Portfolio', icon: '◤' },
  { id: 'intelligence', label: 'Intelligence', icon: '⌘' },
]

function App() {
  const [activePage, setActivePage] = useState('overview')
  const data = useReferenceData('dydx')
  const { prices, status: priceStatus } = useReferencePrices()
  const [account, setAccount] = useSandboxAccount()

  useEffect(() => {
    setAccount((previous) => {
      let changed = false
      const balances = { ...previous.balances }
      const orders = previous.orders.map((order) => ({ ...order }))
      const positions = [...(previous.positions || [])]
      const fills = [...previous.fills]

      for (let index = 0; index < orders.length; index += 1) {
        const order = orders[index]
        if (order.status !== 'OPEN') continue
        const mark = Number(prices[order.asset]?.price)
        if (!Number.isFinite(mark) || mark <= 0) continue
        const shouldFill = order.side === 'LONG' ? mark <= Number(order.limitPrice) : mark >= Number(order.limitPrice)
        if (!shouldFill) continue
        const executionPrice = Number(order.limitPrice)
        const notional = Number(order.quantity) * executionPrice
        const fee = notional * SANDBOX_FEE_RATE
        const margin = notional / Number(order.leverage || 1)
        const createdAt = nowIso()
        positions.unshift(makePosition({ id: newId(), asset: order.asset, side: order.side, quantity: order.quantity, entryPrice: executionPrice, leverage: order.leverage, takeProfit: order.takeProfit, stopLoss: order.stopLoss, margin, createdAt }))
        orders[index] = { ...order, status: 'FILLED', filledAt: createdAt, filledPrice: executionPrice }
        fills.unshift({ id: newId(), asset: order.asset, pair: `${order.asset}-PERP`, side: `OPEN ${order.side}`, type: 'LIMIT', quantity: order.quantity, price: executionPrice, notional, fee, createdAt, status: 'FILLED', leverage: order.leverage })
        changed = true
      }

      const survivors = []
      for (const position of positions) {
        const mark = Number(prices[position.asset]?.price)
        if (!Number.isFinite(mark) || mark <= 0) { survivors.push(position); continue }
        const pnl = position.side === 'LONG' ? (mark - Number(position.entryPrice)) * Number(position.quantity) : (Number(position.entryPrice) - mark) * Number(position.quantity)
        const hitTP = position.takeProfit != null && (position.side === 'LONG' ? mark >= Number(position.takeProfit) : mark <= Number(position.takeProfit))
        const hitSL = position.stopLoss != null && (position.side === 'LONG' ? mark <= Number(position.stopLoss) : mark >= Number(position.stopLoss))
        const liquidated = pnl <= -Number(position.margin || 0) * 0.95
        if (!hitTP && !hitSL && !liquidated) { survivors.push(position); continue }
        const reason = liquidated ? 'SIMULATED LIQUIDATION' : hitTP ? 'TAKE PROFIT' : 'STOP LOSS'
        const realized = Math.max(-Number(position.margin || 0), pnl)
        const closeFee = mark * Number(position.quantity) * SANDBOX_FEE_RATE
        balances.USDC = Math.max(0, Number(balances.USDC || 0) + Number(position.margin || 0) + realized - closeFee)
        fills.unshift({ id: newId(), asset: position.asset, pair: `${position.asset}-PERP`, side: reason, type: 'AUTO CLOSE', quantity: position.quantity, price: mark, notional: mark * position.quantity, fee: closeFee, pnl: realized, createdAt: nowIso(), status: 'CLOSED', leverage: position.leverage })
        changed = true
      }
      return changed ? { ...previous, balances, orders, positions: survivors, fills: fills.slice(0, 200) } : previous
    })
  }, [prices, setAccount])

  function navigate(page) {
    setActivePage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function claimTestFunds() {
    const grant = { USDC: 5000, ETH: 0.25, SOL: 5, BNB: 0.25 }
    setAccount((previous) => ({
      ...previous,
      balances: Object.fromEntries(Object.keys(grant).map((asset) => [asset, Number(previous.balances[asset] || 0) + grant[asset]])),
      fills: [{ id: newId(), event: 'TEST FAUCET', pair: 'Test token grant', createdAt: nowIso(), status: 'CLAIMED' }, ...previous.fills].slice(0, 200),
    }))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => navigate('overview')} aria-label="ARRAKIS overview">
          <span className="brand-mark">A</span><span className="brand-name">ARRAKIS<span className="brand-period">.</span></span>
        </button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => <button key={item.id} type="button" className={activePage === item.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.id)} aria-current={activePage === item.id ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{activePage === item.id && <span className="nav-indicator" />}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="connection-status"><span className="status-ring" /><span>Sandbox engine ready</span></div><p>Test funds only<br />No mainnet execution</p></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb"><span className="muted">ARRAKIS</span><span className="breadcrumb-divider">/</span><strong>{NAV_ITEMS.find((item) => item.id === activePage)?.label}</strong></div>
          <div className="topbar-right sandbox-topbar-right">
            <span className="mode-indicator sandbox-mode-indicator"><span className="live-dot" /> SIMULATION MODE</span>
            <div className="sandbox-topbar-balance"><span className="muted tiny">LOCAL SANDBOX USDC</span><strong>{usd(account.balances.USDC || 0)}</strong></div>
            <div className="avatar-mark">A</div>
          </div>
        </header>

        <main className="page-content">
          <AccountBalanceStrip account={account} prices={prices} onClaimFunds={claimTestFunds} />
          {activePage === 'overview' && <Overview account={account} prices={prices} onNavigate={navigate} />}
          {activePage === 'trade' && <TradePage account={account} setAccount={setAccount} prices={prices} priceStatus={priceStatus} />}
          {['swap', 'portfolio', 'intelligence'].includes(activePage) && <FoundationPage page={activePage} data={data} account={account} setAccount={setAccount} prices={prices} onNavigate={navigate} />}
        </main>

        <footer className="app-footer"><span>ARRAKIS <span className="muted">· Built for clarity.</span></span><span className="muted">ARRAKIS sandbox · Simulated balances · No on-chain orders</span></footer>
      </div>
    </div>
  )
}

function BetaAccessGate({ children }) {
  const [verified, setVerified] = useState(!REQUIRE_BETA_ACCESS)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function checkCode(candidate) {
    const response = await fetch(`${API_BASE}/api/beta/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: candidate }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.verified !== true) {
      throw new Error(payload.error || `Access check failed (HTTP ${response.status}).`)
    }
    window.sessionStorage.setItem(BETA_CODE_SESSION_KEY, candidate)
    setVerified(true)
    setError('')
  }

  useEffect(() => {
    if (!REQUIRE_BETA_ACCESS) return
    let cancelled = false
    let saved = ''
    try { saved = window.sessionStorage.getItem(BETA_CODE_SESSION_KEY) || '' } catch { /* continue to code prompt */ }
    if (!saved) return
    fetch(`${API_BASE}/api/beta/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: saved }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (cancelled) return
      if (response.ok && payload.verified === true) {
        setVerified(true)
      } else {
        window.sessionStorage.removeItem(BETA_CODE_SESSION_KEY)
        setVerified(false)
      }
    }).catch(() => {
      if (!cancelled) setError('Could not reach the ARRAKIS beta API. Check the connection and try again.')
    })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!code.trim()) { setError('Enter the access code shared by the ARRAKIS team.'); return }
    setBusy(true)
    setError('')
    try { await checkCode(code.trim()) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Access verification failed.') }
    finally { setBusy(false) }
  }

  if (verified) return children
  return (
    <div className="beta-access-screen">
      <section className="beta-access-card" aria-labelledby="beta-access-title">
        <div className="beta-access-mark">A<span>.</span></div>
        <div className="beta-access-eyebrow">PRIVATE VOLUNTEER BETA</div>
        <h1 id="beta-access-title">Welcome to ARRAKIS</h1>
        <p>Enter the beta access code provided by the ARRAKIS team to open the simulated exchange.</p>
        <form onSubmit={handleSubmit} className="beta-access-form">
          <label htmlFor="beta-access-code">Access code</label>
          <input id="beta-access-code" type="password" autoComplete="current-password" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter your invitation code" maxLength={256} />
          {error && <p className="beta-access-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Enter ARRAKIS'}</button>
        </form>
        <p className="beta-access-footnote">Simulated balances only. No real funds, wallet connection, or on-chain orders.</p>
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<BetaAccessGate><App /></BetaAccessGate>)
