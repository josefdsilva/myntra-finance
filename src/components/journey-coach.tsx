import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { proposeJourneyStages, type StageProposal } from "@/lib/journey-coach.functions";
import { createStage } from "@/lib/journey.functions";
import { AiBadge } from "@/components/ai-badge";
import { useT } from "@/lib/i18n";

/**
 * Conversational coach for the Journey: ask for stages or a review; the coach
 * proposes grounded stages you accept or dismiss. AI-generated, labelled as such.
 */
export function JourneyCoach({
  householdId,
  onChanged,
}: {
  householdId: string;
  onChanged: () => void;
}) {
  const t = useT();
  const proposeFn = useServerFn(proposeJourneyStages);
  const createFn = useServerFn(createStage);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [proposals, setProposals] = useState<StageProposal[] | null>(null);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  async function propose(request: string | null) {
    setLoading(true);
    setProposals(null);
    setNote("");
    try {
      const res = await proposeFn({ data: { household_id: householdId, request } });
      if (!res.ok && res.proposals.length === 0) toast.error(t("journey.coach.failed"));
      setNote(res.note);
      setProposals(res.proposals);
    } catch {
      toast.error(t("journey.coach.failed"));
    } finally {
      setLoading(false);
    }
  }

  async function add(p: StageProposal, idx: number) {
    setAddingIdx(idx);
    try {
      await createFn({
        data: { household_id: householdId, title: p.title, objective: p.objective || null, optional: p.optional },
      });
      toast.success(t("journey.coach.addedToast"));
      setProposals((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
      onChanged();
    } catch {
      toast.error(t("journey.coach.failed"));
    } finally {
      setAddingIdx(null);
    }
  }

  function dismiss(idx: number) {
    setProposals((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">{t("journey.coach.title")}</span>
        <AiBadge />
      </div>
      <p className="text-xs text-muted-foreground">{t("journey.coach.sub")}</p>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder={t("journey.coach.placeholder")}
          className="min-h-0 resize-none"
          disabled={loading}
        />
        <Button
          onClick={() => propose(input.trim() || null)}
          disabled={loading || !input.trim()}
          size="icon"
          aria-label={t("journey.coach.ask")}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        </Button>
      </div>
      <Button variant="outline" size="sm" onClick={() => propose(null)} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{" "}
        {t("journey.coach.review")}
      </Button>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {proposals && proposals.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">{t("journey.coach.none")}</p>
      )}
      {proposals && proposals.length > 0 && (
        <ul className="space-y-2">
          {proposals.map((p, i) => (
            <li key={i} className="rounded-lg border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.title}</span>
                    {p.optional && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t("journey.sideQuestBadge")}
                      </span>
                    )}
                  </div>
                  {p.objective && <p className="text-xs text-muted-foreground">{p.objective}</p>}
                  {p.rationale && <p className="mt-1 text-[11px] text-muted-foreground/80">{p.rationale}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" onClick={() => add(p, i)} disabled={addingIdx === i}>
                    {addingIdx === i ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{" "}
                    {t("journey.coach.add")}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t("common.dismiss")} onClick={() => dismiss(i)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
