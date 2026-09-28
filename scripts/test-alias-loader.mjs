import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isFile(candidate) {
  return existsSync(candidate) && statSync(candidate).isFile();
}

function resolveAlias(specifier, parentURL) {
  let base = null;
  if (specifier.startsWith("@/")) {
    base = path.join(root, "src", specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    parentURL?.startsWith("file:")
  ) {
    base = path.resolve(path.dirname(fileURLToPath(parentURL)), specifier);
  }
  if (!base) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    path.join(base, "index.ts"),
  ];
  return candidates.find((candidate) => isFile(candidate)) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const hit = resolveAlias(specifier, context.parentURL);
    if (!hit) throw error;
    return nextResolve(pathToFileURL(hit).href, context);
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".json")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: `export default ${JSON.stringify(JSON.parse(source))};\n`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
