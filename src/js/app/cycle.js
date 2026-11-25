import { cycleDayNumber, cycleStats, topSymptoms } from '../features/cycle/calculations.js';
import { isWaterHabit } from '../features/habits/model.js';
import { estimateWaterGoal } from '../features/habits/water-goal.js';
import { CYCLE_SOCIAL_OPTIONS, CYCLE_TEST_RESULTS } from '../features/cycle/log.js';
import { clamp, plural } from './core.js';
import { ymLabel } from './finance-view.js';
import { areaPageTitle, cap, gate } from './shell.js';
import { estimatedCyclePhase, renderCycleView, S, ui, weekStartDay } from './state.js';

// Ciclo
export const CYC = [
  {
    id: 'flow',
    title: 'Fluxo',
    single: true,
    opts: [
      ['spot', 'Escape'],
      ['light', 'Leve'],
      ['medium', 'Médio'],
      ['heavy', 'Intenso'],
    ],
  },
  {
    id: 'pain',
    title: 'Dor',
    opts: [
      ['cramp', 'Cólica'],
      ['head', 'Dor de cabeça'],
      ['back', 'Dor nas costas'],
      ['breast', 'Seios sensíveis'],
      ['joint', 'Dor nas articulações'],
      ['ovary', 'Dor no ovário'],
    ],
  },
  {
    id: 'mood',
    title: 'Mente e sentimentos',
    opts: [
      ['happy', 'Feliz'],
      ['calm', 'Tranquila'],
      ['energized', 'Com energia'],
      ['sensitive', 'Sensível'],
      ['irritated', 'Irritada'],
      ['anxious', 'Ansiosa'],
      ['sad', 'Triste'],
      ['stressed', 'Sobrecarregada'],
      ['concentration', 'Dificuldade de concentração'],
      ['memory', 'Esquecimentos ou lapsos de memória'],
    ],
  },
  { id: 'social', title: 'Vida social', opts: CYCLE_SOCIAL_OPTIONS },
  {
    id: 'energy',
    title: 'Energia',
    single: true,
    opts: [
      ['exhausted', 'Exausta'],
      ['low', 'Baixa'],
      ['normal', 'Normal'],
      ['high', 'Alta'],
    ],
  },
  {
    id: 'digestion',
    title: 'Digestão e apetite',
    opts: [
      ['bloat', 'Inchaço'],
      ['nausea', 'Enjoo'],
      ['constip', 'Prisão de ventre'],
      ['diarrhea', 'Diarreia'],
      ['sweet', 'Vontade de doce'],
      ['salt', 'Vontade de salgado'],
      ['hungry', 'Muito apetite'],
    ],
  },
  {
    id: 'sleep',
    title: 'Sono',
    single: true,
    opts: [
      ['great', 'Dormiu bem'],
      ['restless', 'Sono agitado'],
      ['insomnia', 'Insônia'],
      ['sleepy', 'Muito sono'],
    ],
  },
  {
    id: 'skin',
    title: 'Pele e cabelo',
    opts: [
      ['acne', 'Acne'],
      ['oilyskin', 'Pele oleosa'],
      ['dryskin', 'Pele seca'],
      ['oilyhair', 'Cabelo oleoso'],
    ],
  },
  {
    id: 'discharge',
    title: 'Corrimento',
    single: true,
    opts: [
      ['none', 'Nenhum'],
      ['sticky', 'Pegajoso'],
      ['creamy', 'Cremoso'],
      ['watery', 'Aquoso'],
      ['eggwhite', 'Clara de ovo'],
    ],
  },
];
export const CYC_ICON = {
  flow: 'droplet',
  pain: 'alert',
  mood: 'heart',
  social: 'user',
  energy: 'sparkles',
  digestion: 'stomach',
  sleep: 'moon',
  skin: 'user',
  discharge: 'flower',
};
export const CYC_OPTION_ICON = {
  flow: { spot: 'spot', light: 'droplet', medium: 'water', heavy: 'blood' },
  pain: { cramp: 'activity', head: 'sun', back: 'spine', breast: 'heart', joint: 'bone', ovary: 'ovaries' },
  mood: {
    happy: 'smile',
    calm: 'meditate',
    energized: 'sparkles',
    sensitive: 'heart',
    irritated: 'alert',
    anxious: 'activity',
    sad: 'moon',
    stressed: 'target',
    concentration: 'target',
    memory: 'clock',
  },
  energy: { exhausted: 'moon', low: 'coffee', normal: 'activity', high: 'arrowUp' },
  digestion: {
    bloat: 'wind',
    nausea: 'activity',
    constip: 'inbox',
    diarrhea: 'droplet',
    sweet: 'candy',
    salt: 'utensils',
    hungry: 'apple',
  },
  sleep: { great: 'bed', restless: 'activity', insomnia: 'clock', sleepy: 'coffee' },
  skin: { acne: 'acne', oilyskin: 'sun', dryskin: 'leaf', oilyhair: 'hair' },
  discharge: { none: 'close', sticky: 'droplet', creamy: 'cloud', watery: 'water', eggwhite: 'egg' },
};
export const CYC_SHORT_LABEL = {
  pain: { head: 'Cabeça', back: 'Costas', breast: 'Seios', joint: 'Juntas', ovary: 'Ovário' },
  digestion: { constip: 'Intestino', sweet: 'Doce', salt: 'Salgado', hungry: 'Apetite' },
  sleep: { great: 'Bem', restless: 'Agitado', sleepy: 'Sonolência' },
  skin: { oilyskin: 'Oleosa', dryskin: 'Ressecada', oilyhair: 'Cabelo oleoso' },
};
export const cycLabel = (cat, v) => (CYC.find((c) => c.id === cat)?.opts.find((o) => o[0] === v) || [, v])[1];
const cycleTestResultLabel = (value) => CYCLE_TEST_RESULTS.find(([id]) => id === value)?.[1] || '';
export const dayLog = (k) => S.cycleLog[k] || {};
export const isBleeding = (l) => ['light', 'medium', 'heavy'].includes(l.flow);
export const hasAnyLog = (l) =>
  !!l &&
  (l.flow ||
    l.energy ||
    l.sleep ||
    l.discharge ||
    l.note ||
    Number.isFinite(l.weightKg) ||
    Object.hasOwn(l, 'sexualActivity') ||
    l.masturbationActivity ||
    l.sexToysUsed ||
    l.libido ||
    Object.hasOwn(l, 'orgasmOccurred') ||
    Object.hasOwn(l, 'ovulationTestResult') ||
    Object.hasOwn(l, 'pregnancyTestResult') ||
    Object.hasOwn(l, 'medicationTaken') ||
    Number.isInteger(l.orgasmCount) ||
    ['pain', 'mood', 'digestion', 'skin', 'social'].some((c) => (l[c] || []).length));
