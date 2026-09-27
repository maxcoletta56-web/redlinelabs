import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const projectRoot = new URL("../", import.meta.url);
const EXTENSIONS = [".ts", ".tsx"];

function firstExisting(base) {
  for (const extension of EXTENSIONS) {
    const candidate = new URL(base.href + extension);
    if (existsSync(fileURLToPath(candidate))) return candidate.href;
  }
  return null;
}

/**
 * App source uses bundler-style specifiers: extensionless relative paths and the
 * `@/*` alias from tsconfig. Node's ESM loader resolves neither, so unit tests
 * run under `--experimental-strip-types` cannot import those modules directly.
 */
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = firstExisting(new URL(`src/${specifier.slice(2)}`, projectRoot));
    if (resolved) return nextResolve(resolved, context);
  }

  if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const parent = context.parentURL ? new URL(context.parentURL) : pathToFileURL(process.cwd());
    const resolved = firstExisting(new URL(specifier, parent));
    if (resolved) return nextResolve(resolved, context);
  }

  return nextResolve(specifier, context);
}
