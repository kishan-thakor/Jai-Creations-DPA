import { createPricingRequestId } from "../utils/pricingRequestId.js";

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

/** @param {string} requestId */
export function trace(requestId, tag, message, data) {
  const payload =
    data !== undefined
      ? { requestId, message, ...data }
      : { requestId, message };
  console.log(`[${tag}]`, JSON.stringify(payload));
}

/** @param {string} requestId */
export function traceError(requestId, message, data) {
  trace(requestId, "ERROR", message, data);
}

export { createPricingRequestId };

/** @param {string} requestId */
function logShopMetafields(requestId, payload) {
  console.log("[SHOP_METAFIELDS]", JSON.stringify({ requestId, ...payload }));
}

/**
 * @param {string} requestId
 * @param {string} skipReason
 * @param {Record<string, unknown>} detail
 */
function logSkip(requestId, skipReason, detail) {
  console.log(
    "[SKIP]",
    JSON.stringify({
      requestId,
      skipReason,
      metafieldNamespace: PRODUCT_METAFIELD_NAMESPACE,
      ...detail,
    }),
  );
}

/** @param {{ metalType?: { value?: string } | null, weight?: { value?: string } | null, makingCharges?: { value?: string } | null }} variantNode */
function variantMetafieldsFromShopify(variantNode) {
  return {
    metal_type: variantNode.metalType?.value ?? null,
    weight: variantNode.weight?.value ?? null,
    making_charges: variantNode.makingCharges?.value ?? null,
  };
}

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

export async function saveShopPricingRates(admin, rates, options = {}) {
  const requestId = options.requestId ?? createPricingRequestId();

  const { shopId, rates: existingRates } = await fetchShopPricingRates(admin);

  const beforeSave = {
    gold_rate: existingRates.goldRate === "" ? null : existingRates.goldRate,
    silver_rate: existingRates.silverRate === "" ? null : existingRates.silverRate,
    gst: existingRates.gst === "" ? null : existingRates.gst,
  };

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
    console.error(
      "[SHOP_METAFIELDS]",
      JSON.stringify({
        requestId,
        error: "metafieldsSet failed",
        userErrors,
        responseJson,
      }),
    );
    throw new Error(
      `Failed to save pricing rates: ${userErrors
        .map((error) => error.message)
        .join(", ")}`,
    );
  }

  const savedMetafields =
    responseJson?.data?.metafieldsSet?.metafields ?? [];

  logShopMetafields(requestId, {
    shopMetafieldNamespace: SHOP_PRICING_NAMESPACE,
    beforeSaveFromShopify: beforeSave,
    afterSaveWritten: {
      gold_rate: rates.goldRate,
      silver_rate: rates.silverRate,
      gst: rates.gst,
    },
    shopifyReturnedMetafields: savedMetafields,
  });
}

function getPriceBreakdown({ metalType, weight, makingCharges, rates }) {
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
  const finalPrice = roundToTwo(subtotal + (subtotal * rates.gst) / 100);
  const formula = `final = round(subtotal + subtotal * gst/100, 2) where subtotal = weight * metalRate + makingCharges`;
  const formulaWithValues = `subtotal=${weight}*${metalRate}+${makingCharges}=${subtotal}; final=round(${subtotal}+${subtotal}*${rates.gst}/100,2)=${finalPrice}`;
  return {
    normalizedType,
    metalRate,
    subtotal,
    finalPrice,
    formula,
    formulaWithValues,
  };
}

function calculateFinalPrice({ metalType, weight, makingCharges, rates }) {
  const breakdown = getPriceBreakdown({
    metalType,
    weight,
    makingCharges,
    rates,
  });
  return breakdown ? breakdown.finalPrice : null;
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
              handle
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
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

async function updateProductVariantsPrice(
  admin,
  productId,
  variantUpdates,
  requestId,
) {
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
    console.error(
      "[PRICING_UPDATE_FAILED]",
      JSON.stringify({
        requestId,
        productId,
        userErrors,
        responseJson,
      }),
    );
    return {
      success: false,
      reason: userErrors.map((error) => error.message).join(", "),
      responseJson,
    };
  }

  return { success: true };
}

