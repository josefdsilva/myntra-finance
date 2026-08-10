-- Widen the kpi_targets.metric_key allow-list to the full metric registry
-- (adds savings rate, essential-expenses ratio, housing cost ratio, non-mortgage
-- debt service, net worth, debt-to-asset, investment-assets ratio).

ALTER TABLE public.kpi_targets DROP CONSTRAINT IF EXISTS kpi_targets_metric_key_check;

ALTER TABLE public.kpi_targets ADD CONSTRAINT kpi_targets_metric_key_check
  CHECK (metric_key IN (
    'emergency_months', 'dti_pct', 'invested_months', 'invested_years',
    'total_income', 'income_concentration', 'spending_vs_plan',
    'savings_rate', 'essential_expenses_ratio', 'housing_cost_ratio',
    'non_mortgage_debt_service', 'net_worth', 'debt_to_asset',
    'investment_assets_ratio'
  ));
