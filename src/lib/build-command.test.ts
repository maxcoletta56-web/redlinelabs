import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel runs the same schema scripts as npm run build", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: { build: string };
  };
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    buildCommand: string;
  };

  assert.equal(vercel.buildCommand, pkg.scripts.build);
  assert.match(vercel.buildCommand, /node scripts\/ensure-club-tables\.mjs/);
  assert.match(
    vercel.buildCommand,
    /ensure-orders-table\.mjs && node scripts\/ensure-club-tables\.mjs && next build$/,
  );
});
