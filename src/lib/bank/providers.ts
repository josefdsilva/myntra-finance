/**
 * Bank provider abstraction.
 *
 * bynku's hybrid model: users can (a) enter manually, (b) upload a
 * statement, or (c) link a bank for auto-sync. Regardless of source,
 * transactions land in the Inbox for approval — the provider layer only
 * has to return a normalized shape.
 *
 * Two providers:
 *  - "mock"       — deterministic synthetic feed, always available.
 *  - "gocardless" — real PSD2 aggregation via GoCardless Bank Account Data.
 *                   Server-only imports (`.server.ts`) are lazy-loaded inside
 *                   the async methods so this module stays client-safe.
 */

export type NormalizedBankTx = {
  external_transaction_id: string;
  amount: number; // positive number; `kind` decides direction
  kind: "expense" | "income";
  currency: string;
  occurred_at: string; // ISO
  merchant: string | null;
  note: string | null;
  raw: Record<string, unknown>;
};

export type NormalizedBankAccount = {
  external_account_id: string;
  display_name: string;
  iban_last4: string | null;
  currency: string;
  last_balance: number | null;
  last_balance_at: string | null;
};

export type BankProvider = {
  id: "mock" | "gocardless";
  listAccounts(connection: {
    requisition_id: string | null;
    institution_id: string | null;
  }): Promise<NormalizedBankAccount[]>;
  fetchTransactions(input: {
    external_account_id: string;
    since: string | null;
  }): Promise<NormalizedBankTx[]>;
};

// ---------------------------------------------------------------------------
// Mock provider — deterministic feed. Every call returns the same seeded set
// so approving once and syncing again does not re-populate the inbox.
// ---------------------------------------------------------------------------

const MOCK_ACCOUNTS: NormalizedBankAccount[] = [
  {
    external_account_id: "mock-acc-checking",
    display_name: "Mock Checking",
    iban_last4: "4242",
    currency: "EUR",
    last_balance: 2450.13,
    last_balance_at: new Date().toISOString(),
  },
  {
    external_account_id: "mock-acc-savings",
    display_name: "Mock Savings",
    iban_last4: "9931",
    currency: "EUR",
    last_balance: 8420.0,
    last_balance_at: new Date().toISOString(),
  },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const MOCK_TX: Record<string, NormalizedBankTx[]> = {
  "mock-acc-checking": [
    {
      external_transaction_id: "mock-tx-1",
      amount: 47.9,
      kind: "expense",
      currency: "EUR",
      occurred_at: daysAgo(1),
      merchant: "Continente",
      note: "Groceries",
      raw: {},
    },
    {
      external_transaction_id: "mock-tx-2",
      amount: 12.5,
      kind: "expense",
      currency: "EUR",
      occurred_at: daysAgo(2),
      merchant: "Uber",
      note: null,
      raw: {},
    },
    {
      external_transaction_id: "mock-tx-3",
      amount: 850.0,
      kind: "expense",
      currency: "EUR",
      occurred_at: daysAgo(3),
      merchant: "Landlord",
      note: "Rent Nov",
      raw: {},
    },
    {
      external_transaction_id: "mock-tx-4",
      amount: 2100.0,
      kind: "income",
      currency: "EUR",
      occurred_at: daysAgo(5),
      merchant: "Employer Ltd",
      note: "Salary",
      raw: {},
    },
  ],
  "mock-acc-savings": [
    {
      external_transaction_id: "mock-tx-s1",
      amount: 200.0,
      kind: "income",
      currency: "EUR",
      occurred_at: daysAgo(6),
      merchant: "Interest",
      note: null,
      raw: {},
    },
  ],
};

export const mockProvider: BankProvider = {
  id: "mock",
  async listAccounts() {
    return MOCK_ACCOUNTS;
  },
  async fetchTransactions({ external_account_id }) {
    return MOCK_TX[external_account_id] ?? [];
  },
};

// ---------------------------------------------------------------------------
// GoCardless provider — real PSD2 aggregation. Requires GOCARDLESS_SECRET_ID
// and GOCARDLESS_SECRET_KEY. Server-only imports are lazy so this file is
// still safe to import from client code.
// ---------------------------------------------------------------------------

export function isGoCardlessConfigured(): boolean {
  return !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY);
}

function last4(iban?: string | null): string | null {
  if (!iban) return null;
  const compact = iban.replace(/\s+/g, "");
  return compact.length >= 4 ? compact.slice(-4) : null;
}

function pickMerchant(t: {
  creditorName?: string;
  debtorName?: string;
  amount: number;
}): string | null {
  // Expense (negative or "expense" kind): counterparty is the creditor.
  // Income  (positive): counterparty is the debtor.
  if (t.amount < 0) return t.creditorName ?? t.debtorName ?? null;
  return t.debtorName ?? t.creditorName ?? null;
}

export const gocardlessProvider: BankProvider = {
  id: "gocardless",
  async listAccounts({ requisition_id }) {
    if (!requisition_id) return [];
    const gc = await import("./gocardless.server");
    const req = await gc.getRequisition(requisition_id);
    const out: NormalizedBankAccount[] = [];
    for (const id of req.accounts ?? []) {
      try {
        const [details, balances] = await Promise.all([
          gc.getAccountDetails(id),
          gc.getAccountBalances(id).catch(() => ({ balances: [] as never[] })),
        ]);
        const acc = details.account ?? {};
        const bal = gc.pickCurrentBalance(balances.balances ?? []);
        out.push({
          external_account_id: id,
          display_name:
            acc.displayName ??
            acc.name ??
            acc.ownerName ??
            acc.product ??
            (acc.iban ? `Account ${last4(acc.iban)}` : "Bank account"),
          iban_last4: last4(acc.iban),
          currency: acc.currency ?? bal?.currency ?? "EUR",
          last_balance: bal?.amount ?? null,
          last_balance_at: bal?.at ?? null,
        });
      } catch {
        // A single account failing shouldn't block the rest.
      }
    }
    return out;
  },
  async fetchTransactions({ external_account_id, since }) {
    const gc = await import("./gocardless.server");
    const { transactions } = await gc.getAccountTransactions(external_account_id, since);
    const rows: NormalizedBankTx[] = [];
    for (const t of transactions.booked ?? []) {
      const amtNum = Number(t.transactionAmount?.amount);
      if (!Number.isFinite(amtNum) || amtNum === 0) continue;
      const externalId =
        t.transactionId ?? t.internalTransactionId ?? t.entryReference ?? null;
      if (!externalId) continue; // no stable id => skip; would risk dupes
      const occurred = t.bookingDate ?? t.valueDate ?? new Date().toISOString().slice(0, 10);
      const noteParts = [
        t.remittanceInformationUnstructured,
        ...(t.remittanceInformationUnstructuredArray ?? []),
        t.additionalInformation,
      ].filter((x): x is string => !!x && x.trim().length > 0);
      rows.push({
        external_transaction_id: externalId,
        amount: Math.abs(amtNum),
        kind: amtNum < 0 ? "expense" : "income",
        currency: t.transactionAmount.currency,
        occurred_at: new Date(occurred).toISOString(),
        merchant: pickMerchant({
          creditorName: t.creditorName,
          debtorName: t.debtorName,
          amount: amtNum,
        }),
        note: noteParts.length ? noteParts.join(" · ") : null,
        raw: t as unknown as Record<string, unknown>,
      });
    }
    return rows;
  },
};

export function pickProvider(id: string): BankProvider {
  if (id === "gocardless") return gocardlessProvider;
  return mockProvider;
}
