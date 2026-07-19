// submitScore write-path tests. Firestore is mocked at the module boundary so
// the document shapes can be asserted without a live database.
//
// Two properties here are load-bearing and both are enforced by firestore.rules,
// so a regression in either rejects every write in production while the app
// still looks fine locally:
//
//   1. `phone` must never reach the world-readable `leaderboard` collection.
//   2. `createdAt` must be the serverTimestamp() sentinel, because the rules pin
//      it to request.time. A plain `new Date()` here would pass every test and
//      fail 100% of real writes.
//
// The score write must also be the one that can fail the call — an orphaned
// contact is harmless, a lost score is the product.

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { submitScore } from './firebase';

// A distinctive object standing in for the Firestore sentinel, so assertions can
// prove the sentinel itself was written rather than merely that a field exists.
const SENTINEL = { __serverTimestamp: true };

// Create React App runs Jest with resetMocks: true, which strips the
// implementations a jest.mock factory supplies before every test.
beforeEach(() => {
  collection.mockImplementation((_db, name) => ({ __collection: name }));
  doc.mockImplementation((first, name, id) =>
    // doc(collectionRef) -> auto id;  doc(db, 'contacts', id) -> explicit id
    first?.__collection
      ? { __collection: first.__collection, id: 'generated-id' }
      : { __collection: name, id },
  );
  setDoc.mockResolvedValue(undefined);
  serverTimestamp.mockReturnValue(SENTINEL);
});

/** The document written to a given collection. */
function writtenTo(collectionName) {
  const call = setDoc.mock.calls.find(([ref]) => ref.__collection === collectionName);
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

  // Regression guard. Mutating this to `new Date()` used to leave the whole
  // suite green while making every production write fail the rules.
  test('stamps createdAt with the server sentinel, not a client clock', async () => {
    await submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc');
    expect(serverTimestamp).toHaveBeenCalled();
    expect(writtenTo('leaderboard').createdAt).toBe(SENTINEL);
    expect(writtenTo('contacts').createdAt).toBe(SENTINEL);
    expect(writtenTo('leaderboard').createdAt).not.toBeInstanceOf(Date);
  });

  test('the leaderboard row carries exactly the fields the rules allow', async () => {
    // firestore.rules uses hasOnly, so an extra field rejects the write.
    await submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc');
    expect(Object.keys(writtenTo('leaderboard')).sort()).toEqual(
      ['createdAt', 'game', 'name', 'playerId', 'score', 'team', 'week'].sort(),
    );
  });

  test('the contact row carries exactly the fields the rules allow', async () => {
    await submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc');
    expect(Object.keys(writtenTo('contacts')).sort()).toEqual(
      ['createdAt', 'name', 'phone', 'playerId', 'week'].sort(),
    );
  });

  test('the score is written before the contact', async () => {
    await submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc');
    expect(setDoc.mock.calls[0][0].__collection).toBe('leaderboard');
    expect(setDoc.mock.calls[1][0].__collection).toBe('contacts');
  });

  test('the contact shares the score row id, so the two can be joined', async () => {
    await submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc');
    const [entryRef] = setDoc.mock.calls[0];
    const [contactRef] = setDoc.mock.calls[1];
    expect(contactRef.id).toBe(entryRef.id);
  });

  test('a failed contact write does not cost the player their score', async () => {
    // An orphaned contact is harmless; a lost score is the product.
    setDoc
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('permission-denied'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc');
    expect(result.entryId).toBe('generated-id');
    expect(result.contactStored).toBe(false);
    console.error.mockRestore();
  });

  test('a failed score write rejects, and no contact is written', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(
      submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc'),
    ).rejects.toThrow(/permission-denied/);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  test('returns the entry id the voucher request needs', async () => {
    const result = await submitScore('Pravy', '0912', 7, 'football', 'BRA', 'uuid-abc');
    expect(result).toEqual({ entryId: 'generated-id', contactStored: true });
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

  test('trims name and phone before writing', async () => {
    await submitScore('  Pravy  ', '  0912  ', 5, 'football', 'BRA', 'uuid-x');
    expect(writtenTo('leaderboard').name).toBe('Pravy');
    expect(writtenTo('contacts').phone).toBe('0912');
  });

  test('rejects an implausible score and writes nothing', async () => {
    await expect(
      submitScore('Pravy', '0912', 999, 'football', 'BRA', 'uuid-x'),
    ).rejects.toThrow(/Implausible/);
    expect(setDoc).not.toHaveBeenCalled();
  });

  test('rejects a football score above the honest ceiling', async () => {
    await expect(
      submitScore('Pravy', '0912', 40, 'football', 'BRA', 'uuid-x'),
    ).rejects.toThrow(/Implausible/);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
