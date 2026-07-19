// submitScore write-path tests. Firestore is mocked at the module boundary so
// the document shapes can be asserted without a live database.
//
// The load-bearing assertions here are the ones about `phone`: the leaderboard
// is world-readable and must never carry a contact detail, while `contacts` is
// write-only for clients and is where the number belongs.

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  serverTimestamp: jest.fn(),
  writeBatch: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

import { writeBatch, collection, doc } from 'firebase/firestore';
import { submitScore } from './firebase';

// Create React App runs Jest with resetMocks: true, which strips the
// implementations a jest.mock factory supplies before every test. They have to
// be reinstated here or writeBatch() hands back undefined.
beforeEach(() => {
  // Tag refs with their collection so assertions can tell the two writes apart.
  collection.mockImplementation((_db, name) => ({ __collection: name }));
  doc.mockImplementation((col) => ({ __collection: col.__collection, id: 'generated-id' }));
  writeBatch.mockImplementation(() => ({
    set: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  }));
});

/** The batch object returned by the nth writeBatch() call in this test. */
function batchAt(index = 0) {
  return writeBatch.mock.results[index].value;
}

/** The document written to a given collection by the nth batch. */
function writtenTo(collectionName, index = 0) {
  const call = batchAt(index).set.mock.calls.find(
    ([ref]) => ref.__collection === collectionName,
  );
  return call ? call[1] : undefined;
}

describe('submitScore', () => {
  test('never writes a phone number to the public leaderboard', async () => {
    await submitScore('Pravy', '0912345678', 7, 'football', 'BRA', 'uuid-abc');
    expect('phone' in writtenTo('leaderboard')).toBe(false);
  });

  test('writes the phone number to the private contacts collection', async () => {
    await submitScore('Pravy', '0912345678', 7, 'football', 'BRA', 'uuid-abc');
    const contact = writtenTo('contacts');
    expect(contact.phone).toBe('0912345678');
    expect(contact.name).toBe('Pravy');
    expect(contact.playerId).toBe('uuid-abc');
  });

  test('commits both rows in a single batch so neither can be orphaned', async () => {
    await submitScore('Pravy', '0912345678', 7, 'football', 'BRA', 'uuid-abc');
    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(batchAt().set).toHaveBeenCalledTimes(2);
    expect(batchAt().commit).toHaveBeenCalledTimes(1);
  });

  test('stamps the playerId field when one is supplied (football path)', async () => {
    await submitScore('Pravy', '0912345678', 7, 'football', 'BRA', 'uuid-abc');
    const entry = writtenTo('leaderboard');
    expect(entry.playerId).toBe('uuid-abc');
    expect(entry.game).toBe('football');
    expect(entry.team).toBe('BRA');
  });

  test('omits playerId on the 3-arg Boba Catcher path', async () => {
    await submitScore('Pravy', '0912345678', 120);
    const entry = writtenTo('leaderboard');
    expect('playerId' in entry).toBe(false);
    expect('team' in entry).toBe(false);
    expect(entry.game).toBe('bobacatcher');
  });

  test('omits playerId when explicitly null or empty', async () => {
    await submitScore('Pravy', '0912', 5, 'football', 'BRA', null);
    expect('playerId' in writtenTo('leaderboard', 0)).toBe(false);
    expect('playerId' in writtenTo('contacts', 0)).toBe(false);

    await submitScore('Pravy', '0912', 5, 'football', 'BRA', '');
    expect('playerId' in writtenTo('leaderboard', 1)).toBe(false);
    expect('playerId' in writtenTo('contacts', 1)).toBe(false);
  });

  test('trims name and phone before writing', async () => {
    await submitScore('  Pravy  ', '  0912  ', 5, 'football', 'BRA', 'uuid-x');
    expect(writtenTo('leaderboard').name).toBe('Pravy');
    expect(writtenTo('contacts').name).toBe('Pravy');
    expect(writtenTo('contacts').phone).toBe('0912');
  });

  test('every leaderboard row declares its game', async () => {
    // A document that simply omitted `game` used to slip through the rules at
    // the 1000 ceiling, so the field is now mandatory on both paths.
    await submitScore('Pravy', '0912', 5, 'football', 'BRA', 'uuid-x');
    expect(writtenTo('leaderboard').game).toBe('football');

    await submitScore('Pravy', '0912', 5);
    expect(writtenTo('leaderboard', 1).game).toBe('bobacatcher');
  });

  test('rejects an implausible score and writes nothing', async () => {
    await expect(
      submitScore('Pravy', '0912', 999, 'football', 'BRA', 'uuid-x'),
    ).rejects.toThrow(/Implausible/);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  test('rejects a football score above the honest ceiling', async () => {
    await expect(
      submitScore('Pravy', '0912', 40, 'football', 'BRA', 'uuid-x'),
    ).rejects.toThrow(/Implausible/);
    expect(writeBatch).not.toHaveBeenCalled();
  });
});
