import React, { useMemo, useState } from 'react';
import { TEAMS, FEATURED_TEAMS } from './teams';
import './TeamSelectScreen.css';

// Small kit preview: two stacked colour bars (jersey + accent) so a player can
// see the colours they will wear before kicking off.
function KitSwatch({ primary, secondary }) {
  return (
    <span className="ts-swatch" aria-hidden="true">
      <span className="ts-swatch-bar" style={{ background: primary }} />
      <span className="ts-swatch-bar" style={{ background: secondary }} />
    </span>
  );
}

function TeamSelectScreen({ onPick, onBack, initialCode }) {
  const [selected, setSelected] = useState(
    () => TEAMS.find((t) => t.code === initialCode) || null,
  );
  // Default view shows only the fan favourites; "Others" reveals the full field.
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEAMS;
    return TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q),
    );
  }, [query]);

  const otherCount = TEAMS.length - FEATURED_TEAMS.length;

  const handleKickOff = () => {
    if (selected) onPick(selected);
  };

  return (
    <div className="pen-screen ts-screen">
      <div className="ts-content">
        <button type="button" className="ts-back" onClick={onBack}>
          ‹ Back
        </button>

        <h1 className="ts-title">Pick Your Nation</h1>
        <p className="ts-subtitle">Wear your colours. Your striker takes the field in this kit.</p>

        {!showAll ? (
          <>
            {/* Default: the fan favourites only */}
            <p className="ts-section-label">Fan favourites</p>
            <div className="ts-featured-grid">
              {FEATURED_TEAMS.map((team) => {
                const active = selected?.code === team.code;
                return (
                  <button
                    key={team.code}
                    type="button"
                    className={`ts-featured-card ${active ? 'ts-active' : ''}`}
                    onClick={() => setSelected(team)}
                    aria-pressed={active}
                  >
                    <span className="ts-flag" aria-hidden="true">{team.flag}</span>
                    <span className="ts-name">{team.name}</span>
                    <KitSwatch primary={team.primary} secondary={team.secondary} />
                  </button>
                );
              })}
            </div>

            <button type="button" className="ts-others-btn" onClick={() => setShowAll(true)}>
              Others — {otherCount} more nations ›
            </button>
          </>
        ) : (
          <>
            {/* Expanded: search across the full 48-team field */}
            <div className="ts-list-head">
              <p className="ts-section-label">All {TEAMS.length} nations</p>
              <button
                type="button"
                className="ts-collapse-btn"
                onClick={() => { setShowAll(false); setQuery(''); }}
              >
                ‹ Favourites
              </button>
            </div>
            <input
              className="ts-search"
              type="text"
              inputMode="search"
              placeholder="Search nations…"
              aria-label="Search nations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="ts-list" role="listbox" aria-label="Nations">
              {results.length === 0 ? (
                <p className="ts-empty">No nation matches “{query}”.</p>
              ) : (
                results.map((team) => {
                  const active = selected?.code === team.code;
                  return (
                    <button
                      key={team.code}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`ts-chip ${active ? 'ts-active' : ''}`}
                      onClick={() => setSelected(team)}
                    >
                      <span className="ts-chip-flag" aria-hidden="true">{team.flag}</span>
                      <span className="ts-chip-name">{team.name}</span>
                      <span className="ts-chip-code">{team.code}</span>
                      <KitSwatch primary={team.primary} secondary={team.secondary} />
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Sticky kick-off bar */}
      <div className="ts-kickoff-bar">
        {selected ? (
          <span className="ts-kickoff-team">
            <span aria-hidden="true">{selected.flag}</span> {selected.name}
          </span>
        ) : (
          <span className="ts-kickoff-hint">Tap a nation to choose your team</span>
        )}
        <button
          type="button"
          className="ts-kickoff-btn"
          onClick={handleKickOff}
          disabled={!selected}
        >
          {selected ? `Kick Off as ${selected.code}` : 'Pick a team'}
        </button>
      </div>
    </div>
  );
}

export default TeamSelectScreen;
