export interface Param {
  id: string;
  name: string;
  short: string;
  unit: string;
  /** `null` means upper-bound-only (no lower bound). A numeric value, including `0`, is a real floor. */
  lo: number | null;
  hi: number;
}

export interface Result {
  date: string;
  paramId: string;
  value: number;
}

export interface EventAnno {
  id: string;
  date: string;
  dateTo: string | null;
  label: string;
}

export interface Dataset {
  params: Param[];
  events: EventAnno[];
  /** Sorted ascending list of distinct dates that appear in results. */
  dates: string[];
  /** values[paramId][date] = number. Missing keys = no measurement. */
  values: Record<string, Record<string, number>>;
}
