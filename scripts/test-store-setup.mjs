// Creates the missing products, discounts, collections and pages from tests/store/products.mjs.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collections,
  discounts,
  pages,
  products,
} from "../tests/store/products.mjs";

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

// Shopify takes videos and 3D models only from its own storage, so copy them there first.
const STAGED = {
  VIDEO: ["VIDEO", "video/mp4"],
  MODEL_3D: ["MODEL_3D", "model/gltf-binary"],
};
const stage = async (file) => {
  if (!STAGED[file.contentType]) return file;
  const [resource, mimeType] = STAGED[file.contentType];
  const source = await fetch(file.originalSource);
  if (!source.ok) {
    throw new Error(
      `Download of ${file.originalSource} failed: ${source.status}`,
    );
  }
  const body = await source.blob();
  const filename = new URL(file.originalSource).pathname.split("/").pop();
  const { stagedUploadsCreate } = execute(
    "mutation ($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { message } } }",
    {
      input: [
        {
          filename,
          mimeType,
          resource,
          fileSize: String(body.size),
          httpMethod: "POST",
        },
      ],
    },
    { mutation: true },
  );
  if (stagedUploadsCreate.userErrors.length) {
    throw new Error(JSON.stringify(stagedUploadsCreate.userErrors));
  }
  const [target] = stagedUploadsCreate.stagedTargets;
  const form = new FormData();
  target.parameters.forEach(({ name, value }) => form.append(name, value));
  form.append("file", body, filename);
  const upload = await fetch(target.url, { method: "POST", body: form });
  if (!upload.ok)
    throw new Error(`Upload of ${filename} failed: ${upload.status}`);
  return { ...file, originalSource: target.resourceUrl };
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
  // The featured product tests need this home template; git ignores the copy so it never ships.
  const template = "templates/index.featured-test.json";
  if (existsSync(template)) {
    console.log(`kept     ${template}`);
  } else {
    copyFileSync("tests/store/fixtures/index.featured-test.json", template);
    console.log(`created  ${template}`);
  }

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
          `p${i}: productByIdentifier(identifier: { handle: ${JSON.stringify(p.handle)} }) { id status mediaCount { count } sellingPlanGroupsCount { count } metafields(first: 20) { nodes { namespace key } } publishedOnPublication(publicationId: $publication) }`,
      )
      .join(" ")} }`,
    { publication: onlineStore.id },
  );

  const ids = {};
  for (const [i, product] of products.entries()) {
    const found = existing[`p${i}`];
    if (found) ids[product.handle] = found.id;
    if (found) {
      if (found.status !== "ACTIVE") {
        throw new Error(
          `${product.handle} exists but is ${found.status}; make it Active or delete it.`,
        );
      }
      if (!found.publishedOnPublication) publish(found.id, onlineStore.id);
      const media = product.files?.length ?? 0;
      const groups = product.sellingPlanGroups?.length ?? 0;
      const missing = [
        found.mediaCount.count < media &&
          `${found.mediaCount.count} of ${media} media`,
        found.sellingPlanGroupsCount.count < groups &&
          `${found.sellingPlanGroupsCount.count} of ${groups} plan groups`,
        ...(product.metafields ?? [])
          .filter(
            ({ namespace, key }) =>
              !found.metafields.nodes.some(
                (m) => m.namespace === namespace && m.key === key,
              ),
          )
          .map(({ namespace, key }) => `no ${namespace}.${key} metafield`),
      ].filter(Boolean);
      const note = missing.length
        ? ` (has ${missing.join(", ")}; delete it and run again to add them)`
        : "";
      console.log(`kept     ${product.handle}${note}`);
      continue;
    }

    const {
      sellingPlanGroups = [],
      recommendations,
      ...productInput
    } = product;
    const input = {
      ...productInput,
      ...(product.files && {
        files: await Promise.all(product.files.map(stage)),
      }),
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
    for (const group of sellingPlanGroups) {
      const { sellingPlanGroupCreate } = execute(
        "mutation ($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput) { sellingPlanGroupCreate(input: $input, resources: $resources) { userErrors { message } } }",
        { input: group, resources: { productIds: [productSet.product.id] } },
        { mutation: true },
      );
      if (sellingPlanGroupCreate.userErrors.length) {
        throw new Error(JSON.stringify(sellingPlanGroupCreate.userErrors));
      }
    }
    publish(productSet.product.id, onlineStore.id);
    ids[product.handle] = productSet.product.id;
    console.log(`created  ${product.handle}`);
  }

  // Recommendations reference other products, so they go on once every product exists.
  const RECOMMENDATIONS = "shopify--discovery--product_recommendation";
  for (const [i, product] of products.entries()) {
    if (!product.recommendations) continue;
    const has = (key) =>
      existing[`p${i}`]?.metafields.nodes.some(
        (m) => m.namespace === RECOMMENDATIONS && m.key === key,
      );
    const metafields = Object.entries(product.recommendations)
      .filter(([intent]) => !has(`${intent}_products`))
      .map(([intent, handles]) => ({
        ownerId: ids[product.handle],
        namespace: RECOMMENDATIONS,
        key: `${intent}_products`,
        type: "list.product_reference",
        value: JSON.stringify(handles.map((handle) => ids[handle])),
      }));
    if (!metafields.length) continue;
    const { metafieldsSet } = execute(
      "mutation ($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }",
      { metafields },
      { mutation: true },
    );
    if (metafieldsSet.userErrors.length) {
      throw new Error(
        `${product.handle} recommendations: ${JSON.stringify(metafieldsSet.userErrors)} (is Search & Discovery installed?)`,
      );
    }
    console.log(`set      ${product.handle} recommendations`);
  }

  const { automaticDiscountNodes } = execute(
    "{ automaticDiscountNodes(first: 100) { nodes { automaticDiscount { ... on DiscountAutomaticBasic { title } } } } }",
  );
  const titles = automaticDiscountNodes.nodes.map(
    (n) => n.automaticDiscount.title,
  );
  for (const discount of discounts) {
    if (titles.includes(discount.title)) {
      console.log(`kept     ${discount.title}`);
      continue;
    }
    const items = discount.products
      ? { products: { productsToAdd: discount.products.map((h) => ids[h]) } }
      : { all: true };
    const { discountAutomaticBasicCreate } = execute(
      "mutation ($discount: DiscountAutomaticBasicInput!) { discountAutomaticBasicCreate(automaticBasicDiscount: $discount) { userErrors { message } } }",
      {
        discount: {
          title: discount.title,
          startsAt: "2026-01-01T00:00:00Z",
          customerGets: { value: discount.value, items },
          ...(discount.minimumSubtotal && {
            minimumRequirement: {
              subtotal: {
                greaterThanOrEqualToSubtotal: discount.minimumSubtotal,
              },
            },
          }),
          combinesWith: { productDiscounts: true, orderDiscounts: true },
        },
      },
      { mutation: true },
    );
    if (discountAutomaticBasicCreate.userErrors.length) {
      throw new Error(
        `${discount.title}: ${JSON.stringify(discountAutomaticBasicCreate.userErrors)}`,
      );
    }
    console.log(`created  ${discount.title}`);
  }

  for (const collection of collections) {
    const { collectionByIdentifier: found } = execute(
      "query ($handle: String!) { collectionByIdentifier(identifier: { handle: $handle }) { id } }",
      { handle: collection.handle },
    );
    if (found) {
      console.log(`kept     collection ${collection.handle}`);
      continue;
    }
    const { collectionCreate } = execute(
      "mutation ($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } userErrors { message } } }",
      { input: collection },
      { mutation: true },
    );
    if (collectionCreate.userErrors.length) {
      throw new Error(
        `${collection.handle}: ${JSON.stringify(collectionCreate.userErrors)}`,
      );
    }
    publish(collectionCreate.collection.id, onlineStore.id);
    console.log(`created  collection ${collection.handle}`);
  }

  for (const page of pages) {
    const { pages: found } = execute(
      "query ($query: String!) { pages(first: 1, query: $query) { nodes { id } } }",
      { query: `handle:${page.handle}` },
    );
    if (found.nodes.length) {
      console.log(`kept     page ${page.handle}`);
      continue;
    }
    const { pageCreate } = execute(
      "mutation ($page: PageCreateInput!) { pageCreate(page: $page) { userErrors { message } } }",
      {
        page: {
          handle: page.handle,
          title: page.title,
          body: page.body,
          templateSuffix: page.templateSuffix,
          isPublished: true,
        },
      },
      { mutation: true },
    );
    if (pageCreate.userErrors.length) {
      throw new Error(
        `${page.handle}: ${JSON.stringify(pageCreate.userErrors)}`,
      );
    }
    console.log(`created  page ${page.handle}`);
  }
} catch (error) {
  const reason = String(error.stderr ?? "").trim();
  console.error(reason || error.message.split("\n")[0].slice(0, 200));
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
