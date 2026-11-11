import { isPlainObject } from '../../core/data-integrity.js';

const MAX_GOALS_PER_PLAN = 100;
const MAX_INTENTION_LENGTH = 300;
const MAX_GOAL_TITLE_LENGTH = 120;
const MAX_GOAL_ACTION_LENGTH = 280;
const QUARTERS = new Set(['', 'q1', 'q2', 'q3', 'q4']);

export const ANNUAL_PLAN_IDEA_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'bem-estar', label: 'Bem-estar' }),
  Object.freeze({ id: 'trabalho-estudos', label: 'Trabalho e estudos' }),
  Object.freeze({ id: 'dinheiro', label: 'Dinheiro' }),
  Object.freeze({ id: 'relacoes', label: 'Relações' }),
  Object.freeze({ id: 'casa-rotina', label: 'Casa e rotina' }),
  Object.freeze({ id: 'experiencias', label: 'Experiências e lazer' }),
]);

export const ANNUAL_PLAN_IDEAS = Object.freeze([
  { id: 'move-more', category: 'bem-estar', title: 'Movimentar meu corpo com regularidade', action: 'Escolher uma atividade que combine com minha rotina.' },
  { id: 'sleep-routine', category: 'bem-estar', title: 'Cuidar melhor do meu sono', action: 'Testar um horário para desacelerar antes de dormir.' },
  { id: 'preventive-care', category: 'bem-estar', title: 'Colocar meus cuidados de saúde em dia', action: 'Anotar consultas ou exames que quero agendar.' },
  { id: 'less-stress', category: 'bem-estar', title: 'Criar mais momentos de descanso', action: 'Reservar um intervalo livre na semana.' },
  { id: 'learn-skill', category: 'trabalho-estudos', title: 'Aprender uma habilidade nova', action: 'Pesquisar um curso ou material para começar.' },
  { id: 'finish-course', category: 'trabalho-estudos', title: 'Concluir um curso ou formação', action: 'Definir qual curso e quanto tempo consigo dedicar.' },
  { id: 'update-cv', category: 'trabalho-estudos', title: 'Atualizar meu currículo ou portfólio', action: 'Reunir meus projetos e experiências recentes.' },
  { id: 'career-step', category: 'trabalho-estudos', title: 'Dar um próximo passo na minha carreira', action: 'Escrever o que quero mudar ou experimentar no trabalho.' },
  { id: 'emergency-fund', category: 'dinheiro', title: 'Começar ou reforçar minha reserva', action: 'Escolher um valor possível para guardar por mês.' },
  { id: 'pay-debt', category: 'dinheiro', title: 'Avançar na quitação de uma dívida', action: 'Listar os saldos e escolher por onde começar.' },
  { id: 'track-spending', category: 'dinheiro', title: 'Entender melhor para onde vai meu dinheiro', action: 'Revisar meus gastos de um mês sem julgamentos.' },
  { id: 'save-for-something', category: 'dinheiro', title: 'Guardar para algo que desejo', action: 'Definir o valor aproximado e uma contribuição inicial.' },
  { id: 'family-time', category: 'relacoes', title: 'Ter mais tempo de qualidade com a família', action: 'Combinar um momento simples para estarmos juntos.' },
  { id: 'reconnect', category: 'relacoes', title: 'Me reaproximar de alguém importante', action: 'Mandar uma mensagem ou fazer um convite.' },
  { id: 'meet-people', category: 'relacoes', title: 'Conhecer pessoas com interesses parecidos', action: 'Procurar um grupo, encontro ou atividade local.' },
  { id: 'healthy-boundaries', category: 'relacoes', title: 'Cuidar melhor dos meus limites', action: 'Identificar uma situação em que quero me posicionar.' },
  { id: 'organize-space', category: 'casa-rotina', title: 'Organizar um espaço da minha casa', action: 'Escolher uma gaveta, prateleira ou canto para começar.' },
  { id: 'simplify-belongings', category: 'casa-rotina', title: 'Desapegar do que não uso mais', action: 'Separar uma pequena caixa para revisar.' },
  { id: 'meal-routine', category: 'casa-rotina', title: 'Deixar a rotina das refeições mais leve', action: 'Escolher duas refeições para planejar com antecedência.' },
  { id: 'home-project', category: 'casa-rotina', title: 'Fazer uma melhoria em casa', action: 'Anotar o que precisa e estimar os materiais.' },
  { id: 'plan-trip', category: 'experiencias', title: 'Fazer uma viagem especial', action: 'Pesquisar destinos e custos sem pressa.' },
  { id: 'creative-hobby', category: 'experiencias', title: 'Experimentar um hobby criativo', action: 'Escolher uma atividade e separar um primeiro horário.' },
  { id: 'read-more', category: 'experiencias', title: 'Ler mais por prazer', action: 'Escolher um livro que estou com vontade de ler.' },
  { id: 'local-experience', category: 'experiencias', title: 'Explorar mais a minha cidade', action: 'Salvar um lugar ou evento que quero conhecer.' },
].map((idea) => Object.freeze(idea)));

const foldText = (value) => String(value)
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export function filterAnnualPlanIdeas(category = 'all', query = '') {
  const search = foldText(query.trim());
  return ANNUAL_PLAN_IDEAS.filter((idea) => {
    if (category !== 'all' && idea.category !== category) return false;
    if (!search) return true;
    return foldText(`${idea.title} ${idea.action} ${idea.category}`).includes(search);
  });
}

const isAnnualYear = (year) => /^\d{4}$/.test(year) && Number(year) >= 1900;
const isAnnualGoal = (goal) => isPlainObject(goal)
  && typeof goal.id === 'string'
  && Boolean(goal.id.trim())
  && goal.id.length <= 200
  && typeof goal.title === 'string'
  && Boolean(goal.title.trim())
  && goal.title.length <= MAX_GOAL_TITLE_LENGTH
  && typeof goal.action === 'string'
  && goal.action.length <= MAX_GOAL_ACTION_LENGTH
  && QUARTERS.has(goal.quarter)
  && typeof goal.done === 'boolean';

export function isValidAnnualPlans(value) {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  const idsByYear = new Set();
  return entries.every(([year, plan]) => {
    if (!isAnnualYear(year)
      || !isPlainObject(plan)
      || typeof plan.intention !== 'string'
      || plan.intention.length > MAX_INTENTION_LENGTH
      || !Array.isArray(plan.goals)
      || plan.goals.length > MAX_GOALS_PER_PLAN
      || !plan.goals.every(isAnnualGoal)) return false;
    const ids = plan.goals.map((goal) => goal.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => idsByYear.has(`${year}:${id}`))) return false;
    ids.forEach((id) => idsByYear.add(`${year}:${id}`));
    return true;
  });
}

export function normalizeAnnualPlans(value) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([year, plan]) => isAnnualYear(year)
      && isPlainObject(plan)
      && typeof plan.intention === 'string'
      && plan.intention.length <= MAX_INTENTION_LENGTH
      && Array.isArray(plan.goals)
      && plan.goals.length <= MAX_GOALS_PER_PLAN)
    .map(([year, plan]) => [year, {
      ...plan,
      goals: plan.goals.filter(isAnnualGoal).map((goal) => ({ ...goal })),
    }]));
}

export const ANNUAL_PLAN_LIMITS = Object.freeze({
  intention: MAX_INTENTION_LENGTH,
  goalTitle: MAX_GOAL_TITLE_LENGTH,
  goalAction: MAX_GOAL_ACTION_LENGTH,
  goals: MAX_GOALS_PER_PLAN,
});
