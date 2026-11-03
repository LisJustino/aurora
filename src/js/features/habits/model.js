import { addDays, isDay, pk } from '../../utils/dates.js';
import { weekDays } from '../planning/week.js';
import { isPlainObject } from '../../core/data-integrity.js';
import { isValidWaterGoalMl, normalizeWaterHabit } from './water-goal.js';

export const HABIT_ICONS = Object.freeze([
  ['droplet', 'Água'], ['book', 'Leitura'], ['dumbbell', 'Treino'], ['activity', 'Movimento'],
  ['bike', 'Pedalar'], ['leaf', 'Natureza'], ['apple', 'Alimentação'], ['meditate', 'Meditar'],
  ['moon', 'Dormir'], ['sun', 'Acordar'], ['bed', 'Descanso'], ['pencil', 'Escrever'],
  ['note', 'Diário'], ['pill', 'Remédio'], ['coffee', 'Pausa'], ['music', 'Música'],
  ['palette', 'Criar'], ['smile', 'Gratidão'], ['phoneOff', 'Menos tela'], ['heart', 'Autocuidado'],
  ['target', 'Foco'], ['home', 'Casa'], ['sparkles', 'Outro'],
  ['acne', 'Pele'], ['flower', 'Skincare'], ['hair', 'Cabelo'], ['shield', 'Proteção'],
  ['wind', 'Respiração'], ['egg', 'Nutrição'], ['utensils', 'Cozinhar'], ['blood', 'Ciclo'],
  ['spine', 'Postura'], ['stomach', 'Digestão'], ['calendarCheck', 'Rotina'], ['clock', 'Horário'],
  ['folder', 'Organização'], ['pie', 'Equilíbrio'], ['check', 'Concluir'], ['water', 'Hidratação'],
  ['candy', 'Lazer'], ['scale', 'Acompanhamento'], ['flag', 'Meta'], ['grid', 'Organizar'],
]);
export const HABIT_ICON_KEYS = Object.freeze(HABIT_ICONS.map(([key]) => key));
export const HABIT_COLORS = Object.freeze([
  '#c97994', '#e07a5f', '#d9a05b', '#a3b55a', '#5fa68a', '#5aa5b8',
  '#7c8fd4', '#8a7ac4', '#a24f9e', '#d6455d', '#8b8b95', '#ad8c76',
]);
export const DEFAULT_HABIT_ICON = 'sparkles';
export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const normalizeHabitText = (value) => String(value ?? '')
  .trim()
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');
export const isWaterHabit = (habit) => (
  habit?.tracking === 'water' || /^beber agua(?:\s|$)/.test(normalizeHabitText(habit?.name))
);
export const habitIconKey = (habit) => (
  HABIT_ICON_KEYS.includes(habit?.icon) ? habit.icon : DEFAULT_HABIT_ICON
);
export const habitColor = (habit) => (
  HEX_COLOR.test(habit?.color || '') ? habit.color : DEFAULT_HABIT_COLOR
);

export const SUGGESTED_HABIT_CATEGORIES = Object.freeze([
  { id: 'personal-care', title: 'Cuidados pessoais' },
  { id: 'movement', title: 'Corpo e movimento' },
  { id: 'mind', title: 'Cuidados com a mente' },
  { id: 'food', title: 'Alimentação' },
  { id: 'routine', title: 'Rotina e casa' },
]);

export const SUGGESTED_HABIT_TAGS = Object.freeze([
  { id: 'quick', title: 'Poucos minutos' },
  { id: 'home', title: 'Em casa' },
  { id: 'no-equipment', title: 'Sem equipamento' },
]);

