import { validCustomerReceipt, validQuotation } from './salesArchive';
import {
  filterTransactionQuotations,
  filterTransactionReceipts,
  transactionCents,
  validTransactionEntries,
  type TransactionFilters,
  type TransactionStore,
} from './transactions';

export type TransactionArchive = TransactionStore & {
  format: 'my-lovely-craft-transactions';
  version: 1;
  exportedAt: string;
};
export type TransactionMergeStats = {
  receiptsAdded: number;
  quotationsAdded: number;
  entriesAdded: number;
  duplicates: number;
  conflicts: number;
};
const unique = (rows: readonly { id: string }[]) =>
  rows.every(
    (row) =>
      typeof row.id === 'string' &&
      row.id.trim().length > 0 &&
      row.id.length <= 250
  ) && new Set(rows.map((row) => row.id)).size === rows.length;
export function validateTransactionArchive(input: unknown): TransactionArchive {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Choose a My Lovely Craft transaction archive.');
  }
  const archive = input as TransactionArchive;
  if (
    archive.format !== 'my-lovely-craft-transactions' ||
    archive.version !== 1 ||
    typeof archive.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(archive.exportedAt)) ||
    !Array.isArray(archive.customerReceipts) ||
    !Array.isArray(archive.quotations) ||
    archive.customerReceipts.length + archive.quotations.length > 100000
  ) {
    throw new Error('Unsupported or damaged transaction archive.');
  }
  // Reuse the durable document validators without requiring today's catalog.
  if (
    !archive.customerReceipts.every(validCustomerReceipt) ||
    !archive.quotations.every(validQuotation)
  ) {
    throw new Error(
      'The transaction archive contains invalid saved documents.'
    );
  }
  if (
    !unique(archive.customerReceipts) ||
    !unique(archive.quotations) ||
    !validTransactionEntries(
      archive.transactionEntries ?? [],
      archive.customerReceipts
    )
  ) {
    throw new Error(
      'The transaction archive has duplicate IDs or invalid debit/credit records.'
    );
  }
  archive.customerReceipts.forEach((receipt) => {
    [
      receipt.total,
      receipt.subtotal,
      receipt.discount,
      receipt.amountPaid,
      receipt.balance,
      receipt.change,
    ].forEach(transactionCents);
    receipt.items.forEach((item) => {
      transactionCents(item.amount);
      if (item.totalProductCost != null) {
        transactionCents(item.totalProductCost);
      }
    });
  });
  return {
    format: archive.format,
    version: 1,
    exportedAt: archive.exportedAt,
    customerReceipts: archive.customerReceipts,
    quotations: archive.quotations,
    transactionEntries: archive.transactionEntries ?? [],
  };
}
export function createTransactionArchive(
  store: TransactionStore,
  filters: TransactionFilters,
  includeQuotations: boolean
): TransactionArchive {
  const receipts = filterTransactionReceipts(store, filters);
  const ids = new Set(receipts.map((receipt) => receipt.id));
  return validateTransactionArchive({
    format: 'my-lovely-craft-transactions',
    version: 1,
    exportedAt: new Date().toISOString(),
    customerReceipts: receipts,
    quotations: includeQuotations
      ? filterTransactionQuotations(store, filters)
      : [],
    transactionEntries: (store.transactionEntries ?? []).filter((entry) =>
      ids.has(entry.receiptId)
    ),
  });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
/** Append only. A changed document or management record with the same ID always keeps the local version. */
export function mergeTransactionArchive<T extends TransactionStore>(
  current: T,
  input: TransactionArchive
): { state: T; stats: TransactionMergeStats } {
  const archive = validateTransactionArchive(input);
  const stats: TransactionMergeStats = {
    receiptsAdded: 0,
    quotationsAdded: 0,
    entriesAdded: 0,
    duplicates: 0,
    conflicts: 0,
  };
  const blocked = new Set<string>();
  function append<R extends { id: string }>(
    local: R[],
    incoming: R[],
    kind: 'receiptsAdded' | 'quotationsAdded'
  ) {
    const index = new Map(local.map((record) => [record.id, record]));
    const added: R[] = [];
    incoming.forEach((record) => {
      const existing = index.get(record.id);
      if (!existing) {
        added.push(record);
        stats[kind]++;
      } else if (canonical(existing) === canonical(record)) {
        stats.duplicates++;
      } else {
        stats.conflicts++;
        if (kind === 'receiptsAdded') {
          blocked.add(record.id);
        }
      }
    });
    return [...local, ...added].sort((a, b) => {
      const left = a as R & { createdAt: string },
        right = b as R & { createdAt: string };
      return (
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        a.id.localeCompare(b.id)
      );
    });
  }
  const customerReceipts = append(
    current.customerReceipts,
    archive.customerReceipts,
    'receiptsAdded'
  );
  const quotations = append(
    current.quotations,
    archive.quotations,
    'quotationsAdded'
  );
  const entries = [...(current.transactionEntries ?? [])];
  const index = new Map(entries.map((entry) => [entry.receiptId, entry]));
  (archive.transactionEntries ?? []).forEach((entry) => {
    if (blocked.has(entry.receiptId)) {
      return;
    }
    const existing = index.get(entry.receiptId);
    if (!existing) {
      entries.push(entry);
      stats.entriesAdded++;
    } else if (canonical(existing) === canonical(entry)) {
      stats.duplicates++;
    } else {
      stats.conflicts++;
    }
  });
  return {
    state: {
      ...current,
      customerReceipts,
      quotations,
      transactionEntries: entries,
    },
    stats,
  };
}
