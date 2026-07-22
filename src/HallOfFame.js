import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BEST_RUN, GOLDEN_BOOT, SEASON } from './hallOfFameData';
import { getTeamByCode } from './teams';
import './HallOfFame.css';

// The code handed out at the counter.
//
// This is a novelty, NOT a security control, and nothing here should be read as
// one. It ships in the JS bundle where anyone can read it out, and the data
// behind it is public regardless: firestore.rules has `allow read: if true` on
// `leaderboard`, so the same names can be fetched straight from Firestore
// without visiting this page at all.
//
// That is exactly why a client-side check is acceptable here and was not
// acceptable for /reports. The reports passcode `boba2026` guarded item-level
// revenue and shipped in the same bundle as the 319KB it claimed to protect —
// it was a lock drawn on the door of an open room. This gate guards nothing
// private: no phone numbers, no contact details (those live in `contacts`,
// which clients may append to and may never read back). It exists so the shop
// has something to hand out, not to keep anyone out.
//
// If anything genuinely private is ever put on this page, this constant is not
// the thing to strengthen — move the data behind the Worker pattern in
// services/reports, where the token is a server-side secret.
const ACCESS_CODE = 'FIFA';

const STORAGE_KEY = 'bnbHallOfFameUnlocked';

// The first-place badge names the award that table actually confers, so it has
// to live per-tab: the Golden Boot belongs to the career-goals leader, and
// badging the streak leader with it would award them someone else's title.
// Second and third are shared — they are places, not titles.
const RUNNER_UP_MEDALS = ['Silver', 'Bronze'];

const TABS = [
  {
    id: 'golden-boot',
    label: 'Golden Boot',
    hint: 'Every goal scored across all seven weeks — the career table.',
    rows: GOLDEN_BOOT,
    metric: 'goals',
    unit: 'goals',
    topMedal: 'Golden Boot',
  },
  {
    id: 'best-run',
    label: 'Best Run',
    hint: 'Longest unbroken streak in a single game.',
    rows: BEST_RUN,
    metric: 'best',
    unit: 'streak',
    topMedal: 'Longest Run',
  },
];

function medalFor(rank, tab) {
  return rank === 1 ? tab.topMedal : RUNNER_UP_MEDALS[rank - 2];
}

function readUnlocked() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Private mode or blocked storage: the page still works, the code just has
    // to be entered again on the next visit.
    return false;
  }
}

function rememberUnlocked() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Not fatal — the in-memory state has already unlocked this visit.
  }
}

function flagFor(code) {
  return getTeamByCode(code)?.flag ?? '⚽';
}

function nationFor(code) {
  return getTeamByCode(code)?.name ?? code ?? 'No team';
}

function subtitleFor(player, tabId) {
  const games = `${player.games} game${player.games === 1 ? '' : 's'}`;
  return tabId === 'golden-boot'
    ? `${games} · best run ${player.best}`
    : `${games} · ${player.goals} goals in total`;
}

function Seat({ player, rank, tab }) {
  // Names the whole seat after its heading, so the podium reads as three
  // labelled regions rather than one undifferentiated block.
  const headingId = `${tab.id}-seat-${rank}`;

  return (
    <article className={`hof-seat hof-seat-${rank}`} aria-labelledby={headingId}>
      <div className="hof-seat-num" aria-hidden="true">
        {rank}
      </div>
      <div className="hof-seat-flag" role="img" aria-label={nationFor(player.team)}>
        {flagFor(player.team)}
      </div>
      <div className="hof-seat-who">
        <span className="hof-medal">{medalFor(rank, tab)}</span>
        {/* First division under the page h1, so h2 — no level is skipped. */}
        <h2 className="hof-seat-name" id={headingId}>
          <span className="hof-sr">Rank {rank}: </span>
          {player.name}
        </h2>
        <p className="hof-seat-meta">{subtitleFor(player, tab.id)}</p>
      </div>
      <div className="hof-seat-tally">
        <div className="hof-tally-v">{player[tab.metric]}</div>
        <div className="hof-tally-l">{tab.unit}</div>
      </div>
    </article>
  );
}

function LedgerRow({ player, rank, tab }) {
  return (
    <li className="hof-row">
      <span className="hof-row-num">{rank}</span>
      <span className="hof-row-flag" role="img" aria-label={nationFor(player.team)}>
        {flagFor(player.team)}
      </span>
      <span className="hof-row-who">
        <span className="hof-row-name">{player.name}</span>
        <span className="hof-row-meta">{subtitleFor(player, tab.id)}</span>
      </span>
      <span className="hof-row-tally">
        {player[tab.metric]}
        <span className="hof-sr"> {tab.unit}</span>
      </span>
    </li>
  );
}

