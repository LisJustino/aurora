import assert from 'node:assert/strict';
import { agendaForMonth, agendaLabel, agendaMarker } from '../src/js/features/planning/agenda.js';

const out = agendaForMonth('2026-11', {
  bills: [{ date: '2026-11-25', label: 'Aluguel', amount: 'R$ 1.000,00' }, { date: '2026-12-02', label: 'Fora do mês' }],
  invoices: [{ date: '2026-11-25', label: 'Fatura Nubank', amount: 'R$ 300,00' }],
  cycleRange: { from: '2026-11-29', to: '2026-12-02' },
});
assert.deepEqual(Object.keys(out).sort(), ['2026-11-25', '2026-11-29', '2026-11-30']);
assert.deepEqual(out['2026-11-25'].map((item) => item.kind), ['invoice', 'bill']); // fatura primeiro
assert.equal(out['2026-11-29'][0].kind, 'cycle');
assert.equal(out['2026-11-29'][0].label, 'Janela prevista da menstruação');
assert.equal(agendaMarker(out['2026-11-25']), '<u class="agenda-bill"></u>');
assert.equal(agendaMarker(out['2026-11-29']), '<u class="agenda-cycle"></u>');
assert.deepEqual(agendaLabel(out['2026-11-25']), ['2 contas a vencer']);
assert.deepEqual(agendaLabel(out['2026-11-29']), ['previsão do ciclo']);
assert.deepEqual(agendaForMonth('2026-11'), {});
assert.equal(agendaForMonth('2026-12', { cycleRange: { from: '2026-12-01', to: '2026-12-01' } })['2026-12-01'][0].label, 'Previsão da menstruação');
assert.deepEqual(agendaForMonth('2026-11', { cycleRange: { from: '2026-11-10', to: '2026-11-05' } }), {}); // intervalo invertido ignorado
console.log('agenda ok');
