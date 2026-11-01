import {
  emptyTransactionArchive,
  validatePortableTransactions,
  type PortableTransactionArchive,
} from './portableTransactions';

export type TransactionHistorySnapshot = {
  revision: number;
  archive: PortableTransactionArchive;
};
const DATABASE = 'my-lovely-craft-transaction-history';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('history');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(
        request.error ?? new Error('Transaction storage could not be opened.')
      );
    request.onblocked = () =>
      reject(
        new Error(
          'Close other tabs updating transaction storage and try again.'
        )
      );
  });
}
export async function loadTransactionHistory(): Promise<TransactionHistorySnapshot> {
  const db = await open();
  const stored = await new Promise<TransactionHistorySnapshot | undefined>(
    (resolve, reject) => {
      const transaction = db.transaction('history', 'readonly'),
        request = transaction.objectStore('history').get('current');
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result as TransactionHistorySnapshot | undefined);
      };
      transaction.onerror = transaction.onabort = () => {
        db.close();
        reject(
          transaction.error ??
            new Error('Transaction history could not be read.')
        );
      };
    }
  );
  if (!stored) {
    return { revision: 0, archive: emptyTransactionArchive() };
  }
  if (!Number.isSafeInteger(stored.revision) || stored.revision < 1) {
    throw new Error(
      'Saved transaction history is invalid. Existing data has been retained.'
    );
  }
  return {
    revision: stored.revision,
    archive: await validatePortableTransactions(stored.archive),
  };
}
/** The read/compare/write runs in one IDB transaction to protect concurrent tabs. */
export async function saveTransactionHistory(
  archive: PortableTransactionArchive,
  expectedRevision: number
): Promise<TransactionHistorySnapshot> {
  const validated = await validatePortableTransactions(archive);
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    expectedRevision >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error('Invalid transaction history revision.');
  }
  const db = await open();
  return new Promise((resolve, reject) => {
    let failure: Error | null = null;
    const transaction = db.transaction('history', 'readwrite'),
      store = transaction.objectStore('history'),
      request = store.get('current');
    const next = { revision: expectedRevision + 1, archive: validated };
    request.onsuccess = () => {
      const current = request.result as TransactionHistorySnapshot | undefined;
      if ((current?.revision ?? 0) !== expectedRevision) {
        failure = new Error(
          'Transaction history changed in another tab. Reload history before saving.'
        );
        transaction.abort();
        return;
      }
      store.put(next, 'current');
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(next);
    };
    transaction.onerror = transaction.onabort = () => {
      db.close();
      reject(
        failure ??
          transaction.error ??
          new Error(
            'Transaction history was not saved. Existing data has been retained.'
          )
      );
    };
  });
}
