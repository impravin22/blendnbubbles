import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { filterRows, kpis, groupSum, groupOrders, topDrinks, heatmapGrid } from './reportsData';
import './Reports.css';

// Client-side passcode. This is a deterrent for a static site, NOT strong
// security: anyone can read the bundle. Change this value to rotate the code.
// For real protection, move the data behind an authenticated API.
const REPORTS_PIN = 'boba2026';
const PIN_SESSION_KEY = 'bnbReportsAuthed';
const DATA_URL = '/reports-data.cbf3b17bc7.json';

const TEAL = '#0d6e6e';
const GOLD = '#CEAA67';
const DONUT_COLORS = [GOLD, TEAL, '#9fd6c0', '#BB8750', '#7fb7a6', '#d8bd86'];

// The seven cross-filter dimensions. Each maps to a row field; a tap toggles the
// value in that dimension's set (OR within a dimension, AND across dimensions).
const DIMS = ['hour', 'dow', 'week', 'drink', 'category', 'order_type', 'payment'];
const DIM_LABEL = { hour: 'Hour', dow: 'Day', week: 'Week', drink: 'Drink', category: 'Category', order_type: 'Type', payment: 'Pay' };

const emptySel = () => Object.fromEntries(DIMS.map((d) => [d, new Set()]));
const fmtRs = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtNum = (n) => Number(n).toLocaleString('en-IN');
const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const hourShort = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// ─── Chart primitives (dependency-free, tappable) ────────────

