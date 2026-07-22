import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HallOfFame from './HallOfFame';

// Fixed fixture rather than the generated table, so regenerating
// src/hallOfFameData.js never breaks these tests.
jest.mock('./hallOfFameData', () => ({
  SEASON: {
    players: 362,
    games: 905,
    goals: 4528,
    rejected: 1,
    weeks: 7,
    firstWeek: '2026-W24',
    lastWeek: '2026-W30',
    ceiling: 19,
    closedOn: '2026-07-22',
  },
  GOLDEN_BOOT: [
    { name: 'Arpan', team: 'JPN', goals: 304, games: 32, best: 17 },
    { name: 'Sania Bhowmick', team: 'ARG', goals: 187, games: 16, best: 17 },
    { name: 'Debraj Singha Roy', team: 'POR', goals: 153, games: 25, best: 13 },
    { name: 'Rahul', team: 'ARG', goals: 96, games: 7, best: 17 },
    { name: 'Spandy', team: 'POR', goals: 59, games: 13, best: 7 },
    { name: '<img src=x onerror=alert(1)>', team: null, goals: 12, games: 1, best: 12 },
  ],
  BEST_RUN: [
    { name: 'Emoji Player', team: 'ESP', goals: 36, games: 2, best: 19 },
    { name: 'Prasanna Thapa', team: 'ARG', goals: 21, games: 3, best: 19 },
    { name: 'Sania', team: 'ARG', goals: 88, games: 7, best: 18 },
    { name: 'Rija Adhikary', team: 'BRA', goals: 18, games: 1, best: 18 },
  ],
}));

const setup = () =>
  render(
    <MemoryRouter>
      <HallOfFame />
    </MemoryRouter>,
  );

const typeCode = (code) =>
  fireEvent.change(screen.getByLabelText(/access code/i), { target: { value: code } });

const submitCode = (code) => {
  if (code !== undefined) typeCode(code);
  fireEvent.click(screen.getByRole('button', { name: /open the hall of fame/i }));
};

const selectTab = (name) => fireEvent.click(screen.getByRole('tab', { name }));

const pressArrow = (key) => {
  const selected = screen.getByRole('tab', { selected: true });
  selected.focus();
  fireEvent.keyDown(selected, { key });
};

const openBoard = () => {
  window.localStorage.setItem('bnbHallOfFameUnlocked', 'true');
  return setup();
};

beforeEach(() => {
  window.localStorage.clear();
  document.title = '';
});

