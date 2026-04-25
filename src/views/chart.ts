import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Filler,
  type ChartConfiguration,
  type ScriptableLineSegmentContext,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin, { type AnnotationOptions } from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { Dataset, Param } from '../types';
import { fmtVal, status } from '../format';

// D8 / task 6.2: register plugins exactly once at module top-level.
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Filler,
  annotationPlugin,
  zoomPlugin
);

const P1C = '#3b6fd4';
const P2C = '#c9a020';
const DANGER = '#c93535';

export function initChart(dataset: Dataset): void {
  const sel1 = document.getElementById('sel1') as HTMLSelectElement;
  const sel2 = document.getElementById('sel2') as HTMLSelectElement;
  const dfrom = document.getElementById('date-from') as HTMLInputElement;
  const dto = document.getElementById('date-to') as HTMLInputElement;
  const resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
  const chipsEl = document.getElementById('event-chips') as HTMLElement;
  const legendEl = document.getElementById('legend') as HTMLElement;
  const canvas = document.getElementById('mainChart') as HTMLCanvasElement;

  const { params, events, dates } = dataset;
  if (!dates.length || !params.length) {
    legendEl.innerHTML = '<div class="leg-item">Brak danych</div>';
    return;
  }

  const noneOpt = (lbl: string) => `<option value="">${lbl}</option>`;
  const optionsHtml =
    noneOpt('— brak —') +
    params.map((p) => `<option value="${p.id}">${p.name} (${p.unit})</option>`).join('');
  sel1.innerHTML = optionsHtml;
  sel2.innerHTML = optionsHtml;
  sel1.value = params[0]!.id;
  sel2.value = params[1]?.id ?? '';

  dfrom.value = dates[0]!;
  dto.value = dates[dates.length - 1]!;

  const activeEvents = new Set<string>(events.map((e) => e.id));

  let chart: Chart<'line', { x: string; y: number }[]> | null = null;

  function findParam(id: string): Param | null {
    return params.find((p) => p.id === id) ?? null;
  }

  function fmtDatePLLocal(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function buildSeriesData(p: Param): { x: string; y: number }[] {
    const byDate = dataset.values[p.id] ?? {};
    const out: { x: string; y: number }[] = [];
    for (const d of dates) {
      const v = byDate[d];
      if (v !== undefined) out.push({ x: d, y: v });
    }
    return out;
  }

  function isOut(p: Param, v: number): boolean {
    if (p.lo !== null && v < p.lo) return true;
    return v > p.hi;
  }

  function ptColors(p: Param, data: { y: number }[], base: string): string[] {
    return data.map((d) => (isOut(p, d.y) ? DANGER : base));
  }

  function makeDataset(p: Param, color: string, yAxis: 'y1' | 'y2') {
    const data = buildSeriesData(p);
    const pc = ptColors(p, data, color);
    return {
      label: `${p.short} (${p.unit})`,
      data,
      borderColor: color,
      backgroundColor: color,
      segment: {
        borderColor: (ctx: ScriptableLineSegmentContext) => {
          const v0 = ctx.p0.parsed.y;
          const v1 = ctx.p1.parsed.y;
          return isOut(p, v0) || isOut(p, v1) ? DANGER : color;
        },
      },
      pointBackgroundColor: pc,
      pointBorderColor: pc.map((c) => (c === DANGER ? '#fff' : color)),
      pointBorderWidth: pc.map((c) => (c === DANGER ? 1.5 : 0)),
      pointRadius: 5.5,
      pointHoverRadius: 7.5,
      borderWidth: 2.5,
      tension: 0.35,
      yAxisID: yAxis,
      spanGaps: true,
    };
  }

  function rangeAnnotation(p: Param, axis: 'y1' | 'y2', color: string, labelColor: string, position: 'start' | 'end'): AnnotationOptions {
    if (p.lo !== null) {
      return {
        type: 'box',
        yScaleID: axis,
        yMin: p.lo,
        yMax: p.hi,
        backgroundColor: color + '12',
        borderColor: color + '40',
        borderWidth: 1,
        label: {
          display: true,
          content: `▲ norma: ${p.lo}–${p.hi} ${p.unit}`,
          position: { x: position, y: 'start' },
          color: labelColor,
          font: { size: 10, family: 'DM Sans', weight: 'bold' },
          padding: { x: 6, y: 3 },
        },
      };
    }
    return {
      type: 'line',
      yScaleID: axis,
      yMin: p.hi,
      yMax: p.hi,
      borderColor: color + '60',
      borderWidth: 1.5,
      borderDash: [6, 3],
      label: {
        display: true,
        content: `max: ${p.hi} ${p.unit}`,
        position,
        color: labelColor,
        font: { size: 10, family: 'DM Sans', weight: 'bold' },
        padding: { x: 6, y: 2 },
      },
    };
  }

  function buildConfig(): ChartConfiguration<'line', { x: string; y: number }[]> {
    const p1 = findParam(sel1.value);
    const p2id = sel2.value;
    const p2 = p2id && p2id !== sel1.value ? findParam(p2id) : null;

    const datasets: ReturnType<typeof makeDataset>[] = [];
    const annotations: Record<string, AnnotationOptions> = {};

    for (const ev of events) {
      if (!activeEvents.has(ev.id)) continue;
      const key = `ev_${ev.id}`;
      if (ev.dateTo) {
        annotations[key] = {
          type: 'box',
          xMin: ev.date,
          xMax: ev.dateTo,
          backgroundColor: 'rgba(110,118,135,0.08)',
          borderColor: 'rgba(110,118,135,0.3)',
          borderWidth: 1,
          label: {
            display: true,
            content: ev.label,
            position: { x: 'center', y: 'start' },
            yAdjust: 8,
            color: '#5a6070',
            font: { size: 10.5, family: 'DM Sans', weight: 500 },
            padding: { x: 7, y: 4 },
          },
        };
      } else {
        annotations[key] = {
          type: 'line',
          xMin: ev.date,
          xMax: ev.date,
          borderColor: 'rgba(110,118,135,0.45)',
          borderWidth: 1.5,
          borderDash: [5, 4],
          label: {
            display: true,
            content: ev.label,
            position: 'start',
            yAdjust: 8,
            color: '#5a6070',
            font: { size: 10.5, family: 'DM Sans', weight: 500 },
            padding: { x: 7, y: 4 },
          },
        };
      }
    }

    if (p1) {
      datasets.push(makeDataset(p1, P1C, 'y1'));
      annotations['ref1'] = rangeAnnotation(p1, 'y1', P1C, 'rgba(59,111,212,0.7)', 'start');
    }
    if (p2) {
      datasets.push(makeDataset(p2, P2C, 'y2'));
      annotations['ref2'] = rangeAnnotation(p2, 'y2', P2C, 'rgba(180,140,10,0.75)', 'end');
    }

    return {
      type: 'line',
      data: { datasets: datasets as never },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff',
            borderColor: '#dde1ea',
            borderWidth: 1,
            titleColor: '#1a1d23',
            bodyColor: '#5a6070',
            padding: 13,
            titleFont: { family: 'DM Sans', size: 13, weight: 'bold' },
            bodyFont: { family: 'DM Mono', size: 12.5 },
            boxPadding: 4,
            callbacks: {
              title: (items) => {
                const d = new Date(items[0]!.parsed.x);
                return d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
              },
              label: (item) => {
                const p = item.datasetIndex === 0 ? p1 : p2;
                if (!p) return '';
                const v = item.parsed.y;
                const s = status(v, p);
                const flag = s === 'ok' ? '' : s === 'high' ? ' ↑ za wysoki' : ' ↓ za niski';
                return `  ${p.name}: ${fmtVal(v)} ${p.unit}${flag}`;
              },
            },
          },
          annotation: { annotations },
          zoom: {
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
            pan: { enabled: true, mode: 'x' },
            limits: { x: { min: 'original', max: 'original' } },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'dd-MM-yyyy',
              displayFormats: { day: 'dd-MM-yyyy' },
            },
            min: dfrom.value,
            max: dto.value,
            grid: { color: '#eef0f4' },
            ticks: {
              font: { family: 'DM Mono', size: 11 },
              color: '#9aa0af',
              maxRotation: 45,
              minRotation: 45,
            },
            border: { color: '#dde1ea' },
          },
          y1: {
            type: 'linear',
            position: 'left',
            display: !!p1,
            title: {
              display: !!p1,
              text: p1 ? `${p1.name}  (${p1.unit})` : '',
              color: P1C,
              font: { family: 'DM Sans', size: 12, weight: 500 },
            },
            ticks: { color: P1C, font: { family: 'DM Mono', size: 11 } },
            grid: { color: '#eef0f4' },
            border: { color: '#dde1ea' },
          },
          y2: {
            type: 'linear',
            position: 'right',
            display: !!p2,
            title: {
              display: !!p2,
              text: p2 ? `${p2.name}  (${p2.unit})` : '',
              color: P2C,
              font: { family: 'DM Sans', size: 12, weight: 500 },
            },
            ticks: { color: P2C, font: { family: 'DM Mono', size: 11 } },
            grid: { display: false },
            border: { color: '#dde1ea' },
          },
        },
      },
    };
  }

  function updateLegend(): void {
    const p1 = findParam(sel1.value);
    const p2id = sel2.value;
    const p2 = p2id && p2id !== sel1.value ? findParam(p2id) : null;
    let html = '';
    if (p1) {
      html += `
        <div class="leg-item">
          <div class="leg-line" style="background:${P1C}"></div>
          <span>${p1.name}</span>
        </div>
        <div class="leg-item">
          <div class="leg-band" style="background:${P1C};border:1px solid ${P1C}"></div>
          <span>Zakres ref. (lewa oś)</span>
        </div>`;
    }
    if (p2) {
      html += `
        <div class="leg-item">
          <div class="leg-line" style="background:${P2C}"></div>
          <span>${p2.name}</span>
        </div>
        <div class="leg-item">
          <div class="leg-band" style="background:${P2C};border:1px solid ${P2C}"></div>
          <span>Zakres ref. (prawa oś)</span>
        </div>`;
    }
    html += `
      <div class="leg-item">
        <div class="leg-dot" style="background:${DANGER};"></div>
        <span>Poza normą</span>
      </div>`;
    legendEl.innerHTML = html;
  }

  function renderChips(): void {
    chipsEl.innerHTML = events
      .map((ev) => {
        const on = activeEvents.has(ev.id);
        const rangeStr = ev.dateTo
          ? ` <span style="font-size:10px;opacity:0.6;font-family:var(--mono);">${fmtDatePLLocal(ev.date)}–${fmtDatePLLocal(ev.dateTo)}</span>`
          : ` <span style="font-size:10px;opacity:0.6;font-family:var(--mono);">${fmtDatePLLocal(ev.date)}</span>`;
        const inner = ev.dateTo
          ? `<span class="chip-band"></span>`
          : `<span class="chip-dash"></span><span class="chip-dot"></span>`;
        return `<button class="event-chip${on ? ' on' : ''}" data-id="${ev.id}">
          ${inner}
          ${ev.label}${rangeStr}
        </button>`;
      })
      .join('');
    chipsEl.querySelectorAll<HTMLElement>('.event-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.dataset['id'];
        if (!id) return;
        if (activeEvents.has(id)) activeEvents.delete(id);
        else activeEvents.add(id);
        renderChips();
        updateChart();
      });
    });
  }

  function updateChart(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (chart) chart.destroy();
    chart = new Chart(ctx, buildConfig());
    updateLegend();
  }

  sel1.addEventListener('change', updateChart);
  sel2.addEventListener('change', updateChart);
  dfrom.addEventListener('change', () => {
    if (chart) {
      chart.options.scales!['x']!.min = dfrom.value;
      chart.update();
    }
  });
  dto.addEventListener('change', () => {
    if (chart) {
      chart.options.scales!['x']!.max = dto.value;
      chart.update();
    }
  });
  resetBtn.addEventListener('click', () => {
    dfrom.value = dates[0]!;
    dto.value = dates[dates.length - 1]!;
    updateChart();
  });

  renderChips();
  updateChart();
}
