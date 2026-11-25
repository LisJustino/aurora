// Agenda unificada: junta contas a vencer, faturas e a previsão do ciclo em um
// mapa dia -> itens, para o calendário do Planejar mostrar tudo num lugar só.
import { addDays } from '../../utils/dates.js';

const MAX_RANGE_DAYS = 31;

// bills/invoices: [{ date, label, amount }]; cycleRange: { from, to } ou null.
// Só devolve dias do mês `ym` (AAAA-MM).
export function agendaForMonth(ym, { bills = [], invoices = [], cycleRange = null } = {}) {
  const byDay = {};
  const add = (day, item) => {
    if (typeof day === 'string' && day.startsWith(`${ym}-`)) (byDay[day] = byDay[day] || []).push(item);
  };
  invoices.forEach((item) => add(item.date, { kind: 'invoice', label: item.label, amount: item.amount ?? '' }));
  bills.forEach((item) => add(item.date, { kind: 'bill', label: item.label, amount: item.amount ?? '' }));
  if (cycleRange?.from && cycleRange?.to && cycleRange.from <= cycleRange.to) {
    const single = cycleRange.from === cycleRange.to;
    for (
      let day = cycleRange.from, guard = 0;
      day <= cycleRange.to && guard < MAX_RANGE_DAYS;
      day = addDays(day, 1), guard++
    ) {
      add(day, {
        kind: 'cycle',
        label: single ? 'Previsão da menstruação' : 'Janela prevista da menstruação',
        amount: '',
      });
    }
  }
  return byDay;
}

export const agendaMarker = (items) =>
  [
    items.some((item) => item.kind === 'bill' || item.kind === 'invoice') ? '<u class="agenda-bill"></u>' : '',
    items.some((item) => item.kind === 'cycle') ? '<u class="agenda-cycle"></u>' : '',
  ].join('');

export const agendaLabel = (items) => {
  const money = items.filter((item) => item.kind === 'bill' || item.kind === 'invoice').length;
  const cycle = items.some((item) => item.kind === 'cycle');
  return [
    money ? `${money} ${money === 1 ? 'conta a vencer' : 'contas a vencer'}` : '',
    cycle ? 'previsão do ciclo' : '',
  ].filter(Boolean);
};
