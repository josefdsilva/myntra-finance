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