export async function recalculateAllProductPrices(admin, rates, options = {}) {
  const requestId = options.requestId ?? createPricingRequestId();

  const numericRates = {
    goldRate: Number(rates.goldRate),
    silverRate: Number(rates.silverRate),
    gst: Number(rates.gst),
  };

  if (
    !Number.isFinite(numericRates.goldRate) ||
    !Number.isFinite(numericRates.silverRate) ||
    !Number.isFinite(numericRates.gst)
  ) {
    console.error(
      "[SKIP]",
      JSON.stringify({
        requestId,
        skipReason: "INVALID_SHOP_RATES",
        whySkipped:
          "Gold, silver, or GST from the form could not be read as finite numbers.",
        parsedRates: numericRates,
      }),
    );
    throw new Error("Invalid pricing rates for recalculation.");
  }

  let hasNextPage = true;
  let afterCursor = null;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];
  let pageIndex = 0;

  const productFromShopify = (node) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
  });

  try {
    while (hasNextPage) {
      const pageResponse = await fetchProductPage(admin, afterCursor);
      const products = pageResponse?.data?.products;

      if (!products) {
        console.error(
          "[SKIP]",
          JSON.stringify({
            requestId,
            skipReason: "PRODUCTS_QUERY_FAILED",
            whySkipped:
              "Shopify did not return products data (see responseJson).",
            pageIndex,
            afterCursor,
            responseJson: pageResponse,
          }),
        );
        throw new Error("Failed to fetch products for pricing recalculation.");
      }

      const productEdges = products.edges ?? [];

      if (productEdges.length === 0 && pageIndex === 0) {
        console.log(
          "[SKIP]",
          JSON.stringify({
            requestId,
            skipReason: "NO_PRODUCTS_IN_CATALOG",
            whySkipped: "Shopify returned zero products on the first page.",
          }),
        );
      }

      for (
        let index = 0;
        index < productEdges.length;
        index += UPDATE_BATCH_SIZE
      ) {
        const batch = productEdges.slice(index, index + UPDATE_BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async ({ node }) => {
            processed += 1;

            const variantEdges = node.variants?.edges ?? [];
            const variantUpdates = [];

            if (variantEdges.length === 0) {
              logSkip(requestId, "PRODUCT_HAS_NO_VARIANTS", {
                productFromShopify: productFromShopify(node),
                whySkipped:
                  "Product has no variants in Shopify; nothing to price.",
              });
              return { status: "skipped" };
            }

            for (const edge of variantEdges) {
              const variantNode = edge.node;
              const metalType = variantNode.metalType?.value ?? "";
              const weight = Number(variantNode.weight?.value);
              const makingCharges = Number(variantNode.makingCharges?.value);
              const metafieldsFromShopify =
                variantMetafieldsFromShopify(variantNode);

              if (!metalType) {
                logSkip(requestId, "VARIANT_SKIPPED_NO_METAL_TYPE", {
                  productFromShopify: productFromShopify(node),
                  variantFromShopify: {
                    id: variantNode.id,
                    title: variantNode.title ?? "",
                  },
                  metafieldsFromShopify,
                  whySkipped:
                    "custom.metal_type is missing or empty. Expected a value (e.g. gold or silver).",
                });
                continue;
              }

              if (!Number.isFinite(weight) || weight <= 0) {
                logSkip(requestId, "VARIANT_SKIPPED_INVALID_WEIGHT", {
                  productFromShopify: productFromShopify(node),
                  variantFromShopify: {
                    id: variantNode.id,
                    title: variantNode.title ?? "",
                  },
                  metafieldsFromShopify,
                  parsedWeight: weight,
                  whySkipped:
                    "custom.weight must be a positive number; value was missing, non-numeric, or <= 0.",
                });
                continue;
              }

              if (!Number.isFinite(makingCharges) || makingCharges < 0) {
                logSkip(requestId, "VARIANT_SKIPPED_INVALID_MAKING_CHARGES", {
                  productFromShopify: productFromShopify(node),
                  variantFromShopify: {
                    id: variantNode.id,
                    title: variantNode.title ?? "",
                  },
                  metafieldsFromShopify,
                  parsedMakingCharges: makingCharges,
                  whySkipped:
                    "custom.making_charges must be a number >= 0 (use 0 if none); value was missing, non-numeric, or negative.",
                });
                continue;
              }

              const calculatedPrice = calculateFinalPrice({
                metalType,
                weight,
                makingCharges,
                rates: numericRates,
              });

              if (calculatedPrice === null) {
                logSkip(requestId, "VARIANT_SKIPPED_METAL_TYPE_NOT_GOLD_OR_SILVER", {
                  productFromShopify: productFromShopify(node),
                  variantFromShopify: {
                    id: variantNode.id,
                    title: variantNode.title ?? "",
                  },
                  metafieldsFromShopify,
                  metalTypeRaw: metalType,
                  normalizedMetalType: String(metalType || "").toLowerCase(),
                  whySkipped:
                    'metal_type must normalize to "gold" or "silver" (case-insensitive).',
                });
                continue;
              }

              variantUpdates.push({
                id: variantNode.id,
                price: calculatedPrice.toFixed(2),
              });
            }

            if (variantUpdates.length === 0) {
              return { status: "skipped" };
            }

            const updateResult = await updateProductVariantsPrice(
              admin,
              node.id,
              variantUpdates,
              requestId,
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
      pageIndex += 1;
    }

    return {
      processed,
      updated,
      skipped,
      failed,
      failures: failures.slice(0, 10),
      requestId,
    };
  } catch (error) {
    console.error(
      "[PRICING]",
      JSON.stringify({
        requestId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
    throw error;
  }
}
