import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const current = spawnSync(
  "git",
  ["config", "--local", "--get", "core.hooksPath"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);

if (current.error) throw current.error;
if (current.status !== 0 && current.status !== 1) {
  throw new Error(
    `Não foi possível consultar core.hooksPath (git exit ${current.status}).`,
  );
}

const configuredPath = current.status === 0 ? current.stdout.trim() : "";
if (configuredPath && configuredPath !== ".githooks") {
  throw new Error(
    `core.hooksPath já aponta para "${configuredPath}"; nenhuma configuração foi alterada.`,
  );
}

execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit",
});
console.log(
  "Hook pre-push instalado: npm run build será executado antes de cada push.",
);
