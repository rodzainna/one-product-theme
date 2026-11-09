import { existsSync, readFileSync, readdirSync } from "node:fs";
import stylelint from "stylelint";
import config from "../stylelint.config.mjs";

const stylesheetBlock =
  /\{%-?\s*stylesheet\s*-?%\}([\s\S]*?)\{%-?\s*endstylesheet\s*-?%\}/g;
const lineOf = (text, index) => text.slice(0, index).split("\n").length - 1;

const files = ["assets", "blocks", "layout", "sections", "snippets"]
  .filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => /\.(css|liquid)$/.test(name))
      .map((name) => `${dir}/${name}`),
  );

const chunks = files.flatMap((file) => {
  const source = readFileSync(file, "utf8");
  if (file.endsWith(".css")) return [{ file, code: source, offset: 0 }];
  return [...source.matchAll(stylesheetBlock)].map((m) => ({
    file,
    code: m[1],
    offset: lineOf(source, m.index),
  }));
});

const reports = await Promise.all(
  chunks.map(({ code }) => stylelint.lint({ code, config })),
);

const problems = reports.flatMap(({ results: [result] }, i) => {
  const { file, offset } = chunks[i];
  return [
    ...result.invalidOptionWarnings.map(
      (w) => `stylelint.config.mjs  ${w.text}`,
    ),
    ...result.warnings.map((w) => `${file}:${w.line + offset}  ${w.text}`),
  ];
});

const unique = [...new Set(problems)];
if (unique.length) {
  console.error(unique.join("\n"));
  console.error(
    `\n${unique.length} CSS problem${unique.length === 1 ? "" : "s"} in ${files.length} files`,
  );
  process.exit(1);
}
console.log(`CSS guard: ${files.length} files, no problems`);