describe('closed-season gate', () => {
  it('shows the closed message instead of the game', () => {
    setup();

    expect(screen.getByRole('heading', { name: /the shootout is closed/i })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('states the season totals so the page says something even while locked', () => {
    setup();
    expect(screen.getByText(/7 weeks, 362 players/i)).toBeInTheDocument();
  });

  it('sets a page title distinct from the unlocked one', () => {
    setup();
    expect(document.title).toMatch(/shootout is closed/i);
  });

  it('rejects a wrong code with an alert and marks the field invalid', () => {
    setup();

    submitCode('NOPE');

    expect(screen.getByRole('alert')).toHaveTextContent(/that code isn’t right/i);
    expect(screen.getByLabelText(/access code/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('clears the error once the field is edited again', () => {
    setup();

    submitCode('NOPE');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    typeCode('NOPE2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not unlock on an empty submission', () => {
    setup();

    submitCode();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it.each([['FIFA'], ['fifa'], ['FiFa'], ['  fifa  ']])(
    'accepts %s, so case and stray spaces do not lock a customer out',
    (code) => {
      setup();

      submitCode(code);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    },
  );

  it('remembers the unlock so a returning visitor is not asked twice', () => {
    setup();

    submitCode('FIFA');

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(window.localStorage.getItem('bnbHallOfFameUnlocked')).toBe('true');
  });

  it('opens straight to the board when already unlocked', () => {
    openBoard();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('still unlocks when storage is unavailable, as in private mode', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    try {
      setup();
      submitCode('FIFA');

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe('board', () => {
  it('sets the unlocked page title', () => {
    openBoard();
    expect(document.title).toMatch(/hall of fame/i);
  });

  it('renders the season totals', () => {
    openBoard();

    expect(screen.getByText('362')).toBeInTheDocument();
    expect(screen.getByText('905')).toBeInTheDocument();
    expect(screen.getByText('4,528')).toBeInTheDocument();
  });

  it('opens on the Golden Boot table', () => {
    openBoard();

    expect(screen.getByRole('tab', { name: /golden boot/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: /rank 1: arpan/i })).toBeInTheDocument();
    expect(screen.getByText('304')).toBeInTheDocument();
  });

  it('numbers the ledger from four, continuing the podium', () => {
    openBoard();

    const items = within(screen.getByRole('list')).getAllByRole('listitem');

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Rahul');
    expect(items[0]).toHaveTextContent('4');
  });

  it('switches to Best Run and swaps the table', () => {
    openBoard();

    selectTab(/best run/i);

    expect(screen.getByRole('heading', { name: /rank 1: emoji player/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /rank 1: arpan/i })).not.toBeInTheDocument();
  });

  it('shows the streak, not the career total, as the headline figure on Best Run', () => {
    openBoard();

    selectTab(/best run/i);

    const seat = screen.getByRole('article', { name: /rank 1: emoji player/i });
    expect(seat).toHaveTextContent('19');
    expect(seat).toHaveTextContent('36 goals in total');
  });

  it('moves between tabs with arrow keys, taking focus with the selection', () => {
    openBoard();

    pressArrow('ArrowRight');
    expect(screen.getByRole('tab', { name: /best run/i })).toHaveAttribute('aria-selected', 'true');
    // Roving focus is half the tablist contract: without it a keyboard user
    // selects a tab and their focus stays behind on the old one.
    expect(screen.getByRole('tab', { name: /best run/i })).toHaveFocus();

    pressArrow('ArrowLeft');
    expect(screen.getByRole('tab', { name: /golden boot/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /golden boot/i })).toHaveFocus();
  });

  it('names the first-place medal after the award that table confers', () => {
    openBoard();

    // The Golden Boot belongs to the career-goals leader. Badging the streak
    // leader with it would hand them another player's title.
    expect(screen.getByRole('article', { name: /rank 1: arpan/i })).toHaveTextContent('Golden Boot');

    selectTab(/best run/i);

    const streakLeader = screen.getByRole('article', { name: /rank 1: emoji player/i });
    expect(streakLeader).toHaveTextContent('Longest Run');
    expect(streakLeader).not.toHaveTextContent('Golden Boot');
  });

  it('keeps Silver and Bronze on the runners-up regardless of tab', () => {
    openBoard();

    expect(screen.getByRole('article', { name: /rank 2:/i })).toHaveTextContent('Silver');
    expect(screen.getByRole('article', { name: /rank 3:/i })).toHaveTextContent('Bronze');
  });

  it('re-announces a rejection when the same wrong code is submitted twice', () => {
    window.localStorage.clear();
    setup();

    submitCode('NOPE');
    const first = screen.getByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: /open the hall of fame/i }));

    // A fresh node, not the same one left in place — assistive tech only
    // announces an alert that is newly inserted.
    expect(screen.getByRole('alert')).not.toBe(first);
  });

  it('points aria-controls only at a panel that exists', () => {
    openBoard();

    const selected = screen.getByRole('tab', { selected: true });
    expect(selected).toHaveAttribute('aria-controls', 'panel-golden-boot');
    expect(screen.getByRole('tab', { name: /best run/i })).not.toHaveAttribute('aria-controls');
  });

  it('wraps arrow navigation around the ends of the tablist', () => {
    openBoard();

    pressArrow('ArrowLeft');

    expect(screen.getByRole('tab', { name: /best run/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('ignores keys that are not arrows', () => {
    openBoard();

    pressArrow('Enter');

    expect(screen.getByRole('tab', { name: /golden boot/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps only the selected tab in the tab order', () => {
    openBoard();

    expect(screen.getByRole('tab', { name: /golden boot/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /best run/i })).toHaveAttribute('tabindex', '-1');
  });

  it('links the panel to its tab', () => {
    openBoard();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-golden-boot');
  });

  it('renders a player name as text, never as markup', () => {
    openBoard();

    // React escapes by default; this asserts the guarantee holds for a name a
    // customer could really have typed into the score form. Matching the exact
    // string as a text node is the proof: had it been parsed as HTML there
    // would be an <img> element and no text node to find.
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.queryAllByRole('img', { name: '' })).toHaveLength(0);
  });

  it('labels each flag with its nation for screen readers', () => {
    openBoard();
    expect(screen.getAllByRole('img', { name: 'Japan' }).length).toBeGreaterThan(0);
  });

  it('falls back to a neutral label when no nation was recorded', () => {
    openBoard();
    expect(screen.getByRole('img', { name: 'No team' })).toBeInTheDocument();
  });

  it('footnotes the dropped over-ceiling submission', () => {
    openBoard();

    expect(screen.getByText(/one submission was dropped/i)).toBeInTheDocument();
  });

  it('explains the ceiling on the Best Run table', () => {
    openBoard();

    selectTab(/best run/i);

    expect(screen.getByText(/is the ceiling/i)).toBeInTheDocument();
  });

  it('offers a way back to the site', () => {
    openBoard();
    expect(screen.getByRole('link', { name: /blendnbubbles\.com/i })).toHaveAttribute('href', '/');
  });
});
