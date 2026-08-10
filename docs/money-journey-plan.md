# Money Journey — a roadmap that turns the numbers into a path

Today bynku has strong financial machinery (projects, allocations, health score, coach
facts) but no sense of *journey*: goals are computed live, achievements evaporate when
edited, and the order-of-operations the coach knows (safety net → kill expensive debt →
invest → life goals) lives only in prose. The Money Journey makes that progression a
first-class, user-controllable object: an ordered **roadmap of stages**, each a milestone
with an objective, a reason, and a reward — authored by the user, drafted by the coach, or
shaped together. It becomes the new home of the "Save & Invest" module, wrapping the
existing project maths rather than replacing them.

Guiding constraints (from the product owner):

- The user must be able to **control the roadmap and add elements** to it directly.
- The coach can **proactively propose** a roadmap, or one can emerge from **iteration with
  the coach**, or the user builds it alone — all three modes are supported.
- The roadmap **relates to and likely replaces the Save & Invest module**, but must **not
  destroy the maths, objectives, and concepts already built**.
- **Achievements, levels, and a visual map** are in scope. **Streaks are optional** and
  deferred until we see whether they add value.

---

## What already exists (reuse, do not rebuild)

- **Projects (`buckets`)** with `kind` (`savings|emergency|investment`), `target_type`
  (`pct_surplus|fixed_monthly|fixed_yearly|goal_by_date`), `target_value`,
  `target_deadline`, `initial_balance`, `color`, `sort_order`, optional reverse asset link
  (`assets.bucket_id`). CRUD lives in `BucketsSection` (settings.tsx).
- **The canonical balance formula** `bucketBalance()` in `src/lib/movements.ts:145`
  (`initial + Σ confirmed allocations + Σ net movements`) and batched `bucketBalancesFor()`.
  Every surface (allocations page, goals-card, net-worth, projection) already agrees on it.
- **Allocation mechanics**: `bucket_allocations` (confirmed_at/period/amount),
  `account_movements` (deposit/withdraw/transfer), `confirmBucketAllocation`,
  `fund_deposit`, Move Funds UI, the "This cycle" allocation card, real/planned allocation
  and surplus totals (allocations.tsx). Untouched by this plan.
- **Health-score pillars** (`src/lib/health-score.ts`): emergency buffer
  (`monthsOfEmergency`), deploy-surplus (`investedShare`, gated at ≥6 months buffer),
  funding-consistency (`fundedFraction`), debt pillar (`debtRatio`). Returns `badges` and
  `debtRatio`.
- **Coach facts** (`src/lib/coach.functions.ts`): `liquidReserve`, `emergencyFundMonths`,
  safety-net months, `investedAmount`, `debtToIncomePct`, `monthlyDebtService`, plus the
  waterfall guidance in the prompt (emergency → debt → invest).
- **Per-cycle snapshots** (`cycle_metrics`): persisted `score_overall`, `badges`,
  `project_funded`; powers trends, compare card (`CycleCompareCard`), momentum.
- **Debt / DTI**: `debtRatio` / `debtToIncomePct`, `monthlyDebtService`, live remaining
  principal via `debt-schedule.ts`, the payoff simulator, and ECB benchmark
  `compareDebtService`.
- **Projection engine** (`projection.functions.ts`): `startingSavings` from bucket
  balances (excluding asset-linked), per-project contribution from `target_type`.
- **Celebration surfaces**: goals-card trophies, `milestoneSignals` (persisted to
  `coach_messages`), `MomentumCard`.

**The gaps.** There is no `stage`/roadmap concept, no persisted `achievements` table (all
medals are recomputed live, so editing a goal erases recognition), no notion of an active
stage or level, and no visual journey. The order-of-operations is implicit in coach prose.

---

## Design principles

