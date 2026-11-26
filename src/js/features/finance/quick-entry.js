import { addDays, pad } from '../../utils/dates.js';

const TAG_TOKEN_RE = /(?:^|\s)#([a-zA-ZÀ-ÿ0-9_-]{1,24})(?=\s|$|[.,;!?])/g;
const STRIP_TAG_RE = /(?:^|\s)#[a-zA-ZÀ-ÿ0-9_-]{1,24}(?=\s|$|[.,;!?])/g;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeFinanceTag(tag) {
  const clean = String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/[^a-zA-ZÀ-ÿ0-9_-]+/g, '')
    .toLocaleLowerCase('pt-BR')
    .slice(0, 24);
  return clean;
}

export function extractFinanceTags(text) {
  const raw = String(text || '');
  const seen = new Set();
  const tags = [];
  for (const match of raw.matchAll(TAG_TOKEN_RE)) {
    const normalized = normalizeFinanceTag(match[1]);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      tags.push(normalized);
    }
  }
  return tags;
}

export function stripFinanceTags(text) {
  return String(text || '')
    .replace(STRIP_TAG_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTagsInput(input) {
  const seen = new Set();
  const tags = [];
  String(input || '')
    .split(/[\s,;]+/)
    .forEach((part) => {
      const normalized = normalizeFinanceTag(part);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        tags.push(normalized);
      }
    });
  return tags.slice(0, 6);
}

export function composeDescWithTags(desc, tagsInput) {
  const inlineTags = extractFinanceTags(desc);
  const extraTags = Array.isArray(tagsInput)
    ? tagsInput.map(normalizeFinanceTag).filter(Boolean)
    : parseTagsInput(tagsInput);
  const allTags = [...new Set([...inlineTags, ...extraTags])].slice(0, 6);
  const cleanDesc = stripFinanceTags(desc).slice(0, 80);
  if (!allTags.length) return cleanDesc;
  const suffix = allTags.map((tag) => `#${tag}`).join(' ');
  return cleanDesc ? `${cleanDesc} ${suffix}`.slice(0, 140) : suffix.slice(0, 140);
}

function parseAmountToken(token) {
  const cleaned = token.replace(/^r\$\s*/i, '').replace(/^[+-]/, '');
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/.test(cleaned)) return null;
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 999999999) return null;
  return Math.round(value * 100);
}

function resolveDateFromParts(day, month, todayIso) {
  const [ty, tm] = todayIso.split('-').map(Number);
  const m = month || tm;
  if (m < 1 || m > 12) return null;
  const lastDay = new Date(ty, m, 0).getDate();
  if (day < 1 || day > lastDay) return null;
  return `${ty}-${pad(m)}-${pad(day)}`;
}

