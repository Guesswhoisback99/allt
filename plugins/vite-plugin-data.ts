import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import Papa from 'papaparse';
import type { Plugin } from 'vite';
import type { Dataset, EventAnno, Param, Result } from '../src/types';

const VIRTUAL_ID = 'virtual:dataset';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface CsvRow {
  [k: string]: string;
}

interface CsvFile {
  path: string;
  rows: CsvRow[];
  sha256: string;
}

class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataPluginError';
  }
}

function readCsv(path: string, label: string): CsvFile {
  let buf: Buffer;
  try {
    statSync(path);
    buf = readFileSync(path);
  } catch (err) {
    throw new BuildError(
      `[${label}] cannot read file at "${path}": ${(err as Error).message}`
    );
  }
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const text = buf.toString('utf8');
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });
  if (result.errors.length) {
    const e = result.errors[0]!;
    throw new BuildError(`[${label}] CSV parse error at row ${e.row}: ${e.message}`);
  }
  return { path, rows: result.data, sha256 };
}

function requireColumns(label: string, rows: CsvRow[], cols: string[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  for (const c of cols) {
    if (!headers.includes(c)) {
      throw new BuildError(`[${label}] missing required column "${c}"`);
    }
  }
}

function parseNumber(s: string | undefined): number | null {
  if (s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function validateParams(file: CsvFile): Param[] {
  requireColumns('PARAMS_CSV', file.rows, ['id', 'name', 'short', 'unit', 'lo', 'hi']);
  const out: Param[] = [];
  const seen = new Set<string>();
  file.rows.forEach((row, i) => {
    const rn = i + 2;
    const id = row['id'] ?? '';
    if (!id) throw new BuildError(`[PARAMS_CSV] row ${rn}: empty id`);
    if (seen.has(id)) throw new BuildError(`[PARAMS_CSV] row ${rn}: duplicate id "${id}"`);
    seen.add(id);
    const name = row['name'] ?? '';
    const short = row['short'] ?? '';
    const unit = row['unit'] ?? '';
    if (!name) throw new BuildError(`[PARAMS_CSV] row ${rn}: empty name`);
    const hi = parseNumber(row['hi']);
    if (hi === null || Number.isNaN(hi)) {
      throw new BuildError(`[PARAMS_CSV] row ${rn} (id="${id}"): hi must be a number, got "${row['hi']}"`);
    }
    if (hi <= 0) {
      throw new BuildError(`[PARAMS_CSV] row ${rn} (id="${id}"): hi must be > 0, got ${hi}`);
    }
    const loRaw = row['lo'] ?? '';
    let lo: number | null;
    if (loRaw === '') {
      lo = null;
    } else {
      const parsed = parseNumber(loRaw);
      if (parsed === null || Number.isNaN(parsed)) {
        throw new BuildError(`[PARAMS_CSV] row ${rn} (id="${id}"): lo must be empty or numeric, got "${loRaw}"`);
      }
      lo = parsed;
      if (hi <= lo) {
        throw new BuildError(`[PARAMS_CSV] row ${rn} (id="${id}"): hi (${hi}) must be > lo (${lo})`);
      }
    }
    out.push({ id, name, short, unit, lo, hi });
  });
  return out;
}

function validateResults(file: CsvFile, params: Param[]): Result[] {
  requireColumns('RESULTS_CSV', file.rows, ['date', 'param_id', 'value']);
  const validIds = new Set(params.map((p) => p.id));
  const out: Result[] = [];
  file.rows.forEach((row, i) => {
    const rn = i + 2;
    const date = row['date'] ?? '';
    if (!ISO_DATE.test(date)) {
      throw new BuildError(`[RESULTS_CSV] row ${rn}: date must be YYYY-MM-DD, got "${date}"`);
    }
    const paramId = row['param_id'] ?? '';
    if (!validIds.has(paramId)) {
      throw new BuildError(`[RESULTS_CSV] row ${rn}: unknown param_id "${paramId}"`);
    }
    const value = parseNumber(row['value']);
    if (value === null || Number.isNaN(value)) {
      throw new BuildError(`[RESULTS_CSV] row ${rn}: value must be a number, got "${row['value']}"`);
    }
    out.push({ date, paramId, value });
  });
  return out;
}

function validateEvents(file: CsvFile): EventAnno[] {
  requireColumns('EVENTS_CSV', file.rows, ['id', 'date', 'date_to', 'label']);
  const out: EventAnno[] = [];
  const seen = new Set<string>();
  file.rows.forEach((row, i) => {
    const rn = i + 2;
    const id = row['id'] ?? '';
    if (!id) throw new BuildError(`[EVENTS_CSV] row ${rn}: empty id`);
    if (seen.has(id)) throw new BuildError(`[EVENTS_CSV] row ${rn}: duplicate id "${id}"`);
    seen.add(id);
    const date = row['date'] ?? '';
    if (!ISO_DATE.test(date)) {
      throw new BuildError(`[EVENTS_CSV] row ${rn} (id="${id}"): date must be YYYY-MM-DD, got "${date}"`);
    }
    const dateToRaw = row['date_to'] ?? '';
    let dateTo: string | null = null;
    if (dateToRaw !== '') {
      if (!ISO_DATE.test(dateToRaw)) {
        throw new BuildError(`[EVENTS_CSV] row ${rn} (id="${id}"): date_to must be YYYY-MM-DD or empty, got "${dateToRaw}"`);
      }
      if (dateToRaw <= date) {
        throw new BuildError(`[EVENTS_CSV] row ${rn} (id="${id}"): date_to (${dateToRaw}) must be strictly after date (${date})`);
      }
      dateTo = dateToRaw;
    }
    const label = row['label'] ?? '';
    if (!label) throw new BuildError(`[EVENTS_CSV] row ${rn} (id="${id}"): empty label`);
    out.push({ id, date, dateTo, label });
  });
  return out;
}

function buildDataset(params: Param[], results: Result[], events: EventAnno[]): Dataset {
  const values: Record<string, Record<string, number>> = {};
  for (const p of params) values[p.id] = {};
  const dateSet = new Set<string>();
  for (const r of results) {
    values[r.paramId]![r.date] = r.value;
    dateSet.add(r.date);
  }
  const dates = [...dateSet].sort();
  return { params, events, dates, values };
}

interface LoadedData {
  dataset: Dataset;
  inputs: { label: string; path: string; sha256: string }[];
}

function loadAll(): LoadedData {
  const requireEnv = (k: string): string => {
    const v = process.env[k];
    if (!v || v.trim() === '') {
      throw new BuildError(`environment variable ${k} is required`);
    }
    return resolve(v);
  };

  const resultsPath = requireEnv('RESULTS_CSV');
  const paramsPath = requireEnv('PARAMS_CSV');
  const eventsPath = requireEnv('EVENTS_CSV');

  const paramsFile = readCsv(paramsPath, 'PARAMS_CSV');
  const resultsFile = readCsv(resultsPath, 'RESULTS_CSV');
  const eventsFile = readCsv(eventsPath, 'EVENTS_CSV');

  const params = validateParams(paramsFile);
  const results = validateResults(resultsFile, params);
  const events = validateEvents(eventsFile);

  const dataset = buildDataset(params, results, events);

  return {
    dataset,
    inputs: [
      { label: 'PARAMS_CSV', path: paramsFile.path, sha256: paramsFile.sha256 },
      { label: 'RESULTS_CSV', path: resultsFile.path, sha256: resultsFile.sha256 },
      { label: 'EVENTS_CSV', path: eventsFile.path, sha256: eventsFile.sha256 },
    ],
  };
}

export function dataPlugin(): Plugin {
  let loaded: LoadedData | null = null;
  let outDir = 'dist';

  return {
    name: 'allt:data',
    enforce: 'pre',

    configResolved(config) {
      // D7: validate BEFORE Vite touches dist/. Throw here aborts the build
      // before buildStart and before emptyOutDir runs.
      loaded = loadAll();
      outDir = config.build.outDir;
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_ID) return null;
      if (!loaded) throw new BuildError('dataset not loaded');
      // Watch input files in dev so editing a CSV triggers HMR.
      for (const input of loaded.inputs) {
        this.addWatchFile(input.path);
      }
      return `export default ${JSON.stringify(loaded.dataset)};`;
    },

    closeBundle() {
      if (!loaded) return;
      const info = {
        builtAt: new Date().toISOString(),
        inputs: loaded.inputs.map((i) => ({ label: i.label, path: i.path, sha256: i.sha256 })),
      };
      const target = resolve(process.cwd(), outDir, 'build-info.json');
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(info, null, 2) + '\n', 'utf8');
    },
  };
}
