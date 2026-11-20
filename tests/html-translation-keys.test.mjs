import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";

// A translation key ending in _html doesn't escape the values passed to it, so each value has to
// be safe before the call: escaped, a time tag, a literal, or built from safe parts.
const SAFE_FILTERS = ["escape", "time_tag"];

export const isSafe = (expression, assignments, seen = new Set()) => {
  const [base, ...filters] = expression.split("|").map((part) => part.trim());
  let safe = false;
  if (/^(['"]).*\1$/.test(base) || /^[\d.]+$/.test(base)) {
    safe = true;
  } else if (/^\w+$/.test(base) && !seen.has(base)) {
    const all = assignments[base] ?? [];
    safe =
      all.length > 0 &&
      all.every((value) => isSafe(value, assignments, new Set(seen).add(base)));
  }
  for (const filter of filters) {
    const [name, ...rest] = filter.split(":");
    if (SAFE_FILTERS.includes(name.trim())) safe = true;
    else if (name.trim() === "append") {
      safe = safe && isSafe(rest.join(":").trim(), assignments, seen);
    }
  }
  return safe;
};

const assignmentsIn = (source) => {
  const assignments = {};
  for (const match of source.matchAll(
    /assign\s+(\w+)\s*=\s*(.+?)\s*(?:-?%}|$)/gm,
  )) {
    (assignments[match[1]] ??= []).push(match[2]);
  }
  return assignments;
};

const directories = ["layout", "sections", "snippets", "blocks", "templates"];
const files = directories.flatMap((directory) =>
  readdirSync(directory)
    .filter((name) => name.endsWith(".liquid"))
    .map((name) => `${directory}/${name}`),
);

const calls = files.flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const assignments = assignmentsIn(source);
  return [
    ...source.matchAll(/'([\w.]+_html)'\s*\|\s*t:\s*(.+?)\s*(?:-?}}|-?%}|$)/gm),
  ].flatMap((match) =>
    match[2].split(/,\s*(?=\w+:)/).map((argument) => {
      const [name, ...rest] = argument.split(":");
      return {
        file,
        key: match[1],
        name: name.trim(),
        value: rest.join(":").trim(),
        assignments,
      };
    }),
  );
});

describe("the safety check", () => {
  const assignments = {
    raw: ["article.author"],
    escaped: ["article.author | escape"],
    mixed: ["article.author | escape", "other.author"],
    built: ["'<b>' | append: escaped | append: '</b>'"],
    leaked: ["escaped | append: raw"],
    loop: ["loop"],
  };
  test.each([
    ["article.author", false],
    ["article.author | escape", true],
    ["'text'", true],
    ["3", true],
    ["raw", false],
    ["raw | append: ''", false],
    ["escaped", true],
    ["mixed", false],
    ["built", true],
    ["leaked", false],
    ["loop", false],
    ["missing", false],
  ])("%s is safe: %s", (expression, expected) => {
    expect(isSafe(expression, assignments)).toBe(expected);
  });
});

describe("translation keys ending in _html", () => {
  test("are found in the theme", () => {
    expect(calls.length).toBeGreaterThan(0);
  });

  test.each(
    calls.map((call) => [`${call.file}: ${call.key} ${call.name}`, call]),
  )("%s gets a value that is safe beforehand", (_label, call) => {
    expect(
      isSafe(call.value, call.assignments),
      `${call.value} isn't escaped, a time tag, a literal or built from those`,
    ).toBe(true);
  });
});