const SUGGESTED_HABIT_TAGGED_IDS = Object.freeze({
  quick: Object.freeze([
    'stretch', 'reading', 'meditate', 'journal', 'gratitude', 'pause', 'fruit',
    'active-break', 'mobility', 'check-in-with-yourself', 'prepare-snack',
    'make-bed', 'five-minute-tidy', 'make-grocery-list', 'clear-desk',
    'set-out-clothes', 'keys-in-place',
  ]),
  home: Object.freeze([
    'water', 'skincare', 'hair-care', 'personal-hygiene', 'sleep', 'medication',
    'reading', 'meditate', 'journal', 'gratitude', 'screens', 'pause', 'fruit',
    'cook', 'meal-plan', 'tidy', 'morning-plan', 'evening-routine', 'dental-care',
    'creative-time', 'mindful-meal', 'prepare-snack', 'make-bed', 'review-calendar',
    'organize-bag', 'care-for-plant', 'five-minute-tidy', 'prepare-for-bed',
    'check-in-with-yourself', 'plan-rest', 'study', 'weekly-reflection',
    'screen-free-break', 'try-new-recipe', 'prepare-breakfast', 'add-vegetable',
    'make-grocery-list', 'clear-desk', 'wash-dishes', 'set-out-clothes',
    'keys-in-place', 'organize-digital-files', 'weekly-reset',
  ]),
  'no-equipment': Object.freeze([
    'training', 'stretch', 'walk', 'dance', 'active-break', 'mobility',
    'take-stairs', 'play-outside',
  ]),
});

export function habitSuggestionTags(suggestion) {
  return SUGGESTED_HABIT_TAGS.filter(({ id }) => (
    SUGGESTED_HABIT_TAGGED_IDS[id].includes(suggestion?.id)
  ));
}

export function featuredHabitSuggestions(suggestions, limit = 4) {
  const available = Array.isArray(suggestions) ? suggestions : [];
  const count = Number.isInteger(limit) ? Math.max(0, limit) : 4;
  const selected = [];
  const add = (suggestion) => {
    if (suggestion && selected.length < count && !selected.some(({ id }) => id === suggestion.id)) selected.push(suggestion);
  };
  for (const id of ['water', 'stretch', 'reading', 'fruit']) {
    add(available.find((suggestion) => suggestion.id === id));
  }
  for (const category of SUGGESTED_HABIT_CATEGORIES) {
    if (selected.length >= count) break;
    if (selected.some((suggestion) => suggestion.category === category.id)) continue;
    add(available.find((suggestion) => suggestion.category === category.id));
  }
  for (const suggestion of available) add(suggestion);
  return selected;
}

