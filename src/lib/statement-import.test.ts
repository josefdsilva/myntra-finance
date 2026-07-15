// Run with: bun test src/lib/statement-import.test.ts
import { test, expect } from "bun:test";
import {
  parseAmount,
  parseDate,
  parseCsv,
  detectDelimiter,
  inferColumns,
  toTransactions,
  normalizeMerchant,
  analyzeStatement,
  statementMonths,
} from "./statement-import";

test("parseAmount handles EU and US formats and signs", () => {
  expect(parseAmount("1.234,56")).toBe(1234.56);
  expect(parseAmount("1,234.56")).toBe(1234.56);
  expect(parseAmount("-800,00")).toBe(-800);
  expect(parseAmount("(45.00)")).toBe(-45);
  expect(parseAmount("45,00-")).toBe(-45);
  expect(parseAmount("€ 12,99")).toBe(12.99);
  expect(parseAmount("2000")).toBe(2000);
});

test("parseDate handles ISO and EU day-first", () => {
  expect(parseDate("2026-01-05")).toBe("2026-01-05");
  expect(parseDate("05/01/2026")).toBe("2026-01-05");
  expect(parseDate("05.01.26")).toBe("2026-01-05");
});

test("detectDelimiter picks semicolon for EU exports", () => {
  expect(detectDelimiter("Data;Descrição;Valor\n05/01/2026;RENDA;-800,00")).toBe(";");
});

test("normalizeMerchant strips card/transfer noise, dates and refs", () => {
  expect(normalizeMerchant("COMPRA CONTINENTE 05/01 REF 123456789")).toBe("CONTINENTE");
  expect(normalizeMerchant("MB WAY NETFLIX.COM *LISBOA")).toBe("NETFLIX COM LISBOA");
});

// A small 3-month Portuguese-style statement (semicolon-delimited, EU amounts).
// Groceries hit several times a month (so they stay VARIABLE, not fixed); rent,
// subscription and loan are once-a-month regular (fixed / debt).
const CSV = `Data;Descrição;Valor
05/01/2026;RENDA CASA;-800,00
05/02/2026;RENDA CASA;-800,00
05/03/2026;RENDA CASA;-800,00
10/01/2026;NETFLIX.COM;-12,99
10/02/2026;NETFLIX.COM;-12,99
10/03/2026;NETFLIX.COM;-12,99
08/01/2026;PRESTACAO EMPRESTIMO HABITACAO;-450,00
08/02/2026;PRESTACAO EMPRESTIMO HABITACAO;-450,00
08/03/2026;PRESTACAO EMPRESTIMO HABITACAO;-450,00
25/01/2026;ORDENADO ACME LDA;2000,00
25/02/2026;ORDENADO ACME LDA;2000,00
25/03/2026;ORDENADO ACME LDA;2000,00
03/01/2026;COMPRA CONTINENTE;-45,20
11/01/2026;COMPRA CONTINENTE;-60,00
24/01/2026;COMPRA CONTINENTE;-38,50
05/02/2026;COMPRA CONTINENTE;-52,00
18/02/2026;COMPRA CONTINENTE;-47,00
02/03/2026;COMPRA CONTINENTE;-48,00
15/03/2026;COMPRA CONTINENTE;-55,00
04/01/2026;ZARA;-40,00
12/02/2026;H&M;-35,00
15/02/2026;FNAC COMPRA;-1200,00`;

function txns() {
  const rows = parseCsv(CSV);
  const map = inferColumns(rows[0]);
  expect(map).not.toBeNull();
  return toTransactions(rows, map!);
}

test("inferColumns is not fooled by a value-date or balance column", () => {
  // Real PT bank layout: "Data-valor" contains "valor", "Saldo…" is the balance.
  const header = [
    "Data mov.",
    "Data-valor",
    "Descrição",
    "Montante",
    "Saldo contabilístico após movimento",
  ];
  expect(inferColumns(header)).toEqual({ date: 0, description: 2, amount: 3 });
});

test("toTransactions reads a real PT bank export (5 columns, EU amounts)", () => {
  const csv = `Data mov.;Data-valor;Descrição;Montante;Saldo contabilístico após movimento
14/07/2026;14/07/2026;MEO SA;-68,42;2.941,32
13/07/2026;13/07/2026;TRF 08640;-777,77;3.089,96
09/07/2026;09/07/2026;EDP COMERCIAL;-123,84;4.008,46
04/07/2026;04/07/2026;CAR WAL;-500,00;7.671,42`;
  const rows = parseCsv(csv);
  const map = inferColumns(rows[0])!;
  const t = toTransactions(rows, map);
  expect(t.length).toBe(4);
  expect(t[0]).toEqual({ date: "2026-07-14", description: "MEO SA", amount: -68.42 });
  expect(t[3].amount).toBe(-500);
});

test("inferColumns + toTransactions parse the statement", () => {
  const t = txns();
  expect(t.length).toBe(22);
  expect(statementMonths(t)).toBe(3);
});

test("analyzeStatement separates fixed, debt, income and variable", () => {
  const a = analyzeStatement(txns());

  // Rent and Netflix are recurring fixed costs; the loan is NOT among them.
  const rent = a.fixed.find((f) => f.merchant.includes("RENDA"));
  expect(rent).toBeDefined();
  expect(Math.abs((rent!.monthlyAmount ?? 0) - 800)).toBeLessThan(1);
  expect(a.fixed.some((f) => f.merchant.includes("EMPRESTIMO"))).toBe(false);
  const netflix = a.fixed.find((f) => f.merchant.includes("NETFLIX"));
  expect(netflix?.category).toBe("subscriptions");

  // The loan installment is detected as a debt.
  expect(a.debts.length).toBeGreaterThan(0);
  expect(Math.abs(a.debts[0].monthlyAmount - 450)).toBeLessThan(1);

  // Salary detected as the largest recurring inflow.
  expect(a.income.length).toBeGreaterThan(0);
  expect(a.income[0].isSalary).toBe(true);
  expect(Math.abs(a.income[0].monthlyAmount - 2000)).toBeLessThan(1);

  // Groceries show up as a variable estimate; the €1,200 one-off is excluded.
  expect(a.variable.estimates.some((e) => e.category === "groceries")).toBe(true);
  expect(a.variable.anomalies.some((x) => x.amount === 1200)).toBe(true);
});
