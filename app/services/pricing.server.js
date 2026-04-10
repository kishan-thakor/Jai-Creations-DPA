const SHOP_PRICING_NAMESPACE = "pricing";

// Product metafields (metal_type, weight, making_charges): must match admin definitions
// (e.g. custom.metal_type — Shopify default namespace for merchant-created definitions).
const PRODUCT_METAFIELD_NAMESPACE = "custom";

const SHOP_METAFIELD_KEYS = {
  goldRate: "gold_rate",
  silverRate: "silver_rate",
  gst: "gst",
};

const PRODUCTS_PAGE_SIZE = 50;
const UPDATE_BATCH_SIZE = 25;
const BATCH_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveNumber(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validatePricingInput(input) {
  const parsed = {
    goldRate: parsePositiveNumber(input.goldRate),
    silverRate: parsePositiveNumber(input.silverRate),
    gst: parsePositiveNumber(input.gst),
  };

  const errors = {};

  if (parsed.goldRate === null) {
    errors.goldRate = "Gold rate must be a number greater than 0.";
  }
  if (parsed.silverRate === null) {
    errors.silverRate = "Silver rate must be a number greater than 0.";
  }
  if (parsed.gst === null) {
    errors.gst = "GST must be a number greater than 0.";
  }

  return {
    values: parsed,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

export async function fetchShopPricingRates(admin) {
  const response = await admin.graphql(
    `#graphql
      query getShopPricingRates {
        shop {
          id
          goldRate: metafield(namespace: "pricing", key: "gold_rate") {
            value
          }
          silverRate: metafield(namespace: "pricing", key: "silver_rate") {
            value
          }
          gst: metafield(namespace: "pricing", key: "gst") {
            value
          }
        }
      }
    `,
  );

  const responseJson = await response.json();
  const shop = responseJson?.data?.shop;

  if (!shop?.id) {
    throw new Error("Unable to fetch shop details for pricing.");
  }

  return {
    shopId: shop.id,
    rates: {
      goldRate: shop.goldRate?.value ?? "",
      silverRate: shop.silverRate?.value ?? "",
      gst: shop.gst?.value ?? "",
    },
  };
}

export async function saveShopPricingRates(admin, rates) {
  const { shopId } = await fetchShopPricingRates(admin);

  // Assumption: these shop-level pricing values are stored as decimal metafields.
  const metafields = [
    {
      ownerId: shopId,
      namespace: SHOP_PRICING_NAMESPACE,
      key: SHOP_METAFIELD_KEYS.goldRate,
      type: "number_decimal",
      value: String(rates.goldRate),
    },
    {
      ownerId: shopId,
      namespace: SHOP_PRICING_NAMESPACE,
      key: SHOP_METAFIELD_KEYS.silverRate,
      type: "number_decimal",
      value: String(rates.silverRate),
    },
    {
      ownerId: shopId,
      namespace: SHOP_PRICING_NAMESPACE,
      key: SHOP_METAFIELD_KEYS.gst,
      type: "number_decimal",
      value: String(rates.gst),
    },
  ];

  const response = await admin.graphql(
    `#graphql
      mutation setPricingMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            namespace
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    { variables: { metafields } },
  );

  const responseJson = await response.json();
  const userErrors = responseJson?.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      `Failed to save pricing rates: ${userErrors
        .map((error) => error.message)
        .join(", ")}`,
    );
  }
}

function buildVariantUpdates(variantEdges, price) {
  const formattedPrice = price.toFixed(2);
  // Assumption: all variants under a product should share the same metal pricing outcome.
  return variantEdges.map((edge) => ({
    id: edge.node.id,
    price: formattedPrice,
  }));
}

function calculateFinalPrice({ metalType, weight, makingCharges, rates }) {
  const normalizedType = String(metalType || "").toLowerCase();
  const metalRate =
    normalizedType === "gold"
      ? rates.goldRate
      : normalizedType === "silver"
        ? rates.silverRate
        : null;

  if (!metalRate) {
    return null;
  }

  const subtotal = weight * metalRate + makingCharges;
  const finalPrice = subtotal + (subtotal * rates.gst) / 100;
  return roundToTwo(finalPrice);
}

async function fetchProductPage(admin, afterCursor) {
  const ns = PRODUCT_METAFIELD_NAMESPACE;
  const response = await admin.graphql(
    `#graphql
      query getProductsForPricing($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              title
              variants(first: 50) {
                edges {
                  node {
                    id
                  }
                }
              }
              metalType: metafield(namespace: "${ns}", key: "metal_type") {
                value
              }
              weight: metafield(namespace: "${ns}", key: "weight") {
                value
              }
              makingCharges: metafield(
                namespace: "${ns}"
                key: "making_charges"
              ) {
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    {
      variables: {
        first: PRODUCTS_PAGE_SIZE,
        after: afterCursor,
      },
    },
  );

  return response.json();
}

async function updateProductVariantsPrice(admin, productId, variantUpdates) {
  if (variantUpdates.length === 0) {
    return { success: false, reason: "NO_VARIANTS" };
  }

  const response = await admin.graphql(
    `#graphql
      mutation updateProductVariantPrices(
        $productId: ID!
        $variants: [ProductVariantsBulkInput!]!
      ) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          product {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        productId,
        variants: variantUpdates,
      },
    },
  );

  const responseJson = await response.json();
  const userErrors =
    responseJson?.data?.productVariantsBulkUpdate?.userErrors ?? [];

  if (userErrors.length > 0) {
    return {
      success: false,
      reason: userErrors.map((error) => error.message).join(", "),
    };
  }

  return { success: true };
}

export async function recalculateAllProductPrices(admin, rates) {
  const numericRates = {
    goldRate: Number(rates.goldRate),
    silverRate: Number(rates.silverRate),
    gst: Number(rates.gst),
  };

  let hasNextPage = true;
  let afterCursor = null;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  while (hasNextPage) {
    const pageResponse = await fetchProductPage(admin, afterCursor);
    const products = pageResponse?.data?.products;

    if (!products) {
      throw new Error("Failed to fetch products for pricing recalculation.");
    }

    const productEdges = products.edges ?? [];

    for (let index = 0; index < productEdges.length; index += UPDATE_BATCH_SIZE) {
      const batch = productEdges.slice(index, index + UPDATE_BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async ({ node }) => {
          processed += 1;

          const metalType = node.metalType?.value ?? "";
          const weight = Number(node.weight?.value);
          const makingCharges = Number(node.makingCharges?.value);

          if (
            !metalType ||
            !Number.isFinite(weight) ||
            weight <= 0 ||
            !Number.isFinite(makingCharges) ||
            makingCharges < 0
          ) {
            return { status: "skipped" };
          }

          const calculatedPrice = calculateFinalPrice({
            metalType,
            weight,
            makingCharges,
            rates: numericRates,
          });

          if (calculatedPrice === null) {
            return { status: "skipped" };
          }

          const variantUpdates = buildVariantUpdates(
            node.variants?.edges ?? [],
            calculatedPrice,
          );
          const updateResult = await updateProductVariantsPrice(
            admin,
            node.id,
            variantUpdates,
          );

          if (!updateResult.success) {
            return {
              status: "failed",
              message: `${node.title}: ${updateResult.reason}`,
            };
          }

          return { status: "updated" };
        }),
      );

      for (const result of batchResults) {
        if (result.status === "updated") {
          updated += 1;
        } else if (result.status === "skipped") {
          skipped += 1;
        } else {
          failed += 1;
          failures.push(result.message);
        }
      }

      await sleep(BATCH_DELAY_MS);
    }

    hasNextPage = Boolean(products.pageInfo?.hasNextPage);
    afterCursor = products.pageInfo?.endCursor ?? null;
  }

  return {
    processed,
    updated,
    skipped,
    failed,
    failures: failures.slice(0, 10),
  };
}
