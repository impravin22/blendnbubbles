import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import NailOrder from './NailOrder';
import { TOP_DRINK_NAMES } from './nailOrderData';

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/nail']}>
        <NailOrder />
      </MemoryRouter>
    </ThemeProvider>
  );

const sentMessage = () => {
  const link = screen.getByRole('link', { name: /send order on whatsapp/i });
  return decodeURIComponent(link.getAttribute('href').split('?text=')[1]);
};

describe('/nail order page', () => {
  test('shows the coupon and all ten drinks', () => {
    renderPage();
    expect(screen.getByText('Code BNB-NAIL15')).toBeInTheDocument();
    TOP_DRINK_NAMES.forEach((name) => {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    });
  });

  test('cannot send an empty order', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Pick at least one drink' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /send order on whatsapp/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove one Royal Taro Mist cold' })).toBeDisabled();
  });

  test('asks for the name and studio before sending', () => {
    renderPage();
    userEvent.click(screen.getByRole('button', { name: 'Add one Royal Taro Mist cold' }));
    expect(screen.getByRole('button', { name: 'Add your name' })).toBeDisabled();
    userEvent.type(screen.getByLabelText('Your name'), 'Priya');
    expect(screen.getByRole('button', { name: 'Add your nail studio' })).toBeDisabled();
  });

  test('below ₹199 it bills the full price and says how much more gets the discount', () => {
    renderPage();
    userEvent.click(screen.getByRole('button', { name: 'Add one Royal Taro Mist cold' }));
    expect(screen.getByTestId('nail-amount-to-pay')).toHaveTextContent('₹179');
    expect(screen.getByText('Add ₹20 more to get 15% off.')).toBeInTheDocument();
  });

  test('a complete order shows the discounted bill and sends it to WhatsApp', () => {
    renderPage();
    const addTaro = screen.getByRole('button', { name: 'Add one Royal Taro Mist cold' });
    userEvent.click(addTaro);
    userEvent.click(addTaro);
    userEvent.type(screen.getByLabelText('Your name'), 'Priya');
    userEvent.type(screen.getByLabelText('Nail studio'), 'Glossy Tips');

    expect(screen.getByTestId('nail-amount-to-pay')).toHaveTextContent('₹304');
    expect(screen.getByText('-₹54')).toBeInTheDocument();
    expect(screen.getByText('2 drinks · You pay ₹304')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /send order on whatsapp/i });
    expect(link.getAttribute('href').startsWith('https://wa.me/919330697501?text=')).toBe(true);
    const message = sentMessage();
    expect(message.startsWith('*NAIL ORDER · BNB-NAIL15*')).toBe(true);
    expect(message).toContain('Studio: Glossy Tips');
    expect(message).toContain('2 x Royal Taro Mist (Cold) = ₹358');
    expect(message).toContain('*To pay: ₹304*');
  });

  test('carries the note through to the message, and omits it when blank', () => {
    renderPage();
    userEvent.click(screen.getByRole('button', { name: 'Add one Royal Taro Mist cold' }));
    userEvent.type(screen.getByLabelText('Your name'), 'Priya');
    userEvent.type(screen.getByLabelText('Nail studio'), 'Glossy Tips');
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
    userEvent.type(screen.getByLabelText('Nail studio'), 'Glossy Tips');
    userEvent.click(screen.getByRole('button', { name: 'Add one Cafe Mocha cold' }));
    expect(screen.getByRole('link', { name: /send order on whatsapp/i })).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: 'Remove one Cafe Mocha cold' }));
    expect(screen.getByRole('button', { name: 'Pick at least one drink' })).toBeDisabled();
  });
});
