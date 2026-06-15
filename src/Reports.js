import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './Reports.css';

// Client-side passcode. This is a deterrent for a static site, NOT strong
// security: anyone can read the bundle. Change this value to rotate the code.
// For real protection, move the data behind an authenticated API.
const REPORTS_PIN = 'boba2026';
const PIN_SESSION_KEY = 'bnbReportsAuthed';

const TEAL = '#0d6e6e';
const GOLD = '#CEAA67';

const formatRs = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const formatNum = (n) => Number(n).toLocaleString('en-IN');

// ─── Small chart primitives (dependency-free SVG) ────────────

function VerticalBars({ data, valueKey, labelKey, color = GOLD, height = 190, valueFormat = formatNum, ariaLabel }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <svg className="rp-svg" viewBox={`0 0 ${data.length * 44} ${height}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
      {data.map((d, i) => {
        const h = Math.max(0, (d[valueKey] / max) * (height - 42));
        const x = i * 44 + 6;
        return (
          <g key={d[labelKey]}>
            {h > 0 && <rect x={x} y={height - 26 - h} width={32} height={h} rx={5} fill={color} opacity={0.92} />}
            <text x={x + 16} y={height - 30 - h} className="rp-bar-val" textAnchor="middle">{d[valueKey] ? valueFormat(d[valueKey]) : ''}</text>
            <text x={x + 16} y={height - 9} className="rp-bar-lbl" textAnchor="middle">{d[labelKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizontalBars({ data, valueKey, labelKey, subKey, color = TEAL }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="rp-hbars">
      {data.map((d) => (
        <div className="rp-hbar-row" key={d[labelKey]}>
          <span className="rp-hbar-label" title={d[labelKey]}>{d[labelKey]}</span>
          <div className="rp-hbar-track">
            <div className="rp-hbar-fill" style={{ width: `${(d[valueKey] / max) * 100}%`, background: color }} />
          </div>
          <span className="rp-hbar-value">{formatNum(d[valueKey])}{subKey ? <em> {formatRs(d[subKey])}</em> : null}</span>
        </div>
      ))}
    </div>
  );
}

function LineTrend({ data, valueKey, labelKey, height = 200, ariaLabel, gradientId = 'rpArea', keyKey = labelKey }) {
  const w = 520;
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => [i * stepX, height - 34 - (d[valueKey] / max) * (height - 50)]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${w},${height - 34} L0,${height - 34} Z`;
  return (
    <svg className="rp-svg" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>
      {data.length > 1 && <path d={area} fill={`url(#${gradientId})`} />}
      <path d={path} fill="none" stroke={GOLD} strokeWidth="3" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={data[i][keyKey]}>
          <circle cx={p[0]} cy={p[1]} r="4" fill={GOLD} />
          <text x={p[0]} y={p[1] - 10} className="rp-bar-val" textAnchor="middle">{formatNum(data[i][valueKey])}</text>
          <text x={p[0]} y={height - 12} className="rp-bar-lbl" textAnchor="middle">{data[i][labelKey]}</text>
        </g>
      ))}
    </svg>
  );
}