export const SUGGESTED_HABITS = [
  { id: 'water', category: 'personal-care', name: 'Beber água', description: 'Registre os mL consumidos e acompanhe a meta diária.', icon: 'droplet', color: HABIT_COLORS[5] },
  { id: 'skincare', category: 'personal-care', name: 'Fazer skincare', description: 'Reserve um momento para cuidar da pele.', icon: 'flower', color: HABIT_COLORS[0] },
  { id: 'hair-care', category: 'personal-care', name: 'Cuidar do cabelo', description: 'Inclua os cuidados com o cabelo na rotina.', icon: 'hair', color: HABIT_COLORS[11] },
  { id: 'personal-hygiene', category: 'personal-care', name: 'Cuidar da higiene pessoal', description: 'Acompanhe um cuidado diário importante para você.', icon: 'sparkles', color: HABIT_COLORS[6] },
  { id: 'sleep', category: 'personal-care', name: 'Dormir no horário', description: 'Vá para a cama sem estender a noite.', icon: 'moon', color: HABIT_COLORS[7] },
  { id: 'medication', category: 'personal-care', name: 'Tomar remédio ou vitamina', description: 'Lembre-se do cuidado orientado para você.', icon: 'pill', color: HABIT_COLORS[5] },
  { id: 'gym', category: 'movement', name: 'Ir à academia', description: 'Reserve um horário para o treino.', icon: 'dumbbell', color: HABIT_COLORS[1] },
  { id: 'training', category: 'movement', name: 'Fazer um treino', description: 'Movimente o corpo do seu jeito.', icon: 'activity', color: HABIT_COLORS[4] },
  { id: 'stretch', category: 'movement', name: 'Alongar', description: 'Faça alguns minutos de alongamento.', icon: 'spine', color: HABIT_COLORS[3] },
  { id: 'walk', category: 'movement', name: 'Caminhar ao ar livre', description: 'Um pouco de movimento e ar fresco.', icon: 'leaf', color: HABIT_COLORS[3] },
  { id: 'cycle', category: 'movement', name: 'Pedalar', description: 'Inclua um passeio de bicicleta na semana.', icon: 'bike', color: HABIT_COLORS[5] },
  { id: 'reading', category: 'mind', name: 'Ler por 10 minutos', description: 'Reserve alguns minutos para a leitura.', icon: 'book', color: HABIT_COLORS[6] },
  { id: 'meditate', category: 'mind', name: 'Respirar e meditar', description: 'Faça uma pausa para respirar com calma.', icon: 'meditate', color: HABIT_COLORS[8] },
  { id: 'journal', category: 'mind', name: 'Escrever no diário', description: 'Anote como foi o seu dia.', icon: 'note', color: HABIT_COLORS[0] },
  { id: 'gratitude', category: 'mind', name: 'Praticar gratidão', description: 'Pense em algo bom que aconteceu.', icon: 'smile', color: HABIT_COLORS[2] },
  { id: 'screens', category: 'mind', name: 'Ficar sem telas antes de dormir', description: 'Desconecte-se um pouco antes de descansar.', icon: 'phoneOff', color: HABIT_COLORS[10] },
  { id: 'pause', category: 'mind', name: 'Fazer uma pausa', description: 'Faça uma pausa consciente durante o dia.', icon: 'coffee', color: HABIT_COLORS[2] },
  { id: 'fruit', category: 'food', name: 'Comer uma fruta', description: 'Inclua uma fruta na rotina.', icon: 'apple', color: HABIT_COLORS[9] },
  { id: 'cook', category: 'food', name: 'Preparar uma refeição', description: 'Separe um momento para cozinhar.', icon: 'utensils', color: HABIT_COLORS[11] },
  { id: 'meal-plan', category: 'food', name: 'Planejar as refeições', description: 'Organize com antecedência o que pretende comer.', icon: 'calendarCheck', color: HABIT_COLORS[3] },
  { id: 'tidy', category: 'routine', name: 'Arrumar um cantinho', description: 'Organize um pedacinho da casa.', icon: 'home', color: HABIT_COLORS[11] },
  { id: 'morning-plan', category: 'routine', name: 'Planejar o dia', description: 'Escolha uma prioridade para o seu dia.', icon: 'target', color: HABIT_COLORS[7] },
  { id: 'evening-routine', category: 'routine', name: 'Preparar o dia seguinte', description: 'Deixe algo organizado para amanhã.', icon: 'calendarCheck', color: HABIT_COLORS[6] },
  { id: 'dental-care', category: 'personal-care', name: 'Cuidar da saúde bucal', description: 'Inclua um momento de cuidado com a saúde bucal.', icon: 'sparkles', color: HABIT_COLORS[5] },
  { id: 'sunscreen', category: 'personal-care', name: 'Passar protetor solar', description: 'Lembre-se desse cuidado nos dias em que fizer sentido para você.', icon: 'sun', color: HABIT_COLORS[2] },
  { id: 'dance', category: 'movement', name: 'Dançar', description: 'Coloque uma música e se movimente do seu jeito.', icon: 'music', color: HABIT_COLORS[0] },
  { id: 'active-break', category: 'movement', name: 'Fazer uma pausa ativa', description: 'Levante, caminhe ou alongue por alguns minutos.', icon: 'activity', color: HABIT_COLORS[4] },
  { id: 'mobility', category: 'movement', name: 'Praticar mobilidade', description: 'Reserve alguns minutos para movimentar o corpo.', icon: 'spine', color: HABIT_COLORS[3] },
  { id: 'study', category: 'mind', name: 'Estudar por 15 minutos', description: 'Avance um pouco em um assunto que queira aprender.', icon: 'book', color: HABIT_COLORS[6] },
  { id: 'creative-time', category: 'mind', name: 'Dedicar tempo a um hobby', description: 'Faça algo criativo ou que você goste.', icon: 'palette', color: HABIT_COLORS[8] },
  { id: 'connect', category: 'mind', name: 'Falar com alguém querido', description: 'Envie uma mensagem ou reserve um tempo para conversar.', icon: 'heart', color: HABIT_COLORS[9] },
  { id: 'mindful-meal', category: 'food', name: 'Fazer uma refeição sem distrações', description: 'Desfrute de uma refeição com menos telas por perto.', icon: 'utensils', color: HABIT_COLORS[3] },
  { id: 'prepare-snack', category: 'food', name: 'Preparar um lanche', description: 'Deixe um lanche separado para mais tarde.', icon: 'apple', color: HABIT_COLORS[9] },
  { id: 'make-bed', category: 'routine', name: 'Arrumar a cama', description: 'Comece o dia com uma pequena tarefa concluída.', icon: 'bed', color: HABIT_COLORS[11] },
  { id: 'review-calendar', category: 'routine', name: 'Conferir a agenda', description: 'Veja seus compromissos e escolha o que precisa de atenção.', icon: 'calendarCheck', color: HABIT_COLORS[7] },
  { id: 'organize-bag', category: 'routine', name: 'Organizar a bolsa ou mochila', description: 'Separe o que vai precisar levar com você.', icon: 'folder', color: HABIT_COLORS[1] },
  { id: 'care-for-plant', category: 'routine', name: 'Cuidar de uma planta', description: 'Reserve um momento para cuidar das suas plantas.', icon: 'leaf', color: HABIT_COLORS[4] },
  { id: 'five-minute-tidy', category: 'routine', name: 'Organizar por cinco minutos', description: 'Escolha um espaço pequeno e deixe-o mais organizado.', icon: 'home', color: HABIT_COLORS[11] },
  { id: 'prepare-for-bed', category: 'personal-care', name: 'Preparar-se para dormir com calma', description: 'Crie um pequeno ritual para encerrar o dia.', icon: 'moon', color: HABIT_COLORS[7] },
  { id: 'check-in-with-yourself', category: 'personal-care', name: 'Perceber como você está', description: 'Reserve um momento para notar como está se sentindo.', icon: 'heart', color: HABIT_COLORS[9] },
  { id: 'plan-rest', category: 'personal-care', name: 'Separar um tempo para descansar', description: 'Inclua um intervalo de descanso na sua rotina.', icon: 'bed', color: HABIT_COLORS[11] },
  { id: 'take-stairs', category: 'movement', name: 'Subir escadas quando fizer sentido', description: 'Escolha as escadas em um trajeto possível para você.', icon: 'activity', color: HABIT_COLORS[4] },
  { id: 'walk-with-dog', category: 'movement', name: 'Passear com o cachorro', description: 'Inclua um passeio na rotina com seu pet.', icon: 'leaf', color: HABIT_COLORS[3] },
  { id: 'play-outside', category: 'movement', name: 'Brincar ou se movimentar ao ar livre', description: 'Aproveite um momento fora de casa para se movimentar.', icon: 'sun', color: HABIT_COLORS[2] },
  { id: 'learn-language', category: 'mind', name: 'Estudar um idioma', description: 'Pratique algumas palavras ou frases novas.', icon: 'book', color: HABIT_COLORS[6] },
  { id: 'practice-instrument', category: 'mind', name: 'Praticar um instrumento', description: 'Dedique alguns minutos à música.', icon: 'music', color: HABIT_COLORS[0] },
  { id: 'weekly-reflection', category: 'mind', name: 'Fazer uma revisão da semana', description: 'Lembre do que foi importante e do que quer levar adiante.', icon: 'note', color: HABIT_COLORS[8] },
  { id: 'screen-free-break', category: 'mind', name: 'Fazer uma pausa longe das telas', description: 'Descanse os olhos e faça uma pausa sem dispositivos.', icon: 'phoneOff', color: HABIT_COLORS[10] },
  { id: 'try-new-recipe', category: 'food', name: 'Experimentar uma receita nova', description: 'Escolha algo diferente para preparar quando quiser.', icon: 'utensils', color: HABIT_COLORS[1] },
  { id: 'prepare-breakfast', category: 'food', name: 'Preparar o café da manhã', description: 'Separe um momento para organizar sua primeira refeição.', icon: 'coffee', color: HABIT_COLORS[2] },
  { id: 'add-vegetable', category: 'food', name: 'Incluir um vegetal em uma refeição', description: 'Escolha um vegetal para acompanhar uma refeição.', icon: 'apple', color: HABIT_COLORS[4] },
  { id: 'make-grocery-list', category: 'food', name: 'Anotar itens para as compras', description: 'Registre o que está faltando antes de ir às compras.', icon: 'calendarCheck', color: HABIT_COLORS[5] },
  { id: 'clear-desk', category: 'routine', name: 'Deixar a mesa organizada', description: 'Organize o espaço antes ou depois de usar.', icon: 'home', color: HABIT_COLORS[7] },
  { id: 'wash-dishes', category: 'routine', name: 'Lavar a louça após uma refeição', description: 'Cuide da louça de uma refeição por vez.', icon: 'utensils', color: HABIT_COLORS[3] },
  { id: 'set-out-clothes', category: 'routine', name: 'Separar a roupa do dia seguinte', description: 'Deixe uma opção pronta para facilitar a manhã.', icon: 'calendarCheck', color: HABIT_COLORS[6] },
  { id: 'keys-in-place', category: 'routine', name: 'Guardar chaves no mesmo lugar', description: 'Escolha um local fixo para encontrar suas chaves.', icon: 'target', color: HABIT_COLORS[1] },
  { id: 'organize-digital-files', category: 'routine', name: 'Organizar arquivos digitais', description: 'Separe alguns arquivos ou fotos para colocar em ordem.', icon: 'folder', color: HABIT_COLORS[8] },
  { id: 'weekly-reset', category: 'routine', name: 'Preparar a casa para a semana', description: 'Escolha uma pequena tarefa para começar a semana com mais leveza.', icon: 'calendarCheck', color: HABIT_COLORS[11] },
];

