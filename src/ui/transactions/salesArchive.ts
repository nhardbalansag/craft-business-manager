import type {
  SavedQuotation,
  SavedCustomerReceipt,
  ProductPhoto,
} from './models';
import type { OwnerQuotationView } from '../pricing/ownerQuotation';
import type {
  OwnerQuotationMaterialLine,
  OwnerQuotationMaterialTotal,
} from '../pricing/ownerQuotationMaterials';

const amount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const optionalAmount = (value: unknown) =>
  value === null || (typeof value === 'number' && Number.isFinite(value));
const text = (value: unknown) => typeof value === 'string';
const nullableText = (value: unknown) => value === null || text(value);
const optionalCost = (value: unknown) => value === null || amount(value);
function validMaterialLine(
  input: unknown
): input is OwnerQuotationMaterialLine {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const line = input as OwnerQuotationMaterialLine;
  return (
    text(line.materialId) &&
    text(line.materialName) &&
    text(line.source) &&
    ['g', 'mL', 'pc'].includes(line.unit) &&
    amount(line.quantityPerProduct) &&
    amount(line.totalQuantity) &&
    optionalCost(line.unitCost) &&
    optionalCost(line.totalCost)
  );
}
function validMaterialTotal(
  input: unknown,
  products: number
): input is OwnerQuotationMaterialTotal {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const line = input as OwnerQuotationMaterialTotal;
  return (
    text(line.materialId) &&
    text(line.materialName) &&
    ['g', 'mL', 'pc'].includes(line.unit) &&
    amount(line.totalQuantity) &&
    optionalCost(line.unitCost) &&
    optionalCost(line.totalCost) &&
    Number.isSafeInteger(line.contributingProducts) &&
    line.contributingProducts >= 1 &&
    line.contributingProducts <= products
  );
}
function validOwnerMaterialEvidence(owner: OwnerQuotationView) {
  const hasDetails =
    owner.materials !== undefined ||
    owner.totalMaterialCost !== undefined ||
    owner.materialBreakdownComplete !== undefined ||
    owner.items.some(
      (item) =>
        item.materialLines !== undefined ||
        item.materialCostTotal !== undefined ||
        item.materialBreakdownComplete !== undefined
    );
  if (!hasDetails) {
    return true;
  } // Original saved quotations remain valid.
  return (
    Array.isArray(owner.materials) &&
    owner.materials.every(
      (line) =>
        validMaterialTotal(line, owner.items.length) &&
        (!owner.materialBreakdownComplete || amount(line.totalCost))
    ) &&
    typeof owner.materialBreakdownComplete === 'boolean' &&
    (owner.materialBreakdownComplete
      ? amount(owner.totalMaterialCost)
      : owner.totalMaterialCost === null) &&
    owner.items.every(
      (item) =>
        Array.isArray(item.materialLines) &&
        item.materialLines.every(
          (line) =>
            validMaterialLine(line) &&
            (!item.materialBreakdownComplete || amount(line.totalCost))
        ) &&
        typeof item.materialBreakdownComplete === 'boolean' &&
        (item.materialBreakdownComplete
          ? amount(item.materialCostTotal)
          : item.materialCostTotal === null) &&
        (!owner.materialBreakdownComplete || item.materialBreakdownComplete)
    )
  );
}
export function validPhotoMap(
  input: unknown
): input is Record<string, ProductPhoto> {
  return (
    !!input &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    Object.values(input).every(
      (photo) =>
        photo &&
        text(photo.uri) &&
        /^backup:\/\/image\/[a-f0-9]{64}$/.test(photo.uri) &&
        text(photo.thumbnailUri) &&
        /^backup:\/\/image\/[a-f0-9]{64}$/.test(photo.thumbnailUri) &&
        ['sourceImageUri', 'sourceBrochureUri'].every(
          (key) =>
            photo[key] === undefined ||
            (text(photo[key]) &&
              /^backup:\/\/image\/[a-f0-9]{64}$/.test(photo[key]))
        )
    )
  );
}
export function validQuotation(input: unknown): input is SavedQuotation {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const value = input as SavedQuotation;
  const customer = value.customer,
    owner = value.owner;
  return (
    text(value.id) &&
    text(value.createdAt) &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    text(value.revision) &&
    validPhotoMap(value.photos) &&
    !!customer &&
    !!owner &&
    text(customer.businessName) &&
    text(customer.quotationReference) &&
    !!customer.customer &&
    text(customer.customer.name) &&
    nullableText(customer.customer.contact) &&
    nullableText(customer.customer.address) &&
    nullableText(customer.validUntil) &&
    nullableText(customer.notes) &&
    nullableText(customer.terms) &&
    text(customer.generatedAtIso) &&
    Number.isFinite(Date.parse(customer.generatedAtIso)) &&
    amount(customer.total) &&
    amount(customer.subtotal) &&
    Array.isArray(customer.items) &&
    customer.items.length > 0 &&
    customer.items.length <= 200 &&
    customer.items.every(
      (item) =>
        item &&
        item.product &&
        item.pricing &&
        text(item.product.id) &&
        text(item.product.name) &&
        Number.isSafeInteger(item.product.quantity) &&
        item.product.quantity > 0 &&
        text(item.pricing.sourceLabel) &&
        amount(item.pricing.unitSellingPrice) &&
        amount(item.pricing.totalSellingPrice)
    ) &&
    Array.isArray(owner.items) &&
    owner.items.length === customer.items.length &&
    owner.quotationReference === customer.quotationReference &&
    owner.businessName === customer.businessName &&
    owner.generatedAtIso === customer.generatedAtIso &&
    owner.validUntil === customer.validUntil &&
    !!owner.customer &&
    owner.customer.name === customer.customer.name &&
    owner.customer.contact === customer.customer.contact &&
    owner.customer.address === customer.customer.address &&
    owner.notes === customer.notes &&
    owner.terms === customer.terms &&
    Number.isSafeInteger(owner.unresolvedCostCount) &&
    owner.unresolvedCostCount >= 0 &&
    owner.unresolvedCostCount <= owner.items.length &&
    owner.totalSales === customer.total &&
    optionalCost(owner.totalProductCost) &&
    optionalAmount(owner.totalProfit) &&
    optionalAmount(owner.grossMargin) &&
    owner.items.every(
      (item, index) =>
        item &&
        item.productId === customer.items[index].product.id &&
        item.productName === customer.items[index].product.name &&
        item.sourceLabel === customer.items[index].pricing.sourceLabel &&
        item.unitSellingPrice ===
          customer.items[index].pricing.unitSellingPrice &&
        item.quantity === customer.items[index].product.quantity &&
        item.totalSellingPrice ===
          customer.items[index].pricing.totalSellingPrice &&
        optionalCost(item.totalProductCost) &&
        optionalAmount(item.totalProfit) &&
        optionalCost(item.unitProductCost) &&
        optionalAmount(item.profitPerUnit) &&
        optionalAmount(item.grossMargin)
    ) &&
    validOwnerMaterialEvidence(owner)
  );
}
export function validCustomerReceipt(
  input: unknown
): input is SavedCustomerReceipt {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const value = input as SavedCustomerReceipt;
  if (
    !(
      text(value.id) &&
      text(value.reference) &&
      text(value.createdAt) &&
      Number.isFinite(Date.parse(value.createdAt)) &&
      text(value.revision) &&
      text(value.businessName) &&
      text(value.customerName) &&
      text(value.customerContact) &&
      text(value.paymentMethod) &&
      text(value.notes) &&
      [
        value.subtotal,
        value.discount,
        value.total,
        value.amountPaid,
        value.balance,
        value.change,
      ].every(amount) &&
      Array.isArray(value.items) &&
      value.items.length > 0 &&
      value.items.length <= 200 &&
      value.items.every(
        (item) =>
          item &&
          text(item.productId) &&
          text(item.name) &&
          text(item.sourceLabel) &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0 &&
          amount(item.unitPrice) &&
          amount(item.amount) &&
          (item.totalProductCost === undefined ||
            item.totalProductCost === null ||
            amount(item.totalProductCost))
      )
    )
  ) {
    return false;
  }
  const cents = (number: number) => Math.round(number * 100);
  return (
    value.items.reduce((sum, item) => sum + cents(item.amount), 0) ===
      cents(value.subtotal) &&
    cents(value.subtotal) - cents(value.discount) === cents(value.total) &&
    cents(value.balance) ===
      Math.max(0, cents(value.total) - cents(value.amountPaid)) &&
    cents(value.change) ===
      Math.max(0, cents(value.amountPaid) - cents(value.total))
  );
}
