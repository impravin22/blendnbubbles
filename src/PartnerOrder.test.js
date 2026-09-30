import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import PartnerOrder from './PartnerOrder';
import { TOP_DRINK_NAMES } from './partnerOrderData';

const renderPage = (slug = 'oh-nails') =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/p/${slug}`]}>
        <Routes>
          <Route path="/p/:slug" element={<PartnerOrder />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

const sentMessage = () => {
  const link = screen.getByRole('link', { name: /send order on whatsapp/i });
  return decodeURIComponent(link.getAttribute('href').split('?text=')[1]);
};

const addTaro = () => userEvent.click(screen.getByRole('button', { name: 'Add one Royal Taro Mist cold' }));

describe('partner order page', () => {
  test('shows the partner, its code and all ten drinks', () => {
    renderPage();
    expect(screen.getByText('For Oh Nails clients')).toBeInTheDocument();
    expect(screen.getByText('Code BNB-OH-NAIL')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /fresh set\? fresh sip\./i })).toBeInTheDocument();
    TOP_DRINK_NAMES.forEach((name) => {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    });
  });

  test('uses copy that fits the kind of venue', () => {
    renderPage('artifice-studio');
    expect(screen.getByRole('heading', { name: /fresh ink\? cold drink\./i })).toBeInTheDocument();
    expect(screen.getByText('Code BNB-ARTIFICE')).toBeInTheDocument();
  });

  test('cannot send an empty order', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Pick at least one drink' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /send order on whatsapp/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove one Royal Taro Mist cold' })).toBeDisabled();
  });

  test('asks for a name before sending, and no studio field because the page knows the partner', () => {
    renderPage();
    addTaro();
    expect(screen.getByRole('button', { name: 'Add your name' })).toBeDisabled();
    expect(screen.queryByLabelText(/studio/i)).not.toBeInTheDocument();
  });

  test('below ₹199 it bills the full price and says how much more gets the discount', () => {
    renderPage();
    addTaro();
    expect(screen.getByTestId('partner-amount-to-pay')).toHaveTextContent('₹179');
    expect(screen.getByText('Add ₹20 more to get 15% off.')).toBeInTheDocument();
  });

  test('a complete order shows the discounted bill and sends it, tagged with the partner', () => {
    renderPage('headliners');
    addTaro();
    addTaro();
    userEvent.type(screen.getByLabelText('Your name'), 'Priya');

    expect(screen.getByTestId('partner-amount-to-pay')).toHaveTextContent('₹304');
    expect(screen.getByText('-₹54')).toBeInTheDocument();
    expect(screen.getByText('2 drinks · You pay ₹304')).toBeInTheDocument();
    // The hint is only true below the minimum; leaving it up next to an applied
    // discount would tell a qualifying customer to keep spending.
    expect(screen.queryByText(/more to get 15% off/i)).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /send order on whatsapp/i });
    expect(link.getAttribute('href').startsWith('https://wa.me/919330697501?text=')).toBe(true);
    const message = sentMessage();
    expect(message.startsWith('*BNB ORDER · BNB-HEADLINERS*\nPartner: Headliners\nName: Priya')).toBe(true);
    expect(message).toContain('2 x Royal Taro Mist (Cold) = ₹358');
    expect(message).toContain('*To pay: ₹304*');
  });

  test('carries the note through to the message, and omits it when blank', () => {
    renderPage();
    addTaro();
    userEvent.type(screen.getByLabelText('Your name'), 'Priya');
    expect(sentMessage()).not.toContain('Note:');

    userEvent.type(screen.getByLabelText('Note (optional)'), 'less ice');
    expect(sentMessage()).toContain('Note: less ice');
  });

  test('shows a stepper only for the temperatures a drink is actually sold at', () => {
    renderPage();
    // Cafe Mocha is cold-only on the menu; a hot stepper here would offer a
    // drink the shop does not make.
    expect(screen.getByRole('button', { name: 'Add one Cafe Mocha cold' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add one Cafe Mocha hot' })).not.toBeInTheDocument();
    // Caramel Boba Coffee is sold both ways, so both must be offered.
    expect(screen.getByRole('button', { name: 'Add one Caramel Boba Coffee cold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add one Caramel Boba Coffee hot' })).toBeInTheDocument();
  });

  test('removing the last drink takes the send link away again', () => {
    renderPage();
    userEvent.type(screen.getByLabelText('Your name'), 'Priya');
    userEvent.click(screen.getByRole('button', { name: 'Add one Cafe Mocha cold' }));
    expect(screen.getByRole('link', { name: /send order on whatsapp/i })).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: 'Remove one Cafe Mocha cold' }));
    expect(screen.getByRole('button', { name: 'Pick at least one drink' })).toBeDisabled();
  });

  test('an unknown partner shows a way to the menu instead of a broken page', () => {
    renderPage('not-a-partner');
    expect(screen.getByRole('heading', { name: /this offer link isn't active/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pick your drinks/i })).not.toBeInTheDocument();
  });
});
