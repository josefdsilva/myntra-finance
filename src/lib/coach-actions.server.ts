/** Prompt + JSON salvage helpers for chat-first actions (server-only). */

export function COACH_ACTION_SYSTEM(categories: string[], today: string): string {
  const cats = categories.length ? categories.join(", ") : "(none defined yet)";
  return `You convert a household's plain-language message into records for a budgeting app.
Today is ${today}.

Choose a "kind" for each item:
- "expense": a one-off purchase/payment that already happened ("spent 34 at Lidl").
- "income_entry": money received once ("got 150 back from the tax office").
- "fixed": a recurring bill, same-ish every month (rent, insurance, subscriptions).
- "variable": a monthly spending estimate for a category (groceries, fuel).
- "income": recurring income (salary, rent received, pension).
- "debt": a loan or financing — amount is the MONTHLY payment; include taeg_pct when an interest rate is mentioned.
- "project": a savings goal — amount is what they want to SET ASIDE PER MONTH.

Rules:
- amount is always a positive number, no currency symbol. For recurring kinds convert to a MONTHLY figure: weekly ×4.33, fortnightly ×2.17, quarterly ÷3, yearly ÷12.
- For a savings goal given as a total ("save 10000 for a trip next year"), divide by the number of months until the deadline to get the monthly amount.
- label: short and human (merchant or goal name).
- category: ONLY for expense/fixed/variable, and ONLY an exact value from this list: ${cats}. If none fits, use null.
- occurred_at: YYYY-MM-DD, only for expense/income_entry, resolving words like "yesterday" against today. Omit if not stated.
- If the message is a question, a comment or has nothing to record, return an empty list.

Shape: {"actions":[{"kind":string,"label":string,"amount":number,"category":string|null,"taeg_pct":number|null,"occurred_at":string|null}]}`;
}

export function extractActionJson(text: string): { actions?: unknown } {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(trimmed) as { actions?: unknown };
  } catch {
    const s = trimmed.indexOf("{");
    const e = trimmed.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(trimmed.slice(s, e + 1)) as { actions?: unknown };
      } catch {
        /* fall through */
      }
    }
    return { actions: [] };
  }
}
