// The load-bearing property: this page holds customer names and phone numbers,
// so nothing may render before the server has accepted a token, and no bundled
// constant may decide that. These tests assert the page cannot show data
// without a successful fetch, and that the fetch is what gates it.

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Partners from './Partners';
import * as partnersClient from './partnersClient';

const EXTRACT = {
  generatedAt: '2026-08-10T00:00:00.000Z',
  sheets: [
    {
      id: 'sheet-events',
      name: 'BnB Event Requests',
      lastUpdated: '2026-08-09T10:00:00.000Z',
      url: 'https://docs.google.com/spreadsheets/d/sheet-events',
      rows: [
        ['Name', 'Organisation', 'Phone'],
        // Non-dialable on purpose: a realistic-looking Indian mobile in a
        // public repo is one that might belong to somebody.
        ['Ananya Sen', 'TCS Gitanjali Park', '+91 00000 00000'],
        // Ragged: Sheets omits trailing empty cells.
        ['Rahul Das'],
      ],
    },
    {
      id: 'sheet-spins',
      name: 'BnB Anniversary Spins',
      lastUpdated: '2026-08-08T10:00:00.000Z',
      url: 'https://docs.google.com/spreadsheets/d/sheet-spins',
      rows: [['Ticket', 'Prize'], ['A-100', 'Free topping']],
    },
  ],
};

const renderPartners = () =>
  render(
    <MemoryRouter initialEntries={['/partners']}>
      <Partners />
    </MemoryRouter>,
  );

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('the gate', () => {
  it('shows the token prompt when no token is stored', () => {
    renderPartners();
    expect(screen.getByRole('heading', { name: /partner portal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/access token/i)).toBeInTheDocument();
  });

  it('renders no sheet data before a token is accepted', () => {
    renderPartners();
    expect(screen.queryByText(/BnB Event Requests/)).not.toBeInTheDocument();
    expect(screen.queryByText('+91 00000 00000')).not.toBeInTheDocument();
  });

  it('does not fetch until a token is submitted', () => {
    const spy = jest.spyOn(partnersClient, 'fetchPartnerSheets');
    renderPartners();
    expect(spy).not.toHaveBeenCalled();
  });

  it('submits the typed token to the server rather than checking it locally', async () => {
    const spy = jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: EXTRACT });
    renderPartners();

    await userEvent.type(screen.getByLabelText(/access token/i), 'owner-token');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /unlock dashboard/i }));
    });

    await waitFor(() => expect(spy).toHaveBeenCalledWith('owner-token'));
    await screen.findByRole('heading', { name: 'BnB Event Requests' });
  });

  it('rejects an empty submission without calling the server', async () => {
    const spy = jest.spyOn(partnersClient, 'fetchPartnerSheets');
    renderPartners();
    await userEvent.click(screen.getByRole('button', { name: /unlock dashboard/i }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('clears a server-rejected token so the prompt returns instead of looping', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'unauthorised' });
    renderPartners();

    await userEvent.type(screen.getByLabelText(/access token/i), 'wrong-token');
    // The rejection path updates three pieces of state from the fetch callback.
    // Settling the click inside act() keeps those updates in the same scope
    // rather than landing after it closes.
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /unlock dashboard/i }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i);
    expect(window.localStorage.getItem(partnersClient.TOKEN_KEY)).toBeNull();
    expect(screen.getByLabelText(/access token/i)).toBeInTheDocument();
  });

  it('keeps an accepted token so a reload does not re-prompt', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: EXTRACT });
    renderPartners();

    await userEvent.type(screen.getByLabelText(/access token/i), 'owner-token');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /unlock dashboard/i }));
    });

    await screen.findByRole('heading', { name: 'BnB Event Requests' });
    expect(window.localStorage.getItem(partnersClient.TOKEN_KEY)).toBe('owner-token');
  });
});

