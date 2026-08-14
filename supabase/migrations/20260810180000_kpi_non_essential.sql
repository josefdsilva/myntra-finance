-- Add non_essential_ratio (nice-to-have + treat share of spend) to the KPI
-- target allow-list — the tight-budget "trim non-essentials" target.

ALTER TABLE public.kpi_targets DROP CONSTRAINT IF EXISTS kpi_targets_metric_key_check;

ALTER TABLE public.kpi_targets ADD CONSTRAINT kpi_targets_metric_key_check
  CHECK (metric_key IN (
    'emergency_months', 'dti_pct', 'invested_months', 'invested_years',
    'total_income', 'income_concentration', 'spending_vs_plan',
    'savings_rate', 'essential_expenses_ratio', 'housing_cost_ratio',
    'non_mortgage_debt_service', 'net_worth', 'debt_to_asset',
    'investment_assets_ratio', 'non_essential_ratio'
  ));
