import { createFileRoute, Link } from "@tanstack/react-router";
import { pageMeta } from "@/lib/route-meta";
import { GUIDES } from "@/components/guide-layout";

export const Route = createFileRoute("/guides/")({
  head: () => {
    const base = pageMeta({
      path: "/guides",
      title: "Money guides for couples, families & small teams — bynku",
      description:
        "Practical budgeting guides for people who share money: couples splitting bills, families juggling irregular costs, and freelancers managing business cash flow.",
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "bynku money guides",
            url: "https://bynku.app/guides",
            hasPart: GUIDES.map((g) => ({
              "@type": "Article",
              headline: g.title,
              url: `https://bynku.app${g.to}`,
              description: g.blurb,
            })),
          }),
        },
      ],
    };
  },
  component: GuidesIndex,
});

function GuidesIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <nav className="mb-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← bynku
          </Link>
        </nav>

        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Guides</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">
            Budgeting when money is shared
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Most budgeting advice assumes one person, one income and predictable bills. These guides
            are for the messier reality: two salaries arriving on different days, a family with
            school fees and childcare, or a one-person business where the owner and the company
            share a bank balance.
          </p>
        </header>

        <main>
          <ul className="space-y-6">
            {GUIDES.map((g) => (
              <li key={g.to} className="rounded-xl border p-5">
                <h2 className="font-display text-2xl">
                  <Link to={g.to} className="hover:underline">
                    {g.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.blurb}</p>
                <Link
                  to={g.to}
                  className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Read the guide →
                </Link>
              </li>
            ))}
          </ul>
        </main>

        <aside className="mt-12 rounded-xl border bg-muted/30 p-5">
          <h2 className="font-display text-xl">One number, shared</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            bynku takes the income, fixed costs and loans of a household — or a small business — and
            answers the only question that matters day to day: what can we safely spend?
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Get started with bynku
          </Link>
        </aside>

        <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
          <p>
            General educational guidance, not regulated financial advice. Read our{" "}
            <Link to="/privacy" className="underline">
              privacy notice
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
