import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Events from './Events';
import * as eventsClient from './eventsClient';

jest.mock('./eventsClient');

const renderEvents = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/events']}>
        <Events />
      </MemoryRouter>
    </ThemeProvider>
  );

const fillRequired = () => {
  fireEvent.change(screen.getByLabelText(/name \*/i), { target: { value: 'Ananya Sen' } });
  fireEvent.change(screen.getByLabelText(/email \*/i), { target: { value: 'ananya@example.com' } });
  fireEvent.change(screen.getByLabelText(/phone number \*/i), { target: { value: '+91 98301 22334' } });
  fireEvent.change(screen.getByLabelText(/event type \*/i), { target: { value: 'College fest' } });
  fireEvent.change(screen.getByLabelText(/event date \*/i), { target: { value: '2026-09-14' } });
  fireEvent.change(screen.getByLabelText(/approx\. guests \*/i), { target: { value: '100 – 250' } });
};

beforeEach(() => {
  jest.clearAllMocks();
  eventsClient.isEventsEnabled.mockReturnValue(true);
  eventsClient.submitEventRequest.mockResolvedValue({ status: 'sent' });
  window.scrollTo = jest.fn();
});

describe('Events page', () => {
  it('renders the hero and the form with labelled fields', () => {
    renderEvents();
    expect(screen.getByRole('heading', { name: /bubble tea for your big day/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/event type \*/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send event request/i })).toBeInTheDocument();
  });

  it('sets the document title for the route', () => {
    renderEvents();
    expect(document.title).toMatch(/event requests - blendnbubbles/i);
  });

  it('blocks submission and shows per-field errors when required fields are empty', async () => {
    renderEvents();
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(screen.getByText(/please tell us your name/i)).toBeInTheDocument();
    expect(eventsClient.submitEventRequest).not.toHaveBeenCalled();
  });

  it('rejects a malformed email with a field error', async () => {
    renderEvents();
    fillRequired();
    fireEvent.change(screen.getByLabelText(/email \*/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByText(/does not look right/i)).toBeInTheDocument();
    expect(eventsClient.submitEventRequest).not.toHaveBeenCalled();
  });

  it('submits and shows the success card on a sent reply', async () => {
    renderEvents();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByRole('heading', { name: /request received/i })).toBeInTheDocument();
    expect(screen.getByText(/2026-09-14/)).toBeInTheDocument();
    expect(eventsClient.submitEventRequest).toHaveBeenCalledTimes(1);
    expect(eventsClient.submitEventRequest.mock.calls[0][0]).toMatchObject({
      name: 'Ananya Sen',
      eventType: 'College fest',
      guests: '100 – 250',
    });
  });

  it('shows the error banner and keeps typed values on an unavailable reply', async () => {
    eventsClient.submitEventRequest.mockResolvedValue({ status: 'unavailable' });
    renderEvents();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByText(/couldn't send your request/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name \*/i)).toHaveValue('Ananya Sen');
    expect(screen.getByRole('button', { name: /send event request/i })).toBeEnabled();
  });

  it('shows the not-live-yet fallback when no webhook is configured', async () => {
    eventsClient.isEventsEnabled.mockReturnValue(false);
    renderEvents();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByText(/isn't live just yet/i)).toBeInTheDocument();
    expect(eventsClient.submitEventRequest).not.toHaveBeenCalled();
  });

  it('disables the submit button while a request is in flight', async () => {
    let resolveSubmit;
    eventsClient.submitEventRequest.mockReturnValue(
      new Promise((resolve) => { resolveSubmit = resolve; })
    );
    renderEvents();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByRole('button', { name: /sending your request/i })).toBeDisabled();
    resolveSubmit({ status: 'sent' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /request received/i })).toBeInTheDocument()
    );
  });

  it('rejects a past event date with a field error', async () => {
    renderEvents();
    fillRequired();
    fireEvent.change(screen.getByLabelText(/event date \*/i), { target: { value: '2020-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByText(/upcoming date/i)).toBeInTheDocument();
    expect(eventsClient.submitEventRequest).not.toHaveBeenCalled();
  });

  it('clears a stale error banner when a later attempt fails client-side validation', async () => {
    eventsClient.submitEventRequest.mockResolvedValue({ status: 'unavailable' });
    renderEvents();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByText(/couldn't send your request/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/name \*/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    expect(await screen.findByText(/please tell us your name/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't send your request/i)).not.toBeInTheDocument();
  });

  it('keeps the honeypot out of the accessibility tree and tab order', () => {
    renderEvents();
    const hp = document.getElementById('ev-hp');
    expect(hp).toBeTruthy();
    expect(hp).toHaveAttribute('tabindex', '-1');
    expect(hp.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('escapes hostile input rather than rendering it as markup', async () => {
    renderEvents();
    fillRequired();
    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: '<img src=x onerror=alert(1)>' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send event request/i }));
    await screen.findByRole('heading', { name: /request received/i });
    // The success card interpolates the first "word" of the name — the raw
    // string must appear as text, never as an element.
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
