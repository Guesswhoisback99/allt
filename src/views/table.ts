import type { Dataset, Param } from '../types';
import { fmtDatePL, fmtVal, status } from '../format';

export function initTable(dataset: Dataset): void {
  const { params, dates, values } = dataset;
  const dateListEl = document.getElementById('date-list') as HTMLElement;
  const dateCountEl = document.getElementById('date-count') as HTMLElement;
  const searchEl = document.getElementById('date-search') as HTMLInputElement;
  const cardEl = document.getElementById('table-card') as HTMLElement;

  if (!dates.length) {
    cardEl.innerHTML = `<div class="date-list-empty">Brak danych</div>`;
    return;
  }

  let selDate: string = dates[dates.length - 1]!;
  let query = '';

  function dateHasAnomaly(d: string): boolean {
    return params.some((p) => {
      const v = values[p.id]?.[d];
      if (v === undefined) return false;
      return status(v, p) !== 'ok';
    });
  }

  function renderList(): void {
    const q = query.trim().toLowerCase();
    const filtered = dates.filter((d) => !q || d.includes(q) || fmtDatePL(d).includes(q));
    dateCountEl.textContent = `${filtered.length} / ${dates.length}`;
    if (!filtered.length) {
      dateListEl.innerHTML = `<div class="date-list-empty">Brak wyników</div>`;
      return;
    }
    dateListEl.innerHTML = [...filtered]
      .reverse()
      .map((d) => {
        const anomaly = dateHasAnomaly(d);
        return `<div class="date-list-item${d === selDate ? ' active' : ''}${anomaly ? ' has-anomaly' : ''}" data-d="${d}">
          <span class="date-txt">${fmtDatePL(d)}</span>
          <span class="date-flag" title="Wynik poza normą"></span>
        </div>`;
      })
      .join('');
    dateListEl.querySelectorAll<HTMLElement>('.date-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        const d = item.dataset['d'];
        if (!d) return;
        selDate = d;
        renderList();
        renderTable();
      });
    });
    const activeEl = dateListEl.querySelector<HTMLElement>('.date-list-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function rangeStr(p: Param): string {
    if (p.lo === null) return `&lt; ${p.hi}`;
    return `${p.lo} – ${p.hi}`;
  }

  function renderTable(): void {
    const present = params.filter((p) => values[p.id]?.[selDate] !== undefined);
    const anomalyCount = present.filter((p) => status(values[p.id]![selDate]!, p) !== 'ok').length;
    const headerNote = anomalyCount
      ? `<span style="color:var(--danger);font-size:12px;font-weight:500;">${anomalyCount} wynik${anomalyCount === 1 ? '' : 'i'} poza normą</span>`
      : `<span style="color:var(--ok);font-size:12px;font-weight:500;">Wszystkie wyniki w normie</span>`;

    const rows = params
      .map((p) => {
        const v = values[p.id]?.[selDate];
        if (v === undefined) {
          return `<tr>
            <td class="td-name">${p.name}</td>
            <td class="td-value" style="color:var(--text-3);">—</td>
            <td class="td-unit">${p.unit}</td>
            <td class="td-range">${rangeStr(p)}</td>
            <td><span class="badge" style="background:var(--bg-3);color:var(--text-3);">brak</span></td>
          </tr>`;
        }
        const s = status(v, p);
        const badgeCls = s === 'ok' ? 'badge-ok' : s === 'high' ? 'badge-high' : 'badge-low';
        const badgeTxt = s === 'ok' ? '✓ Norma' : s === 'high' ? '↑ Podwyższony' : '↓ Obniżony';
        const valCls = s !== 'ok' ? ' val-danger' : '';
        return `<tr>
          <td class="td-name">${p.name}</td>
          <td class="td-value${valCls}">${fmtVal(v)}</td>
          <td class="td-unit">${p.unit}</td>
          <td class="td-range">${rangeStr(p)}</td>
          <td><span class="badge ${badgeCls}">${badgeTxt}</span></td>
        </tr>`;
      })
      .join('');

    cardEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--border);">
        <span style="font-size:14px;font-weight:600;">${fmtDatePL(selDate)}</span>
        ${headerNote}
      </div>
      <table class="results-table">
        <thead><tr>
          <th>Parametr</th><th>Wynik</th><th>Jednostka</th>
          <th>Zakres referencyjny</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  searchEl.addEventListener('input', (e) => {
    query = (e.target as HTMLInputElement).value;
    renderList();
  });

  renderList();
  renderTable();
}
