import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const gateJob = workflow.slice(workflow.indexOf("\n  ci-pass:"));

// The script under "run: |", exactly as the workflow has it.
const readScript = () => {
  const lines = gateJob.split("\n");
  const start = lines.findIndex((line) => line.trim() === "run: |") + 1;
  const indent = lines[start].search(/\S/);
  const end = lines.findIndex(
    (line, i) => i > start && line.trim() && line.search(/\S/) < indent,
  );
  return lines
    .slice(start, end === -1 ? undefined : end)
    .map((line) => line.slice(indent))
    .join("\n");
};

const JOBS = ["changes", "lint", "unit", "prTitle", "browsers"];

// GitHub runs a step with "bash -e", so the first failing line fails the check.
const passes = (docsOnly, results) => {
  const job = Object.fromEntries(JOBS.map((name, i) => [name, results[i]]));
  try {
    execFileSync("bash", ["-e", "-c", readScript()], {
      stdio: "ignore",
      env: {
        PATH: process.env.PATH,
        RESULTS: results.join(" "),
        DOCS_ONLY: docsOnly,
        CHANGES: job.changes,
        LINT: job.lint,
        UNIT: job.unit,
        BROWSERS: job.browsers,
      },
    });
    return true;
  } catch {
    return false;
  }
};

const ok = "success";
const skip = "skipped";
const fail = "failure";
const stop = "cancelled";

describe("the CI passed gate", () => {
  test("waits for every job and runs even when the run is cancelled", () => {
    expect(gateJob).toContain(
      "needs: [changes, lint, unit, pr-title, browsers]",
    );
    expect(gateJob).toContain("if: ${{ always() }}");
  });

  // Results are in the order of JOBS: changes, lint, unit, pr-title, browsers.
  test.each([
    ["a pull request with code", "false", [ok, ok, ok, ok, ok]],
    ["a push, which has no title to check", "false", [ok, ok, ok, skip, ok]],
    ["a Markdown-only pull request", "true", [ok, ok, skip, ok, skip]],
  ])("passes %s", (_, docsOnly, results) => {
    expect(passes(docsOnly, results)).toBe(true);
  });

  test.each([
    ["Prettier fails on Markdown", "true", [ok, fail, skip, ok, skip]],
    ["the title fails on Markdown", "true", [ok, ok, skip, fail, skip]],
    ["Lint never ran", "true", [ok, skip, skip, ok, skip]],
    ["change detection never ran", "true", [skip, ok, skip, ok, skip]],
    ["change detection failed", "", [fail, skip, skip, ok, skip]],
    ["code skipped the Node tests", "false", [ok, ok, skip, ok, ok]],
    ["code skipped the browsers", "false", [ok, ok, ok, ok, skip]],
    ["no answer skipped the heavy jobs", "", [ok, ok, skip, ok, skip]],
    ["a browser failed", "false", [ok, ok, ok, ok, fail]],
    ["the Node tests failed", "false", [ok, ok, fail, ok, skip]],
    ["the browsers were cancelled", "false", [ok, ok, ok, ok, stop]],
    ["the title check was cancelled", "true", [ok, ok, skip, stop, skip]],
    ["the whole run was cancelled", "", [stop, stop, stop, stop, stop]],
  ])("fails when %s", (_, docsOnly, results) => {
    expect(passes(docsOnly, results)).toBe(false);
  });
});
