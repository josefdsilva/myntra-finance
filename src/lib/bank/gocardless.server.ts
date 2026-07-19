/**
 * GoCardless Bank Account Data (formerly Nordigen) API client.
 *
 * Server-only. Never import from client code — the `.server.ts` extension
 * enforces that at build time.
 *
 * Docs: https://developer.gocardless.com/bank-account-data
 *
 * Flow we implement:
 *   1. `getToken()`     — exchange secret_id/secret_key for a 24h access token
 *      (cached in memory per worker instance).
 *   2. `listInstitutions(country)` — banks available in a country.
 *   3. `createRequisition({ institution_id, redirect, reference })` — returns
 *      { id, link } where the user must go to consent.
 *   4. GoCardless redirects the user back to `redirect?ref=<reference>`.
 *   5. `getRequisition(id)` — after consent, lists the linked account IDs.
 *   6. `getAccountDetails/Balances/Transactions(id)` — per-account data.
 *
 * Notes on transactions: GoCardless returns { booked, pending } with amount
 * as a *signed* decimal string (negative = debit). We treat pending as
 * skipped (they'll come back as booked with the real transactionId, which
 * would cause duplicates otherwise).
 */

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

type Token = { access: string; access_expires_at: number };
let cachedToken: Token | null = null;

async function getToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.access_expires_at > now + 60) {
    return cachedToken.access;
  }
  const secret_id = process.env.GOCARDLESS_SECRET_ID;
  const secret_key = process.env.GOCARDLESS_SECRET_KEY;
  if (!secret_id || !secret_key) {
    throw new Error("GoCardless is not configured (missing secrets).");
  }
  const res = await fetch(`${BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ secret_id, secret_key }),
  });
  if (!res.ok) {
    throw new Error(`GoCardless token error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { access: string; access_expires: number };
  cachedToken = {
    access: data.access,
    access_expires_at: now + Math.max(60, data.access_expires ?? 3600),
  };
  return cachedToken.access;
}

async function gcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Refresh once on 401 in case the cached token expired mid-request.
    if (res.status === 401) {
      cachedToken = null;
      const t2 = await getToken();
      const res2 = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${t2}`,
          ...(init?.headers ?? {}),
        },
      });
      if (!res2.ok) {
        throw new Error(`GoCardless ${path} ${res2.status}: ${await res2.text()}`);
      }
      return (await res2.json()) as T;
    }
    throw new Error(`GoCardless ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

export type Institution = {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string; // stringified integer
  countries: string[];
  logo: string;
};

const institutionsCache = new Map<string, { at: number; list: Institution[] }>();

export async function listInstitutions(country: string): Promise<Institution[]> {
  const key = country.toUpperCase();
  const cached = institutionsCache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < 12 * 60 * 60 * 1000) return cached.list;
  const list = await gcFetch<Institution[]>(`/institutions/?country=${encodeURIComponent(key)}`);
  institutionsCache.set(key, { at: now, list });
  return list;
}

// ---------------------------------------------------------------------------
// Requisitions
// ---------------------------------------------------------------------------

export type Requisition = {
  id: string;
  status: string;
  link: string;
  accounts: string[];
  institution_id: string;
  reference: string | null;
};

export async function createRequisition(input: {
  institution_id: string;
  redirect: string;
  reference: string;
  agreement?: string;
  user_language?: string;
}): Promise<Requisition> {
  return gcFetch<Requisition>(`/requisitions/`, {
    method: "POST",
    body: JSON.stringify({
      institution_id: input.institution_id,
      redirect: input.redirect,
      reference: input.reference,
      user_language: input.user_language ?? "EN",
      ...(input.agreement ? { agreement: input.agreement } : {}),
    }),
  });
}

export async function getRequisition(id: string): Promise<Requisition> {
  return gcFetch<Requisition>(`/requisitions/${encodeURIComponent(id)}/`);
}

export async function deleteRequisition(id: string): Promise<void> {
  await gcFetch<unknown>(`/requisitions/${encodeURIComponent(id)}/`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type AccountMetadata = {
  id: string;
  status: string;
  iban?: string;
  institution_id: string;
  owner_name?: string;
  currency?: string;
};

export type AccountDetails = {
  account: {
    iban?: string;
    name?: string;
    ownerName?: string;
    displayName?: string;
    product?: string;
    currency?: string;
  };
};

export type AccountBalances = {
  balances: Array<{
    balanceAmount: { amount: string; currency: string };
    balanceType: string;
    referenceDate?: string;
  }>;
};

export type Transaction = {
  transactionId?: string;
  internalTransactionId?: string;
  entryReference?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
};

export type AccountTransactions = {
  transactions: { booked: Transaction[]; pending: Transaction[] };
};

export async function getAccountMetadata(id: string): Promise<AccountMetadata> {
  return gcFetch<AccountMetadata>(`/accounts/${encodeURIComponent(id)}/`);
}

export async function getAccountDetails(id: string): Promise<AccountDetails> {
  return gcFetch<AccountDetails>(`/accounts/${encodeURIComponent(id)}/details/`);
}

export async function getAccountBalances(id: string): Promise<AccountBalances> {
  return gcFetch<AccountBalances>(`/accounts/${encodeURIComponent(id)}/balances/`);
}

export async function getAccountTransactions(
  id: string,
  since: string | null,
): Promise<AccountTransactions> {
  const params = new URLSearchParams();
  if (since) {
    // GoCardless wants YYYY-MM-DD.
    const d = new Date(since);
    if (!Number.isNaN(d.getTime())) {
      params.set("date_from", d.toISOString().slice(0, 10));
    }
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return gcFetch<AccountTransactions>(
    `/accounts/${encodeURIComponent(id)}/transactions/${qs}`,
  );
}

/**
 * Return the "current" balance (interimAvailable → interimBooked → first).
 */
export function pickCurrentBalance(
  balances: AccountBalances["balances"],
): { amount: number; currency: string; at: string | null } | null {
  if (!balances?.length) return null;
  const priority = ["interimAvailable", "interimBooked", "closingBooked", "expected"];
  for (const p of priority) {
    const b = balances.find((x) => x.balanceType === p);
    if (b) {
      const amt = Number(b.balanceAmount.amount);
      if (Number.isFinite(amt)) {
        return {
          amount: amt,
          currency: b.balanceAmount.currency,
          at: b.referenceDate ?? null,
        };
      }
    }
  }
  const first = balances[0];
  const amt = Number(first.balanceAmount.amount);
  return Number.isFinite(amt)
    ? { amount: amt, currency: first.balanceAmount.currency, at: first.referenceDate ?? null }
    : null;
}
