import { existsSync, readFileSync, readdirSync } from "node:fs";
import { lintCss } from "./css-guard.mjs";

const files = ["assets", "blocks", "layout", "sections", "snippets"]
  .filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => /\.(css|liquid)$/.test(name))
      .map((name) => `${dir}/${name}`),
  );

const reports = await Promise.all(
  files.map((file) => lintCss(file, readFileSync(file, "utf8"))),
);

const unique = [
  ...new Set(reports.flat().map(({ file, text }) => `${file}  ${text}`)),
];
if (unique.length) {
  console.error(unique.join("\n"));
  console.error(
    `\n${unique.length} CSS problem${unique.length === 1 ? "" : "s"} in ${files.length} files`,
  );
  process.exit(1);
}
console.log(`CSS guard: ${files.length} files, no problems`);
