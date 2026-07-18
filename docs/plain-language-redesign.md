# bynku plain-language redesign (reducing conceptual load)

## Why

The app is sophisticated, but its audience is people who need financial guidance and are not financially literate. Today they meet a lot of vocabulary at once: baseline, surplus, real surplus, variable pool, safe to spend, allocations, buckets, project types, cycles, and now plans. Each piece is sensible; together they are a wall.

The goal is not to dumb the app down or strip out the depth. The mission includes teaching people about their money. So the goal is: a default surface a normal person understands in a minute, using plain words, with the richer concepts kept and explained in place rather than assumed or hidden.

## The three levers

Reorganizing the navigation alone does not reduce load. Three disciplines do:

1. Plain language. Every user-facing word should be one a non-financial person already uses. Keep the concept, drop the jargon.
2. Teach in place, do not hide. Lead with the plain headline, keep the detail one tap away, and always attach a short "what's this?" that explains it in plain words (linking to the wiki or the coach). The advanced ideas (the safety margin, the project kinds, loan interest) stay visible, because understanding them is part of the point; they are just introduced gently and always explained. Reduce the burden by not forcing every choice up front (sensible defaults, refine later), not by removing the choice.
3. Self-correcting loops. Where a concept is abstract (the spending estimate), make it concrete and let reality teach it, so the user is not asked to understand or guess in the abstract.

## Target information architecture (plain language)

Organize the app around the questions a normal person already asks about their money, in plain words:

- Money in. Income, each source with a type (salary, rent, pension, benefits, other).
- Money out. Regular bills (fixed monthly expenses and loan payments) and everyday spending (estimate vs actual). Spending is both set up and recorded here, next to each other.
- Save & Invest. The pots you build up: savings goals, an emergency fund, and investments, funded from what is left after Money in minus Money out.
- Coming up. Plans: known future costs and income that are not part of a normal month.

Plus, later, a plain worth view: what you own, minus your loans.

The dashboard stays the daily home ("safe to spend today" and a simple status). Settings shrinks to genuine preferences (household, country, currency, the safety margin, privacy, account), and stops being the place that also holds your income, bills and goals.

## Naming: jargon to plain

- baseline -> "How much do I need" (what a normal month costs). Keep the formula (bills + loans + everyday spending + safety cushion) visible underneath for traceability, so there is no ambiguity about where the number comes from.
- surplus / real surplus -> "what's left" (free to save)
- safety margin -> keep it, and keep it visible, but explain it plainly: a small cushion added on top of your costs so a normal month does not leave you at zero. Shown as part of the "How much do I need" breakdown.
- safe to spend -> keep (already plain)
- fixed monthly expenses -> "regular bills" (or keep "fixed monthly expenses")
- estimated variable costs -> "everyday spending (estimate)" (and fix the Costs/Expenses inconsistency)
- allocations (the page and the action) -> folded into "Save & Invest"; the action is "set aside", not "allocate"
- buckets -> "projects" (finish the rename newer screens already started)
- project kinds -> keep all three: savings, emergency, investment. They are meaningful and worth teaching (the emergency fund is protected, investments are not raided). Introduce them gently with a one-line "what's this?" rather than removing them.
- debt / "what you owe" -> "Loans", a single unified concept used everywhere. Deliberately avoid "owe" and "owed": they blur a loan (borrowed money repaid over time) with an everyday amount owed for a good or service.
- assets / liabilities -> never shown. Use "what you own" and "your loans".
- net worth -> "your worth" = what you own, minus your loans.

## Credit and interest: teach it, do not hide it

Credit is central to most people's financial life and is genuinely hard to fully cost and understand, so the app should build awareness here rather than tuck it away. Keep and surface:

- What a loan really costs. The total interest over its life, how much interest has been paid so far and how much is still to come, and what the rate means in plain money terms per month and per year.
- Interest-rate awareness. Show the effective rate (the app already deduces a consistent rate from principal, payment and maturity) and explain, simply, why a higher rate on a bigger balance hurts most.
- Avalanche and snowball. Keep both as ways to order which loan to attack, each with a plain one-line explanation (avalanche saves the most interest; snowball gives quicker wins), driven by the coach.
- The payoff levers. Keep the "pay an extra amount per month" preview that shows months and interest saved.

This is education, framed in plain language, not a wall of TAN/TAEG acronyms; the acronyms can live behind a "what's this?".

## Two real features this direction implies

The reorganization houses these, but they are genuine builds.

1. Everyday spending: estimate vs actual (the highest teaching value). Keep the estimate, and next to it show the actual spend this cycle per category and how the two are tracking. Let the user adopt the real figure as the new estimate for this or the next cycle. This makes the most abstract chain in the app (estimate -> everyday pool -> safe to spend) concrete and self-correcting, and makes the hidden rule visible: recording an expense spends against your estimate. Feasible today because expenses are already categorized.
2. Income type. A type field on each income (salary, rent, pension, benefits, other). Cheap, and it feeds the coach, sharpens the single-income-source warning, and "rent" hints at owned property for the later worth view.

## Plans vs projects (confirmed distinction)

They are different on purpose, and a plan does not have to become a project.

- A plan is a heads-up on the roadmap: a known cost or income that is not part of a normal month. A yearly car insurance bill is a real, lumpy, but not-monthly burden that is easy to be caught out by. Putting it on the roadmap helps people prepare.
- From a plan the user chooses how to prepare: set up a project and safely accumulate for it, or simply keep the reminder and cover it from savings when it lands. Both are valid; some people want the discipline of a project, others just want the nudge.
- A project is an ongoing pot you save or invest into. Not every plan becomes a project, and that is intentional.

## Help is always one tap away

Whenever something becomes less obvious (the safety margin, a project kind, an interest figure, the difference between a plan and a project), attach a short, plain "what's this?" that explains it in a sentence or two and links to the fuller wiki entry. The vocabulary should be learnable in context, never assumed.

## Sequencing (build on demand, not speculatively)

- Cheap wins now (low risk, clearly right): the Costs -> Expenses consistency fix, finishing buckets -> "projects", the income type field, and renaming baseline to "How much do I need" with the formula kept visible.
- Build as a real feature next (high teaching value): everyday spending estimate vs actual, with adopt-as-new-estimate; and the credit/interest awareness surfacing.
- Validate with beta before committing (high effort, disorienting if wrong): the information-architecture reshuffle itself, moving income, bills, spending and goals out of Settings into Money in / Money out / Save & Invest / Coming up, and retiring "allocations". A wrong reshuffle is expensive to unwind, so show testers first.
