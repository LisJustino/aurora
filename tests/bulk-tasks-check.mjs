import assert from 'node:assert/strict';
import { MAX_BULK_TASKS, parseBulkTasks } from '../src/js/features/planning/bulk-tasks.js';

const today = '2026-11-22'; // domingo
const rows = parseBulkTasks(`
- [ ] Pagar condomínio 28/11
1. Ligar para o dentista amanhã 14h30 #saúde
• Comprar presente #família #família

Revisar planilha sexta
Entregar relatório hoje e amanhã
amanhã
`, today);

assert.equal(rows.length, 6);
assert.deepEqual(rows[0], { line: 2, source: '- [ ] Pagar condomínio 28/11', title: 'Pagar condomínio', dueDate: '2026-11-28', time: '', tags: [], duplicate: false, on: true });
assert.equal(rows[1].title, 'Ligar para o dentista');
assert.equal(rows[1].dueDate, '2026-11-23');
assert.equal(rows[1].time, '14:30');
assert.deepEqual(rows[1].tags, ['saúde']);
assert.equal(rows[2].dueDate, null); // sem data reconhecida: vai para a caixa de entrada
assert.deepEqual(rows[2].tags, ['família']);
assert.equal(rows[3].dueDate, '2026-11-27');
assert.ok(rows[4].error);
assert.equal(rows[4].line, 7);
assert.equal(rows[5].error, 'Escreva o título da tarefa.');

// duplicatas: contra tarefas abertas e dentro da própria lista
const existing = [
  { title: 'pagar condomínio', dueDate: '2026-11-28', done: false },
  { title: 'Revisar planilha', dueDate: '2026-11-27', done: true },
];
const dup = parseBulkTasks('Pagar condomínio 28/11\nRevisar planilha sexta\nLer livro\nler livro', today, existing);
assert.deepEqual(dup.map((row) => [row.duplicate, row.on]), [[true, false], [false, true], [false, true], [true, false]]);

// limites e entradas vazias
assert.deepEqual(parseBulkTasks('', today), []);
assert.deepEqual(parseBulkTasks(null, today), []);
const many = parseBulkTasks(Array.from({ length: MAX_BULK_TASKS + 2 }, (_, i) => `Tarefa ${i}`).join('\n'), today);
assert.equal(many.filter((row) => !row.error).length, MAX_BULK_TASKS);
assert.match(many.at(-1).error, /Limite/);
assert.match(parseBulkTasks('x'.repeat(121), today)[0].error, /120/);

console.log('bulk-tasks-check: ok');
