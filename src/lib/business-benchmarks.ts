/**
 * Business sector benchmarks — Eurostat Structural Business Statistics (SBS),
 * dataset `sbs_ovw_act`, reference year 2023, EU-27 level.
 *
 * Three indicators per NACE Rev. 2 division:
 *  - labourProductivityK  = gross value added per person employed (€ thousand)
 *  - turnoverPerPersonK    = turnover (revenue) per person employed (€ thousand)
 *  - grossOperatingRatePct = gross operating surplus ÷ turnover (%), i.e. the
 *                            sector's typical operating margin.
 *
 * These are EU-wide sector averages, not country×sector cells (SBS doesn't
 * publish reliable small-cell country×division figures for every market). We
 * therefore benchmark against the EU sector and show the country's overall
 * business-economy productivity as context, so a lower-productivity market isn't
 * unfairly judged against the EU frontier. `null` = Eurostat did not publish that
 * cell (confidential / not available); we never invent a value.
 *
 * Source: https://ec.europa.eu/eurostat/databrowser/view/sbs_ovw_act (2023),
 * cross-checked against the "Structural business statistics overview" article.
 */

export const SBS_SOURCE_YEAR = 2023;

export type SectorBenchmark = {
  /** NACE Rev. 2 section letter (for grouping in the picker). */
  section: string;
  /** English division name. */
  name: string;
  labourProductivityK: number | null;
  turnoverPerPersonK: number | null;
  grossOperatingRatePct: number | null;
};

/** English names of the NACE sections we surface. */
export const NACE_SECTIONS: Record<string, string> = {
  B: "Mining & quarrying",
  C: "Manufacturing",
  D: "Energy",
  E: "Water & waste",
  F: "Construction",
  G: "Trade & repair",
  H: "Transport & storage",
  I: "Accommodation & food",
  J: "Information & communication",
  K: "Finance & insurance",
  L: "Real estate",
  M: "Professional & scientific",
  N: "Administrative & support",
  P: "Education",
  Q: "Health & social work",
  R: "Arts & recreation",
  S: "Other services",
};

