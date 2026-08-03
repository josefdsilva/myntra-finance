import { Link } from "@tanstack/react-router";

export const GUIDES = [
  {
    to: "/guides/budgeting-for-couples" as const,
    title: "Budgeting for couples",
    blurb:
      "Two incomes, one plan: how to split bills fairly, keep some independence, and stop arguing about money.",
  },
  {
    to: "/guides/family-budgeting" as const,
    title: "Family budgeting",
    blurb:
      "Childcare, school costs and irregular bills — how families build a budget that survives a real month.",
  },
  {
    to: "/guides/small-business-cash-flow" as const,
    title: "Small business cash flow",
    blurb:
      "For freelancers and small teams: separate owner pay from business money and know what's safe to spend.",
  },
];

export function GuideShell({
  eyebrow,
  title,
  intro,
  updated,
  children,
  current,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated?: string;
  children: React.ReactNode;
  current?: string;
}) {
  const others = GUIDES.filter((g) => g.to !== current);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <nav className="mb-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← bynku
          </Link>
          <Link to="/guides" className="hover:text-foreground">
            All guides
          </Link>
        </nav>

        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{intro}</p>
          {updated && (
            <p className="mt-2 text-xs text-muted-foreground">Last updated: {updated}</p>
          )}
        </header>

        <main>{children}</main>

        <aside className="mt-14 rounded-xl border bg-muted/30 p-5">
          <h2 className="font-display text-xl">Try it with your own numbers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            bynku turns income, fixed costs and loans into one daily safe-to-spend number, shared
            with the people you budget with.
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Get started with bynku
          </Link>
        </aside>

        {others.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 font-display text-xl">Keep reading</h2>
            <ul className="space-y-3">
              {others.map((g) => (
                <li key={g.to}>
                  <Link to={g.to} className="text-sm font-medium text-primary hover:underline">
                    {g.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{g.blurb}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
          <p>
            Educational content from the bynku team — general guidance, not regulated financial
            advice. See our <Link to="/privacy" className="underline">privacy notice</Link>.
          </p>
        </footer>
      </div>
    </div>
  );
}

export function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}
