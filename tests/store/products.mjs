// The products pnpm test:store expects; pnpm test:store:setup creates any that are missing.
const stock = (quantity) => ({
  inventoryItem: { tracked: true },
  inventoryPolicy: "DENY",
  inventoryQuantities: [{ name: "available", quantity }],
});

const base = (handle, title, description) => ({
  handle,
  title,
  status: "ACTIVE",
  vendor: "Test",
  productType: "Test",
  descriptionHtml: `<p>${description}</p>`,
});

const single = (price, quantity, extra = {}) => ({
  productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
  variants: [
    {
      optionValues: [{ optionName: "Title", name: "Default Title" }],
      price,
      ...stock(quantity),
      ...extra,
    },
  ],
});

const sizes = (prices, quantities) => ({
  productOptions: [
    { name: "Size", values: ["S", "M", "L"].map((name) => ({ name })) },
  ],
  variants: ["S", "M", "L"].map((size, i) => ({
    optionValues: [{ optionName: "Size", name: size }],
    price: prices[i],
    ...stock(quantities[i]),
  })),
});

// One of each media type, freely licensed; the square, portrait and landscape images test ratios.
const image = (colour, size, text) => ({
  originalSource: `https://placehold.co/${size}/${colour}/FFFFFF.png?text=${text}`,
  alt: `${text} test image`,
  contentType: "IMAGE",
});
const red = image("C62828", "1200x1200", "Red");
const blue = image("1E4FA8", "1200x1600", "Blue");
const media = [
  red,
  blue,
  image("5F6B73", "1600x1000", "Landscape"),
  {
    originalSource:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    alt: "A flower opening (CC0)",
    contentType: "VIDEO",
  },
  {
    originalSource: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    alt: "Big Buck Bunny (Blender Foundation)",
    contentType: "EXTERNAL_VIDEO",
  },
  {
    originalSource:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb",
    alt: "Avocado 3D model (CC0)",
    contentType: "MODEL_3D",
  },
];

// Subscription plans; not part of ProductSetInput, so the setup script adds them afterwards.
const weeks = (count) => ({ interval: "WEEK", intervalCount: count });
const plan = (name, delivery, billing, percentage) => ({
  name,
  options: [name],
  category: "SUBSCRIPTION",
  billingPolicy: { recurring: { ...weeks(billing), minCycles: 1 } },
  deliveryPolicy: { recurring: weeks(delivery) },
  pricingPolicies: [
    {
      fixed: { adjustmentType: "PERCENTAGE", adjustmentValue: { percentage } },
    },
  ],
});
const sellingPlanGroups = [
  {
    name: "Subscribe & save",
    merchantCode: "subscribe-save",
    options: ["Delivery every"],
    sellingPlansToCreate: [
      plan("Every 2 weeks", 2, 2, 10),
      plan("Every 4 weeks", 4, 4, 10),
    ],
  },
  {
    name: "Prepaid",
    merchantCode: "prepaid",
    options: ["Deliveries"],
    sellingPlansToCreate: [plan("4 deliveries, every 2 weeks", 2, 8, 15)],
  },
];

// Size × Colour, with M / Blue sold out and no L / Blue at all.
const twoOptions = () => {
  const combinations = [
    ["S", "Red", "10.00", 50],
    ["S", "Blue", "10.00", 50],
    ["M", "Red", "15.00", 50],
    ["M", "Blue", "15.00", 0],
    ["L", "Red", "20.00", 50],
  ];
  return {
    productOptions: [
      { name: "Size", values: ["S", "M", "L"].map((name) => ({ name })) },
      { name: "Colour", values: ["Red", "Blue"].map((name) => ({ name })) },
    ],
    files: media,
    variants: combinations.map(([size, colour, price, quantity]) => ({
      optionValues: [
        { optionName: "Size", name: size },
        { optionName: "Colour", name: colour },
      ],
      file: colour === "Red" ? red : blue,
      price,
      ...stock(quantity),
    })),
  };
};

