import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { money } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";

type PurchaseLevel = "essential" | "important" | "niceToHave" | "treat";
type PayType = "oneOff" | "financed";

/**
 * "Should I buy this?" — a low-friction, in-the-moment purchase checker. It
 * collects what/price/how it's paid/how much it's wanted, builds a grounded
 * prompt, and hands it to the coach (which already holds the household's
 * capacity figures and the buy-vs-finance + principles logic). The coach
 * returns an affordability verdict and, crucially, how to make it work.
 */
export function PurchaseCheckButton({
  variant = "outline",
  className,
  isBusiness = false,
}: {
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  isBusiness?: boolean;
}) {
  const t = useT();
  // Household-only now: `tb` always resolves the plain copy (kept as a wrapper so
  // the call sites don't churn).
  const tb = (key: string, vars?: Record<string, string | number>) =>
    t(key as MessageKey, vars);
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<PayType>("oneOff");
  const [monthly, setMonthly] = useState("");
  const [term, setTerm] = useState("");
  const [level, setLevel] = useState<PurchaseLevel>("niceToHave");

  const priceNum = parseFloat(price.replace(",", "."));
  const valid = what.trim().length > 0 && isFinite(priceNum) && priceNum > 0;

  function reset() {
    setWhat("");
    setPrice("");
    setPay("oneOff");
    setMonthly("");
    setTerm("");
    setLevel("niceToHave");
  }

  function ask() {
    if (!valid) return;
    const levelLabel = tb(`purchaseCheck.level.${level}`);
    const monthlyNum = parseFloat(monthly.replace(",", "."));
    const termNum = parseInt(term, 10);
    const financed =
      pay === "financed"
        ? isFinite(monthlyNum) && monthlyNum > 0
          ? t("purchaseCheck.termWithMonthly", {
              months: isFinite(termNum) && termNum > 0 ? termNum : "?",
              monthly: money(monthlyNum),
            })
          : t("purchaseCheck.termNoMonthly", {
              months: isFinite(termNum) && termNum > 0 ? termNum : "?",
            })
        : null;

    const prompt =
      pay === "financed"
        ? tb("purchaseCheck.promptFinanced", {
            what: what.trim(),
            price: money(priceNum),
            terms: financed ?? "",
            level: levelLabel,
          })
        : tb("purchaseCheck.promptOneOff", {
            what: what.trim(),
            price: money(priceNum),
            level: levelLabel,
          });

    window.dispatchEvent(new CustomEvent("coach:open", { detail: { prompt } }));
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <ShoppingBag className="size-4" />
          {t("purchaseCheck.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tb("purchaseCheck.title")}</DialogTitle>
          <DialogDescription>{tb("purchaseCheck.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pc-what">{t("purchaseCheck.whatLabel")}</Label>
            <Input
              id="pc-what"
              autoFocus
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder={tb("purchaseCheck.whatPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pc-price">{t("purchaseCheck.priceLabel")}</Label>
              <Input
                id="pc-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tb("purchaseCheck.levelLabel")}</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as PurchaseLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="essential">{tb("purchaseCheck.level.essential")}</SelectItem>
                  <SelectItem value="important">{tb("purchaseCheck.level.important")}</SelectItem>
                  <SelectItem value="niceToHave">{tb("purchaseCheck.level.niceToHave")}</SelectItem>
                  <SelectItem value="treat">{tb("purchaseCheck.level.treat")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("purchaseCheck.payLabel")}</Label>
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
              {(["oneOff", "financed"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPay(p)}
                  aria-pressed={pay === p}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    pay === p
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(p === "oneOff" ? "purchaseCheck.payOneOff" : "purchaseCheck.payFinanced")}
                </button>
              ))}
            </div>
          </div>

          {pay === "financed" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pc-monthly">{t("purchaseCheck.monthlyLabel")}</Label>
                <Input
                  id="pc-monthly"
                  inputMode="decimal"
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  placeholder={t("purchaseCheck.monthlyPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-term">{t("purchaseCheck.termLabel")}</Label>
                <Input
                  id="pc-term"
                  inputMode="numeric"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="12"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={ask} disabled={!valid}>
            {t("purchaseCheck.ask")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