function ClosedGate({ onUnlock }) {
  const [code, setCode] = useState('');
  // Counts rejections rather than flagging one, so the alert node is genuinely
  // re-inserted on a second wrong try. A boolean stays true, React reuses the
  // element, and a screen reader announces nothing the second time.
  const [rejections, setRejections] = useState(0);
  const rejected = rejections > 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (code.trim().toUpperCase() === ACCESS_CODE) {
      onUnlock();
      return;
    }
    setRejections((count) => count + 1);
  };

  return (
    <div className="hof-gate">
      <form className="hof-gate-card" onSubmit={handleSubmit}>
        <p className="hof-whistle">BnB World Cup · Full time</p>
        <h1 className="hof-gate-title">The shootout is closed</h1>
        <p className="hof-gate-sub">
          {SEASON.weeks} weeks, {SEASON.players} players, {SEASON.goals.toLocaleString('en-IN')}{' '}
          goals. The all-time scorers are behind the code — ask at the counter for it.
        </p>
        <label className="hof-sr" htmlFor="hof-code">
          Access code
        </label>
        <input
          className="hof-gate-input"
          id="hof-code"
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setRejections(0);
          }}
          placeholder="Enter code"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={24}
          aria-invalid={rejected}
          aria-describedby={rejected ? 'hof-code-error' : undefined}
        />
        {rejected && (
          <p className="hof-gate-err" id="hof-code-error" role="alert" key={rejections}>
            That code isn’t right. Ask at the counter.
          </p>
        )}
        <button className="hof-gate-btn" type="submit">
          Open the Hall of Fame
        </button>
        <Link className="hof-gate-back" to="/">
          ← Back to blendnbubbles.com
        </Link>
      </form>
    </div>
  );
}

function Board() {
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tabRefs = useRef({});
  const tab = TABS.find((t) => t.id === activeId) ?? TABS[0];

  const podium = tab.rows.slice(0, 3);
  const ledger = tab.rows.slice(3);

  // Left/right arrows move between tabs, as the tablist pattern expects.
  const handleKeyDown = useCallback((event) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (offset === 0) return;
    event.preventDefault();
    setActiveId((current) => {
      const index = TABS.findIndex((t) => t.id === current);
      const next = TABS[(index + offset + TABS.length) % TABS.length];
      tabRefs.current[next.id]?.focus();
      return next.id;
    });
  }, []);

  return (
    <div className="hof-page">
      <header className="hof-top">
        <div>
          <p className="hof-eyebrow">BnB World Cup · Season closed</p>
          <h1 className="hof-h1">Hall of Fame</h1>
        </div>
        <Link className="hof-home" to="/">
          ← blendnbubbles.com
        </Link>
      </header>

      {/* dt precedes dd as the spec requires; the cell is column-reverse so the
          figure still reads above its label. */}
      <dl className="hof-strip">
        <div className="hof-strip-cell">
          <dt className="hof-strip-l">Players</dt>
          <dd className="hof-strip-v">{SEASON.players}</dd>
        </div>
        <div className="hof-strip-cell">
          <dt className="hof-strip-l">Games</dt>
          <dd className="hof-strip-v">{SEASON.games}</dd>
        </div>
        <div className="hof-strip-cell">
          <dt className="hof-strip-l">Goals</dt>
          <dd className="hof-strip-v">{SEASON.goals.toLocaleString('en-IN')}</dd>
        </div>
        <div className="hof-strip-cell">
          <dt className="hof-strip-l">Weeks</dt>
          <dd className="hof-strip-v">{SEASON.weeks}</dd>
        </div>
      </dl>

      <div className="hof-tabs" role="tablist" aria-label="Ranking">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            className="hof-tab"
            type="button"
            role="tab"
            aria-selected={t.id === activeId}
            // Only the active panel is in the DOM, so pointing the inactive
            // tab at it would leave a dangling IDREF.
            aria-controls={t.id === activeId ? `panel-${t.id}` : undefined}
            tabIndex={t.id === activeId ? 0 : -1}
            ref={(node) => {
              tabRefs.current[t.id] = node;
            }}
            onClick={() => setActiveId(t.id)}
            onKeyDown={handleKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="hof-panel"
        id={`panel-${tab.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab.id}`}
        tabIndex={-1}
      >
        <p className="hof-hint">{tab.hint}</p>

        <div className="hof-podium">
          {podium.map((player, index) => (
            <Seat key={`${tab.id}-${index}`} player={player} rank={index + 1} tab={tab} />
          ))}
        </div>

        {/* The role IS redundant per spec, which is what the lint rule checks —
            but WebKit strips list semantics from any list styled
            list-style: none, and .hof-ledger is. Without this, VoiceOver on
            Safari does not announce ranks 4–10 as a list at all. */}
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
        <ol className="hof-ledger" start={4} role="list">
          {ledger.map((player, index) => (
            <LedgerRow key={`${tab.id}-${index}`} player={player} rank={index + 4} tab={tab} />
          ))}
        </ol>

        <div className="hof-foot">
          {tab.id === 'golden-boot' ? (
            <>
              <p>
                Players are matched by device where one was recorded, otherwise by name — so the
                same person on two phones may appear twice.
              </p>
              <p>
                {SEASON.rejected === 1
                  ? 'One submission was dropped for scoring above the ceiling: '
                  : `${SEASON.rejected} submissions were dropped for scoring above the ceiling: `}
                the most any player can actually reach is {SEASON.ceiling}.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>{SEASON.ceiling} is the ceiling.</strong> From kick 11 the keeper starts
                reading the shot, and by kick 20 the widest gap a player can open has fallen below
                the keeper’s reach — nobody can score it.
              </p>
              <p>Among players level on streak, more career goals ranks higher.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HallOfFame() {
  const [unlocked, setUnlocked] = useState(readUnlocked);

  useEffect(() => {
    document.title = unlocked
      ? 'Hall of Fame - BnB World Cup | BlendNBubbles'
      : 'The shootout is closed - BnB World Cup | BlendNBubbles';
  }, [unlocked]);

  const handleUnlock = useCallback(() => {
    rememberUnlocked();
    setUnlocked(true);
  }, []);

  return (
    <main className="hof-root">
      {unlocked ? <Board /> : <ClosedGate onUnlock={handleUnlock} />}
    </main>
  );
}