export const products = [
  {
    ...base("test-regular", "Test regular", "One variant in stock, no image."),
    ...single("20.00", 50),
  },
  {
    ...base("test-sale", "Test sale", "One variant on sale."),
    ...single("15.00", 50, { compareAtPrice: "20.00" }),
  },
  {
    ...base("test-sold-out", "Test sold out", "One variant with no stock."),
    ...single("20.00", 0),
  },
  {
    ...base("test-size-sold-out", "Test size sold out", "Size S has no stock."),
    ...sizes(["20.00", "20.00", "20.00"], [0, 50, 50]),
  },
  {
    ...base(
      "test-several-prices",
      "Test several prices",
      "Each size has its own price.",
    ),
    ...sizes(["10.00", "15.00", "20.00"], [50, 50, 50]),
    sellingPlanGroups,
  },
  {
    ...base(
      "test-unit-price",
      "Test unit price",
      "250g with a price per 100g.",
    ),
    ...single("22.00", 50, {
      unitPriceMeasurement: {
        quantityValue: 250,
        quantityUnit: "G",
        referenceValue: 100,
        referenceUnit: "G",
      },
      showUnitPrice: true,
    }),
  },
  {
    ...base(
      "test-two-options",
      "Test two options",
      "Size × Colour. M / Blue is sold out; L / Blue doesn't exist.",
    ),
    ...twoOptions(),
    // Search & Discovery's picks, by handle; the setup script sets them once every product exists.
    recommendations: {
      complementary: ["test-sale", "test-several-prices", "test-unit-price"],
      related: ["test-regular", "test-size-sold-out"],
    },
    // The standard review metafields that review apps fill in.
    metafields: [
      {
        namespace: "reviews",
        key: "rating",
        type: "rating",
        value: JSON.stringify({
          value: "4.5",
          scale_min: "1.0",
          scale_max: "5.0",
        }),
      },
      {
        namespace: "reviews",
        key: "rating_count",
        type: "number_integer",
        value: "126",
      },
    ],
  },
  {
    ...base(
      "test-gift-card",
      "Test gift card",
      "A gift card, for the recipient form.",
    ),
    giftCard: true,
    productOptions: [
      {
        name: "Denomination",
        values: ["$25", "$50"].map((name) => ({ name })),
      },
    ],
    variants: [
      ["$25", "25.00"],
      ["$50", "50.00"],
    ].map(([name, price]) => ({
      optionValues: [{ optionName: "Denomination", name }],
      price,
      inventoryItem: { tracked: false },
      inventoryQuantities: [],
    })),
  },
  {
    ...base(
      "test-video-first",
      "Test video first",
      "A video is the first media, so the card shows its preview image.",
    ),
    ...single("12.00", 50),
    files: [media.find((item) => item.contentType === "EXTERNAL_VIDEO")],
  },
  // Enough extra products that /collections/all runs to a second page (12 per page).
  ...[1, 2, 3, 4, 5].map((number) => ({
    ...base(
      `test-filler-${number}`,
      `Test filler ${number}`,
      "Fills the collection page.",
    ),
    ...single("5.00", 50),
  })),
];

// Automatic discounts for the cart: one on a product's lines, one on the order. Created by title.
export const discounts = [
  {
    title: "Test 10% off test-regular",
    products: ["test-regular"],
    value: { percentage: 0.1 },
  },
  {
    title: "Test $5 off orders over $100",
    minimumSubtotal: "100.00",
    value: { discountAmount: { amount: "5.00", appliesOnEachItem: false } },
  },
];

// Pages that use a page.<suffix>.json template. Created by handle.
export const pages = [
  {
    handle: "test-plain",
    title: "Test plain page",
    body: `<p>The default page template, with the text in one reading column.</p><h2>A heading</h2><p>Text under the heading, with a <a href="/collections/all">link to the store</a>.</p><ul><li>First point</li><li>Second point</li></ul><h3>A smaller heading</h3><p>${"Supercalifragilisticexpialidocious".repeat(3)}</p>`,
  },
  {
    handle: "test-about",
    title: "Test about",
    templateSuffix: "about",
    body: "<p>Test page for the About template.</p>",
  },
  {
    handle: "test-faq",
    title: "Test FAQ",
    templateSuffix: "faq",
    body: "<p>Test page for the FAQ template.</p>",
  },
  {
    handle: "test-contact",
    title: "Test contact",
    templateSuffix: "contact",
    body: "<p>Test page for the Contact template.</p>",
  },
  {
    handle: "test-compare",
    title: "Test compare",
    templateSuffix: "compare",
    body: "<p>Test page for the Compare template.</p>",
  },
  {
    handle: "test-reviews",
    title: "Test reviews",
    templateSuffix: "reviews",
    body: "<p>Test page for the Reviews template.</p>",
  },
];

