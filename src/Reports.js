import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { filterRows, kpis, groupSum, groupOrders, topDrinks, heatmapGrid, weeklySeries } from './reportsData';
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
// Line palette for the trend: bright, mutually-distinct hues that each clear
// 3:1 contrast on the dark card (WCAG 1.4.11) — the donut TEAL (#0d6e6e) is too
// close to the page background to use as a stroke. Paired with dash patterns so
// series stay distinguishable without colour (WCAG 1.4.1).
const TREND_COLORS = ['#CEAA67', '#3fd0c9', '#9fd6c0', '#e0894e', '#c2a3ff'];
const TREND_DASH = ['', '7 4', '2 4', '9 3 2 3', '1 5'];

// The eight cross-filter dimensions. Each maps to a row field; a tap toggles the
// value in that dimension's set (OR within a dimension, AND across dimensions).
// 'month' is driven by its own pill control rather than the tappable charts.
const DIMS = ['hour', 'dow', 'week', 'month', 'drink', 'category', 'order_type', 'payment'];
const DIM_LABEL = { hour: 'Hour', dow: 'Day', week: 'Week', month: 'Month', drink: 'Drink', category: 'Category', order_type: 'Type', payment: 'Pay' };

const emptySel = () => Object.fromEntries(DIMS.map((d) => [d, new Set()]));
const fmtRs = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtNum = (n) => Number(n).toLocaleString('en-IN');
const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const hourShort = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-06" -> "Jun" (or "Jun '26" when the dataset spans more than one year).
// Falls back to the raw key if the month part is out of range, so a malformed
// dims.months entry never renders an "undefined" pill.
const monthLabel = (m, withYear) => {
  const name = MONTH_NAMES[Number(m.slice(5, 7)) - 1] ?? m;
  return `${name}${withYear ? ` '${m.slice(2, 4)}` : ''}`;
};

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

