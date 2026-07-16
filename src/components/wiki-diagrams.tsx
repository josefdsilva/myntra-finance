// Inline SVG diagrams for the wiki manual. Colours use the app palette and CSS
// variables so the diagrams follow light and dark themes. All text labels are
// passed in as props so the wiki can translate them.
import type { ReactNode } from "react";

const C = {
  fixed: "#2c6e6b",
  debt: "#bc6c25",
  variable: "#7aa874",
  margin: "#d4a373",
  primary: "var(--primary)",
  track: "var(--muted)",
  text: "var(--foreground)",
  sub: "var(--muted-foreground)",
  border: "var(--border)",
};

function Wrap({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <figure className="my-3 rounded-lg border bg-muted/20 p-3">
      <div className="w-full">{children}</div>
      {caption ? (
        <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/** Stacked bar: Fixed + Debt + Variable + Margin = Baseline. */
export function BaselineDiagram(p: {
  fixed: string;
  debt: string;
  variable: string;
  margin: string;
  baseline: string;
  caption?: string;
}) {
  const segs = [
    { w: 150, c: C.fixed, label: p.fixed },
    { w: 60, c: C.debt, label: p.debt },
    { w: 110, c: C.variable, label: p.variable },
    { w: 60, c: C.margin, label: p.margin },
  ];
  let x = 10;
  return (
    <Wrap caption={p.caption}>
      <svg viewBox="0 0 400 108" className="w-full" role="img" aria-label={p.baseline}>
        {segs.map((s, i) => {
          const rx = x;
          x += s.w;
          return (
            <g key={i}>
              <rect x={rx} y={20} width={s.w - 4} height={30} rx={4} fill={s.c} />
              <text x={rx + (s.w - 4) / 2} y={39} textAnchor="middle" fontSize="11" fill="#fff">
                {s.label}
              </text>
            </g>
          );
        })}
        <line x1={10} y1={62} x2={386} y2={62} stroke={C.border} />
        <text x={198} y={82} textAnchor="middle" fontSize="12" fontWeight="600" fill={C.text}>
          = {p.baseline}
        </text>
      </svg>
    </Wrap>
  );
}

/** Pay-cycle timeline: salary today, current cycle, next salary. */
export function CycleDiagram(p: {
  salary: string;
  today: string;
  nextSalary: string;
  cycle: string;
  caption?: string;
}) {
  return (
    <Wrap caption={p.caption}>
      <svg viewBox="0 0 400 96" className="w-full" role="img" aria-label={p.cycle}>
        <line x1={30} y1={48} x2={370} y2={48} stroke={C.border} strokeWidth={2} />
        <circle cx={30} cy={48} r={6} fill={C.primary} />
        <circle cx={370} cy={48} r={6} fill={C.primary} />
        <rect x={30} y={44} width={340} height={8} rx={4} fill={C.primary} opacity={0.18} />
        <text x={30} y={30} textAnchor="middle" fontSize="11" fill={C.text}>
          {p.salary}
        </text>
        <text x={30} y={72} textAnchor="middle" fontSize="10" fill={C.sub}>
          {p.today}
        </text>
        <text x={200} y={44} textAnchor="middle" fontSize="11" fontWeight="600" fill={C.text}>
          {p.cycle}
        </text>
        <text x={370} y={30} textAnchor="middle" fontSize="11" fill={C.text}>
          {p.nextSalary}
        </text>
      </svg>
    </Wrap>
  );
}

/** Surplus split into Real allocations and Real surplus. */
export function WaterfallDiagram(p: {
  surplus: string;
  realAlloc: string;
  realSurplus: string;
  caption?: string;
}) {
  return (
    <Wrap caption={p.caption}>
      <svg viewBox="0 0 400 120" className="w-full" role="img" aria-label={p.surplus}>
        <text x={10} y={22} fontSize="12" fontWeight="600" fill={C.text}>
          {p.surplus}
        </text>
        <rect x={10} y={30} width={376} height={30} rx={4} fill={C.track} />
        <rect x={10} y={30} width={230} height={30} rx={4} fill={C.fixed} />
        <text x={125} y={49} textAnchor="middle" fontSize="11" fill="#fff">
          {p.realAlloc}
        </text>
        <rect x={244} y={30} width={142} height={30} rx={4} fill={C.variable} />
        <text x={315} y={49} textAnchor="middle" fontSize="11" fill="#fff">
          {p.realSurplus}
        </text>
        <text x={198} y={92} textAnchor="middle" fontSize="11" fill={C.sub}>
          {p.realAlloc} + {p.realSurplus} = {p.surplus}
        </text>
      </svg>
    </Wrap>
  );
}

/** Priority ladder: emergency fund, then debt, then invest. */
export function LadderDiagram(p: {
  step1: string;
  step2: string;
  step3: string;
  caption?: string;
}) {
  const steps = [
    { y: 74, w: 150, c: C.margin, label: p.step1 },
    { y: 48, w: 240, c: C.debt, label: p.step2 },
    { y: 22, w: 330, c: C.fixed, label: p.step3 },
  ];
  return (
    <Wrap caption={p.caption}>
      <svg viewBox="0 0 400 108" className="w-full" role="img" aria-label={p.step1}>
        {steps.map((s, i) => (
          <g key={i}>
            <rect x={10} y={s.y} width={s.w} height={22} rx={4} fill={s.c} />
            <text x={20} y={s.y + 15} fontSize="11" fill="#fff">
              {i + 1}. {s.label}
            </text>
          </g>
        ))}
      </svg>
    </Wrap>
  );
}
