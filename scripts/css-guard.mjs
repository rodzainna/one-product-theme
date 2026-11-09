import stylelint from "stylelint";
import config from "../stylelint.config.mjs";

const stylesheetBlock =
  /\{%-?\s*stylesheet\s*-?%\}([\s\S]*?)\{%-?\s*endstylesheet\s*-?%\}/g;
const lineOf = (text, index) => text.slice(0, index).split("\n").length - 1;

export const cssChunks = (file, source) => {
  if (/\.css(\.liquid)?$/.test(file)) return [{ code: source, offset: 0 }];
  return [...source.matchAll(stylesheetBlock)].map((m) => ({
    code: m[1],
    offset: lineOf(source, m.index),
  }));
};

export const lintCss = async (file, source) => {
  const reports = await Promise.all(
    cssChunks(file, source).map(async ({ code, offset }) => {
      const [result] = (await stylelint.lint({ code, config })).results;
      return [
        ...result.invalidOptionWarnings.map(({ text }) => ({
          file: "stylelint.config.mjs",
          rule: "invalid-option",
          text,
        })),
        ...result.warnings.map(({ line, rule, text }) => ({
          file: `${file}:${line + offset}`,
          rule,
          text,
        })),
      ];
    }),
  );
  return reports.flat();
};