function Heatmap({ heatmap }) {
  const { hours, rows } = heatmap;
  const max = Math.max(1, ...rows.flatMap((r) => hours.map((h) => r[String(h)] || 0)));
  const cellColor = (v) => {
    if (!v) return 'rgba(255,255,255,0.04)';
    const t = v / max;
    return `rgba(206,170,103,${0.15 + t * 0.85})`;
  };
  const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
  return (
    <div className="rp-heatmap" style={{ gridTemplateColumns: `42px repeat(${hours.length}, 1fr)` }}>
      <div className="rp-hm-corner" />
      {hours.map((h) => <div key={h} className="rp-hm-hhdr">{hourLabel(h)}</div>)}
      {rows.map((r) => (
        <React.Fragment key={r.dow}>
          <div className="rp-hm-dow">{r.dow}</div>
          {hours.map((h) => {
            const v = r[String(h)] || 0;
            return <div key={h} className="rp-hm-cell" style={{ background: cellColor(v) }} title={`${r.dow} ${hourLabel(h)}: ${v}`} aria-label={`${r.dow} ${hourLabel(h)}: ${v} items`}>{v || ''}</div>;
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function Donut({ data, valueKey, labelKey, ariaLabel }) {
  const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  const colors = [GOLD, TEAL, '#9fd6c0', '#BB8750', '#7fb7a6'];
  let acc = 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="rp-donut-wrap">
      <svg viewBox="0 0 140 140" className="rp-donut" role="img" aria-label={ariaLabel}>
        {data.map((d, i) => {
          const frac = d[valueKey] / total;
          const dash = `${frac * C} ${C - frac * C}`;
          const off = -acc * C;
          acc += frac;
          return <circle key={d[labelKey]} cx="70" cy="70" r={R} fill="none" stroke={colors[i % colors.length]} strokeWidth="20" strokeDasharray={dash} strokeDashoffset={off} transform="rotate(-90 70 70)" />;
        })}
        <text x="70" y="75" textAnchor="middle" className="rp-donut-c">{formatNum(total)}</text>
      </svg>
      <div className="rp-legend">
        {data.map((d, i) => (
          <div key={d[labelKey]} className="rp-leg-row">
            <span className="rp-leg-dot" style={{ background: colors[i % colors.length] }} />
            {d[labelKey]} <strong>{Math.round((d[valueKey] / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Gate ────────────────────────────────────────────────────
function PinGate({ onPass }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (pin === REPORTS_PIN) {
      try { sessionStorage.setItem(PIN_SESSION_KEY, '1'); } catch (storageErr) { /* sessionStorage may be blocked; gate still passes for this view */ }
      onPass();
    } else {
      setErr(true);
    }
  };
  return (
    <div className="rp-gate">
      <form className="rp-gate-card" onSubmit={submit}>
        <img src={process.env.PUBLIC_URL + '/logo.svg'} alt="BlendNBubbles" className="rp-gate-logo" />
        <h1 className="rp-gate-title">Sales Dashboard</h1>
        <p className="rp-gate-sub">Staff only. Enter the access code.</p>
        <input
          className="rp-gate-input"
          type="password"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setErr(false); }}
          placeholder="Access code"
          aria-label="Access code"
          autoFocus
        />
        {err && <p className="rp-gate-err" role="alert">Wrong code. Try again.</p>}
        <button className="rp-gate-btn" type="submit">View Dashboard</button>
        <Link to="/" className="rp-gate-back">&larr; Back to site</Link>
      </form>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────
function Reports() {
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(PIN_SESSION_KEY) === '1'; } catch (storageErr) { return false; }
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Sales Dashboard - BlendNBubbles';
    // Keep the staff dashboard out of search engines. Scoped to this route only
    // (removed on unmount) so the public marketing pages stay indexable. The
    // report data file uses an unguessable name and is linked from nowhere
    // crawlable, so it is not discoverable on its own.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow';
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetch(process.env.PUBLIC_URL + '/reports-data.cbf3b17bc7.json')
      .then((r) => { if (!r.ok) throw new Error('Could not load report data'); return r.json(); })
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [authed]);

  const weekData = useMemo(() => {
    if (!data) return [];
    return data.by_week.map((w) => ({ ...w, label: w.week_start.slice(5) }));
  }, [data]);

  if (!authed) return <PinGate onPass={() => setAuthed(true)} />;

  if (error) return <div className="rp-page"><div className="rp-state">{error}</div></div>;
  if (!data) return <div className="rp-page"><div className="rp-state">Loading dashboard&hellip;</div></div>;

  // Fallbacks guard against an empty/partial data refresh: [0] would be
  // undefined and crash the render on .dow / .label access below.
  const peakDow = [...data.by_dow].sort((a, b) => b.qty - a.qty)[0] ?? { dow: '—', qty: 0 };
  const peakHour = [...data.by_hour].sort((a, b) => b.qty - a.qty)[0] ?? { label: '—', qty: 0 };

  return (
    <div className="rp-page">
      <header className="rp-header">
        <div>
          <h1 className="rp-h1">Sales Dashboard</h1>
          <p className="rp-period">{data.meta.date_from} to {data.meta.date_to} &middot; {data.meta.source}</p>
        </div>
        <Link to="/" className="rp-home-link">BlendNBubbles &rarr;</Link>
      </header>

      <div className="rp-note">{data.meta.note}</div>

      <section className="rp-kpis">
        <div className="rp-kpi"><span className="rp-kpi-v">{formatNum(data.summary.orders)}</span><span className="rp-kpi-l">Orders</span></div>
        <div className="rp-kpi"><span className="rp-kpi-v">{formatNum(data.summary.items_sold)}</span><span className="rp-kpi-l">Items sold</span></div>
        <div className="rp-kpi"><span className="rp-kpi-v">{formatRs(data.summary.revenue)}</span><span className="rp-kpi-l">Net item sales</span></div>
        <div className="rp-kpi"><span className="rp-kpi-v">{formatRs(data.summary.avg_order_value)}</span><span className="rp-kpi-l">Avg order value</span></div>
      </section>

      <section className="rp-insights">
        <div className="rp-insight">Busiest day: <strong>{peakDow.dow}</strong> ({formatNum(peakDow.qty)} items)</div>
        <div className="rp-insight">Peak hour: <strong>{peakHour.label}</strong> ({formatNum(peakHour.qty)} items)</div>
        <div className="rp-insight">Active days: <strong>{data.summary.days_active}</strong></div>
      </section>

      <div className="rp-grid">
        <div className="rp-card rp-card-wide">
          <h2 className="rp-card-title">Items sold by hour of day</h2>
          <VerticalBars data={data.by_hour} valueKey="qty" labelKey="label" color={GOLD} ariaLabel={`Bar chart: items sold by hour of day. Peak hour ${peakHour.label} with ${formatNum(peakHour.qty)} items.`} />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">Items sold by day of week</h2>
          <VerticalBars data={data.by_dow} valueKey="qty" labelKey="dow" color={TEAL} ariaLabel={`Bar chart: items sold by day of week. Busiest ${peakDow.dow} with ${formatNum(peakDow.qty)} items.`} />
        </div>

        <div className="rp-card rp-card-wide">
          <h2 className="rp-card-title">When are we busy? (day &times; hour)</h2>
          <Heatmap heatmap={data.heatmap} />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">Weekly trend (items)</h2>
          <LineTrend data={weekData} valueKey="qty" labelKey="label" keyKey="week_start" ariaLabel={`Line chart: weekly items-sold trend over ${weekData.length} weeks.`} />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">Top sellers</h2>
          <HorizontalBars data={data.top_items.slice(0, 10)} valueKey="qty" labelKey="item" subKey="revenue" color={GOLD} />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">By category</h2>
          <HorizontalBars data={data.by_category.slice(0, 8)} valueKey="qty" labelKey="category" subKey="revenue" color={TEAL} />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">Order type</h2>
          <Donut data={data.order_type} valueKey="orders" labelKey="type" ariaLabel="Donut chart: orders by order type. Breakdown follows in the legend." />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">Payment method</h2>
          <Donut data={data.payment} valueKey="orders" labelKey="type" ariaLabel="Donut chart: orders by payment method. Breakdown follows in the legend." />
        </div>
      </div>

      <footer className="rp-footer">
        Generated {data.meta.generated} &middot; BlendNBubbles &middot; Barrackpore, Kolkata
      </footer>
    </div>
  );
}

export default Reports;
