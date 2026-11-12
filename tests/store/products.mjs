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
    variants: combinations.map(([size, colour, price, quantity]) => ({
      optionValues: [
        { optionName: "Size", name: size },
        { optionName: "Colour", name: colour },
      ],
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
  },
];
