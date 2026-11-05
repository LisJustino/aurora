export const TASK_ICONS = Object.freeze([
  ['sparkles', 'Geral'],
  ['calendarCheck', 'Planejamento'],
  ['book', 'Estudos'],
  ['target', 'Foco'],
  ['flag', 'Meta'],
  ['check', 'Concluir'],
  ['clock', 'Horário'],
  ['folder', 'Organização'],
  ['list', 'Lista'],
  ['note', 'Anotações'],
  ['pencil', 'Escrever'],
  ['home', 'Casa'],
  ['heart', 'Pessoal'],
  ['wallet', 'Finanças'],
  ['bag', 'Compras'],
  ['car', 'Deslocamento'],
  ['utensils', 'Refeição'],
  ['apple', 'Saúde'],
  ['dumbbell', 'Treino'],
  ['droplet', 'Água'],
  ['leaf', 'Natureza'],
  ['music', 'Lazer'],
  ['palette', 'Criatividade'],
  ['phoneOff', 'Menos tela'],
]);

export const TASK_ICON_KEYS = Object.freeze(TASK_ICONS.map(([key]) => key));
export const isTaskIconKey = (value) => TASK_ICON_KEYS.includes(value);
export const taskIconKey = (value) => (isTaskIconKey(value) ? value : '');
