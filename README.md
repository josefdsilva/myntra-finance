# bynku

Household budgeting and financial planning app for families and small households.
bynku helps you track expenses, allocate income across buckets, plan for debts and
big-ticket purchases, and get AI-powered coaching grounded in your own numbers.

Live app: <https://bynku.app>

## Features

- **Cycle-based budgeting** — track expenses and income within your chosen pay cycle
- **Bucket allocations** — split surplus across savings, goals, and reserves with a stacked view
- **Debt manager** — TAEG-aware amortization schedules and overpayment planning
- **Plans** — recurring and one-off goals with forecast projections
- **AI Coach** — persistent side-dock chat with rolling memory, playbooks for housing, cars, and credit comparison
- **Statement import** — parse PDFs/CSVs, plus photo and voice quick-add for expenses
- **Benchmarks** — compare your household against Eurostat-sourced country deciles
- **Multi-household** — switch between households you own or belong to
- **i18n** — English, Portuguese, Spanish, German, French, with device-locale detection
- **Privacy-first** — GDPR-compliant data export and full erasure from Settings
- **Installable PWA** — home-screen install with offline shell

## Tech stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React 19, Vite 7, SSR)
- **Styling**: Tailwind CSS v4, Radix UI primitives, shadcn/ui patterns
- **Backend**: Lovable Cloud (Supabase — Postgres, Auth, Storage, RLS)
- **AI**: Lovable AI Gateway via the Vercel AI SDK
- **Deployment**: Cloudflare Workers (workerd) via Nitro
- **Email**: React Email templates delivered through Lovable email infrastructure

## Getting started

```bash
bun install
bun run dev
```

The dev server runs on <http://localhost:8080>. Environment variables are managed
by Lovable Cloud and injected automatically in preview/production.

### Scripts

| Command            | Purpose                                     |
| ------------------ | ------------------------------------------- |
| `bun run dev`      | Vite dev server with HMR                    |
| `bun run build`    | Production build for Cloudflare Workers     |
| `bun run preview`  | Preview the production build locally        |
| `bun run lint`     | ESLint across the repo                      |
| `bun run format`   | Prettier write                              |
| `bun test`         | Bun test runner (unit tests in `src/lib/`)  |

## Project layout

```
src/
  routes/            file-based TanStack routes (pages + /api/public endpoints)
  components/        UI components (app shell, coach dock, forms, charts)
  lib/               business logic, server functions (*.functions.ts), helpers
  integrations/      Supabase clients (auto-generated — do not edit)
  hooks/             React hooks
  styles.css         Tailwind v4 theme tokens
supabase/            local config
docs/                internal planning notes
```

## Contributing

This is a private beta. See `AGENTS.md` for coding conventions used by the
AI-assisted workflow.

## License & attribution

bynku itself is proprietary. It is built on top of open-source software from
many authors — see [`NOTICE.md`](./NOTICE.md) for the full list of dependencies,
their licenses, and copyright notices.