export function remainingHabitSuggestions(habits, suggestions = SUGGESTED_HABITS) {
  const existingHabits = Array.isArray(habits) ? habits : [];
  const availableSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const existingNames = new Set(existingHabits.map((habit) => normalizeHabitText(habit?.name)));
  const hasWaterHabit = existingHabits.some(isWaterHabit);
  return availableSuggestions.filter((suggestion) => (
    !existingNames.has(normalizeHabitText(suggestion.name))
    && !(suggestion.id === 'water' && hasWaterHabit)
  ));
}

export function filterSuggestedHabits(suggestions, query = '', category = 'all', tag = 'all') {
  const normalizedQuery = normalizeHabitText(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const categoryTitles = new Map(SUGGESTED_HABIT_CATEGORIES.map(({ id, title }) => [id, title]));
  const exactTagQuery = SUGGESTED_HABIT_TAGS.find(({ title }) => normalizeHabitText(title) === normalizedQuery);
  return (Array.isArray(suggestions) ? suggestions : []).filter((suggestion) => {
    if (category !== 'all' && suggestion.category !== category) return false;
    const tags = habitSuggestionTags(suggestion);
    if (tag !== 'all' && !tags.some((item) => item.id === tag)) return false;
    if (exactTagQuery && !tags.some(({ id }) => id === exactTagQuery.id)) return false;
    const searchable = normalizeHabitText([
      suggestion.name,
      suggestion.description,
      categoryTitles.get(suggestion.category),
      ...tags.map(({ title }) => title),
    ].join(' '));
    return terms.every((term) => searchable.includes(term));
  });
}

export function isValidHabit(habit) {
  return isPlainObject(habit)
    && typeof habit.id === 'string'
    && habit.id.trim().length > 0
    && typeof habit.name === 'string'
    && habit.name.trim().length > 0
    && habit.name.length <= 60
    && Array.isArray(habit.days)
    && habit.days.length > 0
    && habit.days.length <= 7
    && habit.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && new Set(habit.days).size === habit.days.length
    && Array.isArray(habit.completions)
    && habit.completions.length <= 10000
    && habit.completions.every(isDay)
    && new Set(habit.completions).size === habit.completions.length
    && (habit.status === undefined || ['active', 'paused', 'archived'].includes(habit.status))
    && optionalDates(habit, 'skipped')
    && (habit.pausedFrom === undefined || isDay(habit.pausedFrom))
    && optionalWeekdays(habit, 'pausedDays')
    && (habit.tracking === undefined || habit.tracking === 'water')
    && (habit.icon === undefined || (typeof habit.icon === 'string' && /^[A-Za-z]{2,20}$/.test(habit.icon)))
    && (habit.color === undefined || (typeof habit.color === 'string' && HEX_COLOR.test(habit.color)))
    && (habit.weeklyGoal === undefined || (Number.isInteger(habit.weeklyGoal) && habit.weeklyGoal >= 1 && habit.weeklyGoal <= 7))
    && (habit.waterGoalMl === undefined || isValidWaterGoalMl(habit.waterGoalMl))
    && (habit.remind === undefined || (typeof habit.remind === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(habit.remind)));
}

function optionalDates(habit, key) {
  return habit[key] === undefined
    || (Array.isArray(habit[key])
      && habit[key].length <= 10000
      && habit[key].every(isDay)
      && new Set(habit[key]).size === habit[key].length);
}

function optionalWeekdays(habit, key) {
  return habit[key] === undefined
    || (Array.isArray(habit[key])
      && habit[key].length > 0
      && habit[key].length <= 7
      && habit[key].every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      && new Set(habit[key]).size === habit[key].length);
}

export function habitIsSkipped(habit, day, today = day) {
  if (!isDay(day) || !isDay(today)) return false;
  return (Array.isArray(habit.skipped) && habit.skipped.includes(day))
    || (habit.status === 'paused'
      && isDay(habit.pausedFrom)
      && day >= habit.pausedFrom
      && day <= today
      && (!Array.isArray(habit.pausedDays) || habit.pausedDays.includes(pk(day).getDay())));
}

export function createSuggestedHabits(selectedIds, existingHabits, createId) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const existingNames = new Set(existingHabits.map((habit) => normalizeHabitText(habit.name)));
  const existingWaterHabit = existingHabits.some(isWaterHabit);
  return SUGGESTED_HABITS
    .filter((suggestion) => selected.has(suggestion.id))
    .filter((suggestion) => (
      !existingNames.has(normalizeHabitText(suggestion.name))
      && (suggestion.id !== 'water' || !existingWaterHabit)
    ))
    .map((suggestion) => ({
      id: createId(),
      name: suggestion.name,
      days: [0, 1, 2, 3, 4, 5, 6],
      completions: [],
      status: 'active',
      ...(suggestion.id === 'water' ? { tracking: 'water' } : {}),
      icon: suggestion.icon,
      color: suggestion.color,
    }));
}

