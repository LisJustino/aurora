const results = [];
const check = (condition, name, detail = '') => results.push({
  passed: Boolean(condition),
  name,
  detail,
});
const keys = ['aurora.app.tasks', 'aurora.app.settings'];
const original = new Map(keys.map((key) => [key, localStorage.getItem(key)]));
const frame = document.createElement('iframe');
frame.hidden = true;
document.body.append(frame);

try {
  const malformedTasks = {
    v: [
      { id: 'test-valid', title: 'Tarefa preservada', done: false, tag: 'Pessoal', dueDate: null, priority: 'normal', createdAt: 1 },
      null,
      { id: 'test-invalid', title: 42 },
    ],
    t: 1,
  };
  localStorage.setItem('aurora.app.tasks', JSON.stringify(malformedTasks));
  localStorage.setItem('aurora.app.settings', JSON.stringify({ v: { onboardingComplete: true }, t: 2 }));
  frame.src = '/index.html#inicio';
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  await new Promise((resolve) => setTimeout(resolve, 100));

  const appDocument = frame.contentDocument;
  check(Boolean(appDocument.querySelector('#app main')), 'App inicia com uma fatia estruturalmente inválida');
  check(appDocument.querySelector('#toast')?.textContent.includes('tasks'), 'O aviso identifica a fatia inválida');
  check(localStorage.getItem('aurora.app.tasks') === JSON.stringify(malformedTasks), 'A fatia bruta não é sobrescrita ao iniciar');

  frame.contentWindow.location.hash = '#config?section=data';
  await new Promise((resolve) => setTimeout(resolve, 100));
  check(Boolean(appDocument.querySelector('[data-action="recovery-export"]')), 'Ajustes oferece cópia de recuperação');
  appDocument.querySelector('[data-action="look-cycle"]')?.click();
  appDocument.querySelector('[data-action="toggle"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  check(localStorage.getItem('aurora.app.tasks') === JSON.stringify(malformedTasks), 'Ações não sobrescrevem a fatia bloqueada');

  const invalidBackup = {
    app: 'aurora',
    version: 2,
    data: { tasks: [{ id: 'good', title: 'Válida' }, { id: 'bad', title: 12 }] },
  };
  const input = appDocument.querySelector('input[data-change="import"]');
  const file = new File([JSON.stringify(invalidBackup)], 'backup-invalido.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  check(appDocument.querySelector('#imperr')?.textContent.includes('registro(s) inválido(s)'), 'Backup inválido é rejeitado sem importação parcial');
} catch (error) {
  check(false, 'Execução de integridade', error.message);
} finally {
  frame.remove();
  for (const [key, value] of original) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
}

const failures = results.filter((result) => !result.passed);
document.querySelector('#status').textContent = `${results.length - failures.length}/${results.length} verificações passaram.`;
results.forEach((result) => {
  const item = document.createElement('li');
  item.textContent = result.passed ? `OK — ${result.name}` : `FALHOU — ${result.name}: ${result.detail}`;
  document.querySelector('#results').append(item);
});
