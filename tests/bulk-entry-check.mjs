import assert from 'node:assert/strict';
import {
  buildBulkRecords,
  bulkRowCount,
  bulkRowInstallmentCents,
  findBulkAccount,
  MAX_BULK_LINES,
  parseAmountCents,
  parseBulkDate,
  parseBulkText,
  resolveBulkCategory,
} from '../src/js/features/finance/bulk-entry.js';
import { addMonths } from '../src/js/utils/dates.js';

const context = { today: '2026-11-21' };

// Os quatro exemplos do pedido original.
const sample = `
- Icloud - fixa mensal - 50,00 - dia 04/12 - categoria assinatura - subcategoria: icloud
- BetaNet - fixa mensal - 129,90 - dia 10/12 - categoria moradia - subcategoria: internet
- Claro Elisa - fixa mensal - 20,00 - dia 03/12 - categoria assinatura - subcategoria plano de telefone
- Casas Bahia- parcelado - 87,76 - parcela 2/90 - dia 07/12 - categoria compras - subcategoria parceladas - valor da parcela
`;
const rows = parseBulkText(sample, context);
assert.equal(rows.length, 4);
assert.ok(rows.every((row) => !row.error), JSON.stringify(rows));
assert.deepEqual(
  rows.map((row) => [row.name, row.repeat, row.amountCents, row.date]),
  [
    ['Icloud', 'fixed', 5000, '2026-12-04'],
    ['BetaNet', 'fixed', 12990, '2026-12-10'],
    ['Claro Elisa', 'fixed', 2000, '2026-12-03'],
    ['Casas Bahia', 'parcel', 8776, '2026-12-07'],
  ],
);
assert.equal(rows[0].categoryText, 'assinatura');
assert.equal(rows[0].subcategoryText, 'icloud');
assert.equal(rows[2].subcategoryText, 'plano de telefone');
assert.equal(rows[3].currentInstallment, 2);
assert.equal(rows[3].totalInstallments, 90);
assert.equal(rows[3].amountMode, 'installment');
assert.equal(bulkRowCount(rows[3]), 89);
assert.equal(bulkRowInstallmentCents(rows[3]), 8776);

// Valores, datas e ordem livre dos campos.
assert.equal(parseAmountCents('1.234,56'), 123456);
assert.equal(parseAmountCents('R$ 50'), 5000);
assert.equal(parseAmountCents('50.00'), 5000);
assert.ok(Number.isNaN(parseAmountCents('abc')));
assert.equal(parseBulkDate('dia 4', '2026-11-21'), '2026-11-04');
assert.equal(parseBulkDate('04/12/2027', '2026-11-21'), '2027-12-04');
assert.equal(parseBulkDate('31/02', '2026-11-21'), null);
const shuffled = parseBulkText('Netflix - dia 05/12 - 39,90 - categoria lazer - fixa', context)[0];
assert.equal(shuffled.repeat, 'fixed');
assert.equal(shuffled.amountCents, 3990);
const wifi = parseBulkText('Wi-Fi - 99,90 - dia 06/12', context)[0];
assert.equal(wifi.name, 'Wi-Fi');
const income = parseBulkText('Salário - receita - 3.200,00 - dia 05/12', context)[0];
assert.equal(income.kind, 'in');
const times = parseBulkText('TV - parcelado - 1.200,00 - 12x - dia 10/12', context)[0];
assert.equal(times.totalInstallments, 12);
assert.equal(times.amountMode, 'total');

// Erros claros, linha a linha, sem derrubar as demais.
const mixed = parseBulkText('Sem valor - dia 10/12\nOk - 10,00 - dia 11/12\nParcela errada - 10,00 - dia 11/12 - parcela 5/3\nSem data - 10,00\nEstranho - 10,00 - dia 11/12 - banana', context);
assert.match(mixed[0].error, /valor/);
assert.equal(mixed[1].error, undefined);
assert.match(mixed[2].error, /parcela atual/);
assert.match(mixed[3].error, /data/);
assert.match(mixed[4].error, /banana/);
assert.equal(mixed[4].line, 5);
assert.equal(parseBulkText('\n\n   \n', context).length, 0);
const tooMany = parseBulkText(Array.from({ length: MAX_BULK_LINES + 5 }, (_, i) => `Item ${i} - 1,00 - dia 10/12`).join('\n'), context);
assert.equal(tooMany.length, MAX_BULK_LINES + 1);
assert.match(tooMany.at(-1).error, /Limite/);

