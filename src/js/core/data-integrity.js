export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function filterValidRecords(value, isValidRecord) {
  if (!Array.isArray(value)) return { records: [], rejectedCount: 1 };

  const records = [];
  let rejectedCount = 0;
  value.forEach((record) => {
    if (isValidRecord(record)) records.push(record);
    else rejectedCount++;
  });
  return { records, rejectedCount };
}
export function validateFinanceReferences(finance) {
  if (!isPlainObject(finance)) {
    return { value: finance, invalidCount: 1 };
  }

  const accounts = Array.isArray(finance.accounts)
    ? finance.accounts
    : [];

  const accountIds = new Set(
    accounts
      .filter((account) => (
        isPlainObject(account)
        && typeof account.id === 'string'
        && account.id.trim().length > 0
      ))
      .map((account) => account.id)
  );

  let invalidCount = 0;

  const transactions = [];

  (Array.isArray(finance.tx) ? finance.tx : []).forEach((transaction) => {
    if (!isPlainObject(transaction)) {
      invalidCount++;
      return;
    }

    const sourceExists = accountIds.has(transaction.accountId);

    const isTransfer = transaction.type === 'tr';

    const destinationExists = !isTransfer
      || accountIds.has(transaction.toAccountId);

    const distinctAccounts = !isTransfer
      || transaction.accountId !== transaction.toAccountId;

    if (!sourceExists || !destinationExists || !distinctAccounts) {
      invalidCount++;
      return;
    }

    transactions.push(transaction);
  });

  const recurring = [];

  (Array.isArray(finance.recurring) ? finance.recurring : []).forEach((item) => {
    if (
      !isPlainObject(item)
      || !accountIds.has(item.accountId)
    ) {
      invalidCount++;
      return;
    }

    recurring.push(item);
  });

  return {
    value: {
      ...finance,
      tx: transactions,
      recurring
    },
    invalidCount
  };
}