// Keyed by NACE division code (2-digit string, unique across sections).
export const SBS_EU_2023: Record<string, SectorBenchmark> = {
  "05": { section: "B", name: "Mining of coal & lignite", labourProductivityK: 76.1, turnoverPerPersonK: 110.0, grossOperatingRatePct: null },
  "06": { section: "B", name: "Extraction of petroleum & gas", labourProductivityK: 560.3, turnoverPerPersonK: 4012.0, grossOperatingRatePct: 11.5 },
  "07": { section: "B", name: "Mining of metal ores", labourProductivityK: null, turnoverPerPersonK: null, grossOperatingRatePct: 28.5 },
  "08": { section: "B", name: "Other mining & quarrying", labourProductivityK: 78.8, turnoverPerPersonK: 226.2, grossOperatingRatePct: 16.9 },
  "10": { section: "C", name: "Food products", labourProductivityK: 57.4, turnoverPerPersonK: 307.8, grossOperatingRatePct: 7.5 },
  "11": { section: "C", name: "Beverages", labourProductivityK: 105.1, turnoverPerPersonK: 420.4, grossOperatingRatePct: null },
  "12": { section: "C", name: "Tobacco products", labourProductivityK: 217.5, turnoverPerPersonK: 678.0, grossOperatingRatePct: 23.3 },
  "13": { section: "C", name: "Textiles", labourProductivityK: null, turnoverPerPersonK: 150.9, grossOperatingRatePct: null },
  "14": { section: "C", name: "Wearing apparel", labourProductivityK: 31.8, turnoverPerPersonK: 107.8, grossOperatingRatePct: 10.1 },
  "15": { section: "C", name: "Leather & related products", labourProductivityK: 50.4, turnoverPerPersonK: 159.2, grossOperatingRatePct: 13.5 },
  "16": { section: "C", name: "Wood & products of wood", labourProductivityK: 48.4, turnoverPerPersonK: 185.7, grossOperatingRatePct: 10.2 },
  "17": { section: "C", name: "Paper & paper products", labourProductivityK: 83.4, turnoverPerPersonK: 355.7, grossOperatingRatePct: 9.6 },
  "18": { section: "C", name: "Printing & reproduction", labourProductivityK: 46.3, turnoverPerPersonK: 129.6, grossOperatingRatePct: 11.3 },
  "19": { section: "C", name: "Coke & refined petroleum", labourProductivityK: 288.5, turnoverPerPersonK: 3586.7, grossOperatingRatePct: 5.8 },
  "20": { section: "C", name: "Chemicals & chemical products", labourProductivityK: 117.1, turnoverPerPersonK: 524.9, grossOperatingRatePct: 9.0 },
  "21": { section: "C", name: "Basic pharmaceuticals", labourProductivityK: 290.4, turnoverPerPersonK: 731.5, grossOperatingRatePct: null },
  "22": { section: "C", name: "Rubber & plastic products", labourProductivityK: 67.7, turnoverPerPersonK: 235.3, grossOperatingRatePct: 10.0 },
  "23": { section: "C", name: "Other non-metallic mineral products", labourProductivityK: 75.0, turnoverPerPersonK: null, grossOperatingRatePct: null },
  "24": { section: "C", name: "Basic metals", labourProductivityK: 83.8, turnoverPerPersonK: 532.5, grossOperatingRatePct: 5.1 },
  "27": { section: "C", name: "Electrical equipment", labourProductivityK: null, turnoverPerPersonK: 291.1, grossOperatingRatePct: 8.0 },
  "28": { section: "C", name: "Machinery & equipment n.e.c.", labourProductivityK: 90.8, turnoverPerPersonK: 294.0, grossOperatingRatePct: 9.9 },
  "29": { section: "C", name: "Motor vehicles & trailers", labourProductivityK: 98.3, turnoverPerPersonK: 572.7, grossOperatingRatePct: 6.3 },
  "30": { section: "C", name: "Other transport equipment", labourProductivityK: 96.0, turnoverPerPersonK: 372.2, grossOperatingRatePct: 7.8 },
  "31": { section: "C", name: "Furniture", labourProductivityK: 41.1, turnoverPerPersonK: 133.3, grossOperatingRatePct: 10.0 },
  "33": { section: "C", name: "Repair & installation of machinery", labourProductivityK: 60.1, turnoverPerPersonK: 168.0, grossOperatingRatePct: 10.8 },
  "35": { section: "D", name: "Electricity, gas & steam supply", labourProductivityK: 276.0, turnoverPerPersonK: 1861.1, grossOperatingRatePct: 11.4 },
  "36": { section: "E", name: "Water collection & supply", labourProductivityK: 82.9, turnoverPerPersonK: 188.5, grossOperatingRatePct: 22.9 },
  "37": { section: "E", name: "Sewerage", labourProductivityK: 92.8, turnoverPerPersonK: 177.1, grossOperatingRatePct: 25.8 },
  "38": { section: "E", name: "Waste collection & treatment", labourProductivityK: 63.6, turnoverPerPersonK: 200.0, grossOperatingRatePct: 11.8 },
  "39": { section: "E", name: "Remediation & waste management", labourProductivityK: 70.0, turnoverPerPersonK: 215.2, grossOperatingRatePct: 11.6 },
  "41": { section: "F", name: "Construction of buildings", labourProductivityK: 53.2, turnoverPerPersonK: 226.5, grossOperatingRatePct: 10.0 },
  "42": { section: "F", name: "Civil engineering", labourProductivityK: 68.3, turnoverPerPersonK: 222.2, grossOperatingRatePct: 10.5 },
  "43": { section: "F", name: "Specialised construction", labourProductivityK: 48.9, turnoverPerPersonK: 130.7, grossOperatingRatePct: 13.9 },
  "45": { section: "G", name: "Motor vehicle trade & repair", labourProductivityK: 56.5, turnoverPerPersonK: 419.2, grossOperatingRatePct: 6.0 },
  "46": { section: "G", name: "Wholesale trade", labourProductivityK: 80.1, turnoverPerPersonK: 668.1, grossOperatingRatePct: 5.5 },
  "47": { section: "G", name: "Retail trade", labourProductivityK: 36.0, turnoverPerPersonK: 203.7, grossOperatingRatePct: 6.1 },
  "49": { section: "H", name: "Land transport", labourProductivityK: 46.1, turnoverPerPersonK: 118.4, grossOperatingRatePct: 12.9 },
  "51": { section: "H", name: "Air transport", labourProductivityK: 128.7, turnoverPerPersonK: 540.7, grossOperatingRatePct: 8.6 },
  "52": { section: "H", name: "Warehousing & transport support", labourProductivityK: 78.0, turnoverPerPersonK: 244.0, grossOperatingRatePct: 13.9 },
  "55": { section: "I", name: "Accommodation", labourProductivityK: 42.9, turnoverPerPersonK: 91.1, grossOperatingRatePct: 20.1 },
  "56": { section: "I", name: "Food & beverage service", labourProductivityK: 23.8, turnoverPerPersonK: 59.3, grossOperatingRatePct: 11.3 },
  "59": { section: "J", name: "Film, video & TV production", labourProductivityK: 68.2, turnoverPerPersonK: null, grossOperatingRatePct: null },
  "60": { section: "J", name: "Programming & broadcasting", labourProductivityK: 91.1, turnoverPerPersonK: 399.3, grossOperatingRatePct: 7.7 },
  "61": { section: "J", name: "Telecommunications", labourProductivityK: 179.5, turnoverPerPersonK: 436.5, grossOperatingRatePct: 26.2 },
  "62": { section: "J", name: "Computer programming & consultancy", labourProductivityK: 80.0, turnoverPerPersonK: 195.6, grossOperatingRatePct: 11.4 },
  "64": { section: "K", name: "Financial services", labourProductivityK: 222.2, turnoverPerPersonK: null, grossOperatingRatePct: null },
  "65": { section: "K", name: "Insurance & pension funding", labourProductivityK: 237.5, turnoverPerPersonK: 1500.0, grossOperatingRatePct: 11.7 },
  "66": { section: "K", name: "Auxiliary financial services", labourProductivityK: 100.3, turnoverPerPersonK: 227.7, grossOperatingRatePct: 22.8 },
  "68": { section: "L", name: "Real estate activities", labourProductivityK: 98.4, turnoverPerPersonK: 205.4, grossOperatingRatePct: 35.5 },
  "70": { section: "M", name: "Head offices & management consultancy", labourProductivityK: 76.9, turnoverPerPersonK: null, grossOperatingRatePct: null },
  "71": { section: "M", name: "Architecture & engineering", labourProductivityK: 64.9, turnoverPerPersonK: 132.5, grossOperatingRatePct: 18.2 },
  "73": { section: "M", name: "Advertising & market research", labourProductivityK: 52.3, turnoverPerPersonK: 163.7, grossOperatingRatePct: 11.0 },
  "74": { section: "M", name: "Other professional & technical", labourProductivityK: 40.9, turnoverPerPersonK: null, grossOperatingRatePct: null },
  "77": { section: "N", name: "Rental & leasing", labourProductivityK: 192.4, turnoverPerPersonK: 398.9, grossOperatingRatePct: 37.9 },
  "78": { section: "N", name: "Employment activities", labourProductivityK: 38.7, turnoverPerPersonK: 53.2, grossOperatingRatePct: null },
  "80": { section: "N", name: "Security & investigation", labourProductivityK: 29.3, turnoverPerPersonK: 45.7, grossOperatingRatePct: null },
  "81": { section: "N", name: "Services to buildings & landscape", labourProductivityK: 27.3, turnoverPerPersonK: 45.5, grossOperatingRatePct: 14.5 },
  "85": { section: "P", name: "Education", labourProductivityK: 31.0, turnoverPerPersonK: 52.8, grossOperatingRatePct: 17.2 },
  "86": { section: "Q", name: "Human health activities", labourProductivityK: 53.6, turnoverPerPersonK: 87.0, grossOperatingRatePct: 22.0 },
  "87": { section: "Q", name: "Residential care", labourProductivityK: 37.5, turnoverPerPersonK: 54.6, grossOperatingRatePct: 2.1 },
  "88": { section: "Q", name: "Social work (no accommodation)", labourProductivityK: 33.4, turnoverPerPersonK: 43.2, grossOperatingRatePct: 6.9 },
  "92": { section: "R", name: "Gambling & betting", labourProductivityK: 114.3, turnoverPerPersonK: 383.6, grossOperatingRatePct: 21.6 },
  "93": { section: "R", name: "Sports, amusement & recreation", labourProductivityK: 38.5, turnoverPerPersonK: 86.1, grossOperatingRatePct: 12.9 },
  "95": { section: "S", name: "Repair of computers & goods", labourProductivityK: 28.0, turnoverPerPersonK: 75.5, grossOperatingRatePct: 15.8 },
  "96": { section: "S", name: "Other personal services", labourProductivityK: 21.6, turnoverPerPersonK: 41.0, grossOperatingRatePct: null },
};

