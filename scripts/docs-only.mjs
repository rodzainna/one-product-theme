// Prints "true" when a change touches only Markdown, so CI and the pre-push hook can skip the heavy checks. Any doubt prints "false".
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

// Without --no-renames, renaming a script to .md would list only the new name.
const isDocsOnly = (base, head) => {
  const files = git(
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    `${base}...${head}`,
    "--",
  )
    .split("\0")
    .filter(Boolean);
  return files.length > 0 && files.every((file) => file.endsWith(".md"));
};

// Git gives the hook one "<local ref> <local sha> <remote ref> <remote sha>" line per ref.
// Each is compared with origin/main, as CI compares a whole pull request.
const isDocsOnlyPush = (input) => {
  const heads = input
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(" ")[1]);
  return (
    heads.length > 0 && heads.every((head) => isDocsOnly("origin/main", head))
  );
};

let docsOnly = false;
try {
  const [first, second] = process.argv.slice(2);
  if (first === "--pre-push")
    docsOnly = isDocsOnlyPush(readFileSync(0, "utf8"));
  else if (first && second) docsOnly = isDocsOnly(first, second);
} catch {
  // A missing commit or a deleted branch: run everything.
}
console.log(String(docsOnly));
