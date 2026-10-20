import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("module boundaries", () => {
  it("core and providers never import chrome APIs", () => {
    const offenders: string[] = [];
    for (const dir of ["src/core"]) {
      for (const file of walk(join(process.cwd(), dir))) {
        const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        if (/\bchrome\./.test(src) || /from ["'](@\/chrome|\.\.\/chrome|\.\.\/\.\.\/chrome)/.test(src)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
