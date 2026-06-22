// submitScore write-path tests. Firestore is mocked at the module boundary so
// the document shape can be asserted without a live database.

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-doc' })),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

import { addDoc } from 'firebase/firestore';
import { submitScore } from './firebase';

afterEach(() => {
  jest.clearAllMocks();
});

// addDoc is called as addDoc(collection, document); the document is the 2nd arg.
function lastWrittenDoc() {
  return addDoc.mock.calls[0][1];
}

describe('submitScore', () => {
  test('stamps the playerId field when one is supplied (football path)', async () => {
    await submitScore('Pravy', '0912345678', 7, 'football', 'BRA', 'uuid-abc');
    const doc = lastWrittenDoc();
    expect(doc.playerId).toBe('uuid-abc');
    expect(doc.game).toBe('football');
    expect(doc.team).toBe('BRA');
  });

  test('omits playerId on the 3-arg Boba Catcher path', async () => {
    await submitScore('Pravy', '0912345678', 120);
    const doc = lastWrittenDoc();
    expect('playerId' in doc).toBe(false);
    expect('team' in doc).toBe(false);
    expect(doc.game).toBe('bobacatcher');
  });

  test('omits playerId when explicitly null or empty', async () => {
    await submitScore('Pravy', '0912', 5, 'football', 'BRA', null);
    expect('playerId' in lastWrittenDoc()).toBe(false);
    await submitScore('Pravy', '0912', 5, 'football', 'BRA', '');
    expect('playerId' in lastWrittenDoc()).toBe(false);
  });

  test('trims name and phone before writing', async () => {
    await submitScore('  Pravy  ', '  0912  ', 5, 'football', 'BRA', 'uuid-x');
    const doc = lastWrittenDoc();
    expect(doc.name).toBe('Pravy');
    expect(doc.phone).toBe('0912');
  });

  test('rejects an implausible score and writes nothing', async () => {
    await expect(
      submitScore('Pravy', '0912', 999, 'football', 'BRA', 'uuid-x'),
    ).rejects.toThrow(/Implausible/);
    expect(addDoc).not.toHaveBeenCalled();
  });
});
