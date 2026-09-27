import { isBuiltin } from "node:module";

const srcUrl = new URL("../src/", import.meta.url);

function hasExtension(specifier) {
  return /\.[a-z0-9]+$/i.test(specifier.split("?")[0]);
}

export async function resolve(specifier, context, nextResolve) {
  if (isBuiltin(specifier) || specifier.startsWith("node:") || specifier.startsWith("data:")) {
    return nextResolve(specifier, context);
  }

  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    const withExt = hasExtension(relative) ? relative : `${relative}.ts`;
    return nextResolve(new URL(withExt, srcUrl).href, context);
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !hasExtension(specifier)
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }

  return nextResolve(specifier, context);
}
