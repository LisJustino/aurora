import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const databaseUrl = process.env.AURORA_TEST_DATABASE_URL
  || 'postgres://postgres:postgres@127.0.0.1:54322/postgres';
const parsedDatabaseUrl = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedDatabaseUrl.hostname)
  || parsedDatabaseUrl.pathname !== '/postgres') {
  throw new Error('O teste de concorrência só aceita o banco Supabase local postgres em localhost.');
}

const userId = randomUUID();
const taskId = randomUUID();
const email = `concurrency-${userId}@example.invalid`;
const psqlEnv = { ...process.env, PGSSLMODE: 'disable' };

function runPsql(sql) {
  const result = spawnSync('psql', [
    '--no-psqlrc', '--quiet', '--tuples-only', '--no-align',
    '--set=ON_ERROR_STOP=1', '--dbname', databaseUrl,
  ], {
    input: sql,
    encoding: 'utf8',
    env: psqlEnv,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`psql falhou: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function startPsql(sql) {
  const child = spawn('psql', [
    '--no-psqlrc', '--quiet', '--tuples-only', '--no-align',
    '--set=ON_ERROR_STOP=1', '--dbname', databaseUrl,
  ], { env: psqlEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(sql);
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
  return { child, completion, getOutput: () => `${stdout}\n${stderr}` };
}

function rpcSql(title, expectedVersion) {
  const payload = JSON.stringify([{
    table: 'tasks',
    replace_missing: false,
    expected_versions: [{ id: taskId, user_id: userId, expected_updated_at: expectedVersion }],
    rows: [{
      id: taskId,
      user_id: userId,
      title,
      is_completed: false,
      priority: 'normal',
      repeat_rule: 'none',
      sort_order: 0,
      focus_seconds: 0,
      is_test_data: false,
      expected_updated_at: expectedVersion,
    }],
  }]).replaceAll("'", "''");
  return `select public.apply_relational_changes('${payload}'::jsonb);`;
}

const claims = JSON.stringify({ sub: userId, role: 'authenticated', aal: 'aal1' }).replaceAll("'", "''");
let fixtureCreated = false;
let writer;
let staleWriter;

try {
  const timestamp = runPsql(`
    begin;
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '${userId}', 'authenticated', 'authenticated', '${email}', '',
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb, now(), now()
    );
    insert into public.tasks (id, user_id, title)
    values ('${taskId}', '${userId}', 'original');
    commit;
    select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    from public.tasks where id = '${taskId}';
  `).split(/\r?\n/).at(-1);
  fixtureCreated = true;
  assert.match(timestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);

  writer = startPsql(`
    begin;
    select set_config('request.jwt.claims', '${claims}', true);
    set local role authenticated;
    select pg_advisory_xact_lock(hashtextextended('tasks:${userId}', 0));
    \\echo WRITER_LOCKED
    ${rpcSql('writer-a', timestamp)}
    select pg_sleep(2);
    commit;
  `);
  const markerDeadline = Date.now() + 10000;
  while (!writer.getOutput().includes('WRITER_LOCKED') && Date.now() < markerDeadline) {
    if (writer.child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(writer.getOutput().includes('WRITER_LOCKED'), 'a primeira conexão não iniciou a gravação');

  staleWriter = startPsql(`
    begin;
    select set_config('request.jwt.claims', '${claims}', true);
    set local role authenticated;
    ${rpcSql('writer-b-stale', timestamp)}
    commit;
  `);
  const firstResult = await writer.completion;
  assert.equal(firstResult.code, 0, `${firstResult.stderr}\n${firstResult.stdout}`);
  const staleResult = await staleWriter.completion;
  assert.notEqual(staleResult.code, 0, 'a segunda conexão não rejeitou a versão obsoleta');
  assert.match(`${staleResult.stderr}\n${staleResult.stdout}`, /version_conflict:/i);

  const winningTitle = runPsql(`select title from public.tasks where id = '${taskId}';`);
  assert.equal(winningTitle, 'writer-a', 'a gravação concorrente obsoleta não deve sobrescrever a vencedora');
  console.log('Supabase: duas conexões concorrentes; a gravação obsoleta foi rejeitada sem sobrescrever a vencedora.');
} finally {
  for (const process of [writer, staleWriter]) {
    if (process && process.child.exitCode === null) process.child.kill();
  }
  if (fixtureCreated) runPsql(`delete from auth.users where id = '${userId}';`);
}
