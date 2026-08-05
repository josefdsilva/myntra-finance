import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { pageMeta } from "@/lib/route-meta";

// Theme for this public page: honour the app's saved choice
// (localStorage["theme"]) so a signed-in visitor keeps their theme, and fall
// back to the OS setting for anonymous visitors. Never writes localStorage and
// never strips the class on unmount, so returning to the app keeps its theme.
function useDeviceTheme() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      root.classList.toggle("dark", stored === "dark");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageMeta({
      path: "/privacy",
      title: "Privacy & data — bynku",
      description:
        "How bynku collects, stores, and protects your household's financial data. GDPR rights, data-sharing scope, and account deletion.",
      ogType: "article",
    }),
  component: PrivacyPage,
});

const UPDATED = "10 July 2026";

function PrivacyPage() {
  useDeviceTheme();
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

        <main>
        <Section title="Who runs bynku">
          <p>
            bynku is a small, self-hosted household budgeting app. The developer operates it as a
            personal / test project and is the <strong>data controller</strong> for the purposes of
            GDPR. Contact for privacy requests: use the email address you signed in with — the
            developer will reply to that account.
          </p>
        </Section>

        <Section title="Waiting list (before launch)">
          <p>
            While bynku is preparing for launch, you can join a waiting list so we can tell you when a
            spot opens. If you do, we store the <strong>email address</strong> you enter, your{" "}
            <strong>browser language</strong>, a note of where you signed up, and the{" "}
            <strong>date and time you consented</strong>. We use this only to contact you about early
            access, never for marketing or advertising, and we never sell it.
          </p>
          <p className="mt-3">
            The legal basis is <strong>your consent</strong>, given by ticking the box on the sign-up
            form. You can withdraw it and ask us to delete your entry at any time. We keep waiting-list
            entries only until launch and a short period afterwards, then delete them. Your email is not
            stored together with your IP address; as with any web request, your IP reaches our hosting
            processor as a normal part of how the internet works (see &ldquo;Who processes it on our
            behalf&rdquo; below).
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

        <Section title="How bynku uses AI">
          <p>
            Several bynku features are powered by an artificial-intelligence model. To be clear and
            in line with the EU AI Act&rsquo;s transparency principle, we label these in the app so
            you always know when you are looking at AI output.
          </p>
          <p className="mt-3">The AI-powered features are:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>The coach</strong> — the chat, the overview it writes, and the proactive nudges
              in the coach inbox are generated by an AI model.
            </li>
            <li>
              <strong>Chat-based setup</strong> — the conversational onboarding that turns what you
              type into draft entries you confirm.
            </li>
            <li>
              <strong>Capture tools</strong> — reading receipts, photos, voice memos, and
              bank-statement text to suggest transactions and categories.
            </li>
          </ul>
          <p className="mt-3">
            When you use these, the relevant text or media is sent to a third-party AI model provider
            via the Lovable AI Gateway solely to compute the response (see &ldquo;Who processes it on
            our behalf&rdquo; above). A few things to keep in mind:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>It can be wrong.</strong> AI output can be inaccurate or incomplete. Always
              review figures and categories before you rely on or save them.
            </li>
            <li>
              <strong>No human reviews each message.</strong> Responses are produced automatically,
              not checked by a person before you see them.
            </li>
            <li>
              <strong>It is educational, not regulated advice.</strong> bynku helps you understand
              your own numbers. It does not provide regulated financial, investment, tax, or legal
              advice, and it does not assess your creditworthiness or assign a credit score.
            </li>
            <li>
              <strong>You are in control.</strong> AI features run only when you actively use them,
              and you can turn them off at any time.
            </li>
          </ul>
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

        </main>

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
