import assert from 'node:assert/strict';
import {
  cycleHistory,
  cycleStats,
  daysWithSymptom,
  nextPeriodRange,
  periodDelay,
  symptomPhasePatterns,
} from '../src/js/features/cycle/calculations.js';
import { buildCycleReport, cycleReportHtml } from '../src/js/features/cycle/report.js';

const flow = (days) => Object.fromEntries(days.map((day) => [day, { flow: 'medium' }]));
const periods = [
  { start: '2026-08-01', end: '2026-08-05' },
  { start: '2026-08-29', end: '2026-09-02' },
  { start: '2026-09-28', end: '2026-10-01' },
  { start: '2026-10-27', end: '2026-10-30' },
];
const today = '2026-11-21';
const stats = cycleStats({}, periods, today);
assert.deepEqual(stats.starts, ['2026-08-01', '2026-08-29', '2026-09-28', '2026-10-27']);
assert.equal(stats.min, 28);
assert.equal(stats.max, 30);

// histórico: mais recente primeiro
const history = cycleHistory(stats.starts, stats.set);
assert.equal(history.length, 4);
assert.deepEqual(history[0], { start: '2026-10-27', periodLength: 4, length: null, ongoing: true });
assert.deepEqual(history[1], { start: '2026-09-28', periodLength: 4, length: 29, ongoing: false });
assert.equal(history[3].length, 28);
assert.equal(cycleHistory(stats.starts, stats.set, 2).length, 2);
assert.deepEqual(cycleHistory(null, null), []);

// previsão em faixa
const range = nextPeriodRange(stats);
assert.deepEqual(range, { from: '2026-11-24', to: '2026-11-26', single: false });
assert.equal(nextPeriodRange(cycleStats({}, [periods[0]], today)), null);

// atraso
assert.equal(periodDelay(stats, '2026-11-20'), null);
assert.deepEqual(periodDelay(stats, '2026-11-27'), { days: 2, insideRange: false });
assert.deepEqual(periodDelay(stats, '2026-11-26'), { days: 1, insideRange: true });
assert.equal(periodDelay(stats, '2027-03-01'), null);

// padrões por fase: cólica mais frequente durante o período
const log = {
  ...flow(['2026-09-28', '2026-09-29']),
  '2026-09-28': { flow: 'medium', pain: ['cramp'] },
  '2026-09-29': { flow: 'medium', pain: ['cramp'] },
  '2026-10-24': { pain: ['cramp'] },
  '2026-10-27': { flow: 'heavy', pain: ['cramp'] },
  '2026-10-12': { mood: ['happy'] },
  '2026-10-13': { mood: ['happy'] },
  '2026-10-14': { mood: ['happy'] },
  '2026-11-10': { mood: ['happy'] },
};
const logStats = cycleStats(log, periods, today);
const label = (category, value) => `${category}/${value}`;
const patterns = symptomPhasePatterns(log, logStats, today, label);
assert.deepEqual(patterns.map((item) => item.value), ['cramp']);
assert.equal(patterns[0].bucket, 'period');
assert.equal(patterns[0].count, 4);
assert.equal(patterns[0].percent, 75);
assert.equal(patterns[0].label, 'pain/cramp');
assert.deepEqual(symptomPhasePatterns({}, logStats, today, label), []);

// resumo para consulta: só ciclo e sintomas, com texto escapado
const sensitiveLog = { ...log, '2026-11-01': { sexualActivity: true, note: 'texto privado', ovulationTestResult: 'positive', pain: ['<b>x</b>'] } };
const report = buildCycleReport({ cycleLog: sensitiveLog, stats: cycleStats(sensitiveLog, periods, today), asOfDate: today, getLabel: label });
assert.equal(report.cycles.length, 3);
assert.equal(report.avgPeriod, 5);
assert.equal(report.lastStart, '2026-10-27');
const html = cycleReportHtml(report, {
  esc: (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
  longDate: (day) => `longo ${day}`,
  shortDate: (day) => `curto ${day}`,
  plural: (n, one, many) => (n === 1 ? one : many),
});
assert.ok(html.includes('Resumo do ciclo'));
assert.ok(html.includes('curto 2026-09-28'));
assert.ok(!html.includes('texto privado'));
assert.ok(!html.includes('sexual'));
assert.ok(!html.includes('<b>x</b>'));
assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));

// filtro de dias por sintoma (últimos 180 dias, mais recente primeiro)
assert.deepEqual(daysWithSymptom(log, 'pain:cramp', today, 180), ['2026-10-27', '2026-10-24', '2026-09-29', '2026-09-28']);
assert.deepEqual(daysWithSymptom(log, 'mood:happy', today, 180), ['2026-11-10', '2026-10-14', '2026-10-13', '2026-10-12']);
assert.deepEqual(daysWithSymptom(log, 'invalido', today, 180), []);

// opções explícitas do resumo para consulta: medicação e anotações entram apenas quando ativadas; intimidade nunca entra
const medLog = {
  ...sensitiveLog,
  '2026-11-18': { medicationTaken: true, note: 'Nota com <script>' },
  '2026-11-19': { medicationTaken: false },
};
const customReport = buildCycleReport({
  cycleLog: medLog,
  stats: cycleStats(medLog, periods, today),
  asOfDate: today,
  getLabel: label,
  includeMedication: true,
  includeNotes: true,
});
assert.deepEqual(customReport.medication, { taken: 1, missed: 1 });
assert.equal(customReport.notes.length, 2);
const customHtml = cycleReportHtml(customReport, {
  esc: (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
  longDate: (day) => `longo ${day}`,
  shortDate: (day) => `curto ${day}`,
  plural: (n, one, many) => (n === 1 ? one : many),
});
assert.ok(customHtml.includes('Medicação (últimos 90 dias)'));
assert.ok(customHtml.includes('1 dia tomado'));
assert.ok(customHtml.includes('1 dia não tomado'));
assert.ok(customHtml.includes('Anotações registradas (últimos 90 dias)'));
assert.ok(customHtml.includes('texto privado'));
assert.ok(customHtml.includes('Nota com &lt;script&gt;'));
assert.ok(!customHtml.includes('<script>'));
assert.ok(!customHtml.includes('sexual'));

console.log('cycle-insights-check: ok');
