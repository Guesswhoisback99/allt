import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  MarkLineComponent,
  DataZoomComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import type { Dataset, Param } from '../types';
import { fmtVal, status } from '../format';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  MarkLineComponent,
  DataZoomComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

const P1C = '#3b6fd4';
const P2C = '#c9a020';
const DANGER = '#c93535';

export function initChart(dataset: Dataset): void {
  const sel1 = document.getElementById('sel1') as HTMLSelectElement;
  const sel2 = document.getElementById('sel2') as HTMLSelectElement;
  const chipsEl = document.getElementById('event-chips') as HTMLElement;
  const legendEl = document.getElementById('legend') as HTMLElement;
  const chartEl = document.getElementById('mainChart') as HTMLElement;

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

  const activeEvents = new Set<string>(events.map((e) => e.id));

  const chart = echarts.init(chartEl);

  function findParam(id: string): Param | null {
    return params.find((p) => p.id === id) ?? null;
  }

  function fmtDatePLLocal(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function fmtDatePLLong(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function buildSeriesData(p: Param): [number, number | null][] {
    const byDate = dataset.values[p.id] ?? {};
    return dates.map((d) => [toTs(d), byDate[d] ?? null]);
  }

  function toTs(d: string): number {
    return new Date(d + 'T00:00:00').getTime();
  }

  const xMin = dates[0]!;
  const xMax = dates[dates.length - 1]!;

  function clipDate(d: string): string {
    if (d < xMin) return xMin;
    if (d > xMax) return xMax;
    return d;
  }

  function eventOverlapsData(ev: { date: string; dateTo?: string | null }): boolean {
    const start = ev.date;
    const end = ev.dateTo ?? ev.date;
    return !(end < xMin || start > xMax);
  }

  function refMarkArea(p: Param, color: string): LineSeriesOption['markArea'] | undefined {
    if (p.lo === null) return undefined;
    return {
      silent: true,
      itemStyle: { color: color + '12', borderColor: color + '40', borderWidth: 1 },
      label: { show: false },
      data: [[{ yAxis: p.lo }, { yAxis: p.hi }]] as never,
    };
  }

  function refMarkLine(p: Param, color: string, side: 'left' | 'right'): LineSeriesOption['markLine'] | undefined {
    const labelPos = side === 'left' ? 'start' : 'end';
    const labelStyle = {
      show: true,
      position: labelPos,
      color: '#fff',
      fontFamily: 'DM Mono',
      fontSize: 10,
      fontWeight: 'bold' as const,
      backgroundColor: color,
      padding: [2, 5],
      borderRadius: 3,
      distance: 2,
    };
    if (p.lo !== null) {
      return {
        silent: true,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        data: [
          { yAxis: p.lo, label: { ...labelStyle, formatter: `${p.lo}` } },
          { yAxis: p.hi, label: { ...labelStyle, formatter: `${p.hi}` } },
        ] as never,
      };
    }
    return {
      silent: true,
      symbol: 'none',
      lineStyle: { color: color + '90', width: 1.5, type: 'dashed' },
      data: [
        { yAxis: p.hi, label: { ...labelStyle, formatter: `max ${p.hi}` } },
      ] as never,
    };
  }

  const LABEL_LEVELS = 4;
  const LABEL_LEVEL_PX = 16;
  const LABEL_BASE_OFFSET = 6;

  function eventLevel(ev: { id: string }): number {
    const visible = events.filter((e) => activeEvents.has(e.id) && eventOverlapsData(e));
    return visible.findIndex((e) => e.id === ev.id);
  }

  function eventMarkArea(): LineSeriesOption['markArea'] {
    const data: { xAxis: number; itemStyle?: object; label?: object }[][] = [];
    for (const ev of events) {
      if (!activeEvents.has(ev.id) || !ev.dateTo) continue;
      if (!eventOverlapsData(ev)) continue;
      const yOffset = (eventLevel(ev) % LABEL_LEVELS) * LABEL_LEVEL_PX;
      data.push([
        {
          xAxis: toTs(clipDate(ev.date)),
          label: { show: true, formatter: ev.label, distance: LABEL_BASE_OFFSET + yOffset },
        },
        { xAxis: toTs(clipDate(ev.dateTo)) },
      ]);
    }
    return {
      silent: false,
      itemStyle: { color: 'rgba(110,118,135,0.06)', borderColor: 'rgba(110,118,135,0.25)', borderWidth: 1 },
      label: {
        show: true,
        position: 'top',
        color: '#3d4250',
        fontFamily: 'DM Sans',
        fontSize: 11,
        fontWeight: 600,
        overflow: 'none',
        backgroundColor: '#fff',
        borderColor: '#dde1ea',
        borderWidth: 1,
        padding: [4, 8],
        borderRadius: 999,
        shadowColor: 'rgba(20,25,40,0.06)',
        shadowBlur: 4,
        shadowOffsetY: 1,
      },
      data: data as never,
    };
  }

  function eventMarkLine(): LineSeriesOption['markLine'] {
    const data: { xAxis: number; label?: object }[] = [];
    for (const ev of events) {
      if (!activeEvents.has(ev.id) || ev.dateTo) continue;
      if (!eventOverlapsData(ev)) continue;
      const yOffset = (eventLevel(ev) % LABEL_LEVELS) * LABEL_LEVEL_PX;
      data.push({
        xAxis: toTs(clipDate(ev.date)),
        label: { show: true, formatter: ev.label, distance: LABEL_BASE_OFFSET + yOffset },
      });
    }
    return {
      silent: true,
      symbol: 'none',
      lineStyle: { color: 'rgba(110,118,135,0.4)', width: 1.25, type: 'dashed' },
      label: {
        show: true,
        position: 'end',
        color: '#3d4250',
        fontFamily: 'DM Sans',
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: '#fff',
        borderColor: '#dde1ea',
        borderWidth: 1,
        padding: [4, 8],
        borderRadius: 999,
        shadowColor: 'rgba(20,25,40,0.06)',
        shadowBlur: 4,
        shadowOffsetY: 1,
      },
      data: data as never,
    };
  }

  function makeSeries(p: Param, color: string, yAxisIndex: 0 | 1): LineSeriesOption {
    const side: 'left' | 'right' = yAxisIndex === 0 ? 'left' : 'right';
    const series: LineSeriesOption = {
      name: `${p.short} (${p.unit})`,
      type: 'line',
      yAxisIndex,
      smooth: 0.35,
      data: buildSeriesData(p),
      connectNulls: true,
      symbol: 'circle',
      symbolSize: 9,
      lineStyle: { color, width: 2.5 },
      itemStyle: { color },
      emphasis: { scale: 1.25 },
    };
    const refArea = refMarkArea(p, color);
    const refLine = refMarkLine(p, color, side);
    if (refArea) series.markArea = refArea;
    if (refLine) series.markLine = refLine;
    return series;
  }

  function makeEventsSeries(): LineSeriesOption {
    return {
      type: 'line',
      data: [[toTs(xMin), null], [toTs(xMax), null]],
      yAxisIndex: 0,
      silent: true,
      showSymbol: false,
      lineStyle: { opacity: 0 },
      tooltip: { show: false },
      markArea: eventMarkArea(),
      markLine: eventMarkLine(),
    };
  }

  function makeVisualMap(p: Param, color: string, seriesIndex: number): EChartsOption['visualMap'] {
    const pieces: { lt?: number; gt?: number; color: string }[] = [];
    if (p.lo !== null) pieces.push({ lt: p.lo, color: DANGER });
    pieces.push({ gt: p.hi, color: DANGER });
    return {
      show: false,
      type: 'piecewise',
      seriesIndex,
      dimension: 1,
      pieces,
      outOfRange: { color },
    };
  }

  function buildOption(): EChartsOption {
    const p1 = findParam(sel1.value);
    const p2id = sel2.value;
    const p2 = p2id && p2id !== sel1.value ? findParam(p2id) : null;

    const series: LineSeriesOption[] = [];
    const visualMaps: NonNullable<EChartsOption['visualMap']>[] = [];

    if (p1) {
      series.push(makeSeries(p1, P1C, 0));
      visualMaps.push(makeVisualMap(p1, P1C, 0) as never);
    }
    if (p2) {
      series.push(makeSeries(p2, P2C, 1));
      visualMaps.push(makeVisualMap(p2, P2C, p1 ? 1 : 0) as never);
    }
    series.push(makeEventsSeries());

    return {
      animation: false,
      grid: { left: 64, right: 64, top: 96, bottom: 110 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#dde1ea',
        borderWidth: 1,
        padding: 13,
        textStyle: { color: '#5a6070', fontFamily: 'DM Mono', fontSize: 12.5 },
        axisPointer: { type: 'line', lineStyle: { color: '#c8cdd8' } },
        formatter: (rawParams) => {
          const items = rawParams as unknown as { axisValue: string | number; seriesIndex: number; value: number | [string, number] | null }[];
          if (!items.length) return '';
          const av = items[0]!.axisValue;
          const isoLike = typeof av === 'string' ? av : new Date(av).toISOString().slice(0, 10);
          const title = `<div style="font-family:DM Sans;font-weight:bold;color:#1a1d23;font-size:13px;margin-bottom:4px;">${fmtDatePLLong(isoLike)}</div>`;
          const lines = items
            .map((it) => {
              if (it.value === null || it.value === undefined) return '';
              const p = it.seriesIndex === 0 ? p1 : p2;
              if (!p) return '';
              const num = Array.isArray(it.value) ? (it.value[1] as number) : (it.value as number);
              const s = status(num, p);
              const flag = s === 'ok' ? '' : s === 'high' ? ' ↑ za wysoki' : ' ↓ za niski';
              return `  ${p.name}: ${fmtVal(num)} ${p.unit}${flag}`;
            })
            .filter(Boolean)
            .join('<br>');
          return title + lines;
        },
      },
      xAxis: {
        type: 'time',
        min: xMin,
        max: xMax,
        axisLine: { lineStyle: { color: '#dde1ea' } },
        axisLabel: {
          color: '#9aa0af',
          fontFamily: 'DM Mono',
          fontSize: 11,
          rotate: 45,
          hideOverlap: true,
          formatter: (v: number) => {
            const dt = new Date(v);
            const dd = String(dt.getDate()).padStart(2, '0');
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            return `${dd}.${mm}.${dt.getFullYear()}`;
          },
        },
        splitLine: { show: true, lineStyle: { color: '#eef0f4' } },
      },
      yAxis: [
        {
          type: 'value',
          show: !!p1,
          position: 'left',
          name: p1 ? `${p1.name}  (${p1.unit})` : '',
          nameTextStyle: { color: P1C, fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500 },
          axisLabel: { color: P1C, fontFamily: 'DM Mono', fontSize: 11 },
          axisLine: { lineStyle: { color: '#dde1ea' } },
          splitLine: { lineStyle: { color: '#eef0f4' } },
        },
        {
          type: 'value',
          show: !!p2,
          position: 'right',
          name: p2 ? `${p2.name}  (${p2.unit})` : '',
          nameTextStyle: { color: P2C, fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500 },
          axisLabel: { color: P2C, fontFamily: 'DM Mono', fontSize: 11 },
          axisLine: { lineStyle: { color: '#dde1ea' } },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false },
        { type: 'slider', xAxisIndex: 0, height: 22, bottom: 16, borderColor: '#dde1ea', fillerColor: 'rgba(59,111,212,0.08)', handleStyle: { color: '#fff', borderColor: '#3b6fd4' }, textStyle: { color: '#9aa0af', fontFamily: 'DM Mono', fontSize: 10 } },
      ],
      visualMap: visualMaps.length === 1 ? visualMaps[0] : (visualMaps as never),
      series,
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
        const inRange = eventOverlapsData(ev);
        const rangeStr = ev.dateTo
          ? ` <span style="font-size:10px;opacity:0.6;font-family:var(--mono);">${fmtDatePLLocal(ev.date)}–${fmtDatePLLocal(ev.dateTo)}</span>`
          : ` <span style="font-size:10px;opacity:0.6;font-family:var(--mono);">${fmtDatePLLocal(ev.date)}</span>`;
        const inner = ev.dateTo
          ? `<span class="chip-band"></span>`
          : `<span class="chip-dash"></span><span class="chip-dot"></span>`;
        const cls = `event-chip${on ? ' on' : ''}${inRange ? '' : ' out-of-range'}`;
        const title = inRange ? '' : ' title="Poza zakresem danych — niewidoczne na wykresie"';
        return `<button class="${cls}" data-id="${ev.id}"${title}>
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
    chart.setOption(buildOption(), { notMerge: true, lazyUpdate: true });
    updateLegend();
  }

  sel1.addEventListener('change', updateChart);
  sel2.addEventListener('change', updateChart);
  window.addEventListener('resize', () => chart.resize());

  function currentZoom(): { start: number; end: number } {
    const opt = chart.getOption() as { dataZoom?: { start?: number; end?: number }[] };
    const dz = opt.dataZoom?.[0];
    return { start: dz?.start ?? 0, end: dz?.end ?? 100 };
  }

  function applyZoom(start: number, end: number): void {
    const min = 0;
    const max = 100;
    const minSpan = 1;
    let s = Math.max(min, start);
    let e = Math.min(max, end);
    if (e - s < minSpan) {
      const mid = (s + e) / 2;
      s = Math.max(min, mid - minSpan / 2);
      e = Math.min(max, s + minSpan);
    }
    chart.dispatchAction({ type: 'dataZoom', start: s, end: e });
  }

  document.getElementById('reset-zoom')?.addEventListener('click', () => {
    applyZoom(0, 100);
  });
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    const { start, end } = currentZoom();
    const span = end - start;
    const next = span * 0.6;
    const mid = (start + end) / 2;
    applyZoom(mid - next / 2, mid + next / 2);
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    const { start, end } = currentZoom();
    const span = end - start;
    const next = Math.min(100, span / 0.6);
    const mid = (start + end) / 2;
    let s = mid - next / 2;
    let e = mid + next / 2;
    if (s < 0) { e -= s; s = 0; }
    if (e > 100) { s -= e - 100; e = 100; }
    applyZoom(s, e);
  });
  document.getElementById('pan-left')?.addEventListener('click', () => {
    const { start, end } = currentZoom();
    const span = end - start;
    const step = Math.max(1, span * 0.25);
    const shift = Math.min(start, step);
    applyZoom(start - shift, end - shift);
  });
  document.getElementById('pan-right')?.addEventListener('click', () => {
    const { start, end } = currentZoom();
    const span = end - start;
    const step = Math.max(1, span * 0.25);
    const shift = Math.min(100 - end, step);
    applyZoom(start + shift, end + shift);
  });

  renderChips();
  updateChart();
}
