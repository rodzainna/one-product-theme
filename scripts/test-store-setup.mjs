// Creates the missing products in tests/store/products.mjs on a test store; existing ones are kept.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { products } from "../tests/store/products.mjs";

const API_VERSION = "2026-10";
const store = process.argv[2];
if (!store) {
  console.error("Usage: pnpm test:store:setup <store>.myshopify.com");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "test-store-setup-"));
const resultFile = join(dir, "result.json");

const execute = (query, variables = {}, { mutation = false } = {}) => {
  const args = ["store", "execute", "-s", store, "--version", API_VERSION];
  args.push("-q", query, "-v", JSON.stringify(variables));
  args.push("--output-file", resultFile, "--no-input");
  if (mutation) args.push("--allow-mutations");
  rmSync(resultFile, { force: true });
  // On failure the CLI exits non-zero and explains why on stderr, printed below.
  execFileSync("shopify", args, { stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(readFileSync(resultFile, "utf8"));
};

const publish = (id, publicationId) => {
  const { publishablePublish } = execute(
    "mutation ($id: ID!, $publication: ID!) { publishablePublish(id: $id, input: [{ publicationId: $publication }]) { userErrors { message } } }",
    { id, publication: publicationId },
    { mutation: true },
  );
  if (publishablePublish.userErrors.length) {
    throw new Error(JSON.stringify(publishablePublish.userErrors));
  }
};

try {
  const { locations, publications } = execute(
    "{ locations(first: 50) { nodes { id fulfillsOnlineOrders } } publications(first: 50, catalogType: APP) { nodes { id catalog { ... on AppCatalog { apps(first: 1) { nodes { handle } } } } } } }",
  );
  const location = locations.nodes.find((l) => l.fulfillsOnlineOrders);
  if (!location) throw new Error("No location fulfils online orders.");
  const onlineStore = publications.nodes.find(
    (p) => p.catalog?.apps?.nodes[0]?.handle === "online_store",
  );
  if (!onlineStore) throw new Error("No Online Store sales channel found.");

  // One query for every handle, aliased p0, p1, …
  const existing = execute(
    `query ($publication: ID!) { ${products
      .map(
        (p, i) =>
          `p${i}: productByIdentifier(identifier: { handle: ${JSON.stringify(p.handle)} }) { id status publishedOnPublication(publicationId: $publication) }`,
      )
      .join(" ")} }`,
    { publication: onlineStore.id },
  );

  products.forEach((product, i) => {
    const found = existing[`p${i}`];
    if (found) {
      if (found.status !== "ACTIVE") {
        throw new Error(
          `${product.handle} exists but is ${found.status}; make it Active or delete it.`,
        );
      }
      if (!found.publishedOnPublication) publish(found.id, onlineStore.id);
      console.log(`kept     ${product.handle}`);
      return;
    }

    const input = {
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        inventoryQuantities: variant.inventoryQuantities.map((q) => ({
          ...q,
          locationId: location.id,
        })),
      })),
    };
    const { productSet } = execute(
      "mutation ($input: ProductSetInput!) { productSet(synchronous: true, input: $input) { product { id } userErrors { field message } } }",
      { input },
      { mutation: true },
    );
    if (productSet.userErrors.length) {
      throw new Error(
        `${product.handle}: ${JSON.stringify(productSet.userErrors)}`,
      );
    }
    publish(productSet.product.id, onlineStore.id);
    console.log(`created  ${product.handle}`);
  });
} catch (error) {
  const reason = String(error.stderr ?? "").trim();
  console.error(reason || error.message.split("\n")[0].slice(0, 200));
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
