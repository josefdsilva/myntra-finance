import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Loader2, Trash2, RefreshCw, Eye, EyeOff } from "lucide-react";
import {
  listSyntheticPersonas,
  seedSyntheticPersona,
  wipeSyntheticPersona,
  getSyntheticPersonaPassword,
} from "@/lib/personas.functions";
import { pageMeta } from "@/lib/route-meta";
import { pageShellClass } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/personas")({
  head: () =>
    pageMeta({
      path: "/personas",
      title: "Test personas · bynku",
      description: "Internal tool for seeding and wiping clearly-flagged synthetic test accounts.",
      noindex: true,
    }),
  component: PersonasPage,
});

function PersonasPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSyntheticPersonas);
  const seed = useServerFn(seedSyntheticPersona);
  const wipe = useServerFn(wipeSyntheticPersona);
  const reveal = useServerFn(getSyntheticPersonaPassword);
  const [password, setPassword] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["synthetic-personas"],
    queryFn: () => list({ data: undefined }),
    retry: false,
  });

  const seedMut = useMutation({
    mutationFn: (key: string) => seed({ data: { key } }),
    onSuccess: (res) => {
      toast.success(`Seeded ${res.email} with ${res.expenses} entries`);
      qc.invalidateQueries({ queryKey: ["synthetic-personas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const wipeMut = useMutation({
    mutationFn: (key: string) => wipe({ data: { key, confirm: "WIPE" as const } }),
    onSuccess: () => {
      toast.success("Persona wiped");
      qc.invalidateQueries({ queryKey: ["synthetic-personas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <main className={pageShellClass()}>
        <h1 className="text-2xl font-semibold">Test personas</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
      </main>
    );
  }

  const personas = data?.personas ?? [];

  return (
    <main className={pageShellClass()}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FlaskConical className="size-5 text-primary" aria-hidden />
            Test personas
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Synthetic accounts you can sign into to experience bynku from another financial angle.
            Every persona is flagged as synthetic — its space shows a banner, and its data must never
            be used for benchmarks, analytics or published numbers.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (password) return setPassword(null);
            try {
              const res = await reveal({ data: undefined });
              setPassword(res.password || "(not set)");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          {password ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
          {password ? "Hide password" : "Show shared password"}
        </Button>
      </header>

      {password && (
        <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm">
          Shared sign-in password for every persona:{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono">{password}</code>
        </div>
      )}

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading personas…
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {personas.map((p) => {
            const busy =
              (seedMut.isPending && seedMut.variables === p.key) ||
              (wipeMut.isPending && wipeMut.variables === p.key);
            return (
              <li key={p.key} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.label}</span>
                      <Badge variant="secondary">Synthetic</Badge>
                      <Badge variant="outline">{p.country}</Badge>
                      <Badge variant="outline">{`${p.adults}a · ${p.children}c`}</Badge>
                      {p.seeded ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          Seeded
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not seeded</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{p.angle}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {p.email} · €{p.monthlyIncome.toLocaleString()}/mo in
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => seedMut.mutate(p.key)}
                      aria-label={`Seed persona ${p.label}`}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 size-4" />
                      )}
                      {p.seeded ? "Re-seed" : "Seed"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !p.seeded}
                      onClick={() => wipeMut.mutate(p.key)}
                      aria-label={`Wipe persona ${p.label}`}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Wipe
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
