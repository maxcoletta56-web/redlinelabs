import { existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), "..");
const stubUrl = new URL("./server-only-stub.mjs", import.meta.url).href;

function aliasUrl(specifier) {
  if (!specifier.startsWith("@/")) return null;
  const base = pathResolve(root, "src", specifier.slice(2));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`];
  const match = candidates.find((candidate) => existsSync(candidate));
  return pathToFileURL(match ?? base).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { format: "module", shortCircuit: true, url: stubUrl };
  }
  const aliased = aliasUrl(specifier);
  if (aliased) return nextResolve(aliased, context);
  return nextResolve(specifier, context);
}
