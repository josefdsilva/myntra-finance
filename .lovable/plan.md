# Dashboard clarity + Web Push notifications

Two bundled deliveries. Ship dashboard polish first (fast, no infra), then wire push (requires VAPID + cron).

## 1. Dashboard clarity (frontend only)

In `src/routes/_authenticated/dashboard.tsx`:

- **Trend indicator** next to "Safe to spend per day": compute yesterday's would-be safe amount (remaining_yesterday ÷ days_left_yesterday) and show `↑ +€X.XX` / `↓ −€X.XX` vs today, muted color.
- **7-day sparkline** under the hero: tiny inline SVG (or reuse recharts `<Line>` at ~40px height) of daily net spend for the last 7 days, dashed horizontal line at current `safeToday`.
- **Clickable tags**: Spent / Received / Balance become buttons that scroll to Recent Expenses and filter that list (local state: `filter: 'all'|'spent'|'received'`).
- **Projected end-of-cycle balance**: new stat card = `remaining − (avgDailySpendLast7 × daysLeft)`; green if ≥0, red if <0, with "at current pace" hint.

All computed client-side from data already loaded — no schema, no server changes.

## 2. Web Push notifications

### Prereqs / secrets
- Generate VAPID keys → store `VAPID_PUBLIC_KEY` (also exposed as `VITE_VAPID_PUBLIC_KEY`) and `VAPID_PRIVATE_KEY` via `generate_secret` / `set_secret`. Subject: `mailto:eng.nandomoreira@gmail.com`.
- Uses existing `LOVABLE_API_KEY` for AI summary (Gemini 3 Flash).

### Schema (new migration)
```
push_subscriptions(
  id uuid pk, user_id uuid → auth.users, household_id uuid → households,
  endpoint text unique, p256dh text, auth text,
  user_agent text, created_at timestamptz
)
notification_prefs(
  user_id uuid pk → auth.users,
  weekly_digest bool default false,
  baseline_warn bool default false,      -- 80% + reached
  emergency_warn bool default false,     -- 80% + depleted
  updated_at timestamptz
)
notification_log(
  id uuid pk, user_id uuid, kind text, sent_at timestamptz,
  payload_hash text  -- for dedup, e.g. 'baseline_reached:<cycle_start>'
)
```
Full RLS + GRANTs (user reads/writes own rows; service_role all).

### Server functions (`src/lib/push.functions.ts`)
- `getVapidPublicKey()` — returns `VITE_VAPID_PUBLIC_KEY` (public, no auth).
- `subscribePush({endpoint,p256dh,auth,user_agent})` — auth'd; upsert.
- `unsubscribePush({endpoint})` — auth'd.
- `getNotificationPrefs()` / `updateNotificationPrefs({...})` — auth'd.
- `sendTestPush()` — auth'd; sends "Notifications enabled ✓" to caller's endpoints.

### Settings UI additions (in `src/routes/_authenticated/settings.tsx`)
New "Notifications" card per member (current user only):
- Enable button → requests browser permission, registers SW, POSTs subscription.
- Three toggles (all default OFF): Weekly digest / Baseline warnings / Emergency pool warnings.
- "Send test notification" button.

### Service worker `public/sw.js`
Handles `push` event → `showNotification(title, {body, icon:'/app-icon.png', data:{url}})`, and `notificationclick` → focus/open `data.url`.

### Public API routes (cron targets, `/api/public/hooks/*`)
Auth: `apikey` header = Supabase anon key (per stack rules).

- **`weekly-digest.ts`** — for each household, for each member with `weekly_digest=true`:
  1. Query expenses last 7d + prior 7d (exclude fixed & salary).
  2. Compute totals, top-3 spent, top-3 received, WoW delta, remaining-before-baseline, emergency pool.
  3. Call Lovable AI (`google/gemini-3-flash-preview`) with a compact JSON prompt → short paragraph.
  4. Send push with title "Weekly overview" and short body; `data.url = /analysis`.
  5. Log to `notification_log`.

- **`budget-alerts.ts`** — runs every 30 min. For each household:
  - Compute cycle spend vs baseline pool and vs emergency pool.
  - Fire `baseline_warn` at ≥80% (once per cycle) and 100% (once per cycle), keyed via `payload_hash` dedup.
  - Fire `emergency_warn` at ≥80% consumed and 100% consumed, same dedup.
  - Only to members opted-in.

### Push delivery helper (`src/lib/webpush.server.ts`)
Uses `web-push` npm package (Worker-compatible via WebCrypto build; if incompat, fall back to sending via a fetch to VAPID-signed request built manually). Handles 404/410 → delete subscription.

### pg_cron
```sql
-- Mondays 08:00 Europe/Lisbon = 07:00 UTC (WET) / 07:00 UTC (WEST → also 07:00 since Lisbon = UTC+1 in summer, so 07:00 UTC is 08:00 local; in winter it's 08:00 UTC = 08:00 local).
-- Simplest: run at both 07:00 UTC and 08:00 UTC? No — schedule daily gate inside handler.
-- Chosen: cron at 07:00 UTC daily; handler checks it's Monday in Europe/Lisbon and it's the 08:00 local hour.
select cron.schedule('weekly-digest', '0 7 * * *', $$
  select net.http_post(url:='.../api/public/hooks/weekly-digest',
    headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb, body:='{}'::jsonb);
$$);
select cron.schedule('budget-alerts', '*/30 * * * *', $$
  select net.http_post(url:='.../api/public/hooks/budget-alerts',
    headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb, body:='{}'::jsonb);
$$);
```
Handler filters "is it Monday 08:00 in Europe/Lisbon?" using `Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',...})`.

### Notes & tradeoffs
- Web Push on iOS Safari requires the site to be installed as PWA (home-screen). Android/desktop Chrome/Firefox/Edge work out of the box. I'll note this in the settings card.
- `web-push` on Cloudflare Worker: verified via WebCrypto — if the npm package's Node crypto path breaks, I'll inline a minimal VAPID JWT signer (~40 lines) using `crypto.subtle`.
- Dedup via `notification_log.payload_hash` prevents alert spam across the 30-min cron.
- AI text is short (≤ 60 words) so it fits the push body.

## Order of implementation
1. Dashboard clarity changes (single file).
2. Schema migration + GRANTs + RLS.
3. VAPID secrets.
4. Service worker + client subscribe flow + Settings UI.
5. `push.functions.ts` + `webpush.server.ts`.
6. Two public cron routes + pg_cron schedules.
7. Manual "Send test" verification, then trigger digest handler once to sanity-check.

Ready to proceed?
