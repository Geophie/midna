// The production deploy must be gated by the CI (workflow_run on CI success)
// and must not install a floating deploy tool. Text checks on purpose: no YAML
// parser is a project dependency.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const wf = (name: string) =>
  readFileSync(path.resolve(__dirname, "..", "..", ".github", "workflows", name), "utf8");

const ci = wf("ci.yml");
const deploy = wf("vercel-production.yml");

describe("production deploy gate", () => {
  it("1. the deploy is gated by the CI (workflow_run on CI success, or the same workflow with needs)", () => {
    const gatedByWorkflowRun =
      /workflow_run:[\s\S]*?workflows:\s*\[?\s*["']?CI["']?\s*\]?/.test(deploy) &&
      /conclusion\s*==\s*['"]success['"]/.test(deploy);
    const gatedByNeeds = /^\s*needs:\s*\S+/m.test(deploy) && /npm run test:golden:all/.test(deploy);
    expect(gatedByWorkflowRun || gatedByNeeds).toBe(true);
  });

  it("2. the deploy does not also trigger directly on push (that would bypass the gate)", () => {
    const directPush = /^on:\s*\n(?:[ \t]+.*\n)*?[ \t]+push:/m.test(deploy);
    expect(directPush).toBe(false);
  });

  it("3. the Vercel CLI version is pinned, not @latest", () => {
    expect(deploy).not.toMatch(/vercel@latest/);
    expect(deploy).toMatch(/vercel@\d+/);
  });
});

describe("non-regression guards (must stay green)", () => {
  it("4. the CI still runs on push to main and on pull requests", () => {
    expect(ci).toMatch(/push:\s*\n\s*branches:\s*\n\s*-\s*main/);
    expect(ci).toMatch(/pull_request:/);
  });

  it("5. the CI still runs type-check, lint, unit and golden tests", () => {
    for (const step of ["tsc --noEmit", "npm run lint", "npm test", "npm run test:golden:all"]) {
      expect(ci).toContain(step);
    }
  });
});
