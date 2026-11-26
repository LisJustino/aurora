import assert from 'node:assert/strict';
import { clearOfflinePending, readOfflinePending, writeOfflinePending } from '../src/js/data/offline-queue.js';

// Node.js não possui IndexedDB nativo: valida o contrato de fallback em memória, isolamento por usuário e normalização.
assert.equal(await readOfflinePending(''), null);
assert.equal(await readOfflinePending('user-a'), null);

const saved = await writeOfflinePending('user-a', {
  snapshot: { tasks: [{ id: 't1', title: 'Pagar conta', done: true }], habits: [] },
  slices: ['tasks', 'tasks', ''],
  count: 2,
});
assert.equal(saved, true);

const readA = await readOfflinePending('user-a');
assert.ok(readA);
assert.equal(readA.userId, 'user-a');
assert.deepEqual(readA.slices, ['tasks']);
assert.equal(readA.count, 2);
assert.equal(readA.snapshot.tasks[0].title, 'Pagar conta');

// Isolamento entre contas
assert.equal(await readOfflinePending('user-b'), null);

// Limpeza após sincronização / logout
await clearOfflinePending('user-a');
assert.equal(await readOfflinePending('user-a'), null);

console.log('offline-queue-check: ok');
