// Cadastro em lote de lançamentos: transforma uma lista de texto em linhas
// estruturadas e as converte nos registros que o app já usa (lançamentos
// avulsos, séries parceladas e fixas mensais).
//
// Formato de cada linha (a ordem dos campos depois do nome é livre):
//   Nome - fixa mensal - 50,00 - dia 04/12 - categoria assinatura - subcategoria icloud
//   Nome - parcelado - 87,76 - parcela 2/90 - dia 07/12 - categoria compras - valor da parcela

export const MAX_BULK_LINES = 100;
export const MAX_BULK_INSTALLMENTS = 120;

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();

const pad = (value) => String(value).padStart(2, '0');

// Separa por traço quando há espaço em pelo menos um dos lados ("A - B", "A- B", "A -B"),
// além de "|" e ";". Traços colados nos dois lados, como em "Wi-Fi", ficam no nome.
const FIELD_SEPARATOR = /\s+[-–—]\s+|(?<=\S)[-–—]\s+|\s+[-–—](?=\S)|\s*[|;]\s*/;
const LINE_BULLET = /^\s*(?:[-–—•*]\s+|\d+[.)]\s+)/;

const MONEY = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
const MONEY_DOT = /^(?:R\$\s*)?(\d+)\.(\d{1,2})$/;