export function habitIsComplete(habit, day) {
  return habit.completions.includes(day);
}

export function normalizeHabits(value) {
  if (!Array.isArray(value)) return { records: [], rejectedCount: 1 };
  const records = [];
  const ids = new Set();
  let rejectedCount = 0;
  for (const habit of value) {
    if (!isValidHabit(habit) || ids.has(habit.id)) {
      rejectedCount++;
      continue;
    }
    ids.add(habit.id);
    const normalized = isWaterHabit(habit) ? normalizeWaterHabit(habit) : habit;
    records.push({ ...normalized, status: habit.status || 'active' });
  }
  return { records, rejectedCount };
}

export function habitWeekOverview(habits, day, weekStart, completedFor, skippedFor) {
  const days = weekDays(day, weekStart).filter((entry) => entry <= day);
  let planned = 0;
  let completed = 0;
  for (const habit of habits) {
    if ((habit.status || 'active') !== 'active') continue;
    for (const entry of days) {
      if (!habit.days.includes(pk(entry).getDay()) || skippedFor(habit, entry)) continue;
      planned += 1;
      if (completedFor(habit, entry)) completed += 1;
    }
  }
  return {
    completed,
    planned,
    paused: habits.filter((habit) => habit.status === 'paused'),
  };
}

export function habitWeekReview(habits, day, weekStart, completedFor, skippedFor) {
  const days = weekDays(day, weekStart).filter((entry) => entry <= day);
  return habits
    .filter((habit) => (habit.status || 'active') === 'active')
    .map((habit) => {
      const scheduled = days.filter((entry) => (
        habit.days.includes(pk(entry).getDay()) && !skippedFor(habit, entry)
      ));
      const weeklyTarget = habitWeeklyTarget(habit);
      const completed = scheduled.filter((entry) => completedFor(habit, entry)).length;
      return {
        habit,
        completed,
        planned: scheduled.length,
        weeklyTarget,
        goalMet: weeklyTarget !== null && completed >= weeklyTarget,
      };
    });
}

