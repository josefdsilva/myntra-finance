/**
 * Bank provider abstraction.
 *
 * bynku's hybrid model: users can (a) enter manually, (b) upload a
 * statement, or (c) link a bank for auto-sync. Regardless of source,
 * transactions land in the Inbox for approval — the provider layer only
 * has to return a normalized shape.
 *
 * Two providers today:
 *  - "mock"       — deterministic synthetic feed, always available, used for
 *                   the UX and integration tests.
 *  - "gocardless" — real PSD2 aggregation via GoCardless Bank Account Data.
 *                   Behind a feature flag: only active when the required
 *                   secrets are present in the server env.
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
// GoCardless provider — stubbed. Wire up when secrets land.
// Docs: https://developer.gocardless.com/bank-account-data
// ---------------------------------------------------------------------------

export function isGoCardlessConfigured(): boolean {
  return !!(
    process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY
  );
}

export const gocardlessProvider: BankProvider = {
  id: "gocardless",
  async listAccounts() {
    throw new Error(
      "GoCardless integration is not configured. Add GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY to enable real bank sync.",
    );
  },
  async fetchTransactions() {
    throw new Error(
      "GoCardless integration is not configured. Add GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY to enable real bank sync.",
    );
  },
};

export function pickProvider(id: string): BankProvider {
  if (id === "gocardless") return gocardlessProvider;
  return mockProvider;
}
