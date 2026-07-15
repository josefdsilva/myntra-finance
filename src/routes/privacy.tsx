import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & data — bynku" },
      {
        name: "description",
        content:
          "How bynku collects, stores, and protects your household's financial data. GDPR rights, data-sharing scope, and account deletion.",
      },
      { property: "og:title", content: "Privacy & data — bynku" },
      {
        property: "og:description",
        content:
          "How bynku collects, stores, and protects your household's financial data. GDPR rights, data-sharing scope, and account deletion.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED = "10 July 2026";

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <nav className="mb-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Home
          </Link>
        </nav>

        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Maintained by the bynku app owner
          </p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">Privacy &amp; data</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: {UPDATED}. This page explains what bynku stores, who can see it, and how
            to erase it. It is written to comply with the EU General Data Protection Regulation
            (GDPR).
          </p>
        </header>

        <Section title="Who runs bynku">
          <p>
            bynku is a small, self-hosted household budgeting app. The developer operates it as a
            personal / test project and is the <strong>data controller</strong> for the purposes of
            GDPR. Contact for privacy requests: use the email address you signed in with — the
            developer will reply to that account.
          </p>
        </Section>

        <Section title="What data we store">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Account</strong> — your email address and (if you used Google) your Google
              display name and avatar URL, stored by our authentication provider.
            </li>
            <li>
              <strong>Profile</strong> — a display name you can edit.
            </li>
            <li>
              <strong>Household financial data</strong> — incomes, fixed expenses, variable
              estimates, allocation buckets, individual expenses (amount, date, category, optional
              note), and analysis summaries you generate.
            </li>
            <li>
              <strong>Optional inputs</strong> — receipt photos, short voice memos, and pasted
              bank-statement text you submit to the AI capture tools. These are sent to the AI
              provider only to extract the transaction, are not stored as files, and are discarded
              from our servers once the extraction completes.
            </li>
            <li>
              <strong>Operational metadata</strong> — credit usage counters (which AI actions your
              household ran and when), notification preferences, and push-subscription endpoints if
              you opt in.
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> collect bank credentials, card numbers, government IDs,
            location, contacts, or advertising identifiers. There is no advertising SDK, no
            third-party analytics, and no cross-site tracking.
          </p>
        </Section>

        <Section title="Who can see your data">
          <p>
            Financial data belongs to a household. Only{" "}
            <strong>members of that specific household</strong> can read it. This is enforced in the
            database with row-level security policies: every read and write is checked against your
            membership before it runs. Data <strong>never leaves your household</strong> and is not
            aggregated, shared, or exposed to members of other households.
          </p>
          <p className="mt-3">
            The developer does <strong>not</strong> read household financial data from the live
            database as a normal operation, and does not use it as a user. Administrative database
            access exists only for emergency recovery (e.g. restoring a broken record you asked us
            to fix) and is not used to browse or export household data.
          </p>
        </Section>

        <Section title="Who processes it on our behalf">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Hosting &amp; database</strong> — the app runs on managed cloud infrastructure
              (Cloudflare edge workers) with a Postgres database provided by Supabase (hosted in the
              EU). They process data on our behalf as sub-processors.
            </li>
            <li>
              <strong>Authentication</strong> — Supabase Auth handles email/password and Google
              sign-in. If you use Google, Google receives standard OAuth metadata.
            </li>
            <li>
              <strong>AI features</strong> — when you use the coach, receipt/photo parsing, voice
              memo, or bank-statement import, the relevant text or media is sent to a third-party AI
              model provider via the Lovable AI Gateway solely to compute the response. It is not
              used to train models by us, and we ask providers not to retain it beyond the request.
            </li>
            <li>
              <strong>Push notifications</strong> — if you opt in, browser push endpoints (Apple,
              Google, Mozilla) receive the encrypted notification payload.
            </li>
          </ul>
          <p className="mt-3">
            All of these are <strong>processors</strong>, not independent controllers of your
            household data.
          </p>
        </Section>

        <Section title="Legal basis (GDPR Art. 6)">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Contract</strong> — storing incomes, expenses, buckets and running
              calculations is necessary to provide the service you asked for.
            </li>
            <li>
              <strong>Consent</strong> — AI features, push notifications, and receipt/photo uploads
              run only when you actively use them.
            </li>
            <li>
              <strong>Legitimate interest</strong> — minimal security logging (failed logins,
              rate-limit counters) to prevent abuse.
            </li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>
            Your data stays until you delete it. When you erase your account or your household from
            Settings → Privacy, all associated rows are removed from the live database immediately.
            Encrypted backups may retain deleted rows for up to 30 days before rolling off. AI
            request payloads are not retained beyond the request.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Under GDPR you can, at any time:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Access</strong> — see everything the app holds about you (visible in the app
              itself).
            </li>
            <li>
              <strong>Rectify</strong> — edit or correct entries directly in the app.
            </li>
            <li>
              <strong>Erase</strong> — delete your account or your entire household from Settings →
              Privacy. This is a hard delete, not a soft flag.
            </li>
            <li>
              <strong>Export</strong> — request a JSON export of your household data by email.
            </li>
            <li>
              <strong>Withdraw consent</strong> — turn off AI features and notifications at any
              time.
            </li>
            <li>
              <strong>Complain</strong> — you can lodge a complaint with your national data
              protection authority.
            </li>
          </ul>
        </Section>

        <Section title="Security">
          <ul className="list-disc space-y-2 pl-5">
            <li>All traffic uses HTTPS (TLS 1.2+).</li>
            <li>Passwords are hashed by Supabase Auth; the app never sees them.</li>
            <li>Row-level security policies scope every query to your household.</li>
            <li>Service-role credentials stay on the server and are never shipped to browsers.</li>
            <li>An allowlist restricts sign-in to invited test accounts during the beta.</li>
          </ul>
          <p className="mt-3">
            No system is perfectly secure. Only enter data you are comfortable storing in a beta
            product.
          </p>
        </Section>

        <Section title="Cookies &amp; local storage">
          <p>
            We use one first-party storage item per browser to keep you signed in (Supabase Auth
            session) and a small local preference for theme and dismissed tips. No advertising
            cookies, no third-party analytics.
          </p>
        </Section>

        <Section title="Changes to this notice">
          <p>
            If we materially change how data is used, we will update the &ldquo;Last updated&rdquo;
            date at the top and notify signed-in users in-app before the change takes effect.
          </p>
        </Section>

        <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
          <p>
            This notice is app-owner content and not an independent certification. It reflects
            current practice — see Settings → Privacy inside the app for account controls.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}
