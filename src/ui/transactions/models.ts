import type { CustomerQuotationView } from '../pricing/customerQuotation';
import type { OwnerQuotationView } from '../pricing/ownerQuotation';
export type ProductPhoto = {
  uri: string;
  thumbnailUri: string;
  sourceImageUri?: string;
  sourceBrochureUri?: string;
};
export type Receipt = {
  title: string;
  text: string;
  qr?: string;
  sections?: { text: string; size: 1 | 2; bold: boolean }[];
  photo?: ProductPhoto & { dots: 384 | 576 };
};
export type CustomerReceiptLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sourceLabel: string;
  totalProductCost?: number | null;
};
export type SavedCustomerReceipt = {
  id: string;
  reference: string;
  createdAt: string;
  revision: string;
  businessName: string;
  customerName: string;
  customerContact: string;
  paymentMethod: string;
  notes: string;
  items: CustomerReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  change: number;
  receipt: Receipt;
};
export type SavedQuotation = {
  id: string;
  createdAt: string;
  revision: string;
  customer: CustomerQuotationView;
  owner: OwnerQuotationView;
  photos: Record<string, ProductPhoto>;
};
