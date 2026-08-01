# bynku — invitation + referral business model

_Design note for later analysis. Prepared August 2026. Not legal or financial advice; confirm tax/company specifics with a contabilista/lawyer._

## The problem it solves

bynku is nearly feature-complete but faces a chicken-and-egg loop: no company yet (no market signal to justify it), want to monetize to prove value, don't want to pay for open banking until there's traction, but users may not pay without open banking — all while keeping a day job and low risk.

This model is a way to **validate willingness-to-pay and retention with a small, paying, invite-only cohort** — cheaply, with controlled growth, and without incorporating (payments run through Paddle, a Merchant of Record, so you can charge as a sole trader with VAT handled).

## Core idea

Invite-only access + a referral discount, redesigned to avoid the three failure modes of a naive "invite 2 friends → free forever" scheme.

The key move: treat it as **two independent dials you control**.

1. **Growth throttle** — governs how fast people get in.
2. **Reward schedule** — governs how much a member saves by referring.

Neither can run away; both are config values changed live (no code, no redeploy).

## The three failure modes it fixes

- **Free cascade / revenue collapse.** "Two referrals = free forever" trends the whole tree toward €0 (each friend also chases free). Fix: a hard price **floor** — discounts lower the price but never reach zero.
- **Throttle vs. incentive conflict.** Invite-only is a brake; a strong referral reward is an accelerator. Fix: a separate **weekly admissions cap** holds total growth (and AI cost) regardless of referral volume.
- **Gaming / vanity signups.** Rewarding any invite invites fraud and fake traction. Fix: a referral **only vests when the friend completes their first paid month**, so every discount is funded by real new revenue and fake accounts earn nothing.

## How it works, end to end

1. Everyone joins by invitation and everyone pays **something** (Paddle handles billing + EU VAT).
2. A new member receives a set number of invites (a number you configure).
3. A friend redeems an invite, subscribes, and completes their **first paid month**.
4. On that qualifying conversion, the referrer earns a reward from the schedule you set: percentage-off, time-boxed, never below the floor, capped at a max number of referrals.
5. Rewards expire (time-boxed) so revenue recovers unless the member keeps referring (up to the cap).

## Your two control dials

**Growth throttle (two knobs)**
- Invites granted per new member (e.g. 2).
- Weekly admissions cap on the whole app (e.g. 40/week) — the real guarantee that growth and AI spend stay inside what you can absorb.
- Plus a global on/off for invites.

**Reward schedule**
- Discount per converted friend (e.g. 25%).
- Duration of each reward (e.g. 6 months).
- Hard price floor (e.g. €3.00 / never below 50%).
- Max referrals counted (e.g. 2).
- AI usage cap per tier (so a discounted seat can't be a cost sink).

## Worked economics (illustrative — tune to reality)

- List price: **€6.00 / month**.
- Paddle fee ≈ 5% + fixed; AI capped at ~€0.20–0.30 / member → full-price contribution ≈ **€4.80**.
- Reward: 25% off for 6 months per converted friend; floor €3.00; cap 2.
  - 1 converted friend → member pays **€4.50**.
  - 2 converted friends → member pays **€3.00** (the floor) — still above AI + infra cost, so **cash-positive even at max discount**, and the two friends are each paying too.
- Contrast with "2 = free forever": you'd lose €6/month indefinitely and both friends would also chase free.

Guiding rule: **a referral reward must cost less than the revenue the referral brings.** Vesting the reward on the friend's first payment guarantees this.

## Guardrails (anti-gaming)

- Reward vests only after the friend's first successful Paddle billing; claws back on a trial refund/cancel.
- No self-referral: block same person / household / payment method / device.
- Price floor enforced server-side.
- AI usage capped per tier regardless of discount.
- Rewards capped per member (e.g. max 2 counted).

## The two surfaces

**Owner control panel (you only).** Every dial as an editable config: list price, invites per new member, weekly admissions cap, reward per converted friend (% + months), price floor, max referrals counted, AI cap per member, "reward vests when", invites on/off. Plus live metrics: members, avg realized price, referral conversion, AI cost/member, weekly joins vs cap.

**Member card.** Founding-member badge; current price with the list price struck through and the active discount + months remaining; a list of their invites with status (converted / pending); and a ladder line — "refer 1 more to reach €X/month, your lowest price."

## Why this is also the validation sprint

A small, invited, **paying** cohort with retention data is the strongest willingness-to-pay signal there is. It needs no company (Paddle MoR), the weekly cap keeps risk and AI cost bounded, and it produces exactly the market signal that would later justify incorporating and adding open banking as a paid tier. Validation + monetization + risk control in one move.

## Build notes (for later)

- Referral logic lives in bynku (track inviter → invitee, vest on first Paddle payment, apply/adjust discount) and calls Paddle's discount API. Modest but real work; handle proration.
- Keep any genuinely-free users on a **separate, AI-capped free tier**, not a €0 paid subscription (a €0 invoice is awkward through a Merchant of Record).
- "Founding member" framing (lock in a low price, early access, shape the roadmap) gives the exclusivity meaning and rewards earliest believers.

## Suggested next step

Fold this into a full go/hold/stop validation plan: the metrics to instrument (activation, week-4 retention, referral conversion, realized price, AI cost/member), a one-page decision scorecard with thresholds, and the concrete screens + data model to add (invites, referral vesting, owner control panel).
