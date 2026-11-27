const themeToggle = document.querySelector('[data-theme-toggle]');
const now = new Date();
const dateLabel = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(now);
const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

document.querySelector('[data-preview-date]').textContent = dateLabel.replace(/^./, (letter) => letter.toUpperCase());
document.querySelector('[data-preview-greeting]').textContent = `${greeting}, Elisa.`;

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro');
});