/**
 * Whole business-economy apparent labour productivity (VA per person, €k, 2023)
 * per curated market — context so a lower-productivity economy isn't judged
 * against the EU frontier. Source: sbs_ovw_act, aggregate B-S_X_O_S94.
 */
export const COUNTRY_BIZ_PRODUCTIVITY_K: Record<string, number> = {
  PT: 34.9,
  ES: 54.7,
  DE: 74.5,
  FR: 73.1,
  IT: 63.2,
  NL: 80.3,
  IE: 190.4,
};

export type SectorOption = { code: string; section: string; name: string };

/** Sector options for a picker, sorted by section then code. */
export function listSectors(): SectorOption[] {
  return Object.entries(SBS_EU_2023)
    .map(([code, v]) => ({ code, section: v.section, name: v.name }))
    .sort((a, b) => (a.section === b.section ? a.code.localeCompare(b.code) : a.section.localeCompare(b.section)));
}

/** Sector options grouped by NACE section, for an <optgroup> picker. */
export function groupSectors(): Array<[string, SectorOption[]]> {
  const groups: Record<string, SectorOption[]> = {};
  for (const s of listSectors()) (groups[s.section] ??= []).push(s);
  return Object.entries(groups);
}

export type BusinessBenchmark = {
  sectorCode: string;
  sectorName: string;
  section: string;
  sectionName: string;
  sourceYear: number;
  /** EU sector reference figures (for the context grid). */
  sector: SectorBenchmark;
  /** The country's overall business-economy productivity (€k/person), if curated. */
  countryProductivityK: number | null;
  /** Revenue-per-employee comparison, when the sector publishes turnover/person. */
  productivity: { userPerEmployeeK: number; sectorPerPersonK: number; ratio: number } | null;
  /** Operating-margin comparison, when the sector publishes a gross operating rate. */
  efficiency: { userMarginPct: number; sectorRatePct: number } | null;
};