// Collections, created by handle. The empty one tests the collection page's empty state, the smart
// one holds the filler products, and the twelve numbered ones push /collections to a second page.
export const collections = [
  {
    handle: "test-empty",
    title: "Test empty",
    descriptionHtml: "<p>Test collection with no products.</p>",
  },
  {
    handle: "test-fillers",
    title: "Test fillers",
    descriptionHtml: "<p>The filler products.</p>",
    ruleSet: {
      appliedDisjunctively: false,
      rules: [{ column: "TITLE", relation: "CONTAINS", condition: "filler" }],
    },
  },
  ...Array.from({ length: 12 }, (_, index) => ({
    handle: `test-collection-${index + 1}`,
    title: `Test collection ${index + 1}`,
  })),
];

// Articles go in the blog with the given handle, which the setup script creates when it's missing.
// Their wording avoids "test" in the fillers so the search tests, which look for it, aren't thrown off.
const MDN_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const LONG_WORD = "Supercalifragilisticexpialidocious".repeat(3);
const articleImage = (colour, size, text) => ({
  url: `https://placehold.co/${size}/${colour}/FFFFFF.png?text=${text}`,
  altText: `${text} article image`,
});
const filler = (number) => ({
  blog: "news",
  handle: `journal-entry-${number}`,
  title: `Journal entry ${number}`,
  author: "Test author",
  publishDate: `2026-10-${String(number).padStart(2, "0")}T09:00:00Z`,
  body: "<p>A short entry that fills the blog's list.</p>",
});
export const articles = [
  {
    blog: "news",
    handle: "test-article",
    title: "Test article",
    author: "Test author",
    summary: "<p>Test article for the search results.</p>",
    body: "<p>Test article for the search results, with a body that is longer than its summary.</p>",
  },
  {
    blog: "news",
    handle: "article-with-image",
    title: "An article with an image",
    author: "Test author",
    publishDate: "2026-11-10T09:00:00Z",
    tags: ["brewing", "guides"],
    image: articleImage("5F6B73", "1600x1000", "Landscape"),
    summary: "<p>A landscape picture, headings, a list and a quote.</p>",
    body: `<p>The opening paragraph, long enough to wrap onto a second line on a phone and to show the reading width on a desktop screen.</p><h2>A heading</h2><p>Text under the heading, with a <a href="/collections/all">link to the store</a>.</p><ul><li>First point</li><li>Second point</li><li>Third point</li></ul><blockquote><p>A quote, set apart from the text around it.</p></blockquote><h3>A smaller heading</h3><p>A closing paragraph.</p>`,
  },
  {
    blog: "news",
    handle: "article-with-video",
    title: "An article with a hosted video",
    author: "Test author",
    publishDate: "2026-11-09T09:00:00Z",
    image: articleImage("1E4FA8", "1200x1600", "Portrait"),
    summary: "<p>A portrait picture and a video inside the text.</p>",
    body: `<p>The video below sits in the article's text.</p><video controls width="1280" height="720" src="${MDN_VIDEO}"></video><p>A paragraph after the video.</p>`,
  },
  {
    blog: "news",
    handle: "article-with-youtube",
    title: "An article with an embedded video",
    author: "Test author",
    publishDate: "2026-11-08T09:00:00Z",
    image: articleImage("C62828", "1200x1200", "Square"),
    summary: "<p>A square picture and a YouTube video in the text.</p>",
    body: `<p>The embedded video below is Big Buck Bunny from the Blender Foundation.</p><iframe width="560" height="315" src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Big Buck Bunny" allowfullscreen></iframe><p>A paragraph after the video.</p>`,
  },
  {
    blog: "news",
    handle: "article-with-long-words",
    title: `A title with ${LONG_WORD} in it`,
    author: `Author${LONG_WORD}`,
    publishDate: "2026-11-07T09:00:00Z",
    summary: `<p>An excerpt with ${LONG_WORD} and more words after it.</p>`,
    body: `<p>${LONG_WORD}</p><p>${"A very long article body. ".repeat(60)}</p>`,
  },
  {
    blog: "news",
    handle: "article-without-excerpt",
    title: "An article without an excerpt or an image",
    author: "Test author",
    publishDate: "2026-11-06T09:00:00Z",
    body: "<p>No summary is set, so the list falls back to the start of this text, which is long enough to be cut short after twenty or so words, because a card must stay tidy.</p>",
  },
  ...Array.from({ length: 10 }, (_, index) => filler(index + 1)),
  {
    blog: "news",
    handle: "article-in-paragraphs",
    title: "An article in paragraphs",
    author: "Test author",
    publishDate: "2026-10-20T09:00:00Z",
    tags: ["Cold Brew"],
    body: "<p>First paragraph.</p>\n<p>Second paragraph.</p>\n<p>Third paragraph.</p>",
  },
];
