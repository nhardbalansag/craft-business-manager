import type { SavedCustomerReceipt, SavedQuotation } from './models';

export type TransactionEntry = {
  receiptId: string;
  direction: 'credit' | 'debit';
  amount: number;
  date: string;
  notes: string;
  updatedAt: string;
};
export type TransactionStore = {
  customerReceipts: SavedCustomerReceipt[];
  quotations: SavedQuotation[];
  transactionEntries?: TransactionEntry[];
};
export type TransactionFilters = {
  query: string;
  from: string;
  to: string;
  direction: 'all' | TransactionEntry['direction'];
  dateBasis: 'sale' | 'movement';
};
export const defaultTransactionFilters: TransactionFilters = {
  query: '',
  from: '',
  to: '',
  direction: 'all',
  dateBasis: 'sale',
};
export function transactionDay(iso = new Date().toISOString()) {
  const date = new Date(iso).getTime();
  if (!Number.isFinite(date)) {
    throw new Error('Invalid transaction date.');
  }
  return new Date(date + 8 * 3600000).toISOString().slice(0, 10);
}
export function validTransactionDay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateTransactionFilters(filters: TransactionFilters) {
  if (
    (filters.from && !validTransactionDay(filters.from)) ||
    (filters.to && !validTransactionDay(filters.to))
  ) {
    throw new Error(
      'Enter valid From and To dates as YYYY-MM-DD, or leave them empty.'
    );
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new Error('From date must be on or before To date.');
  }
}
export function transactionCents(amount: number): number {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents)) {
    throw new Error('Transaction amount is outside the supported range.');
  }
  return cents;
}
export function validTransactionEntries(
  input: unknown,
  receipts: readonly SavedCustomerReceipt[]
): input is TransactionEntry[] {
  if (!Array.isArray(input) || input.length > 100000) {
    return false;
  }
  const ids = new Set<string>();
  const receiptIds = new Set(receipts.map((receipt) => receipt.id));
  return input.every((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !receiptIds.has(entry.receiptId) ||
      ids.has(entry.receiptId) ||
      !['credit', 'debit'].includes(entry.direction) ||
      !validTransactionDay(entry.date) ||
      typeof entry.notes !== 'string' ||
      entry.notes.length > 1000 ||
      typeof entry.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(entry.updatedAt))
    ) {
      return false;
    }
    try {
      transactionCents(entry.amount);
      if (Number(entry.amount.toFixed(2)) !== entry.amount) {
        return false;
      }
    } catch {
      return false;
    }
    ids.add(entry.receiptId);
    return true;
  });
}
export function effectiveTransaction(
  receipt: SavedCustomerReceipt,
  entries: readonly TransactionEntry[] = []
): TransactionEntry {
  return (
    entries.find((entry) => entry.receiptId === receipt.id) ?? {
      receiptId: receipt.id,
      direction: 'credit',
      amount: Math.min(receipt.amountPaid, receipt.total),
      date: transactionDay(receipt.createdAt),
      notes: '',
      updatedAt: receipt.createdAt,
    }
  );
}
const normalized = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();
export function inTransactionDates(
  date: string,
  filters: Pick<TransactionFilters, 'from' | 'to'>
) {
  return (
    (!filters.from || date >= filters.from) &&
    (!filters.to || date <= filters.to)
  );
}
export function filterTransactionReceipts(
  store: TransactionStore,
  filters: TransactionFilters
) {
  validateTransactionFilters(filters);
  const query = normalized(filters.query);
  const entries = new Map(
    (store.transactionEntries ?? []).map((entry) => [entry.receiptId, entry])
  );
  return store.customerReceipts
    .filter((receipt) => {
      const entry = entries.get(receipt.id) ?? effectiveTransaction(receipt);
      return (
        (filters.direction === 'all' ||
          entry.direction === filters.direction) &&
        inTransactionDates(
          filters.dateBasis === 'movement'
            ? entry.date
            : transactionDay(receipt.createdAt),
          filters
        ) &&
        normalized(
          `${receipt.reference} ${receipt.customerName} ${receipt.items
            .map((item) => `${item.name} ${item.productId}`)
            .join(' ')} ${entry.notes}`
        ).includes(query)
      );
    })
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.id.localeCompare(b.id)
    );
}
export function filterTransactionQuotations(
  store: TransactionStore,
  filters: TransactionFilters
) {
  validateTransactionFilters(filters);
  const query = normalized(filters.query);
  return filters.direction !== 'all'
    ? []
    : store.quotations
        .filter(
          (quote) =>
            inTransactionDates(transactionDay(quote.createdAt), filters) &&
            normalized(
              `${quote.customer.quotationReference} ${
                quote.customer.customer.name
              } ${quote.customer.items
                .map((item) => `${item.product.name} ${item.product.id}`)
                .join(' ')}`
            ).includes(query)
        )
        .sort(
          (a, b) =>
            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
            a.id.localeCompare(b.id)
        );
}
export function transactionSummary(
  receipts: readonly SavedCustomerReceipt[],
  entries: readonly TransactionEntry[] = []
) {
  let credit = 0,
    debit = 0,
    sales = 0,
    received = 0,
    balance = 0,
    knownCost = 0,
    unknownCostCount = 0;
  function add(a: number, b: number) {
    const result = a + b;
    if (!Number.isSafeInteger(result)) {
      throw new Error('Financial totals are too large. Narrow the date range.');
    }
    return result;
  }
  const index = new Map(entries.map((entry) => [entry.receiptId, entry]));
  receipts.forEach((receipt) => {
    const entry = index.get(receipt.id) ?? effectiveTransaction(receipt);
    if (entry.direction === 'credit') {
      credit = add(credit, transactionCents(entry.amount));
    } else {
      debit = add(debit, transactionCents(entry.amount));
    }
    sales = add(sales, transactionCents(receipt.total));
    received = add(
      received,
      transactionCents(Math.min(receipt.amountPaid, receipt.total))
    );
    balance = add(balance, transactionCents(receipt.balance));
    if (
      receipt.items.some(
        (item) =>
          item.totalProductCost === undefined || item.totalProductCost === null
      )
    ) {
      unknownCostCount++;
    }
    knownCost = add(
      knownCost,
      transactionCents(
        receipt.items.reduce(
          (sum, item) => sum + (item.totalProductCost ?? 0),
          0
        )
      )
    );
  });
  return {
    count: receipts.length,
    credit: credit / 100,
    debit: debit / 100,
    net: (credit - debit) / 100,
    sales: sales / 100,
    received: received / 100,
    balance: balance / 100,
    knownCost: knownCost / 100,
    cost: unknownCostCount ? null : knownCost / 100,
    profit: unknownCostCount ? null : (sales - knownCost) / 100,
    unknownCostCount,
  };
}
export function managedTransactions(
  store: TransactionStore,
  entry: TransactionEntry
): TransactionEntry[] {
  const next = [
    entry,
    ...(store.transactionEntries ?? []).filter(
      (item) => item.receiptId !== entry.receiptId
    ),
  ];
  if (!validTransactionEntries(next, store.customerReceipts)) {
    throw new Error(
      'Choose a saved receipt and enter a valid direction, amount and date.'
    );
  }
  return next;
}
