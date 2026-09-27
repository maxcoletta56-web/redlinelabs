import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "src");

function fileWithExtension(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`];
  return candidates.find((item) => existsSync(item)) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = fileWithExtension(join(root, specifier.slice(2)));
    if (!found) return nextResolve(specifier, context);
    return finish(found);
  }

  if (specifier.startsWith(".")) {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      const parent = context.parentURL ? fileURLToPath(context.parentURL) : "";
      if (!parent.includes(`${join("src")}`)) throw error;
      const found = fileWithExtension(fileURLToPath(new URL(specifier, context.parentURL)));
      if (!found) throw error;
      return finish(found);
    }
  }

  return nextResolve(specifier, context);
}

function finish(found) {
  const url = pathToFileURL(found).href;
  if (found.endsWith(".json")) {
    return {
      url,
      shortCircuit: true,
      importAttributes: { type: "json" },
    };
  }
  return { url, shortCircuit: true };
}