export function parseAmountCents(text) {
  const value = String(text ?? '').trim();
  const dotted = MONEY_DOT.exec(value);
  if (dotted) {
    const cents = Number(dotted[1]) * 100 + Number(dotted[2].padEnd(2, '0'));
    return Number.isSafeInteger(cents) ? cents : NaN;
  }
  const match = MONEY.exec(value);
  if (!match) return NaN;
  const cents = Number(match[1].replace(/\./g, '')) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : NaN;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Aceita "dia 04/12", "04/12", "04/12/2026", "dia 4" e "4".
// Sem ano, usa o ano de `todayKey`. Sem mês, usa o mês de `todayKey`.
export function parseBulkDate(text, todayKey) {
  const value = normalizeText(text)
    .replace(/^dia\s+/, '')
    .replace(/^em\s+/, '');
  const [todayYear, todayMonth] = todayKey.split('-').map(Number);
  let year = todayYear,
    month = todayMonth,
    day;
  let match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(value);
  if (match) {
    day = Number(match[1]);
    month = Number(match[2]);
    if (match[3]) year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  } else {
    match = /^(\d{1,2})$/.exec(value);
    if (!match) return null;
    day = Number(match[1]);
  }
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const TYPE_WORDS = new Map([
  ['fixa', 'fixed'],
  ['fixa mensal', 'fixed'],
  ['fixo', 'fixed'],
  ['mensal', 'fixed'],
  ['recorrente', 'fixed'],
  ['parcelado', 'parcel'],
  ['parcelada', 'parcel'],
  ['parcelamento', 'parcel'],
  ['avulso', 'single'],
  ['avulsa', 'single'],
  ['unica', 'single'],
  ['unico', 'single'],
  ['a vista', 'single'],
  ['unica vez', 'single'],
]);
const KIND_WORDS = new Map([
  ['despesa', 'out'],
  ['saida', 'out'],
  ['gasto', 'out'],
  ['receita', 'in'],
  ['entrada', 'in'],
]);

// Interpreta uma linha já separada em campos. Retorna { row } ou { error }.
function parseFields(fields, context) {
  const name = fields[0].trim();
  if (!name) return { error: 'Falta o nome do lançamento.' };
  const row = {
    name: name.slice(0, 80),
    kind: 'out',
    repeat: 'single',
    amountCents: NaN,
    amountMode: '',
    date: '',
    currentInstallment: 1,
    totalInstallments: 1,
    categoryText: '',
    subcategoryText: '',
    accountText: '',
    paidFlag: '',
    installmentLabeled: false,
  };
  const unknown = [];
  for (const rawField of fields.slice(1)) {
    const field = rawField.trim();
    if (!field) continue;
    const text = normalizeText(field);
    let match;
    if (TYPE_WORDS.has(text)) row.repeat = TYPE_WORDS.get(text);
    else if (KIND_WORDS.has(text)) row.kind = KIND_WORDS.get(text);
    else if ((match = /^sub-?categoria\s*:?\s*(.+)$/.exec(text)))
      row.subcategoryText = field.slice(field.length - match[1].length).trim();
    else if ((match = /^categoria\s*:?\s*(.+)$/.exec(text)))
      row.categoryText = field.slice(field.length - match[1].length).trim();
    else if ((match = /^(?:conta|cartao)\s*:?\s*(.+)$/.exec(text)))
      row.accountText = field.slice(field.length - match[1].length).trim();
    else if (/^valor (?:da|de cada|por) parcela$|^valor parcela$|^valor da prestacao$/.test(text))
      row.amountMode = 'installment';
    else if (/^valor total$|^total da compra$|^valor da compra$/.test(text)) row.amountMode = 'total';
    else if (text === 'pago' || text === 'paga' || text === 'recebido') row.paidFlag = 'paid';
    else if (text === 'pendente' || text === 'a pagar' || text === 'a receber') row.paidFlag = 'pending';
    else if (
      (match = /^parcela\s+(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})$/.exec(text)) ||
      (match = /^(\d{1,3})\s+de\s+(\d{1,3})$/.exec(text))
    ) {
      row.currentInstallment = Number(match[1]);
      row.totalInstallments = Number(match[2]);
      row.repeat = 'parcel';
      row.installmentLabeled = true;
    } else if ((match = /^(?:em\s+)?(\d{1,3})\s*x$/.exec(text))) {
      row.totalInstallments = Number(match[1]);
      row.repeat = 'parcel';
    } else if (
      text.startsWith('dia ') ||
      text.includes('/') ||
      (/^\d{1,2}$/.test(text) && Number.isFinite(row.amountCents))
    ) {
      const date = parseBulkDate(text, context.today);
      if (!date) return { error: `Data inválida: "${field}".` };
      row.date = date;
    } else if (Number.isFinite(parseAmountCents(field)) && !Number.isFinite(row.amountCents)) {
      row.amountCents = parseAmountCents(field);
    } else unknown.push(field);
  }
  if (unknown.length) return { error: `Não entendi: "${unknown[0]}".` };
  if (!Number.isFinite(row.amountCents) || row.amountCents <= 0) return { error: 'Falta o valor (ex.: 129,90).' };
  if (!row.date) return { error: 'Falta a data (ex.: dia 10/12).' };
  if (row.repeat === 'parcel') {
    const { currentInstallment: current, totalInstallments: total } = row;
    if (total < 2 || total > MAX_BULK_INSTALLMENTS)
      return { error: `O total de parcelas deve ficar entre 2 e ${MAX_BULK_INSTALLMENTS}.` };
    if (current < 1 || current > total) return { error: 'A parcela atual deve estar entre 1 e o total.' };
    // Quem informa "parcela 2/90" costuma estar digitando o valor que paga a cada mês.
    if (!row.amountMode) row.amountMode = row.installmentLabeled ? 'installment' : 'total';
    if (row.amountMode === 'total' && row.amountCents < total) {
      return { error: 'O valor total precisa ser de pelo menos R$ 0,01 por parcela.' };
    }
  }
  return { row };
}

// Quebra o texto em linhas úteis e interpreta cada uma.
export function parseBulkText(text, context) {
  const lines = String(text ?? '').split(/\r?\n/);
  const rows = [];
  let lineNumber = 0;
  for (const rawLine of lines) {
    lineNumber += 1;
    const source = rawLine.replace(LINE_BULLET, '').trim();
    if (!source) continue;
    if (rows.length >= MAX_BULK_LINES) {
      rows.push({
        line: lineNumber,
        source,
        error: `Limite de ${MAX_BULK_LINES} linhas por vez. Cadastre o restante depois.`,
      });
      break;
    }
    const result = parseFields(source.split(FIELD_SEPARATOR), context);
    rows.push(
      result.error ? { line: lineNumber, source, error: result.error } : { line: lineNumber, source, ...result.row },
    );
  }
  return rows;
}

const normalizeMatch = (value) => normalizeText(value);
const singular = (value) => normalizeMatch(value).replace(/s$/, '');

// Procura a categoria pelo nome, ignorando acento, maiúsculas e plural simples ("assinatura" = "Assinaturas").
function findTopCategory(categories, text) {
  const target = singular(text);
  return categories.find((category) => singular(category.name) === target) || null;
}
function findSubcategory(category, text, leafName) {
  const target = singular(text);
  return (category.subcategories || []).find((item) => singular(leafName(item)) === target) || null;
}

// Resolve categoria/subcategoria contra as existentes. Nada é criado aqui:
// o resultado diz o que existe e o que ainda precisa ser criado ao salvar.
export function resolveBulkCategory(row, { categories, leafName, fallback }) {
  const kindCategories = categories[row.kind] || [];
  if (!row.categoryText && !row.subcategoryText) {
    const match = fallback?.(row);
    return { path: match || '', parent: '', child: '', createParent: false, createChild: false };
  }
  let parent = row.categoryText ? findTopCategory(kindCategories, row.categoryText) : null;
  let child = null;
  if (!row.categoryText && row.subcategoryText) {
    // Só subcategoria: procura em qualquer categoria.
    for (const category of kindCategories) {
      child = findSubcategory(category, row.subcategoryText, leafName);
      if (child) {
        parent = category;
        break;
      }
    }
  } else if (parent && row.subcategoryText) child = findSubcategory(parent, row.subcategoryText, leafName);
  const parentName = parent ? parent.name : (row.categoryText || '').trim().slice(0, 30);
  const childName = child ? leafName(child) : (row.subcategoryText || '').trim().slice(0, 30);
  if (!parentName)
    return {
      path: '',
      parent: '',
      child: '',
      createParent: false,
      createChild: false,
      error: 'Informe a categoria da subcategoria.',
    };
  return {
    path: childName ? `${parentName} > ${childName}` : parentName,
    parent: parentName,
    child: childName,
    createParent: !parent,
    createChild: !!childName && !child,
  };
}

export function findBulkAccount(accounts, text, accountLabel) {
  const target = normalizeText(text);
  if (!target) return null;
  return (
    accounts.find((account) => normalizeText(accountLabel(account)) === target) ||
    accounts.find((account) => normalizeText(accountLabel(account)).includes(target)) ||
    null
  );
}

// Monta os registros finais de uma linha. `ctx` traz as dependências do app,
// para esta função continuar pura e testável.
export function buildBulkRecords(row, ctx) {
  const { newId, addMonths, account, isCredit, today, category, now } = ctx;
  const credit = isCredit(account);
  const day = Number(row.date.slice(8, 10));
  // Só o que já venceu pode nascer pago; o resto fica pendente, como no formulário normal.
  const paid = credit ? true : row.paidFlag !== 'pending' && row.date <= today;
  const base = { type: row.kind, accountId: account.id, category, desc: row.name };
  if (row.repeat === 'fixed') {
    return {
      transactions: [],
      recurring: {
        id: newId(),
        ...base,
        cents: row.amountCents,
        day,
        startYM: row.date.slice(0, 7),
        lastYM: null,
        firstPaid: paid,
      },
    };
  }
  const total = row.repeat === 'parcel' ? row.totalInstallments : 1;
  const first = row.repeat === 'parcel' ? row.currentInstallment : 1;
  const count = total - first + 1;
  const groupId = total > 1 ? newId() : undefined;
  const perInstallment = Math.floor(row.amountCents / total);
  const transactions = [];
  for (let offset = 0; offset < count; offset += 1) {
    const number = first + offset;
    const cents =
      row.repeat === 'parcel' && row.amountMode !== 'installment'
        ? perInstallment + (number === 1 ? row.amountCents - perInstallment * total : 0)
        : row.amountCents;
    const date = addMonths(row.date, offset);
    const installmentPaid = credit ? true : offset === 0 ? paid : false;
    transactions.push({
      id: newId(),
      ...base,
      cents,
      date,
      paid: installmentPaid,
      ...(!credit && installmentPaid ? { settledDate: date } : {}),
      createdAt: now + offset,
      ...(total > 1 ? { groupId, desc: `${row.name} (${number}/${total})` } : {}),
    });
  }
  return { transactions, recurring: null };
}

// Total mensal e quantidade de lançamentos que a linha vai gerar (para a revisão).
export function bulkRowCount(row) {
  if (row.repeat === 'fixed') return 1;
  if (row.repeat === 'parcel') return row.totalInstallments - row.currentInstallment + 1;
  return 1;
}

export function bulkRowInstallmentCents(row) {
  if (row.repeat !== 'parcel' || row.amountMode === 'installment') return row.amountCents;
  const perInstallment = Math.floor(row.amountCents / row.totalInstallments);
  return perInstallment + (row.currentInstallment === 1 ? row.amountCents - perInstallment * row.totalInstallments : 0);
}
