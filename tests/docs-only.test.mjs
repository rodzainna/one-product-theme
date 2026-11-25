import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const script = fileURLToPath(
  new URL("../scripts/docs-only.mjs", import.meta.url),
);
const ZEROS = "0".repeat(40);

// Git hooks set GIT_DIR and friends, which would point these commands at this repository.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
);

let repo;
const git = (...args) =>
  execFileSync(
    "git",
    [
      ...["-c", "user.name=Test", "-c", "user.email=test@example.com"],
      ...["-c", "commit.gpgsign=false"],
      ...args,
    ],
    { cwd: repo, env, encoding: "utf8" },
  ).trim();

const write = (path, text) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};

// A commit on top of main that applies one change.
const commit = (change) => {
  git("checkout", "-q", "--detach", "origin/main");
  change();
  git("add", "-A");
  git("commit", "-qm", "change", "--no-verify", "--allow-empty");
  return git("rev-parse", "HEAD");
};

const run = (args, input = "") =>
  execFileSync("node", [script, ...args], {
    cwd: repo,
    env,
    input,
    encoding: "utf8",
  }).trim();

const pushLine = (sha) => `refs/heads/topic ${sha} refs/heads/topic ${ZEROS}\n`;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "docs-only-"));
  git("init", "-q");
  write("README.md", "one\n");
  write("assets/cart.js", "export const cart = 1;\n");
  git("add", "-A");
  git("commit", "-qm", "start", "--no-verify");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("between two commits", () => {
  test.each([
    ["an edited Markdown file", () => write("README.md", "two\n"), "true"],
    [
      "new Markdown files in folders, with spaces in the name",
      () => write("docs/a guide.md", "text\n"),
      "true",
    ],
    [
      "Markdown together with a script",
      () => {
        write("README.md", "two\n");
        write("assets/cart.js", "export const cart = 2;\n");
      },
      "false",
    ],
    ["a deleted script", () => rmSync(join(repo, "assets/cart.js")), "false"],
    [
      "a script renamed to Markdown",
      () => git("mv", "assets/cart.js", "cart.md"),
      "false",
    ],
    [
      "a file that only has md in its name",
      () => write("snippets/md.liquid", "x\n"),
      "false",
    ],
    ["no changed files", () => {}, "false"],
  ])("%s", (_, change, expected) => {
    expect(run(["origin/main", commit(change)])).toBe(expected);
  });

  test("a commit that doesn't exist runs everything", () => {
    expect(run([ZEROS, "HEAD"])).toBe("false");
  });

  test("missing arguments run everything", () => {
    expect(run([])).toBe("false");
    expect(run(["", "HEAD"])).toBe("false");
  });
});

describe("before a push", () => {
  const docs = () => commit(() => write("README.md", "two\n"));
  const code = () => commit(() => write("assets/cart.js", "changed\n"));

  test("a branch with only Markdown changes", () => {
    expect(run(["--pre-push"], pushLine(docs()))).toBe("true");
  });

  test("earlier code commits on the branch still count", () => {
    code();
    write("README.md", "three\n");
    git("commit", "-qam", "docs on top", "--no-verify");
    const head = git("rev-parse", "HEAD");
    expect(run(["--pre-push"], pushLine(head))).toBe("false");
  });

  test("every pushed ref has to be Markdown only", () => {
    const input = pushLine(docs()) + pushLine(code());
    expect(run(["--pre-push"], input)).toBe("false");
  });

  test("deleting a branch or sending nothing runs everything", () => {
    expect(run(["--pre-push"], pushLine(ZEROS))).toBe("false");
    expect(run(["--pre-push"], "")).toBe("false");
  });
});