/** True if we can benchmark this sector code at all. */
export function hasSectorBenchmark(code: string | null | undefined): boolean {
  return !!code && !!SBS_EU_2023[code];
}

export function computeBusinessBenchmark(input: {
  sector: string | null;
  country: string | null;
  revenueMonthly: number;
  employees: number;
  /** Operating margin % (revenue − operating costs) ÷ revenue; null if unknown. */
  operatingMarginPct: number | null;
}): BusinessBenchmark | null {
  const code = input.sector;
  if (!code) return null;
  const sec = SBS_EU_2023[code];
  if (!sec) return null;

  const heads = Math.max(1, Math.round(input.employees) || 1);
  const annualRevenueK = (input.revenueMonthly * 12) / 1000;
  const userPerEmployeeK = annualRevenueK / heads;

  const productivity =
    input.revenueMonthly > 0 && sec.turnoverPerPersonK != null
      ? {
          userPerEmployeeK: Math.round(userPerEmployeeK * 10) / 10,
          sectorPerPersonK: sec.turnoverPerPersonK,
          ratio: sec.turnoverPerPersonK > 0 ? userPerEmployeeK / sec.turnoverPerPersonK : 0,
        }
      : null;

  const efficiency =
    input.operatingMarginPct != null && sec.grossOperatingRatePct != null
      ? {
          userMarginPct: Math.round(input.operatingMarginPct * 10) / 10,
          sectorRatePct: sec.grossOperatingRatePct,
        }
      : null;

  return {
    sectorCode: code,
    sectorName: sec.name,
    section: sec.section,
    sectionName: NACE_SECTIONS[sec.section] ?? sec.section,
    sourceYear: SBS_SOURCE_YEAR,
    sector: sec,
    countryProductivityK: input.country ? (COUNTRY_BIZ_PRODUCTIVITY_K[input.country] ?? null) : null,
    productivity,
    efficiency,
  };
}
