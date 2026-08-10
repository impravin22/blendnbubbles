import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Partners.css';
import {
  fetchPartnerSheets,
  isPartnersConfigured,
  readStoredToken,
  storeToken,
  clearStoredToken,
} from './partnersClient';

// Access is decided by the server, not here. The extract lives in Cloudflare KV
// behind a Worker that checks a bearer token held as a Worker secret, so this
// bundle contains neither the sheets nor anything that validates a credential.
//
// The first version of this page shipped both: a hardcoded passcode constant
// sitting in the same JavaScript as the 1,187 customer phone numbers it claimed
// to gate. Anyone could read the code and skip the gate. Caught before deploy.

// ─── Gate ────────────────────────────────────────────────────
// Deliberately does not check the token. It cannot: only the Worker knows
// whether one is valid. The gate collects it, the fetch decides, and a rejected
// token is cleared so this reappears rather than looping on a stale value.
function TokenGate({ onSubmit, rejected }) {
  const [token, setToken] = useState('');
  return (
    <main className="partners-container">
      <form
        className="partners-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) onSubmit(token.trim());
        }}
      >
        <h1>Partner Portal</h1>
        <p>Owner only. Paste your access token.</p>
        <div className="passcode-input-group">
          <label className="sr-only" htmlFor="partners-token">Access token</label>
          <input
            id="partners-token"
            type="password"
            className="passcode-input"
            placeholder="Access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        {rejected && (
          <p className="error-msg" role="alert">
            That token was rejected. Check it and try again.
          </p>
        )}
        <button type="submit" className="submit-btn">Unlock Dashboard</button>
        <Link to="/" className="partners-back">&larr; Back to site</Link>
      </form>
    </main>
  );
}

// ─── Sheet table ─────────────────────────────────────────────
// Column count comes from the header row: Sheets omits trailing empty cells, so
// rows arrive ragged and a row-derived count would shear the table.
function SheetTable({ rows }) {
  const header = rows?.[0];
  if (!header || header.length === 0) {
    return <div className="no-data">No data or rows found in this sheet.</div>;
  }
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} scope="col">{cell || `Col ${i + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {header.map((_, colIndex) => (
                // ?? not ||: a cell holding 0 or a literal "0" is data, and ||
                // would blank it out.
                <td key={colIndex}>{row[colIndex] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────
function Partners() {
  const [token, setToken] = useState(readStoredToken);
  const [rejected, setRejected] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    document.title = 'Partner Portal - BlendNBubbles';
    // Keep the portal out of search engines. Scoped to this route only (removed
    // on unmount) so the public marketing pages stay indexable.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow';
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    fetchPartnerSheets(token).then((result) => {
      if (!alive) return;
      if (result.status === 'ok') { setData(result.data); setError(''); return; }
      if (result.status === 'unauthorised') {
        // Clear it, or every reload retries a token the server already refused.
        clearStoredToken();
        setToken('');
        setData(null);
        setRejected(true);
        return;
      }
      // Keep the detail: on a static site with no error reporting, "could not
      // load" alone makes a stale deploy or a dead Worker indistinguishable.
      setError(
        result.status === 'unconfigured'
          ? 'Partner portal is not configured for this build (REACT_APP_PARTNERS_URL is unset).'
          : `Could not load partner sheets — ${result.detail}`,
      );
    });
    return () => { alive = false; };
  }, [token]);

  const unlock = useCallback((next) => {
    storeToken(next);
    setRejected(false);
    setError('');
    setToken(next);
  }, []);

  const signOut = useCallback(() => {
    clearStoredToken();
    setToken('');
    setData(null);
    setError('');
    setRejected(false);
    setActiveTab(0);
  }, []);

  if (!token) return <TokenGate onSubmit={unlock} rejected={rejected} />;

  if (error) {
    return (
      <main className="partners-container">
        <div className="partners-card">
          <h1>Partner Portal</h1>
          <p className="error-msg" role="alert">{error}</p>
          {isPartnersConfigured() && (
            <button type="button" className="submit-btn" onClick={signOut}>
              Use a different token
            </button>
          )}
          <Link to="/" className="partners-back">&larr; Back to site</Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="partners-container">
        <div className="partners-card">
          <h1>Partner Portal</h1>
          <p role="status">Loading partner sheets…</p>
        </div>
      </main>
    );
  }

  const sheets = data.sheets;
  const activeSheet = sheets[activeTab];

  return (
    <div className="partners-dashboard-layout">
      <nav className="sidebar" aria-label="Partner sheets">
        <div className="sidebar-header">
          <h2>Recent Sheets</h2>
          <button type="button" className="sign-out-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
        <div className="tab-list">
          {sheets.length === 0 && (
            <p className="no-sheets">No sheets modified in the last 30 days.</p>
          )}
          {sheets.map((sheet, index) => (
            <button
              type="button"
              key={sheet.id}
              className={`tab-btn ${activeTab === index ? 'active' : ''}`}
              aria-current={activeTab === index ? 'true' : undefined}
              onClick={() => setActiveTab(index)}
              title={sheet.name}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      </nav>
      <main className="content-area">
        {activeSheet ? (
          <div className="sheet-view">
            <div className="sheet-header">
              <div>
                <h1 className="sheet-title">{activeSheet.name}</h1>
                <p className="sheet-meta">
                  Last updated: {new Date(activeSheet.lastUpdated).toLocaleString()}
                </p>
              </div>
              <a
                href={activeSheet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Open in Drive
              </a>
            </div>
            <SheetTable rows={activeSheet.rows} />
          </div>
        ) : (
          <div className="no-data">
            Select a sheet from the sidebar to view its data.
          </div>
        )}
      </main>
    </div>
  );
}

export default Partners;
