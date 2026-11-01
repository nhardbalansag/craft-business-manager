import * as XLSX from 'xlsx';
import type { TransactionArchive } from './transactionArchive';
import { effectiveTransaction, type TransactionEntry } from './transactions';
export function transactionWorkbook(
  archive: TransactionArchive,
  portable: string
): Uint8Array {
  if (portable.length > 32 * 1024 * 1024) {
    throw new Error('Transaction archive is too large. Choose fewer dates.');
  }
  const workbook = XLSX.utils.book_new();
  const entries = new Map(
    (archive.transactionEntries ?? []).map((entry) => [entry.receiptId, entry])
  );
  function sheet(name: string, rows: unknown[][]) {
    const value = XLSX.utils.aoa_to_sheet(rows);
    value['!cols'] = rows[0].map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(workbook, value, name);
  }
  sheet('Transactions', [
    [
      'id',
      'reference',
      'createdAt',
      'customer',
      'total',
      'paymentAppliedAtSale',
      'balanceAtSale',
      'direction',
      'movementAmount',
      'movementDate',
      'managementNotes',
    ],
    ...archive.customerReceipts.map((receipt) => {
      const entry = entries.get(receipt.id) ?? effectiveTransaction(receipt);
      return [
        receipt.id,
        receipt.reference,
        receipt.createdAt,
        receipt.customerName,
        receipt.total,
        Math.min(receipt.amountPaid, receipt.total),
        receipt.balance,
        entry.direction,
        entry.amount,
        entry.date,
        entry.notes,
      ];
    }),
  ]);
  sheet('ReceiptItems', [
    [
      'receiptId',
      'productId',
      'productName',
      'quantity',
      'unitPrice',
      'amount',
      'savedProductCost',
    ],
    ...archive.customerReceipts.flatMap((receipt) =>
      receipt.items.map((item) => [
        receipt.id,
        item.productId,
        item.name,
        item.quantity,
        item.unitPrice,
        item.amount,
        item.totalProductCost ?? null,
      ])
    ),
  ]);
  sheet('Quotations', [
    [
      'id',
      'reference',
      'createdAt',
      'customer',
      'quotedTotal',
      'estimatedCost',
      'estimatedProfit',
    ],
    ...archive.quotations.map((quote) => [
      quote.id,
      quote.customer.quotationReference,
      quote.createdAt,
      quote.customer.customer.name,
      quote.customer.total,
      quote.owner.totalProductCost,
      quote.owner.totalProfit,
    ]),
  ]);
  sheet('QuotationItems', [
    [
      'quotationId',
      'productId',
      'productName',
      'quantity',
      'unitPrice',
      'amount',
    ],
    ...archive.quotations.flatMap((quote) =>
      quote.customer.items.map((item) => [
        quote.id,
        item.product.id,
        item.product.name,
        item.product.quantity,
        item.pricing.unitSellingPrice,
        item.pricing.totalSellingPrice,
      ])
    ),
  ]);
  sheet('Management', [
    ['receiptId', 'direction', 'amount', 'date', 'notes', 'updatedAt'],
    ...(archive.transactionEntries ?? []).map((entry: TransactionEntry) => [
      entry.receiptId,
      entry.direction,
      entry.amount,
      entry.date,
      entry.notes,
      entry.updatedAt,
    ]),
  ]);
  const chunks: unknown[][] = [['position', 'content']];
  for (let offset = 0; offset < portable.length; offset += 24000) {
    chunks.push([chunks.length - 1, portable.slice(offset, offset + 24000)]);
  }
  sheet('TransactionArchive', chunks);
  workbook.Workbook = {
    Sheets: workbook.SheetNames.map((name) => ({
      name,
      Hidden: name === 'TransactionArchive' ? 1 : 0,
    })),
  };
  return new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true })
  );
}
