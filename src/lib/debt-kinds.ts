import type { MessageKey } from "./i18n";

// Shared debt-kind vocabulary so Settings and onboarding stay in sync. `t` is the
// translator from useT(); only the label key matters here (no interpolation).
type Translate = (key: MessageKey) => string;

export type DebtKind =
  | "mortgage"
  | "personal"
  | "auto"
  | "credit_card"
  | "student"
  | "other"
  | "business_loan"
  | "credit_line"
  | "equipment_finance"
  | "leasing"
  | "vehicle"
  | "factoring"
  | "property";

/** Full kind → label map (for displaying any saved debt, whatever the space). */
export function debtKindLabel(t: Translate, kind: string): string {
  const map: Record<string, string> = {
    mortgage: t("debts.kindMortgage"),
    personal: t("debts.kindPersonal"),
    auto: t("debts.kindAuto"),
    credit_card: t("debts.kindCreditCard"),
    student: t("debts.kindStudent"),
    other: t("debts.kindOther"),
    business_loan: t("debts.kindBusinessLoan"),
    credit_line: t("debts.kindCreditLine"),
    equipment_finance: t("debts.kindEquipment"),
    leasing: t("debts.kindLeasing"),
    vehicle: t("debts.kindVehicle"),
    factoring: t("debts.kindFactoring"),
    property: t("debts.kindProperty"),
  };
  return map[kind] ?? kind;
}

/** The kind options offered in the picker, tailored to the space. */
export function debtKindOptions(
  t: Translate,
  isBusiness: boolean,
): Array<{ value: DebtKind; label: string }> {
  const kinds: DebtKind[] = isBusiness
    ? [
        "business_loan",
        "credit_line",
        "equipment_finance",
        "leasing",
        "vehicle",
        "property",
        "factoring",
        "credit_card",
        "other",
      ]
    : ["mortgage", "personal", "auto", "credit_card", "student", "other"];
  return kinds.map((value) => ({ value, label: debtKindLabel(t, value) }));
}