export function parseQuickFinanceEntry(
  input,
  {
    todayIso,
    accounts = [],
    accountDisplayName = (account) => account?.name || '',
    isCredit = (account) => account?.type === 'credit',
    guessCategory = () => 'Outros',
    defaultOutAccountId = '',
    defaultInAccountId = '',
  } = {},
) {
  const raw = String(input || '').trim();
  if (!raw) return { valid: false, empty: true };

  const tags = extractFinanceTags(raw);
  let text = stripFinanceTags(raw);
  let kind = 'out';
  let paid = null;
  let date = todayIso;
  let installments = 1;

  // Detect leading + or income keywords
  if (/^\+/.test(text)) {
    kind = 'in';
    text = text.slice(1).trim();
  } else if (/^(?:receita|recebi|entrada|ganhei)\b/i.test(text)) {
    kind = 'in';
    text = text.replace(/^(?:receita|recebi|entrada|ganhei)\b\s*/i, '').trim();
  } else if (/^(?:despesa|gastei|paguei|comprei)\b/i.test(text)) {
    kind = 'out';
    text = text.replace(/^(?:despesa|gastei|paguei|comprei)\b\s*/i, '').trim();
  }

  // Detect installments e.g. "3x"
  const parcelMatch = text.match(/(?:^|\s)(\d{1,2})x(?=\s|$)/i);
  if (parcelMatch) {
    const n = Number(parcelMatch[1]);
    if (n >= 2 && n <= 60) {
      installments = n;
      text = text.replace(parcelMatch[0], ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Detect paid / pending keywords
  if (/(?:^|\s)(?:pendente|a pagar|a receber)(?=\s|$)/i.test(text)) {
    paid = false;
    text = text
      .replace(/(?:^|\s)(?:pendente|a pagar|a receber)(?=\s|$)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Detect natural dates: hoje, ontem, amanha, DD/MM
  if (/(?:^|\s)ontem(?=\s|$)/i.test(text)) {
    date = addDays(todayIso, -1);
    text = text
      .replace(/(?:^|\s)ontem(?=\s|$)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else if (/(?:^|\s)amanh[aã](?=\s|$)/i.test(text)) {
    date = addDays(todayIso, 1);
    text = text
      .replace(/(?:^|\s)amanh[aã](?=\s|$)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else if (/(?:^|\s)hoje(?=\s|$)/i.test(text)) {
    date = todayIso;
    text = text
      .replace(/(?:^|\s)hoje(?=\s|$)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    const dateMatch = text.match(/(?:^|\s)(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?=\s|$)/i);
    if (dateMatch) {
      const resolved = resolveDateFromParts(Number(dateMatch[1]), Number(dateMatch[2]), todayIso);
      if (resolved) {
        date = resolved;
        text = text.replace(dateMatch[0], ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  // Detect credit card / account hint
  let matchedAccount = null;
  const normalizedWords = text.split(/\s+/).filter(Boolean);
  if (kind === 'out') {
    const creditAccounts = accounts.filter(isCredit);
    if (creditAccounts.length && /(?:^|\s)cart[aã]o(?=\s|$)/i.test(text)) {
      matchedAccount = creditAccounts[0];
      text = text
        .replace(/(?:^|\s)cart[aã]o(?=\s|$)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  if (!matchedAccount && accounts.length) {
    const eligible = kind === 'in' ? accounts.filter((account) => !isCredit(account)) : accounts;
    for (const account of eligible) {
      const nameNorm = normalizeText(accountDisplayName(account));
      if (!nameNorm || nameNorm.length < 3) continue;
      const idx = normalizedWords.findIndex((word) => normalizeText(word) === nameNorm);
      if (idx >= 0) {
        matchedAccount = account;
        const token = normalizedWords[idx].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text
          .replace(new RegExp(`(?:^|\\s)${token}(?=\\s|$)`, 'i'), ' ')
          .replace(/\s+/g, ' ')
          .trim();
        break;
      }
    }
  }

  // Extract amount token (prefer last numeric token in text)
  const tokens = text.split(/\s+/).filter(Boolean);
  let amountIndex = -1;
  let cents = 0;
  for (let index = tokens.length - 1; index >= 0; index--) {
    const parsed = parseAmountToken(tokens[index]);
    if (parsed !== null) {
      amountIndex = index;
      cents = parsed;
      break;
    }
  }
  if (amountIndex < 0) {
    return {
      valid: false,
      empty: false,
      error: 'Informe um valor. Ex.: mercado 85,50 ou +salario 3200',
    };
  }
  const descTokens = tokens.filter((_, index) => {
    if (index === amountIndex) return false;
    if (index === amountIndex - 1 && /^r\$$/i.test(tokens[index])) return false;
    return true;
  });
  const cleanDesc = descTokens.join(' ').trim();

  // Infer income automatically for salary-like words if user didn't force despesa
  if (
    kind === 'out' &&
    !/^(?:despesa|gastei|paguei|comprei)\b/i.test(raw) &&
    /\b(?:salario|salário|freela|freelance|rendimento|dividendo|reembolso)\b/i.test(cleanDesc)
  ) {
    kind = 'in';
    if (matchedAccount && isCredit(matchedAccount)) matchedAccount = null;
  }

  const eligibleAccounts = kind === 'in' ? accounts.filter((account) => !isCredit(account)) : accounts;
  const fallbackId = kind === 'in' ? defaultInAccountId : defaultOutAccountId;
  const account =
    matchedAccount ||
    eligibleAccounts.find((item) => item.id === fallbackId) ||
    eligibleAccounts.find((item) => !isCredit(item)) ||
    eligibleAccounts[0] ||
    null;

  if (!account) {
    return { valid: false, empty: false, error: 'Cadastre uma conta antes de lançar.' };
  }
  if (kind === 'in' && installments > 1) installments = 1;

  const effectivePaid = isCredit(account) ? true : paid !== null ? paid : date <= todayIso;
  const category = guessCategory(cleanDesc || (kind === 'in' ? 'Receita' : 'Despesa'), kind);
  const desc = composeDescWithTags(cleanDesc || category, tags);

  return {
    valid: true,
    empty: false,
    kind,
    cents,
    date,
    cleanDesc: cleanDesc || category,
    desc,
    tags,
    category,
    accountId: account.id,
    accountName: accountDisplayName(account),
    isCreditAccount: isCredit(account),
    paid: effectivePaid,
    installments,
  };
}
