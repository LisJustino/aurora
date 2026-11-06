import { addDays } from '../../utils/dates.js';
import {
  cardInfo,
  isCreditAccount,
  isPaid,
  netAccountBalance,
  recurringBillsDueOn,
} from '../finance/calculations.js';

export const BILLS_LOOKAHEAD_DAYS = 3;

const daysInMonth = (day) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0).getDate();
const monthEnd = (day) => `${day.slice(0, 7)}-${String(daysInMonth(day)).padStart(2, '0')}`;

function cardInvoices(finance, helpers, day, limitDate) {
  return finance.accounts
    .filter(isCreditAccount)
    .map((card) => ({ card, info: cardInfo(finance, card, day, helpers) }))
    .filter(({ info }) => info.due && info.due >= day && info.due <= limitDate && info.total > 0)
    .map(({ card, info }) => ({
      kind: 'card',
      id: `card:${card.id}`,
      accountId: card.id,
      date: info.due,
      cents: info.total,
    }));
}

/*
 * Contas a vencer e "livre até o fim do mês". Cálculo local: nada sai do aparelho.
 * helpers = { shiftMonth, parseDate, accountBalance } (os mesmos usados por cardInfo).
 */
export function homeBills(finance, day, helpers) {
  const empty = { upcoming: [], dueCents: 0, freeCents: null, perDayCents: null, daysLeft: 0 };
  if (!finance || !Array.isArray(finance.accounts) || !Array.isArray(finance.tx)) return empty;
  const lastDay = addDays(day, BILLS_LOOKAHEAD_DAYS);
  const upcoming = [];
  for (let offset = 0; offset <= BILLS_LOOKAHEAD_DAYS; offset += 1) {
    const date = addDays(day, offset);
    recurringBillsDueOn(finance.tx, date).forEach((transaction) => {
      upcoming.push({
        kind: 'bill',
        id: `bill:${transaction.id}`,
        accountId: transaction.accountId,
        title: transaction.desc || transaction.category || 'Conta fixa',
        date,
        cents: transaction.cents,
      });
    });
  }
  upcoming.push(...cardInvoices(finance, helpers, day, lastDay));
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const end = monthEnd(day);
  const pendingBills = finance.tx.filter((transaction) => transaction.recId
    && transaction.type === 'out'
    && !isPaid(transaction)
    && transaction.date <= end);
  const dueCents = pendingBills.reduce((sum, transaction) => sum + transaction.cents, 0)
    + cardInvoices(finance, helpers, day, end).reduce((sum, item) => sum + item.cents, 0);
  const daysLeft = daysInMonth(day) - Number(day.slice(8, 10)) + 1;
  const freeCents = netAccountBalance(finance.accounts, finance.tx) - dueCents;
  return {
    upcoming,
    dueCents,
    freeCents,
    perDayCents: Math.floor(freeCents / daysLeft),
    daysLeft,
  };
}
