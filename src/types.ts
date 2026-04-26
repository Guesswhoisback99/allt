export type { Param, Result, EventAnno } from './schema';

import type { Param, EventAnno } from './schema';

export interface Dataset {
  params: Param[];
  events: EventAnno[];
  /** Sorted ascending list of distinct dates that appear in results. */
  dates: string[];
  /** values[paramId][date] = number. Missing keys = no measurement. */
  values: Record<string, Record<string, number>>;
}
