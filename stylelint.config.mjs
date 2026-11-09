const token = String.raw`var\(--[a-z0-9-]+\)`;
const only = (extra = "") =>
  new RegExp(String.raw`^(${token}${extra})$`).toString();
const list = (extra = "") =>
  new RegExp(String.raw`^(${token}${extra})( (${token}${extra}))*$`).toString();
const time = String.raw`/(^|[\s,])\d*\.?\d+m?s\b/`;
const easing = String.raw`/(?<![-\w])(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)(?![-\w])|cubic-bezier\(|steps\(|linear\(/`;

export default {
  rules: {
    "property-disallowed-list": ["font"],
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": [
      "rgb",
      "rgba",
      "hsl",
      "hsla",
      "hwb",
      "lab",
      "lch",
      "oklab",
      "oklch",
      "color",
      "light-dark",
      "device-cmyk",
    ],
    "declaration-property-value-allowed-list": {
      "font-size": [only("|inherit")],
      "font-weight": [only("|inherit")],
      "font-family": [only("|inherit")],
      "/^border(-[a-z]+)*-radius$/": [list("|0")],
      "z-index": [only("|auto")],
      "/^padding/": [list("|0")],
    },
    "declaration-property-value-disallowed-list": {
      "/^(transition|animation)(-duration|-delay)?$/": [time],
      "/^(transition|animation)(-timing-function)?$/": [easing],
    },
  },
};
