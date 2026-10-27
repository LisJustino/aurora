export const isPaid = (transaction) => transaction.paid !== false;
export const isCreditAccount = (account) => account && account.type === 'credit';

export function recurringBillsDueOn(transactions, day) {
  return transactions
    .filter((transaction) => transaction.recId
      && transaction.type === 'out'
      && transaction.date === day
      && !isPaid(transaction))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export const signedAmount = (transaction, accountId) => (
  transaction.type === 'in'
    ? transaction.cents
    : transaction.type === 'out'
      ? -transaction.cents
      : transaction.accountId === accountId
        ? -transaction.cents
        : transaction.cents
);

export function accountBalance(account, transactions) {
  return account.initialCents + transactions
    .filter((transaction) => isPaid(transaction)
      && (transaction.accountId === account.id || transaction.toAccountId === account.id))
    .reduce((sum, transaction) => sum + signedAmount(transaction, account.id), 0);
}

export function netAccountBalance(accounts, transactions) {
  return accounts
    .filter((account) => !isCreditAccount(account))
    .reduce((sum, account) => sum + accountBalance(account, transactions), 0);
}

export function monthStats(transactions, month, accountForId) {
  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(month)
    && transaction.type !== 'tr');
  const sum = (predicate) => monthTransactions
    .filter(predicate)
    .reduce((total, transaction) => total + transaction.cents, 0);
  return {
    tx: monthTransactions,
    inAll: sum((transaction) => transaction.type === 'in'),
    inPaid: sum((transaction) => transaction.type === 'in' && isPaid(transaction)),
    inPending: sum((transaction) => transaction.type === 'in' && !isPaid(transaction)),
    outAll: sum((transaction) => transaction.type === 'out'),
    outPaid: sum((transaction) => transaction.type === 'out'
      && isPaid(transaction) && !isCreditAccount(accountForId(transaction.accountId))),
    outPending: sum((transaction) => transaction.type === 'out'
      && !isPaid(transaction) && !isCreditAccount(accountForId(transaction.accountId))),
    cardOut: sum((transaction) => transaction.type === 'out'
      && isCreditAccount(accountForId(transaction.accountId))),
  };
}

export function byCategory(transactions, kind) {
  const totals = new Map();
  transactions.filter((transaction) => transaction.type === kind).forEach((transaction) => {
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.cents);
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

export function invoiceMonth(card, date, shiftMonth, parseDate) {
  const parsed = parseDate(date);
  let month = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  if (card.closingDay && parsed.getDate() > card.closingDay) month = shiftMonth(month, 1);
  return month;
}

export function cardInfo(finance, card, currentDate, helpers) {
  const { shiftMonth, parseDate, accountBalance: balanceFor } = helpers;
  const month = invoiceMonth(card, currentDate, shiftMonth, parseDate);
  const total = finance.tx
    .filter((transaction) => transaction.accountId === card.id
      && transaction.type === 'out'
      && invoiceMonth(card, transaction.date, shiftMonth, parseDate) === month)
    .reduce((sum, transaction) => sum + transaction.cents, 0);
  const dueMonth = card.dueDay && card.closingDay && card.dueDay <= card.closingDay
    ? shiftMonth(month, 1)
    : month;
  const dueDate = card.dueDay
    ? `${dueMonth}-${String(Math.min(
      card.dueDay,
      new Date(Number(dueMonth.slice(0, 4)), Number(dueMonth.slice(5)), 0).getDate(),
    )).padStart(2, '0')}`
    : null;
  const used = Math.max(0, -balanceFor(card));
  return {
    ym: month,
    total,
    due: dueDate,
    used,
    avail: card.limitCents ? Math.max(0, card.limitCents - used) : null,
  };
}