export function habitMonthDays(month, weekStart = 1) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const offset = (first.getDay() - (weekStart === 0 ? 0 : 1) + 7) % 7;
  const length = new Date(year, monthNumber, 0).getDate();
  return [
    ...Array(offset).fill(null),
    ...Array.from({ length }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ];
}

export function habitMonthStats(
  habit,
  month,
  today,
  isComplete = (day) => habit.completions.includes(day),
  isSkipped = (day) => habitIsSkipped(habit, day, today),
) {
  const scheduled = habitMonthDays(month).filter((day) => (
    day && day <= today && habit.days.includes(pk(day).getDay()) && !isSkipped(day)
  ));
  return {
    completed: scheduled.filter(isComplete).length,
    scheduled: scheduled.length,
  };
}

export function habitWeeklyTarget(habit) {
  return Number.isInteger(habit.weeklyGoal) && habit.weeklyGoal >= 1
    ? Math.min(habit.weeklyGoal, habit.days.length)
    : null;
}

function weeklyGoalStreak(habit, target, today, weekStart, isComplete, isSkipped) {
  let streak = 0;
  let reference = today;
  for (let index = 0; index < 520; index++) {
    const week = weekDays(reference, weekStart);
    const scheduled = week.filter((day) => day <= today
      && habit.days.includes(pk(day).getDay())
      && !isSkipped(day));
    if (!scheduled.length) {
      reference = addDays(week[0], -1);
      continue;
    }
    const done = scheduled.filter(isComplete).length;
    if (done >= target) streak++;
    else if (index > 0) break;
    reference = addDays(week[0], -1);
  }
  return streak;
}

