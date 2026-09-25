import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), ".next/static/chunks");
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith(".js")) files.push({ path, size: statSync(path).size });
  }
}

try {
  walk(root);
} catch {
  console.error("Run next build first so .next/static/chunks exists.");
  process.exit(1);
}

files.sort((a, b) => b.size - a.size);
for (const file of files.slice(0, 8)) {
  const rel = file.path.replace(`${process.cwd()}/`, "");
  console.log(`${(file.size / 1024).toFixed(1)} KB\t${rel}`);
}