// Categorias: acento, plural e criação sob demanda.
const leafName = (item) => item.name;
const categories = {
  out: [
    { name: 'Assinaturas', subcategories: [{ name: 'Streaming' }] },
    { name: 'Moradia', subcategories: [{ name: 'Internet' }] },
  ],
  in: [],
};
const icloud = resolveBulkCategory(rows[0], { categories, leafName });
assert.deepEqual([icloud.path, icloud.createParent, icloud.createChild], ['Assinaturas > icloud', false, true]);
const internet = resolveBulkCategory(rows[1], { categories, leafName });
assert.deepEqual([internet.path, internet.createParent, internet.createChild], ['Moradia > Internet', false, false]);
const novel = resolveBulkCategory(rows[3], { categories, leafName });
assert.deepEqual([novel.path, novel.createParent, novel.createChild], ['compras > parceladas', true, true]);
const guessed = resolveBulkCategory({ kind: 'out', name: 'x' }, { categories, leafName, fallback: () => 'Moradia' });
assert.equal(guessed.path, 'Moradia');

// Contas.
const accounts = [{ id: 'a', name: 'Nubank' }, { id: 'b', name: 'Itaú Visa' }];
const label = (account) => account.name;
assert.equal(findBulkAccount(accounts, 'itau', label)?.id, 'b');
assert.equal(findBulkAccount(accounts, 'nubank', label)?.id, 'a');
assert.equal(findBulkAccount(accounts, 'xp', label), null);

// Registros gerados.
let counter = 0;
const ctx = (extra = {}) => ({
  newId: () => `id${++counter}`,
  addMonths,
  account: { id: 'a' },
  isCredit: () => false,
  today: '2026-11-21',
  category: 'Assinaturas > icloud',
  now: 1000,
  ...extra,
});
const fixed = buildBulkRecords(rows[0], ctx());
assert.equal(fixed.transactions.length, 0);
assert.deepEqual(
  { day: fixed.recurring.day, startYM: fixed.recurring.startYM, cents: fixed.recurring.cents, firstPaid: fixed.recurring.firstPaid },
  { day: 4, startYM: '2026-12', cents: 5000, firstPaid: false },
);
const series = buildBulkRecords(rows[3], ctx({ category: 'Compras > parceladas' }));
assert.equal(series.transactions.length, 89);
assert.equal(series.transactions[0].desc, 'Casas Bahia (2/90)');
assert.equal(series.transactions[0].date, '2026-12-07');
assert.equal(series.transactions.at(-1).desc, 'Casas Bahia (90/90)');
assert.equal(series.transactions.at(-1).date, addMonths('2026-12-07', 88));
assert.ok(series.transactions.every((t) => t.cents === 8776 && t.paid === false && t.groupId === series.transactions[0].groupId));
const split = buildBulkRecords({ ...rows[3], amountMode: 'total', amountCents: 10000, currentInstallment: 1, totalInstallments: 3 }, ctx());
assert.deepEqual(split.transactions.map((t) => t.cents), [3334, 3333, 3333]);
const past = buildBulkRecords(parseBulkText('Luz - 80,00 - dia 10/11', context)[0], ctx());
assert.equal(past.transactions[0].paid, true);
assert.equal(past.transactions[0].settledDate, '2026-11-10');
const pending = buildBulkRecords(parseBulkText('Luz - 80,00 - dia 10/11 - pendente', context)[0], ctx());
assert.equal(pending.transactions[0].paid, false);
const card = buildBulkRecords(rows[3], ctx({ isCredit: () => true }));
assert.ok(card.transactions.every((t) => t.paid === true && !('settledDate' in t)));

console.log('bulk-entry: ok');