function Bars({ data, selectedSet, onToggle, color, ariaLabel }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const active = selectedSet.size > 0;
  return (
    <div className={`rp-bars ${active ? 'rp-dim' : ''}`} role="group" aria-label={ariaLabel}>
      {data.map((d) => {
        const isSel = selectedSet.has(d.key);
        return (
          <button
            type="button" key={d.key}
            className={`rp-barcol ${isSel ? 'sel' : ''}`}
            style={{ '--bar': color }}
            aria-pressed={isSel}
            aria-label={`${d.aria}: ${d.value} items${isSel ? ', selected' : ''}`}
            onClick={() => onToggle(d.key)}
          >
            <span className="rp-bv">{d.value || ''}</span>
            <span className="rp-bar" style={{ height: `${Math.round((d.value / max) * 112)}px` }} />
            <span className="rp-bl">{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DrinkBars({ data, selectedSet, onToggle }) {
  if (!data.length) return <div className="rp-state">No drinks match this filter.</div>;
  const max = Math.max(1, ...data.map((d) => d.qty));
  const active = selectedSet.size > 0;
  return (
    <div className={`rp-drinks ${active ? 'rp-dim' : ''}`}>
      {data.map((d) => {
        const isSel = selectedSet.has(d.drink);
        return (
          <button
            type="button" key={d.drink}
            className={`rp-drow ${isSel ? 'sel' : ''}`}
            aria-pressed={isSel}
            aria-label={`${d.drink}: ${d.qty} items, ${fmtRs(d.revenue)}${isSel ? ', selected' : ''}`}
            onClick={() => onToggle(d.drink)}
          >
            <span className="rp-dname">{d.drink}</span>
            <span className="rp-dval">{d.qty} · {fmtRs(d.revenue)}</span>
            <span className="rp-dtrack"><span className="rp-dfill" style={{ width: `${(d.qty / max) * 100}%` }} /></span>
          </button>
        );
      })}
    </div>
  );
}

function Donut({ data, selectedSet, onToggle, ariaLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const safe = total || 1; // divisor only; the label shows the real total
  const active = selectedSet.size > 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="rp-donut-wrap">
      <svg viewBox="0 0 140 140" className="rp-donut" role="img" aria-label={ariaLabel}>
        {data.map((d, i) => {
          const frac = d.value / safe;
          const dash = `${frac * C} ${C - frac * C}`;
          const off = -acc * C;
          acc += frac;
          return (
            <circle
              key={d.key} cx="70" cy="70" r={R} fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="20"
              strokeDasharray={dash} strokeDashoffset={off} transform="rotate(-90 70 70)"
              opacity={active && !selectedSet.has(d.key) ? 0.3 : 1}
            />
          );
        })}
        <text x="70" y="76" textAnchor="middle" className="rp-donut-c">{fmtNum(total)}</text>
      </svg>
      <div className={`rp-legend ${active ? 'rp-dim' : ''}`}>
        {data.map((d, i) => {
          const isSel = selectedSet.has(d.key);
          return (
            <button
              type="button" key={d.key}
              className={`rp-leg ${isSel ? 'sel' : ''}`} aria-pressed={isSel}
              onClick={() => onToggle(d.key)}
            >
              <span className="rp-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              {d.key} <strong>{pct(d.value, total)}%</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Display-only: reflects the active filter, shows the day x hour pattern. The
// hour and day filters live on the bar charts to keep selection state simple.
function Heatmap({ grid, hours, dows }) {
  const max = Math.max(1, ...grid.flatMap((r) => hours.map((h) => r.counts[h])));
  const cellColor = (v) => (v ? `rgba(206,170,103,${0.15 + (v / max) * 0.85})` : 'rgba(255,255,255,0.04)');
  return (
    <div className="rp-heatmap" style={{ gridTemplateColumns: `42px repeat(${hours.length}, 1fr)` }} role="img" aria-label="Day by hour intensity of items sold for the current filter">
      <div className="rp-hm-corner" />
      {hours.map((h) => <div key={h} className="rp-hm-hhdr">{hourShort(h)}</div>)}
      {grid.map((r) => (
        <React.Fragment key={r.dow}>
          <div className="rp-hm-dow">{dows[r.dow]}</div>
          {hours.map((h) => {
            const v = r.counts[h] || 0;
            return <div key={h} className="rp-hm-cell" style={{ background: cellColor(v) }} title={`${dows[r.dow]} ${hourLabel(h)}: ${v}`} aria-label={`${dows[r.dow]} ${hourLabel(h)}: ${v} items`}>{v || ''}</div>;
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function FilterBar({ sel, dows, onRemove, onClear }) {
  const chips = [];
  DIMS.forEach((dim) => sel[dim].forEach((v) => chips.push({ dim, val: v })));
  return (
    <div className="rp-filterbar">
      {chips.length === 0 && <span className="rp-filter-empty">Tap any bar, drink, or slice to filter &rarr;</span>}
      {chips.map(({ dim, val }) => (
        <button type="button" key={`${dim}:${val}`} className="rp-chip" onClick={() => onRemove(dim, val)}>
          <span className="rp-chip-dim">{DIM_LABEL[dim]}</span> {dim === 'hour' ? hourLabel(val) : dim === 'dow' ? dows[val] : val}
          <span aria-hidden="true"> ✕</span><span className="rp-sr"> — remove filter</span>
        </button>
      ))}
      <button type="button" className="rp-reset" onClick={onClear} disabled={chips.length === 0}>Reset</button>
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
          className="rp-gate-input" type="password" value={pin}
          onChange={(e) => { setPin(e.target.value); setErr(false); }}
          placeholder="Access code" aria-label="Access code" autoFocus
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
  const [sel, setSel] = useState(emptySel);

  useEffect(() => {
    document.title = 'Sales Dashboard - BlendNBubbles';
    // Keep the staff dashboard out of search engines. Scoped to this route only
    // (removed on unmount) so the public marketing pages stay indexable.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow';
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  useEffect(() => {
    if (!authed) return undefined;
    let alive = true;
    fetch(process.env.PUBLIC_URL + DATA_URL)
      .then((r) => { if (!r.ok) throw new Error('Could not load report data'); return r.json(); })
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [authed]);

  const toggle = useCallback((dim, value) => {
    setSel((prev) => {
      const next = new Set(prev[dim]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [dim]: next };
    });
  }, []);
  const clear = useCallback(() => setSel(emptySel()), []);

  const filtered = useMemo(() => (data ? filterRows(data.rows, sel) : []), [data, sel]);

  const derived = useMemo(() => {
    if (!data) return null;
    const donutData = (map) => [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
    const hourQ = groupSum(filtered, 'hour', 'qty');
    const dowQ = groupSum(filtered, 'dow', 'qty');
    const weekQ = groupSum(filtered, 'week', 'qty');
    const peakHour = filtered.length
      ? data.dims.hours.reduce((best, h) => ((hourQ.get(h) || 0) > (hourQ.get(best) || 0) ? h : best), data.dims.hours[0])
      : null;
    const peakDow = filtered.length
      ? data.dims.dows.map((_n, i) => i).reduce((best, i) => ((dowQ.get(i) || 0) > (dowQ.get(best) || 0) ? i : best), 0)
      : null;
    return {
      k: kpis(filtered),
      hour: data.dims.hours.map((h) => ({ key: h, label: hourShort(h), aria: hourLabel(h), value: hourQ.get(h) || 0 })),
      dow: data.dims.dows.map((name, i) => ({ key: i, label: name, aria: name, value: dowQ.get(i) || 0 })),
      week: data.dims.weeks.map((w) => ({ key: w, label: w.slice(5), aria: `week of ${w}`, value: weekQ.get(w) || 0 })),
      drinks: topDrinks(filtered, 10),
      category: donutData(groupSum(filtered, 'category', 'qty')).slice(0, 8),
      orderType: donutData(groupOrders(filtered, 'order_type')),
      payment: donutData(groupOrders(filtered, 'payment')),
      heat: heatmapGrid(filtered, data.dims.hours),
      peakHour, peakDow,
    };
  }, [data, filtered]);

  if (!authed) return <PinGate onPass={() => setAuthed(true)} />;
  if (error) return <div className="rp-page"><div className="rp-state">{error}</div></div>;
  if (!data || !derived) return <div className="rp-page"><div className="rp-state">Loading dashboard&hellip;</div></div>;

  const { dims, meta } = data;
  const { k } = derived;
  const anyFilter = DIMS.some((d) => sel[d].size > 0);

  return (
    <div className="rp-page">
      <header className="rp-header">
        <div>
          <h1 className="rp-h1">Sales Dashboard</h1>
          <p className="rp-period">{meta.date_from} to {meta.date_to} &middot; {meta.source}</p>
        </div>
        <Link to="/" className="rp-home-link">BlendNBubbles &rarr;</Link>
      </header>

      <div className="rp-note">{meta.note}</div>

      <FilterBar sel={sel} dows={dims.dows} onRemove={toggle} onClear={clear} />

      <span className="rp-sr" aria-live="polite" aria-atomic="true">
        {anyFilter ? `Filtered to ${fmtNum(k.orders)} orders, ${fmtNum(k.items)} items` : ''}
      </span>
      <section className="rp-kpis">
        <div className="rp-kpi"><span className="rp-kpi-v">{fmtNum(k.orders)}</span><span className="rp-kpi-l">Orders</span>{anyFilter && <span className="rp-kpi-d">{pct(k.orders, meta.orders)}% of all</span>}</div>
        <div className="rp-kpi"><span className="rp-kpi-v">{fmtNum(k.items)}</span><span className="rp-kpi-l">Items sold</span>{anyFilter && <span className="rp-kpi-d">{pct(k.items, meta.items)}% of all</span>}</div>
        <div className="rp-kpi"><span className="rp-kpi-v">{fmtRs(k.revenue)}</span><span className="rp-kpi-l">Net item sales</span></div>
        <div className="rp-kpi"><span className="rp-kpi-v">{fmtRs(k.aov)}</span><span className="rp-kpi-l">Avg order value</span></div>
      </section>

      <section className="rp-insights">
        <div className="rp-insight">Busiest day: <strong>{derived.peakDow !== null ? dims.dows[derived.peakDow] : '—'}</strong></div>
        <div className="rp-insight">Peak hour: <strong>{derived.peakHour !== null ? hourLabel(derived.peakHour) : '—'}</strong></div>
        <div className="rp-insight">{anyFilter ? 'Filtered view' : `${meta.days_active} active days`}</div>
      </section>

      <div className="rp-grid">
        <div className="rp-card rp-card-wide">
          <h2 className="rp-card-title">Items sold by hour of day</h2>
          <p className="rp-card-hint">Tap an hour to filter every chart</p>
          <Bars data={derived.hour} selectedSet={sel.hour} onToggle={(v) => toggle('hour', v)} color={GOLD} ariaLabel="Items sold by hour of day" />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">By day of week</h2>
          <Bars data={derived.dow} selectedSet={sel.dow} onToggle={(v) => toggle('dow', v)} color={TEAL} ariaLabel="Items sold by day of week" />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">By week</h2>
          <Bars data={derived.week} selectedSet={sel.week} onToggle={(v) => toggle('week', v)} color={GOLD} ariaLabel="Items sold by week" />
        </div>

        <div className="rp-card rp-card-wide">
          <h2 className="rp-card-title">When are we busy? (day &times; hour)</h2>
          <Heatmap grid={derived.heat} hours={dims.hours} dows={dims.dows} />
        </div>

        <div className="rp-card rp-card-wide">
          <h2 className="rp-card-title">Top sellers</h2>
          <p className="rp-card-hint">Tap a drink to see when it sells</p>
          <DrinkBars data={derived.drinks} selectedSet={sel.drink} onToggle={(v) => toggle('drink', v)} />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">By category</h2>
          <Donut data={derived.category} selectedSet={sel.category} onToggle={(v) => toggle('category', v)} ariaLabel="Items sold by category" />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">Order type</h2>
          <Donut data={derived.orderType} selectedSet={sel.order_type} onToggle={(v) => toggle('order_type', v)} ariaLabel="Orders by order type" />
        </div>

        <div className="rp-card">
          <h2 className="rp-card-title">Payment method</h2>
          <Donut data={derived.payment} selectedSet={sel.payment} onToggle={(v) => toggle('payment', v)} ariaLabel="Orders by payment method" />
        </div>
      </div>

      <footer className="rp-footer">
        Generated {meta.generated} &middot; BlendNBubbles &middot; Barrackpore, Kolkata
      </footer>
    </div>
  );
}

export default Reports;