// Weekly trend line chart. One gold line for the total, or one colour-coded
// line per selected drink (the multi-drink compare). Display-only for weeks —
// week filtering stays on the "By week" bars.
function LineTrend({ series, weekLabels, weekKeys, ariaLabel }) {
  const W = 600;
  const H = 210;
  const PADL = 10;
  const PADR = 10;
  const PADT = 18;
  const PADB = 30;
  const plotW = W - PADL - PADR;
  const plotH = H - PADT - PADB;
  const n = weekLabels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i) => PADL + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
  const y = (v) => PADT + plotH - (v / max) * plotH;
  const single = series.length === 1;
  return (
    <div className="rp-trend">
      {!single && (
        <div className="rp-trend-legend">
          {series.map((s) => (
            <span key={s.key} className="rp-tl"><span className="rp-tl-sw" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="rp-trend-svg" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="rpTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((g) => (
          <line key={g} className="rp-trend-grid" x1={PADL} y1={PADT + (plotH * g) / 3} x2={W - PADR} y2={PADT + (plotH * g) / 3} />
        ))}
        {single && n > 1 && (
          <path d={`M${series[0].values.map((v, i) => `${x(i)},${y(v)}`).join(' L')} L${x(n - 1)},${PADT + plotH} L${PADL},${PADT + plotH} Z`} fill="url(#rpTrendArea)" />
        )}
        {series.map((s) => (
          <g key={s.key}>
            <path d={`M${s.values.map((v, i) => `${x(i)},${y(v)}`).join(' L')}`} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash || undefined} strokeLinejoin="round" />
            {s.values.map((v, i) => <circle key={`pt-${weekKeys[i]}`} cx={x(i)} cy={y(v)} r="3.2" fill={s.color} />)}
            {single && s.values.map((v, i) => <text key={`val-${weekKeys[i]}`} className="rp-trend-val" x={x(i)} y={y(v) - 8} textAnchor="middle">{v}</text>)}
          </g>
        ))}
        {weekLabels.map((w, i) => <text key={weekKeys[i]} className="rp-trend-wk" x={x(i)} y={H - 10} textAnchor="middle">{w}</text>)}
      </svg>
      {/* Screen-reader data table — the SVG is decorative for AT, the numbers live here. */}
      <table className="rp-sr">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr><th scope="col">Series</th>{weekLabels.map((w, i) => <th key={weekKeys[i]} scope="col">{w}</th>)}</tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.key}><th scope="row">{s.label}</th>{s.values.map((v, i) => <td key={weekKeys[i]}>{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterBar({ sel, dows, onRemove, onClear, extraActive }) {
  const chips = [];
  // Month has its own pill control above, so it is not shown as a removable chip.
  DIMS.filter((dim) => dim !== 'month').forEach((dim) => sel[dim].forEach((v) => chips.push({ dim, val: v })));
  return (
    <div className="rp-filterbar">
      {chips.length === 0 && <span className="rp-filter-empty">Tap any bar, drink, or slice to filter &rarr;</span>}
      {chips.map(({ dim, val }) => (
        <button type="button" key={`${dim}:${val}`} className="rp-chip" onClick={() => onRemove(dim, val)}>
          <span className="rp-chip-dim">{DIM_LABEL[dim]}</span> {dim === 'hour' ? hourLabel(val) : dim === 'dow' ? dows[val] : val}
          <span aria-hidden="true"> ✕</span><span className="rp-sr"> — remove filter</span>
        </button>
      ))}
      {/* Reset also clears the trend's compare selection, so enable it whenever either is active. */}
      <button type="button" className="rp-reset" onClick={onClear} disabled={chips.length === 0 && !extraActive}>Reset</button>
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
  // Drinks to compare in the Weekly trend (own selection, independent of the
  // cross-filter, so picking compare drinks never narrows the Top-sellers list).
  const [cmp, setCmp] = useState(() => new Set());

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

  // Open on the latest month ("this month") once data arrives, so the dashboard
  // leads with the current month. Applied once; the "All time" pill or Reset clears it.
  const monthDefaulted = useRef(false);
  useEffect(() => {
    if (!data || monthDefaulted.current) return;
    const months = data.dims.months || [];
    if (months.length === 0) return;
    monthDefaulted.current = true;
    const latest = months[months.length - 1];
    setSel((prev) => (prev.month.size === 0 ? { ...prev, month: new Set([latest]) } : prev));
  }, [data]);

  const toggle = useCallback((dim, value) => {
    setSel((prev) => {
      const next = new Set(prev[dim]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [dim]: next };
    });
  }, []);
  const clear = useCallback(() => { setSel(emptySel()); setCmp(new Set()); }, []);
  // Single-select month: pick one month, or pass null for "All time" (clears it).
  const selectMonth = useCallback((m) => {
    setSel((prev) => ({ ...prev, month: m ? new Set([m]) : new Set() }));
  }, []);
  const toggleCmp = useCallback((drink) => {
    setCmp((prev) => {
      const next = new Set(prev);
      if (next.has(drink)) next.delete(drink);
      else if (next.size < 5) next.add(drink); // cap the compare at 5 lines
      return next;
    });
  }, []);

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
      drinks: topDrinks(filtered), // every drink, ranked by qty — a cap previously hid lower-volume drinks (e.g. fruit teas)
      category: donutData(groupSum(filtered, 'category', 'qty')).slice(0, 8),
      orderType: donutData(groupOrders(filtered, 'order_type')),
      payment: donutData(groupOrders(filtered, 'payment')),
      heat: heatmapGrid(filtered, data.dims.hours),
      // Trend respects the non-drink filters but uses its own compare selection,
      // so the lines reflect hour/day/category/etc. while staying independent of
      // the Top-sellers drink cross-filter.
      weekTrend: weeklySeries(filterRows(data.rows, { ...sel, drink: new Set() }), data.dims.weeks, [...cmp]).map((s, i) => ({
        ...s,
        color: s.key === '__all__' ? GOLD : TREND_COLORS[i % TREND_COLORS.length],
        dash: s.key === '__all__' ? '' : TREND_DASH[i % TREND_DASH.length],
      })),
      weekLabels: data.dims.weeks.map((w) => w.slice(5)),
      weekKeys: data.dims.weeks,
      peakHour, peakDow,
    };
  }, [data, filtered, sel, cmp]);

  if (!authed) return <PinGate onPass={() => setAuthed(true)} />;
  if (error) return <div className="rp-page"><div className="rp-state">{error}</div></div>;
  if (!data || !derived) return <div className="rp-page"><div className="rp-state">Loading dashboard&hellip;</div></div>;

  const { dims, meta } = data;
  const { k } = derived;
  const anyFilter = DIMS.some((d) => sel[d].size > 0);
  const months = dims.months || [];
  const multiYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;

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

      {months.length > 0 && (
        <div className="rp-months" role="group" aria-label="Filter by month">
          <span className="rp-months-label">Month</span>
          <button
            type="button"
            className={`rp-month ${sel.month.size === 0 ? 'on' : ''}`}
            aria-pressed={sel.month.size === 0}
            onClick={() => selectMonth(null)}
          >
            All time
          </button>
          {months.map((m) => {
            const on = sel.month.has(m);
            return (
              <button
                type="button" key={m}
                className={`rp-month ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => selectMonth(on ? null : m)}
              >
                {monthLabel(m, multiYear)}
              </button>
            );
          })}
        </div>
      )}

      <FilterBar sel={sel} dows={dims.dows} onRemove={toggle} onClear={clear} extraActive={cmp.size > 0 || sel.month.size > 0} />

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
          <h2 className="rp-card-title">Weekly trend</h2>
          <p className="rp-card-hint">{cmp.size ? `Comparing ${cmp.size} drink${cmp.size > 1 ? 's' : ''} — this chart only (max 5)` : 'Total weekly items — pick drinks to compare (this chart only; Top sellers filters everything)'}</p>
          <div className="rp-cmp">
            {dims.drinks.slice(0, 8).map((d) => {
              const idx = [...cmp].indexOf(d);
              const on = idx >= 0;
              return (
                <button
                  type="button" key={d}
                  className={`rp-cmp-chip ${on ? 'on' : ''}`} aria-pressed={on}
                  style={on ? { '--chip': TREND_COLORS[idx % TREND_COLORS.length] } : undefined}
                  onClick={() => toggleCmp(d)}
                >
                  {on && <span className="rp-cmp-dot" aria-hidden="true" />}{d}
                </button>
              );
            })}
          </div>
          <LineTrend
            series={derived.weekTrend}
            weekLabels={derived.weekLabels}
            weekKeys={derived.weekKeys}
            ariaLabel={cmp.size ? `Weekly trend comparing ${cmp.size} drinks` : 'Weekly trend of total items sold'}
          />
        </div>

        <div className="rp-card rp-card-wide">
          <h2 className="rp-card-title">When are we busy? (day &times; hour)</h2>
          <Heatmap grid={derived.heat} hours={dims.hours} dows={dims.dows} />
        </div>

        <div className="rp-card rp-card-wide">
          <h2 className="rp-card-title">Drinks sold ({derived.drinks.length})</h2>
          <p className="rp-card-hint">Every drink, ranked by quantity — tap one to see when it sells. Scroll for the full list.</p>
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