export function habitStats(
  habit,
  today,
  weekStart = 1,
  isComplete = (day) => habit.completions.includes(day),
  isSkipped = (day) => habitIsSkipped(habit, day, today),
) {
  const week = weekDays(today, weekStart);
  const scheduled = week.filter((day) => habit.days.includes(pk(day).getDay()) && !isSkipped(day));
  const completedThisWeek = scheduled.filter(isComplete).length;
  const weeklyTarget = habitWeeklyTarget(habit);
  let cursor = isComplete(today) ? today : addDays(today, -1);
  if (isSkipped(today)) cursor = today;
  let streak = 0;
  for (let checked = 0; checked < 3660; checked++) {
    if (isSkipped(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (habit.days.includes(pk(cursor).getDay())) {
      if (!isComplete(cursor)) break;
      streak++;
    }
    cursor = addDays(cursor, -1);
  }
  return {
    completedThisWeek,
    scheduledThisWeek: scheduled.length,
    weeklyTarget,
    goalMet: weeklyTarget !== null && completedThisWeek >= weeklyTarget,
    weeklyStreak: weeklyTarget === null ? null : weeklyGoalStreak(habit, weeklyTarget, today, weekStart, isComplete, isSkipped),
    streak,
    week: week.map((day) => ({
      day,
      completed: isComplete(day),
      scheduled: habit.days.includes(pk(day).getDay()),
      skipped: isSkipped(day),
    })),
  };
}