describe('the dashboard', () => {
  beforeEach(() => {
    window.localStorage.setItem(partnersClient.TOKEN_KEY, 'owner-token');
  });

  it('renders the first sheet once the server returns data', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: EXTRACT });
    renderPartners();

    expect(await screen.findByRole('heading', { name: 'BnB Event Requests' })).toBeInTheDocument();
    expect(screen.getByText('Ananya Sen')).toBeInTheDocument();
  });

  it('pads ragged rows to the header width rather than shearing the table', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: EXTRACT });
    renderPartners();

    await screen.findByText('Rahul Das');
    const rows = screen.getAllByRole('row');
    // Header + two body rows, every one three cells wide.
    expect(rows).toHaveLength(3);
    rows.slice(1).forEach((row) => {
      expect(row.querySelectorAll('td')).toHaveLength(3);
    });
  });

  it('switches sheets when a sidebar tab is chosen', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: EXTRACT });
    renderPartners();

    await screen.findByRole('heading', { name: 'BnB Event Requests' });
    await userEvent.click(screen.getByRole('button', { name: /BnB Anniversary Spins/ }));

    expect(await screen.findByRole('heading', { name: 'BnB Anniversary Spins' })).toBeInTheDocument();
    expect(screen.queryByText('Ananya Sen')).not.toBeInTheDocument();
  });

  it('signing out drops the token and every rendered row', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: EXTRACT });
    renderPartners();

    await screen.findByText('Ananya Sen');
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(window.localStorage.getItem(partnersClient.TOKEN_KEY)).toBeNull();
    expect(screen.queryByText('Ananya Sen')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/access token/i)).toBeInTheDocument();
  });

  it('renders an empty extract as a stated result, not a broken page', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: { sheets: [] } });
    renderPartners();

    expect(await screen.findByText(/no sheets modified in the last 30 days/i)).toBeInTheDocument();
  });
});

describe('failure states stay distinguishable', () => {
  beforeEach(() => {
    window.localStorage.setItem(partnersClient.TOKEN_KEY, 'owner-token');
  });

  it('names the cause when the service is unreachable', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'unavailable', detail: 'server returned 503' });
    renderPartners();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/server returned 503/i);
  });

  it('names the missing build variable when unconfigured', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'unconfigured' });
    renderPartners();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/REACT_APP_PARTNERS_URL/);
  });

  it('shows no sheet data on any failure', async () => {
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'unavailable', detail: 'network error' });
    renderPartners();

    await screen.findByRole('alert');
    expect(screen.queryByText('Ananya Sen')).not.toBeInTheDocument();
  });
});

describe('search engines', () => {
  const mountWithData = () => {
    window.localStorage.setItem(partnersClient.TOKEN_KEY, 'owner-token');
    jest
      .spyOn(partnersClient, 'fetchPartnerSheets')
      .mockResolvedValue({ status: 'ok', data: EXTRACT });
    return renderPartners();
  };

  const robotsTags = () =>
    [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content);

  afterEach(() => {
    document.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
  });

  it('marks the portal noindex while it is mounted, and cleans up after', async () => {
    const { unmount } = mountWithData();

    await screen.findByText('Ananya Sen');
    expect(robotsTags()).toEqual(['noindex,nofollow']);

    unmount();
    expect(robotsTags()).toEqual([]);
  });

  it('overrides an existing robots tag rather than adding a second one', async () => {
    // index.html ships `<meta name="robots" content="index, follow">`. Two tags
    // in the head leaves the outcome to crawler policy; there must be exactly
    // one, and it must say noindex.
    const shipped = document.createElement('meta');
    shipped.name = 'robots';
    shipped.content = 'index, follow';
    document.head.appendChild(shipped);

    const { unmount } = mountWithData();
    await screen.findByText('Ananya Sen');

    expect(robotsTags()).toEqual(['noindex,nofollow']);

    // Leaving the site must hand the marketing pages back their indexable tag.
    unmount();
    expect(robotsTags()).toEqual(['index, follow']);
  });
});
