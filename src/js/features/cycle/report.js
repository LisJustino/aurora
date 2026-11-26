import { addDays } from '../../utils/dates.js';
import { cycleHistory, symptomPhasePatterns, topSymptoms } from './calculations.js';

const RECENT_CYCLES = 6;
const BUCKET_LABELS = Object.freeze({
  period: 'durante o período',
  before: 'nos 5 dias antes do período',
});

const average = (values) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

// Por padrão, o resumo usa só período, duração do ciclo e sintomas.
// Registros de intimidade e estimativas de fertilidade nunca entram;
// medicação e anotações só entram se a usuária marcar explicitamente.
export function buildCycleReport({
  cycleLog,
  stats,
  asOfDate,
  getLabel,
  includeMedication = false,
  includeNotes = false,
}) {
  const history = cycleHistory(stats.starts, stats.set, 12);
  const completed = history.filter((row) => row.length).slice(0, RECENT_CYCLES);
  const from = addDays(asOfDate, -90);
  const windowEntries = Object.entries(cycleLog || {})
    .filter(([day, entry]) => day >= from && day <= asOfDate && entry && typeof entry === 'object')
    .sort((a, b) => b[0].localeCompare(a[0]));
  const medication = includeMedication
    ? windowEntries.reduce(
        (acc, [, entry]) => {
          if (entry.medicationTaken === true) acc.taken += 1;
          else if (entry.medicationTaken === false) acc.missed += 1;
          return acc;
        },
        { taken: 0, missed: 0 },
      )
    : null;
  const notes = includeNotes
    ? windowEntries
        .filter(([, entry]) => typeof entry.note === 'string' && entry.note.trim())
        .slice(0, 30)
        .map(([day, entry]) => ({ day, text: entry.note.trim() }))
    : null;
  return {
    asOfDate,
    lastStart: stats.starts[stats.starts.length - 1] || null,
    avgCycle: stats.avg,
    minCycle: stats.min,
    maxCycle: stats.max,
    avgPeriod: average(
      history
        .filter((row) => row.periodLength > 0)
        .slice(0, RECENT_CYCLES)
        .map((row) => row.periodLength),
    ),
    cycles: completed,
    symptoms: topSymptoms(cycleLog, asOfDate, getLabel),
    patterns: symptomPhasePatterns(cycleLog, stats, asOfDate, getLabel),
    loggedDays: windowEntries.length,
    medication,
    notes,
  };
}

export function cycleReportHtml(report, { esc, longDate, shortDate, plural }) {
  const rows = report.cycles
    .map(
      (row) =>
        `<tr><td>${esc(shortDate(row.start))}</td><td>${row.length} dias</td><td>${row.periodLength ? `${row.periodLength} ${plural(row.periodLength, 'dia', 'dias')}` : '—'}</td></tr>`,
    )
    .join('');
  const symptoms = report.symptoms
    .map((item) => `<li>${esc(item.label)} · ${item.count} ${plural(item.count, 'registro', 'registros')}</li>`)
    .join('');
  const patterns = report.patterns
    .map(
      (item) =>
        `<li>${esc(item.label)} · ${item.inBucket} de ${item.count} ${plural(item.count, 'registro', 'registros')} ${BUCKET_LABELS[item.bucket]}</li>`,
    )
    .join('');
  const medicationSection = report.medication
    ? (() => {
        const total = report.medication.taken + report.medication.missed;
        return `<h3>Medicação (últimos 90 dias)</h3>${
          total
            ? `<p>${report.medication.taken} ${plural(report.medication.taken, 'dia tomado', 'dias tomados')}${report.medication.missed ? ` · ${report.medication.missed} ${plural(report.medication.missed, 'dia não tomado', 'dias não tomados')}` : ''} (${total} ${plural(total, 'registro', 'registros')}).</p>`
            : '<p>Nenhum registro de medicação nos últimos 90 dias.</p>'
        }`;
      })()
    : '';
  const notesSection = report.notes
    ? `<h3>Anotações registradas (últimos 90 dias)</h3>${
        report.notes.length
          ? `<ul>${report.notes.map((item) => `<li><b>${esc(shortDate(item.day))}:</b> ${esc(item.text)}</li>`).join('')}</ul>`
          : '<p>Nenhuma anotação registrada nos últimos 90 dias.</p>'
      }`
    : '';
  const range =
    report.minCycle === report.maxCycle ? `${report.minCycle} dias` : `${report.minCycle} a ${report.maxCycle} dias`;
  return `<article class="cycle-report">
<h2>Resumo do ciclo</h2>
<p class="cycle-report-note">Gerado em ${esc(longDate(report.asOfDate))} com os registros feitos no Aurora. É um apoio para conversar com quem cuida da sua saúde e não é diagnóstico.</p>
<dl class="cycle-report-facts">
<div><dt>Último início registrado</dt><dd>${report.lastStart ? esc(longDate(report.lastStart)) : 'Sem registro'}</dd></div>
<div><dt>Duração média do ciclo</dt><dd>${report.avgCycle ? `${report.avgCycle} dias (variação de ${range})` : 'Ainda sem dados suficientes'}</dd></div>
<div><dt>Duração média do período</dt><dd>${report.avgPeriod ? `${report.avgPeriod} ${plural(report.avgPeriod, 'dia', 'dias')}` : 'Sem dados'}</dd></div>
<div><dt>Dias com registro (90 dias)</dt><dd>${report.loggedDays}</dd></div>
</dl>
<h3>Ciclos recentes</h3>
${rows ? `<table><thead><tr><th>Início</th><th>Ciclo</th><th>Período</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Registre ao menos dois inícios de período para ver a duração dos ciclos.</p>'}
<h3>Sintomas mais registrados (últimos 90 dias)</h3>
${symptoms ? `<ul>${symptoms}</ul>` : '<p>Nenhum sintoma registrado no período.</p>'}
${patterns ? `<h3>Padrões nos seus registros</h3><ul>${patterns}</ul>` : ''}
${medicationSection}
${notesSection}
<p class="cycle-report-note">As contagens refletem o que foi registrado; não registrar um sinal não significa que ele não ocorreu. Estimativas de ovulação e janela fértil não fazem parte deste resumo.</p>
</article>`;
}

export const CYCLE_REPORT_PRINT_CSS = `
body { margin: 32px; color: #222; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
h2 { margin: 0 0 4px; font-size: 22px; }
h3 { margin: 22px 0 6px; font-size: 15px; }
.cycle-report-note { color: #555; font-size: 12px; }
.cycle-report-facts { display: grid; gap: 6px; margin: 16px 0 0; }
.cycle-report-facts div { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
.cycle-report-facts dt { color: #555; }
.cycle-report-facts dd { margin: 0; font-weight: 600; text-align: right; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
ul { margin: 0; padding-left: 18px; }
`;
