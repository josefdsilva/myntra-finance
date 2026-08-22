// Transaction de-duplication for statement import. Re-uploading an overlapping
// statement must never double the ledger, so every imported row gets a stable
// fingerprint and we skip rows whose fingerprint already exists.
//
// The fingerprint is intentionally fuzzy on the description (accents stripped,
// long digit runs like card/reference numbers dropped, first few tokens only) so
// the SAME transaction matches across two exports of the same account even when
// the bank pads the description differently. It is sign-agnostic on amount —
// direction is carried by `kind` — and keyed on the calendar day.

export type FingerprintInput = {
  /** ISO date/datetime; only the calendar day is used. */
  date: string;
  /** Signed or unsigned; only the absolute value (in cents) is used. */
  amount: number;
  description?: string | null;
  kind: "expense" | "income";
};

/** Normalise a bank description to its stable core for matching. */
export function normDesc(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD") // decompose accents; the a-z0-9 filter below drops the marks
    .replace(/\d{4,}/g, " ") // drop long digit runs (card/ref/IBAN fragments)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
}

/** Stable fingerprint for a transaction: day | amount-cents | kind | descCore. */
export function txnFingerprint(i: FingerprintInput): string {
  const day = (i.date || "").slice(0, 10);
  const cents = Math.round(Math.abs(Number(i.amount) || 0) * 100);
  return `${day}|${cents}|${i.kind}|${normDesc(i.description)}`;
}
