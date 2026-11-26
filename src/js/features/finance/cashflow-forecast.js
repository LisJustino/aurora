import { addDays, pad } from '../../utils/dates.js';
import {
  accountBalanceOn,
  cardInvoice,
  invoiceDueDate,
  invoiceMonth,
  isCreditAccount,
  isPaid,
  netAccountBalance,
} from './calculations.js';

export const FORECAST_HORIZONS = Object.freeze([30, 60, 90]);

const clampedDay = (month, day) => {
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return `${month}-${pad(Math.min(day, lastDay))}`;
};

function defaultShiftMonth(ym, offset) {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function defaultParseDate(day) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

function scheduledCardPrincipal(transactions, cardId) {
  return transactions
    .filter((tx) => tx.invoiceInstallment && tx.toAccountId === cardId && !isPaid(tx))
    .reduce((sum, tx) => sum + tx.cents - (tx.interestCents || 0), 0);
}

function collectPendingTransactions(accounts, transactions, asOfDate, endDate, accountDisplayName) {
  const accountById = (id) => accounts.find((account) => account.id === id);
  const items = [];
  for (const tx of transactions) {
    if (isPaid(tx) || !tx.date || tx.date > endDate) continue;
    const source = accountById(tx.accountId);
    const destination = tx.toAccountId ? accountById(tx.toAccountId) : null;
    let deltaCents = 0;
    let kind = tx.type;
    if (tx.type === 'in') {
      if (isCreditAccount(source)) continue;
      deltaCents = tx.cents;
    } else if (tx.type === 'out') {
      if (isCreditAccount(source)) continue;
      deltaCents = -tx.cents;
    } else if (tx.type === 'tr') {
      const fromCredit = isCreditAccount(source);
      const toCredit = isCreditAccount(destination);
      if (fromCredit === toCredit) continue;
      deltaCents = toCredit ? -tx.cents : tx.cents;
      kind = toCredit ? 'invoice' : 'in';
    }
    if (!deltaCents) continue;
    const overdue = tx.date < asOfDate;
    const effectiveDate = overdue ? asOfDate : tx.date;
    items.push({
      id: `tx-${tx.id}`,
      date: effectiveDate,
      originalDate: tx.date,
      overdue,
      kind,
      label: tx.desc || tx.category || (kind === 'invoice' ? 'Pagamento de fatura' : 'Lançamento'),
      detail: source ? accountDisplayName(source) : '',
      deltaCents,
      projected: false,
    });
  }
  return items;
}

function collectUnmaterializedRecurring(accounts, transactions, recurring, asOfDate, endDate, shiftMonth, nameOf) {
  if (!Array.isArray(recurring) || !recurring.length) return [];
  const accountById = (id) => accounts.find((account) => account.id === id);
  const startYm = asOfDate.slice(0, 7);
  const endYm = endDate.slice(0, 7);
  const items = [];
  for (const rec of recurring) {
    if (!rec || rec.paused) continue;
    const account = accountById(rec.accountId);
    if (!account || isCreditAccount(account)) continue;
    let ym = rec.startYM && rec.startYM > startYm ? rec.startYM : startYm;
    let guard = 0;
    while (ym <= endYm && (!rec.endYM || ym <= rec.endYM) && guard++ < 12) {
      const date = clampedDay(ym, rec.day || 1);
      if (date >= asOfDate && date <= endDate) {
        const exists = transactions.some((tx) => tx.recId === rec.id && tx.date.startsWith(`${ym}-`));
        if (!exists) {
          items.push({
            id: `rec-${rec.id}-${ym}`,
            date,
            originalDate: date,
            overdue: false,
            kind: rec.type === 'in' ? 'in' : 'out',
            label: rec.desc || rec.category || 'Lançamento fixo',
            detail: `${nameOf(account)} · fixo previsto`,
            deltaCents: rec.type === 'in' ? rec.cents : -rec.cents,
            projected: true,
          });
        }
      }
      ym = shiftMonth(ym, 1);
    }
  }
  return items;
}

function projectedCardRecurringForMonth(card, month, transactions, recurring, shiftMonth, parseDate) {
  if (!Array.isArray(recurring) || !recurring.length) return 0;
  let total = 0;
  const candidateMonths = [shiftMonth(month, -1), month];
  for (const rec of recurring) {
    if (!rec || rec.paused || rec.type !== 'out' || rec.accountId !== card.id) continue;
    for (const ym of candidateMonths) {
      if ((rec.startYM && ym < rec.startYM) || (rec.endYM && ym > rec.endYM)) continue;
      const date = clampedDay(ym, rec.day || 1);
      if (invoiceMonth(card, date, shiftMonth, parseDate) !== month) continue;
      if (transactions.some((tx) => tx.recId === rec.id && tx.date.startsWith(`${ym}-`))) continue;
      total += rec.cents;
    }
  }
  return total;
}

function collectCardInvoices(accounts, transactions, recurring, asOfDate, endDate, shiftMonth, parseDate, nameOf) {
  const items = [];
  const finance = { tx: transactions };
  const helpers = { shiftMonth, parseDate };

  for (const card of accounts.filter(isCreditAccount)) {
    if (!card.dueDay) continue;
    const currentMonth = invoiceMonth(card, asOfDate, shiftMonth, parseDate);
    const currentDue = invoiceDueDate(card, currentMonth, shiftMonth);
    const currentRemaining = Math.max(
      0,
      -accountBalanceOn(card, transactions, asOfDate) - scheduledCardPrincipal(transactions, card.id),
    );
    if (currentDue && currentDue <= endDate && currentRemaining > 0) {
      const overdue = currentDue < asOfDate;
      items.push({
        id: `inv-${card.id}-${currentMonth}`,
        date: overdue ? asOfDate : currentDue,
        originalDate: currentDue,
        overdue,
        kind: 'invoice',
        label: `Fatura ${nameOf(card)}`,
        detail: overdue ? 'Fatura vencida' : 'Fatura atual',
        deltaCents: -currentRemaining,
        projected: false,
      });
    }

    for (let offset = 1; offset <= 5; offset++) {
      const month = shiftMonth(currentMonth, offset);
      const dueDate = invoiceDueDate(card, month, shiftMonth);
      if (!dueDate || dueDate > endDate) break;
      if (dueDate < asOfDate) continue;
      const inv = cardInvoice(finance, card, month, helpers);
      const extraRecurring = projectedCardRecurringForMonth(
        card,
        month,
        transactions,
        recurring,
        shiftMonth,
        parseDate,
      );
      const total = inv.total + extraRecurring;
      if (total <= 0) continue;
      items.push({
        id: `inv-${card.id}-${month}`,
        date: dueDate,
        originalDate: dueDate,
        overdue: false,
        kind: 'invoice',
        label: `Fatura ${nameOf(card)}`,
        detail: inv.installmentCount
          ? `${inv.installmentCount} ${inv.installmentCount === 1 ? 'parcela prevista' : 'parcelas previstas'}`
          : 'Fatura futura',
        deltaCents: -total,
        projected: true,
      });
    }
  }
  return items;
}

export function buildCashflowForecast({
  accounts = [],
  transactions = [],
  recurring = [],
  asOfDate,
  horizonDays = 30,
  shiftMonth = defaultShiftMonth,
  parseDate = defaultParseDate,
  accountDisplayName = (account) => account?.name || 'Conta',
} = {}) {
  const days = FORECAST_HORIZONS.includes(horizonDays) ? horizonDays : 30;
  const startBalanceCents = netAccountBalance(accounts, transactions);
  const endDate = addDays(asOfDate, days);

  const rawEvents = [
    ...collectPendingTransactions(accounts, transactions, asOfDate, endDate, accountDisplayName),
    ...collectUnmaterializedRecurring(
      accounts,
      transactions,
      recurring,
      asOfDate,
      endDate,
      shiftMonth,
      accountDisplayName,
    ),
    ...collectCardInvoices(
      accounts,
      transactions,
      recurring,
      asOfDate,
      endDate,
      shiftMonth,
      parseDate,
      accountDisplayName,
    ),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.deltaCents > 0) - Number(a.deltaCents > 0) ||
      Math.abs(b.deltaCents) - Math.abs(a.deltaCents) ||
      a.label.localeCompare(b.label, 'pt-BR'),
  );

  const byDay = new Map();
  let totalInCents = 0;
  let totalOutCents = 0;
  for (const event of rawEvents) {
    if (event.deltaCents > 0) totalInCents += event.deltaCents;
    else totalOutCents += Math.abs(event.deltaCents);
    if (!byDay.has(event.date)) byDay.set(event.date, []);
    byDay.get(event.date).push(event);
  }

  let running = startBalanceCents;
  const points = [];
  const eventDays = [];
  let lowestPoint = { date: asOfDate, balanceCents: startBalanceCents };
  let highestPoint = { date: asOfDate, balanceCents: startBalanceCents };
  let firstNegativeDate = startBalanceCents < 0 ? asOfDate : null;

  for (let offset = 0; offset <= days; offset++) {
    const date = addDays(asOfDate, offset);
    const items = byDay.get(date) || [];
    const deltaCents = items.reduce((sum, item) => sum + item.deltaCents, 0);
    running += deltaCents;
    points.push({ date, balanceCents: running });
    if (items.length) {
      eventDays.push({ date, deltaCents, balanceCents: running, items });
    }
    if (running < lowestPoint.balanceCents) lowestPoint = { date, balanceCents: running };
    if (running > highestPoint.balanceCents) highestPoint = { date, balanceCents: running };
    if (firstNegativeDate === null && running < 0) firstNegativeDate = date;
  }

  return {
    asOfDate,
    endDate,
    horizonDays: days,
    startBalanceCents,
    endBalanceCents: running,
    totalInCents,
    totalOutCents,
    netChangeCents: totalInCents - totalOutCents,
    lowestPoint,
    highestPoint,
    firstNegativeDate,
    points,
    eventDays,
  };
}
