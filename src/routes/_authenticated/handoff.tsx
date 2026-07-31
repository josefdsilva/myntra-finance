import { pageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Building2, Download, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { getOrCreateHousehold } from "@/lib/household.functions";
import { useActiveHouseholdId } from "@/lib/active-household";
import { getHandoffPreview, sendHandoff, type HandoffPackage } from "@/lib/handoff.functions";
import { pageShellClass } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/handoff")({
  head: () =>
    pageMeta({
      path: "/handoff",
      title: "Accountant handoff · bynku",
      description: "Export a clean bookkeeping package for your accountant in one step.",
      noindex: true,
    }),
  component: HandoffPage,
});

function HandoffPage() {
  const t = useT();
  const activeId = useActiveHouseholdId();
  const fetchHh = useServerFn(getOrCreateHousehold);
  const previewFn = useServerFn(getHandoffPreview);
  const sendFn = useServerFn(sendHandoff);
  const { data: hh } = useQuery({
    queryKey: ["household", activeId],
    queryFn: () => fetchHh({ data: activeId ? { household_id: activeId } : {} }),
  });
  const household = hh?.household;
  const householdId = household?.id;
  const isBusiness = household?.kind === "business";
  const advisor = household?.advisor_email?.trim() || "";

  const now = new Date();
  const thisYear = now.getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [quarter, setQuarter] = useState(String(Math.floor(now.getMonth() / 3) + 1));
  const [sending, setSending] = useState(false);

  const { data: pkg, isLoading } = useQuery({
    enabled: !!householdId && isBusiness,
    queryKey: ["handoff-preview", householdId, year, quarter],
    queryFn: () =>
      previewFn({
        data: { householdId: householdId!, year: Number(year), quarter: Number(quarter) },
      }),
  });

  async function send() {
    if (!advisor) {
      toast.error(t("handoff.noAdvisor"));
      return;
    }
    setSending(true);
    try {
      const res = await sendFn({
        data: { householdId: householdId!, year: Number(year), quarter: Number(quarter) },
      });
      if (res.ok) {
        toast.success(t("handoff.sentToast", { count: res.total, email: res.advisor }));
      } else {
        toast.error(t("handoff.sendFailed"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("handoff.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  function download() {
    if (!pkg) return;
    const html = buildHandoffHtml(pkg);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bynku-handoff-${pkg.periodLabel.replace(/\s+/g, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const years = [thisYear, thisYear - 1, thisYear - 2].map(String);

  return (
    <div className={pageShellClass("4xl")}>
      <header>
        <h1 className="text-3xl md:text-4xl font-display">{t("handoff.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("handoff.subtitle")}</p>
      </header>

      {!isBusiness ? (
        <EmptyState
          icon={Building2}
          title={t("handoff.businessOnly")}
          description={t("handoff.businessOnlyBody")}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("handoff.periodTitle")}</CardTitle>
            <CardDescription>{t("handoff.periodDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("handoff.year")}</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("handoff.quarter")}</Label>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {`Q${n}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading || !pkg ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label={t("handoff.received")} value={money(pkg.totals.received)} />
                  <Stat label={t("handoff.paid")} value={money(pkg.totals.spent)} />
                  <Stat label={t("handoff.net")} value={money(pkg.totals.net)} />
                  <Stat label={t("handoff.entries")} value={String(pkg.totals.count)} />
                </div>

                {pkg.totals.missingCount > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <p className="font-medium text-destructive">
                        {t("handoff.missingWarn", { count: pkg.totals.missingCount })}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("handoff.missingWarnBody")}{" "}
                        <a href="/expenses" className="underline">
                          {t("handoff.reviewExpenses")}
                        </a>
                      </p>
                    </div>
                  </div>
                )}

                {pkg.entries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t("handoff.noEntries")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">{t("handoff.colDate")}</th>
                          <th className="py-2 pr-3 font-medium">{t("handoff.colDesc")}</th>
                          <th className="py-2 pr-3 text-right font-medium">{t("handoff.colAmount")}</th>
                          <th className="py-2 font-medium">{t("handoff.colInvoice")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pkg.entries.map((e) => (
                          <tr key={e.id} className="border-b last:border-0">
                            <td className="py-2 pr-3 tabular-nums text-muted-foreground">{e.date}</td>
                            <td className="py-2 pr-3">{e.description}</td>
                            <td
                              className={`py-2 pr-3 text-right tabular-nums font-medium ${
                                e.direction === "in" ? "text-emerald-600" : ""
                              }`}
                            >
                              {e.direction === "in" ? "+" : "−"}
                              {money(e.amount)}
                            </td>
                            <td className="py-2">
                              {e.invoices.length > 0 ? (
                                <span className="flex flex-col gap-0.5">
                                  {e.invoices.map((inv, j) => (
                                    <a
                                      key={j}
                                      href={inv.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                      <ExternalLink className="size-3 shrink-0" />
                                      <span className="truncate">{inv.name}</span>
                                    </a>
                                  ))}
                                </span>
                              ) : e.invoiceExempt ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                                  <AlertTriangle className="size-3" /> {t("handoff.missingTag")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">{t("handoff.note")}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <p className="text-sm text-muted-foreground">
                    {advisor ? t("handoff.advisorIs", { email: advisor }) : t("handoff.noAdvisorSet")}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={download} disabled={!pkg}>
                      <Download className="size-4" /> {t("handoff.download")}
                    </Button>
                    <Button onClick={send} disabled={sending || !advisor}>
                      {sending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {t("handoff.send")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

/** Build a self-contained HTML document of the handoff for download. */
function buildHandoffHtml(pkg: HandoffPackage): string {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: pkg.currency }).format(n);
  const rows = pkg.entries
    .map((e) => {
      const inv =
        e.invoices.length > 0
          ? e.invoices.map((i) => `<a href="${esc(i.url)}">${esc(i.name)}</a>`).join("<br>")
          : e.invoiceExempt
            ? `<span style="color:#94a3b8">—</span>`
            : `<span style="color:#b91c1c;font-weight:bold">missing</span>`;
      const amt = `${e.direction === "in" ? "+" : "−"}${fmt(e.amount)}`;
      const color = e.direction === "in" ? "#166534" : "#0f172a";
      return `<tr><td>${e.date}</td><td>${esc(e.description)}</td><td style="text-align:right;color:${color};font-weight:bold">${amt}</td><td>${inv}</td></tr>`;
    })
    .join("");
  const warn =
    pkg.missing.length > 0
      ? `<div style="border:1px solid #fecaca;background:#fef2f2;border-radius:10px;padding:12px 14px;margin:0 0 16px">
           <p style="color:#b91c1c;font-weight:bold;margin:0 0 6px">⚠ ${pkg.missing.length} entries missing an invoice</p>
           ${pkg.missing
             .map(
               (m) =>
                 `<p style="color:#7f1d1d;font-size:12px;margin:2px 0">${m.date} · ${
                   m.direction === "in" ? "Received" : "Paid"
                 } ${fmt(m.amount)} · ${esc(m.description)}</p>`,
             )
             .join("")}
         </div>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Handoff ${esc(
    pkg.periodLabel,
  )}</title></head>
  <body style="font-family:Arial,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#0f172a">
    <h1 style="font-size:22px;margin:0 0 4px">Bookkeeping handoff</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px">${esc(pkg.companyName)} · ${esc(
      pkg.periodLabel,
    )} · ${pkg.startIso} → ${pkg.endIso}</p>
    <p style="font-size:13px">Received <b>${fmt(pkg.totals.received)}</b> · Paid <b>${fmt(
      pkg.totals.spent,
    )}</b> · Net <b>${fmt(pkg.totals.net)}</b> · ${pkg.totals.count} entries</p>
    ${warn}
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;border-bottom:2px solid #e2e8f0">
        <th style="padding:6px">Date</th><th style="padding:6px">Description</th>
        <th style="padding:6px;text-align:right">Amount</th><th style="padding:6px">Invoice</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#94a3b8;font-size:11px;margin-top:20px">Generated by bynku. Invoice links stay valid for 14 days.</p>
  </body></html>`;
}
