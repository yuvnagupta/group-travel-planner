// Pure split math shared by the expense form (live preview) and the server
// (what gets stored). Money is always integer cents.

export const SPLIT_TYPES = [
  "even",
  "full",
  "exact",
  "percent",
  "shares",
] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

export const SPLIT_LABELS: Record<SplitType, string> = {
  even: "Split evenly",
  full: "One person covers it",
  exact: "Exact amounts",
  percent: "Percentages",
  shares: "Shares",
};

/** Largest amount accepted for a single item: $1,000,000. */
export const MAX_CENTS = 100_000_000;

/**
 * Splits `total` cents in proportion to `weights` so the parts always sum to
 * `total`. Each part is rounded down, then the leftover cents go one at a time
 * to the largest fractional remainders, ties going to the earlier weight. The
 * result only depends on the inputs and their order, so it's deterministic.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);

  const parts = weights.map((w) => Math.floor((total * w) / sum));
  let leftover = total - parts.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, remainder: (total * w) % sum }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) {
    if (leftover === 0) break;
    parts[i] += 1;
    leftover -= 1;
  }
  return parts;
}

/**
 * What each participant owes for an item. Weights mean: 1 for even/full,
 * cents for exact, basis points for percent and a count for shares. Exact
 * amounts are taken as entered, so check they add up before storing them.
 */
export function shareAmounts(
  type: SplitType,
  amountCents: number,
  weights: number[],
): number[] {
  return type === "exact" ? weights : allocate(amountCents, weights);
}

/** Parses "12", "12.5" or "$1,234.56" into cents, or null if it isn't money. */
export function parseCents(input: string): number | null {
  const v = input.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(v)) return null;
  const [whole = "", frac = ""] = v.split(".");
  return Number(whole || 0) * 100 + Number(frac.padEnd(2, "0"));
}

/** Parses a percentage with up to two decimals ("33.33") into basis points. */
export function parseBasisPoints(input: string): number | null {
  const v = input.trim().replace(/%$/, "");
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(v)) return null;
  const [whole = "", frac = ""] = v.split(".");
  return Number(whole || 0) * 100 + Number(frac.padEnd(2, "0"));
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Formats cents as dollars, e.g. 123456 → "$1,234.56". */
export function formatCents(cents: number) {
  return money.format(cents / 100);
}