export function cycleLogDraft(log = {}) {
  return Object.fromEntries(
    Object.entries(log).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  );
}
function cycleLogSummary(log) {
  if (!hasAnyLog(log)) return 'Nenhum registro para este dia.';
  const orgasmOccurred = Object.hasOwn(log, 'orgasmOccurred')
    ? log.orgasmOccurred
    : Number.isInteger(log.orgasmCount)
      ? log.orgasmCount > 0
      : null;
  const symptomCount = CYC.filter(({ id }) => !['flow', 'mood', 'social'].includes(id)).reduce(
    (count, { id, single }) => {
      const value = log[id];
      return count + (single ? Number(Boolean(value)) : Array.isArray(value) ? value.length : 0);
    },
    0,
  );
  return [
    log.flow ? `Fluxo: ${cycLabel('flow', log.flow)}` : '',
    Number.isFinite(log.weightKg)
      ? `Peso: ${log.weightKg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
      : '',
    log.mood?.length ? `Mente e sentimentos: ${log.mood.map((value) => cycLabel('mood', value)).join(', ')}` : '',
    log.social?.length ? `Vida social: ${log.social.map((value) => cycLabel('social', value)).join(', ')}` : '',
    log.ovulationTestResult ? `Teste de ovulação: ${cycleTestResultLabel(log.ovulationTestResult)}` : '',
    log.pregnancyTestResult ? `Teste de gravidez: ${cycleTestResultLabel(log.pregnancyTestResult)}` : '',
    log.medicationTaken === true ? 'Tomou medicação' : log.medicationTaken === false ? 'Não tomou medicação' : '',
    log.sexualActivity === true
      ? 'Relação com outra pessoa'
      : log.sexualActivity === false
        ? 'Sem relação com outra pessoa'
        : '',
    log.masturbationActivity ? 'Masturbação registrada' : '',
    log.sexToysUsed ? 'Brinquedos registrados' : '',
    log.contraceptionMethods?.includes('none')
      ? 'Sem método contraceptivo'
      : log.contraceptionMethods?.some((method) => !['undisclosed'].includes(method))
        ? 'Método contraceptivo registrado'
        : log.contraceptionMethods?.includes('undisclosed')
          ? 'Método contraceptivo não informado'
          : '',
    log.libido === 'high' ? 'Libido alta' : log.libido === 'low' ? 'Libido baixa' : '',
    orgasmOccurred === true ? 'Orgasmo' : orgasmOccurred === false ? 'Sem orgasmo' : '',
    symptomCount ? `${symptomCount} ${plural(symptomCount, 'sintoma', 'sintomas')}` : '',
    log.note ? 'com anotação' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export function syncLatestCycleWeight() {
  const latest = Object.entries(S.cycleLog)
    .filter(([, log]) => Number.isFinite(log?.weightKg))
    .sort(([dayA], [dayB]) => dayB.localeCompare(dayA))[0];
  if (!latest) return false;
  const [, log] = latest;
  const estimate = estimateWaterGoal({ weightKg: log.weightKg, age: S.settings.profile.age });
  if (!estimate) return false;
  S.settings.profile.weightKg = log.weightKg;
  S.habits.forEach((habit) => {
    if (isWaterHabit(habit)) habit.waterGoalMl = estimate.ml;
  });
  return true;
}
export const cyclePeriodKey = (period) => `${period.start}|${period.end || ''}`;
export const cyclePeriodEnd = (period) => period.end || period.start;
function cycleCalendarPhase(day, stats) {
  return estimatedCyclePhase(day, stats.starts, stats.avg, stats.set, stats.canEstimateFertility);
}
export function viewCiclo() {
  return renderCycleView({
    S,
    ui,
    gate,
    areaPageTitle,
    cycleStats,
    dayLog,
    cycleDayNumber,
    hasAnyLog,
    cyclePeriodEnd,
    cycleCalendarPhase,
    topSymptoms,
    cycLabel,
    weekStartDay,
    clamp,
    plural,
    cycleLogSummary,
    CYC_ICON,
    cap,
    ymLabel,
  });
}
