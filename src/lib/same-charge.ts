import { findBrand } from '@/lib/brands';

function merchantKey(s: string): string {
  return s.toLowerCase().replace(/[\s()[\]·.,_*-]/g, '');
}

/** "스타벅스" and "스타벅스코리아(주)" are the same shop; an empty name matches nothing. */
export function sameMerchant(a: string, b: string): boolean {
  const x = merchantKey(a);
  const y = merchantKey(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

/**
 * Whether two records of a charge agree on *what* it was, beyond the amount:
 * filed under the same category, named alike, or the same brand under two
 * spellings ("넷플릭스" · "NETFLIX.COM").
 *
 * An equal amount on the same account a few days apart is otherwise just a
 * coincidence — and treating a coincidence as "already recorded" drops a real
 * payment without a trace.
 */
export function sameCharge(
  a: { merchant: string; cat: string },
  b: { merchant: string; cat: string },
): boolean {
  if (a.cat === b.cat) return true;
  if (sameMerchant(a.merchant, b.merchant)) return true;
  const brand = findBrand(a.merchant);
  return !!brand && brand.id === findBrand(b.merchant)?.id;
}
