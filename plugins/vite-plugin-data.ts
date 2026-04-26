import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import Papa from 'papaparse';
import { z } from 'zod';
import type { Plugin } from 'vite';
import type { Dataset, EventAnno, Param, Result } from '../src/types';
import { paramsSchema, resultsSchema, eventsSchema } from '../src/schema';

const VIRTUAL_ID = 'virtual:dataset';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

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

function formatZodError(label: string, error: z.ZodError, rows: CsvRow[]): BuildError {
  const issue = error.issues[0]!;
  const rowIdx = typeof issue.path[0] === 'number' ? issue.path[0] : -1;
  const rn = rowIdx + 2; // header is row 1
  const id = rowIdx >= 0 ? rows[rowIdx]?.['id'] ?? '' : '';
  const idPart = id ? ` (id="${id}")` : '';
  const fieldPath = issue.path.slice(1).filter((p) => typeof p === 'string');
  const field = fieldPath.join('.');
  const fieldPart = field ? `${field}: ` : '';
  return new BuildError(`[${label}] row ${rn}${idPart}: ${fieldPart}${issue.message}`);
}

function parseWithSchema<T>(
  label: string,
  file: CsvFile,
  cols: string[],
  schema: z.ZodType<T[], any, any>
): T[] {
  requireColumns(label, file.rows, cols);
  const parsed = schema.safeParse(file.rows);
  if (!parsed.success) throw formatZodError(label, parsed.error, file.rows);
  return parsed.data;
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

  const params = parseWithSchema<Param>(
    'PARAMS_CSV',
    paramsFile,
    ['id', 'name', 'short', 'unit', 'lo', 'hi'],
    paramsSchema
  );
  const results = parseWithSchema<Result>(
    'RESULTS_CSV',
    resultsFile,
    ['date', 'param_id', 'value'],
    resultsSchema
  );
  const events = parseWithSchema<EventAnno>(
    'EVENTS_CSV',
    eventsFile,
    ['id', 'date', 'date_to', 'label'],
    eventsSchema
  );

  // Cross-file FK: results.param_id must exist in params.id
  const validIds = new Set(params.map((p) => p.id));
  results.forEach((r, i) => {
    if (!validIds.has(r.paramId)) {
      throw new BuildError(`[RESULTS_CSV] row ${i + 2}: unknown param_id "${r.paramId}"`);
    }
  });

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
