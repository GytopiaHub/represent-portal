// Builds the docs/ui/<page>.html option pages (SRS §9.1).
// Usage: node scripts/ui-options/build.mjs docs/ui scripts/ui-options/batch1.mjs [more batch files...]
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPage } from "./shell.mjs";

const [outDir, ...mods] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
for (const m of mods) {
  const { pages } = await import(pathToFileURL(resolve(m)).href);
  for (const p of pages) {
    const file = join(outDir, `${p.slug}.html`);
    writeFileSync(file, buildPage(p));
    console.log("wrote", file);
  }
}
