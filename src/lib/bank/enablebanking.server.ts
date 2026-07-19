/**
 * Enable Banking (enablebanking.com) API client — server-only.
 *
 * PSD2 aggregator alternative to GoCardless BAD. Free tier covers sandbox
 * + a small number of live users; paid beyond that (see enablebanking.com).
 *
 * Auth: signed JWT (RS256) using the application's private key. The
 * `kid` header is the application id issued by Enable Banking. The token
 * is short-lived and re-minted per request (cheap; no server-side cache
 * needed for correctness).
 *
 * Docs: https://enablebanking.com/docs/api/reference/
 *
 * NOTE: This file is a *skeleton*. It compiles and cleanly reports
 * "not configured" until ENABLE_BANKING_APP_ID and
 * ENABLE_BANKING_PRIVATE_KEY are set. Endpoint paths and payload shapes
 * are placeholders — fill them in against the live API once credentials
 * are available and the Node crypto sign step is implemented.
 */

const BASE_URL = "https://api.enablebanking.com";

export function isEnableBankingConfigured(): boolean {
  return !!(process.env.ENABLE_BANKING_APP_ID && process.env.ENABLE_BANKING_PRIVATE_KEY);
}

/**
 * Mint a short-lived JWT for the Enable Banking API.
 *
 * Placeholder — signs with RS256 using the PEM private key in
 * ENABLE_BANKING_PRIVATE_KEY. Replace with the real implementation once
 * credentials exist and you can test against the sandbox.
 */
async function mintToken(): Promise<string> {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const privateKeyPem = process.env.ENABLE_BANKING_PRIVATE_KEY;
  if (!appId || !privateKeyPem) {
    throw new Error("Enable Banking is not configured (missing secrets).");
  }
  const { createSign } = await import("crypto");
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (buf: Buffer) =>
    buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(
    Buffer.from(JSON.stringify(payload)),
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const sig = b64url(signer.sign(privateKeyPem));
  return `${signingInput}.${sig}`;
}

/**
 * Exchange the authorization `code` returned in the redirect for a session.
 * The session carries the list of granted account UIDs used downstream.
 */
export type EbCreateSession = {
  session_id: string;
  accounts: Array<{ uid: string; identification_hash?: string }>;
  aspsp?: { name: string; country: string };
};

export async function createSession(code: string): Promise<EbCreateSession> {
  return ebFetch<EbCreateSession>(`/sessions`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

async function ebFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await mintToken();
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
    throw new Error(`Enable Banking ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Institutions (ASPSPs)
// ---------------------------------------------------------------------------

export type EbAspsp = {
  name: string;
  country: string;
  logo?: string;
  psu_types?: string[];
  maximum_consent_validity?: number;
  bic?: string;
};

export async function listAspsps(country: string): Promise<EbAspsp[]> {
  // TODO: verify path against Enable Banking docs (likely /aspsps?country=..).
  const res = await ebFetch<{ aspsps: EbAspsp[] }>(
    `/aspsps?country=${encodeURIComponent(country.toUpperCase())}`,
  );
  return res.aspsps ?? [];
}

// ---------------------------------------------------------------------------
// Authorization / sessions
// ---------------------------------------------------------------------------

export type EbAuthStart = { url: string; authorization_id: string };

export async function startAuthorization(input: {
  aspsp_name: string;
  aspsp_country: string;
  redirect_url: string;
  state: string;
  psu_type?: "personal" | "business";
  valid_until?: string;
}): Promise<EbAuthStart> {
  // TODO: exact payload per Enable Banking /auth spec.
  return ebFetch<EbAuthStart>(`/auth`, {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: input.valid_until },
      aspsp: { name: input.aspsp_name, country: input.aspsp_country },
      state: input.state,
      redirect_url: input.redirect_url,
      psu_type: input.psu_type ?? "personal",
    }),
  });
}

export type EbSession = {
  session_id: string;
  status: string;
  accounts: Array<{ uid: string; identification_hash?: string }>;
};

export async function getSession(sessionId: string): Promise<EbSession> {
  return ebFetch<EbSession>(`/sessions/${encodeURIComponent(sessionId)}`);
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type EbAccountDetails = {
  uid: string;
  name?: string;
  product?: string;
  account_id?: { iban?: string; other?: { identification?: string } };
  currency?: string;
};

export async function getAccountDetails(uid: string): Promise<EbAccountDetails> {
  return ebFetch<EbAccountDetails>(`/accounts/${encodeURIComponent(uid)}/details`);
}

export type EbBalance = {
  balance_amount: { amount: string; currency: string };
  balance_type: string;
  reference_date?: string;
};

export async function getAccountBalances(uid: string): Promise<{ balances: EbBalance[] }> {
  return ebFetch<{ balances: EbBalance[] }>(
    `/accounts/${encodeURIComponent(uid)}/balances`,
  );
}

export type EbTransaction = {
  transaction_id?: string;
  entry_reference?: string;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator?: "CRDT" | "DBIT";
  status?: "BOOK" | "PDNG";
  booking_date?: string;
  value_date?: string;
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[];
};

export async function getAccountTransactions(
  uid: string,
  since: string | null,
): Promise<{ transactions: EbTransaction[] }> {
  const qs = new URLSearchParams();
  if (since) {
    const d = new Date(since);
    if (!Number.isNaN(d.getTime())) qs.set("date_from", d.toISOString().slice(0, 10));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return ebFetch<{ transactions: EbTransaction[] }>(
    `/accounts/${encodeURIComponent(uid)}/transactions${suffix}`,
  );
}

export function pickEbCurrentBalance(
  balances: EbBalance[],
): { amount: number; currency: string; at: string | null } | null {
  if (!balances?.length) return null;
  const priority = ["INTERIM_AVAILABLE", "INTERIM_BOOKED", "CLOSING_BOOKED", "EXPECTED"];
  for (const p of priority) {
    const b = balances.find((x) => x.balance_type?.toUpperCase() === p);
    if (b) {
      const amt = Number(b.balance_amount.amount);
      if (Number.isFinite(amt)) {
        return {
          amount: amt,
          currency: b.balance_amount.currency,
          at: b.reference_date ?? null,
        };
      }
    }
  }
  const first = balances[0];
  const amt = Number(first.balance_amount.amount);
  return Number.isFinite(amt)
    ? { amount: amt, currency: first.balance_amount.currency, at: first.reference_date ?? null }
    : null;
}