1. **The roadmap is an orchestration + progression layer, not new financial math.** A
   stage *reads* values that existing engines already compute (emergency months, DTI,
   invested amount, a project's balance vs target). It never recomputes or overrides them.
   This is how we keep every existing number intact.
2. **Projects live inside the roadmap; they are not replaced.** A `bucket` gains an optional
   `stage_id`. The Save & Invest allocation UI is surfaced within a stage / project detail.
   All balances, targets, and allocations keep working exactly as now.
3. **Non-destructive adoption.** On first load, existing projects auto-map into default
   stages by `kind` (emergency → "Safety net", investment → "Invest", savings/goal → their
   own stage or "Goals"). Nothing is deleted; `/allocations` keeps working during rollout.
4. **Three authoring modes, one data model.** User-created, coach-proposed, and
   collaboratively-refined stages are the same row with a `created_by` of `user` or `coach`
   and a `status`. The coach proposes; the user always has final edit/reorder/delete. The
   roadmap stays **fully editable at all times**, and the coach doesn't only draft a new one
   — it can **review the current roadmap and suggest improvements** (reorder a stage, retune
   a threshold, add a missing stage such as a debt stage when DTI is high, split a bloated
   one). Each suggestion is an accept/ignore proposal; nothing changes without the user.
5. **Every project is born onto the roadmap.** All project-creation entry points feed the
   roadmap so it never drifts out of sync with the projects that exist: the ordinary project
   form (`BucketsSection`) **and** the plan-to-project shortcut ("Save for it" →
   `fundPlanAsProject`, which creates a `goal_by_date` sinking fund) both attach the new
   project to a stage — slotting it into the matching stage by `kind`, or spinning up a
   side-quest stage for it.
6. **A spine plus side-quests.** The main journey is an ordered spine (the order of
   operations), but stages can be marked optional "side-quests" that run in parallel (e.g. a
   house-deposit project alongside investing) — matching how real goals overlap.
7. **Achievements are immutable records.** Earned once, written to a table, never removed by
   later edits. This directly fixes the lost-medal problem.

---

## Data model

New tables (all household-scoped, member RLS like the rest of the schema):

- **`journey_stages`**
  - `id`, `household_id`, `title`, `description`, `sort_order`
  - `objective_type`: `metric | project | debt | custom`
  - `objective_config` (jsonb), interpreted by type:
    - `metric` → `{ key: "emergency_months" | "dti_pct" | "invested_amount" | "net_worth" | "safety_net_months", op: ">=" | "<=", value }`
    - `project` → `{ bucket_id }` (done when that project reaches its target)
    - `debt` → `{ debt_id?, target: "paid_off" | "dti_pct", value? }`
    - `custom` → `{ note }` (user marks done manually)
  - `optional` (bool — side-quest vs spine), `status`: `locked | active | done | skipped`
  - `reached_at` (nullable), `created_by`: `user | coach`, timestamps
- **`achievements`** (immutable log)
  - `id`, `household_id`, `kind` (`stage_complete | goal_reached | badge:<name> | level_up`)
  - `ref_type` / `ref_id` (stage or bucket), `title`, `detail`, `earned_at`, `meta` (jsonb —
    e.g. the value hit and the date)
- **`buckets.stage_id`** (nullable FK → `journey_stages`) — link a project to a stage.
- Level is **derived** (count of completed spine stages, or mapped from health-score tier),
  so no separate table; `level_up` achievements record the crossings.

Objective evaluation reads existing derived values only:

| Objective key | Source (already computed) |
|---|---|
| `emergency_months`, `safety_net_months` | coach facts / health-score `monthsOfEmergency` |
| `dti_pct` | `debtToIncomePct` / health-score `debtRatio` |
| `invested_amount` / share | coach facts `investedAmount`, health `investedShare` |
| `net_worth` | net-worth-card / snapshot |
| project reached | `bucketBalance()` vs `target_value` |
| debt paid off | `debt-schedule.ts` remaining principal |

---

## The default journey (what the coach proposes)

A situation-aware version of the classic order of operations, seeded from existing facts
(income, essentials, debt, dependents, country). Order and thresholds are editable:

1. **Starter buffer** — `emergency_months >= 1` (or a €X floor).
2. **Tame expensive debt** — `dti_pct <= 15%` (or a specific high-interest debt paid off);
   reuses DTI + payoff simulator.
3. **Full safety net** — `emergency_months >= 3`, then a 6-month rung.
4. **Invest for the long term** — `invested_amount >=` a target or `invested_share >=` a %.
5. **Life goals** (side-quests) — `goal_by_date` projects: house deposit, kids, property,
   big purchases — can run in parallel once the safety net is in place.

Each stage carries a one-line rationale (the "why") and a reward (achievement + possible
level-up), so it reads like quests, not chores.

---

## Maths and concepts we must preserve (explicit invariants)

The plan is a no-op for all of these; they remain the single source of truth and the roadmap
only reads them:

- `bucketBalance()` = initial + confirmed allocations + net movements (movements.ts:145).
- The four `target_type` contribution formulas (allocations.tsx + projection mirror).
- Health-score pillars and `badges` (health-score.ts) and their `cycle_metrics` snapshots.
- Coach facts: `liquidReserve`, `emergencyFundMonths`, `investedAmount`, `debtToIncomePct`,
  `monthlyDebtService`, and the waterfall prompt.
- `realAllocated` / `realSurplus` (now windfall-aware), net worth, and the projection
  engine's `startingSavings` (asset-link exclusion intact).

If a stage ever needs a number we don't already compute, we add it to the *existing* engine
and read it — we do not fork the math into the roadmap.

---

## Phased delivery

**Phase 0 — Achievements foundation** *(approved; unblocks everything, fixes lost medals)*
- Migration: `achievements` table + RLS + types.
- Write-on-earn: when a project reaches its target (`goal_by_date`) or a health badge is
  first earned, insert an immutable achievement (idempotent per household + kind + ref).
- Goal lifecycle: a project gains a "reached" state and a persistent "reached €X on <date>"
  badge that survives later target edits. Celebration moment on first reach.
- Surface earned achievements on goals-card / project rows (read from the table).

**Phase 1 — Journey data model + read-only roadmap**
- Migration: `journey_stages` + `buckets.stage_id` + RLS + types.
- Non-destructive backfill: auto-map existing projects into default stages by `kind`.
- New Roadmap page rendering stages as a vertical list first (locked/active/done), each
  showing its objective, progress (from the live metric/project), and nested project(s).
- Read the Save & Invest allocation card into the active stage / project detail (reuse
  components, no logic change).

**Phase 2 — User authoring**
- Add / edit / reorder / delete stages; set `objective_type` + config; mark `optional`
  side-quests; link/unlink projects to stages; manual "mark done" for `custom`.
- Full CRUD server fns + i18n (5 locales).
- **Project creation attaches to the roadmap**: wire `fundPlanAsProject` ("Save for it") and
  `BucketsSection` so a newly created project is placed onto a stage automatically — matched
  to the stage whose `kind` fits, else a new side-quest stage — with the placement editable
  afterwards.

**Phase 3 — Coach authoring + collaboration**
- "Draft my roadmap" action: coach proposes the situation-aware default journey from
  existing facts; user reviews, edits, accepts (bulk insert of `created_by:"coach"` stages).
- Collaborative refinement in coach chat: a structured "propose stage" the user confirms
  (e.g. "add a house-deposit stage after investing").
- Proactive nudge (coach inbox) offering to draft a roadmap when none exists.
- **Ongoing improvement suggestions**: the coach periodically reviews the *existing* roadmap
  against current facts and proposes concrete edits (reorder, retune a threshold, add or
  split a stage, flag a stage that no longer fits) as accept/dismiss items on the roadmap or
  in the inbox — so the roadmap keeps improving, not just gets created once.

**Phase 4 — Auto-evaluation + progression**
- On the existing on-open daily pass (and cycle close), evaluate the active spine stage's
  objective against live metrics; when met: set `done`, write a `stage_complete`
  achievement, unlock the next spine stage, emit a celebratory coach message.
- Derive level from completed spine stages; record `level_up` achievements.
- Coach prompt learns the active stage so nudges point at the current quest.

**Phase 5 — Visual map + gamification polish**
- The journey rendered as a path/map (nodes = stages, states, connectors), current level and
  title, an achievements gallery.
- Streaks: reconsider here (optional). The existing `MomentumCard` stays where it is; we only
  foreground streaks if they prove motivating.

**Phase 6 — Make Roadmap the Save & Invest home**
- Point the "Save & Invest" nav entry at the Roadmap; keep the allocation mechanics inside a
  stage/project detail. Redirect `/allocations` or fold it in. Wording + wiki update + i18n.
- Retire duplicate summary surfaces once the roadmap covers them.

---

## Open decisions (for you)

1. **Name**: "Money Journey", "Roadmap", "Plan", "Path"? (Affects nav + i18n.)
2. **Replace vs coexist**: does Roadmap take over the "Save & Invest" nav slot from Phase 1,
   or live alongside it until Phase 6?
3. **Level definition**: count of completed spine stages, or mapped from the health-score
   tier, or a light XP model?
4. **How prescriptive is the coach's default**: a fixed order-of-operations spine, or fully
   personalised ordering per situation?
5. **Spine strictness**: are spine stages locked until the previous completes, or advisory
   with everything editable? (Recommended: advisory spine + optional parallel side-quests.)
6. **Streaks**: include from Phase 5, or leave out entirely for now?

---

## Recommended first move

Build **Phase 0** now. It is independently valuable (it fixes the lost-medal problem you
hit), it needs only one small migration plus write-on-earn wiring, and every later phase —
stages, levels, the visual map — is built on persisted achievements. Once it is in, Phase 1
turns the existing projects into the first read-only roadmap without risking any of the
established maths.

---

# Addendum — Two objective families: Projects and KPI Targets

*(Product owner decisions, Aug 2026. This supersedes the single "objective" framing above:
the roadmap now connects to two first-class entities, not one.)*

## The core distinction: funded vs. measured

The Journey has always modelled objectives three ways (`metric | project | custom`). We now
promote that into two **user-visible, first-class entities** that both live in the (renamed)
Save & Invest area and that any Journey stage links to:

- **Projects (funded goals).** Exactly today's `buckets`: a pot with a balance you allocate
  money into, a target €, an optional deadline, a `kind` (savings / investment / emergency).
  Money flows in; progress = `bucketBalance()` ÷ target. **Unchanged** — none of the existing
  allocation, net-worth, projection, or health maths moves.
- **KPI Targets (measured goals).** A **new** lightweight entity: a chosen metric, an
  operator, a target value, and an *optional* date. Nothing flows in; progress is **computed
  live** from data bynku already holds. Examples: debt-to-income ≤ 15%, total monthly income
  ≥ €X, income concentration ≤ 70%, invested ≥ N months, emergency ≥ 6 months.

Why two entities and not one flattened table: a funded goal *accumulates money you set
aside*; a KPI target is a *structural outcome measured from your whole picture*. Flattening
them invites the nonsense of "allocate money to lower my DTI" and would entangle KPI logic
with the bucket maths we must not disturb. Two entities, one umbrella, different affordances
(a project shows balance + allocations; a KPI shows current value vs target + trend).

## Decisions locked in

1. **Two separate entities** — Projects (funded) and KPI Targets (measured). Confirmed.
2. **Both live under a renamed Save & Invest, split into two tabs** — one tab for Projects,
   one for KPI Targets. (Name TBD, e.g. "Goals & Targets" / "Save, Invest & Improve".)
3. **Every Journey stage connects to exactly one entity** — a Project *or* a KPI Target.
   `custom`/manual stages are retired in favour of "link it to a real, trackable goal"
   (existing manual stages migrate or stay read-only legacy).
4. **Reach objectives only — no "maintain" mode.** A KPI target is *reached once* and earns
   a medal (like a project hitting its goal). We do **not** build maintain/streak semantics.
5. **Degradation is the coach's job, not the target's.** Instead of a "maintain" state, the
   coach **watches important KPIs and messages the user when one degrades.** A one-off dip is
   noted but not escalated; only when a violation becomes **consistent** (persists across
   cycles) does the coach recommend acting on it and offer to **add a Reach KPI Target to the
   Journey** to fix it. This keeps discipline in the coaching layer, not in a nagging status.

## Data model changes

- **`kpi_targets`** (new, household-scoped, member RLS):
  - `id`, `household_id`, `title`, `metric_key`, `op` (`>=` | `<=`), `target_value`,
    `target_date` (nullable), `status` (`active | reached`), `reached_at` (nullable),
    `created_by` (`user | coach`), `sort_order`, timestamps.
  - `metric_key` registry (all read from **existing** engines — see invariants):
    `dti_pct`, `total_income`, `income_concentration`, `spending_vs_plan`,
    `emergency_months`, `invested_months`, `invested_years`, `net_worth`.
- **`journey_stages`**: keep `objective_type` but the meaningful values become `project`
  (`{ bucket_id }`) and `metric` (now `{ kpi_target_id }`, pointing at a real KPI Target row
  rather than an inline threshold). Inline-threshold metric configs migrate into
  `kpi_targets` rows. `custom` deprecated.
- **`income_concentration`** is computable today (largest income row ÷ total) with no schema
  change; a later per-source `kind` label makes it richer but is not required to ship.
- **Reuse, don't fork:** every `metric_key` maps to the same computation the health score and
  coach facts already use. A KPI target *reads*; it never recomputes. (Same invariant as the
  rest of this doc — see "Maths and concepts we must preserve".)

## KPI Target with an optional date = trajectory

A dated KPI target unlocks the **time-value / trajectory indicator** (the same one designed
for funded goals): "to reach total income €X by <date> you need +€Y/mo of new income," or for
a savings goal, the nominal-vs-today's-money view. Undated targets are open-ended ("get here
eventually"). This gives Projects and KPI Targets the same date-aware progress language.

## Coach degradation watch (replaces "maintain")

- On the existing on-open / cycle-close pass, compare each watched KPI to its recent history
  (reuse `cycle_metrics` snapshots — DTI, badges, invested share already persist there).
- **One-off vs consistent:** a single-cycle regression is recorded silently; a regression
  that **persists ≥ N cycles** (start N=2) triggers a coach message: "your debt-to-income has
  climbed for two cycles — want to make this a target on your Journey?"
- The message offers a one-tap **"add as a Reach KPI Target"** that creates the row and links
  a Journey stage — closing the loop from *observation* to *plan* without nagging.

## Where this lands in the phases

- **Projects tab** = today's Save & Invest UI, essentially as-is, under the renamed section.
- **New work** concentrates in: the `kpi_targets` table + metric registry (Phase 1-ish), the
  KPI Targets tab + CRUD + i18n (extends Phase 2), Journey stages linking to a KPI target
  instead of an inline threshold (extends Phase 2), and the coach degradation watch (extends
  the Phase 3/4 proactive-suggestion work).
- **Ship order:** (a) `kpi_targets` model + read-only KPI tab reusing existing metrics;
  (b) Journey stage → KPI-target link + creation from the Edit panel; (c) coach degradation
  watch + "add as target" loop last, since it depends on both.

## Decisions (settled, Aug 2026)

1. **Section name**: **"Save, Invest & Improve"** — keeps the familiar Save & Invest and adds
   "Improve" for KPIs. Two tabs inside: Projects and KPI Targets.
2. **Metric registry v1**: **ship everything** — `dti_pct`, `emergency_months`,
   `invested_months`, `invested_years`, `total_income`, `income_concentration`,
   `spending_vs_plan`. (spending_vs_plan needs the most wiring; it lands last within v1.)
3. **Degradation threshold N = 2** consecutive cycles of regression before the coach speaks up.
4. **Legacy `custom` stages**: **auto-migrate where an obvious KPI/project match exists**;
   leave the rest as read-only legacy the user can delete.

## Build order

- **(a) — DONE.** `kpi_targets` migration + types + shared **metric registry** (`src/lib/metrics.ts`,
  reads existing engines, never forks the maths) + **Grow** section (renamed Save & Invest)
  with Projects and Targets tabs, full CRUD. Migration `20260810120000_kpi_targets.sql`.
- **(b) — DONE.** Journey stage → KPI-target link. "Add a target" button in Journey edit mode
  opens a picker of existing targets (excludes already-linked) and creates a linked metric
  stage (`objective_config.kpi_target_id`). Journey now computes all seven metrics; an
  unavailable metric shows 0% and never falsely completes (same guard as the medal fix).
- **(c) — DONE.** Coach degradation watch (`degradationSignals` in `coach-signals.ts`, wired in
  `coach-runner.server.ts`): watches emergency_months, dti_pct, spending_vs_plan; fires a warn
  nudge when a metric worsens 2 consecutive cycles AND is in a concern zone; deduped once per
  metric per cycle. The nudge links to `/journey?kpi=&op=&value=`, which opens a prefilled
  confirm that creates a coach-authored KPI target + linked stage in one tap.

## Follow-ups (not yet built)

- **Snapshot the remaining four metrics per cycle** so the degradation watch can cover all
  seven. Today only emergency_months, dti_pct and spending_vs_plan have per-cycle history in
  `cycle_metrics`; `invested_months`, `invested_years`, `income_concentration` (and a clean
  `total_income`) are computed live and discarded. Add them to the `metrics` JSONB (or new
  columns) written at cycle close in `cycle-metrics.functions.ts`/`cycle-metrics.ts`, then
  read them in the runner's series map. Note: builds history **going forward** only — a
  two-cycle decline on the new metrics can't be detected until two more cycles close.
- **Coach de-dup vs. KPI targets**: extend the coach's existing stage-dedup so it also skips
  proposing a metric already covered by a linked KPI-target stage.
- **Auto-migrate legacy `custom` stages** into KPI targets where an obvious match exists
  (decided, not yet implemented).
- **Time-value / trajectory indicator** for dated KPI targets and funded goals (the kids-fund
  real-vs-nominal view), reusing the Fast Forward projection.
