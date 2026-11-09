import { expect, test } from "vitest";
import { cssChunks, lintCss } from "../scripts/css-guard.mjs";

test("a .css or .css.liquid file is linted whole", () => {
  expect(cssChunks("assets/a.css", "a {}")).toEqual([
    { code: "a {}", offset: 0 },
  ]);
  expect(cssChunks("assets/a.css.liquid", "a {}")).toHaveLength(1);
});

test("a liquid file without a stylesheet has no chunks", () => {
  expect(cssChunks("snippets/x.liquid", "{{ 'hi' }}")).toEqual([]);
});

test("problems point to the line in the liquid file", async () => {
  const source = [
    "<div></div>",
    "{% stylesheet %}",
    "  a { color: red; }",
    "{% endstylesheet %}",
    "",
    "{%- stylesheet -%}",
    "  b {",
    "    z-index: 99;",
    "  }",
    "{%- endstylesheet -%}",
  ].join("\n");

  const problems = await lintCss("blocks/x.liquid", source);

  expect(problems.map(({ file }) => file)).toEqual([
    "blocks/x.liquid:3",
    "blocks/x.liquid:8",
  ]);
});
