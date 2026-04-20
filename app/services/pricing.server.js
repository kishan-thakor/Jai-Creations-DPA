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
const DEBUG_PRICING = process.env.DEBUG_PRICING === "true";

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

function pricingLog(label, data) {
  if (!DEBUG_PRICING) return;
  console.log(`[pricing] ${label}`, JSON.stringify(data, null, 2));
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

export async function fetchShopPricingRates(admin, options = {}) {
  const requestId = options.requestId;
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
  if (requestId) {
    logGraphqlErrors(requestId, "fetchShopPricingRates", responseJson);
  }

  const shop = responseJson?.data?.shop;

  if (!shop?.id) {
    if (requestId) {
      traceError(requestId, "Unable to fetch shop details for pricing", {
        step: "fetchShopPricingRates",
        responseJson,
      });
    }
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

/**
 * @param {string} requestId
 * @param {unknown} responseJson
 */
function logGraphqlErrors(requestId, context, responseJson) {
  const errors = responseJson?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    traceError(requestId, `GraphQL errors (${context})`, {
      step: context,
      errors,
    });
  }
}

export async function saveShopPricingRates(admin, rates, options = {}) {
  const requestId = options.requestId ?? createPricingRequestId();

  trace(requestId, "DATA", "saveShopPricingRates: fetching shop pricing metafields", {
    source: "Shopify Admin GraphQL (shop metafields, namespace pricing)",
  });

  const { shopId, rates: existingRates } = await fetchShopPricingRates(admin, {
    requestId,
  });

  const fetched = {
    goldRate: existingRates.goldRate === "" ? null : existingRates.goldRate,
    silverRate: existingRates.silverRate === "" ? null : existingRates.silverRate,
    gst: existingRates.gst === "" ? null : existingRates.gst,
  };
  trace(requestId, "DATA", "Fetched existing shop rate metafields (before save)", {
    fetched,
  });
  if (
    fetched.goldRate == null &&
    fetched.silverRate == null &&
    fetched.gst == null
  ) {
    trace(
      requestId,
      "DATA",
      "NOTE: all pricing metafields were empty on shop (first save or unset)",
      {},
    );
  }

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

  trace(requestId, "DATA", "Writing validated rates to shop metafields (metafieldsSet)", {
    payload: {
      goldRate: rates.goldRate,
      silverRate: rates.silverRate,
      gst: rates.gst,
    },
  });

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
  logGraphqlErrors(requestId, "metafieldsSet", responseJson);

  const userErrors = responseJson?.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    traceError(requestId, "saveShopPricingRates: metafieldsSet userErrors", {
      step: "saveShopPricingRates",
      userErrors,
      responseJson,
    });
    throw new Error(
      `Failed to save pricing rates: ${userErrors
        .map((error) => error.message)
        .join(", ")}`,
    );
  }

  trace(requestId, "DATA", "Shop pricing metafields saved successfully", {
    metafields: responseJson?.data?.metafieldsSet?.metafields ?? [],
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

  trace(requestId, "UPDATE", "productVariantsBulkUpdate (request)", {
    productId,
    variantUpdates: variantUpdates.map((v) => ({ id: v.id, price: v.price })),
  });

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
  logGraphqlErrors(requestId, "productVariantsBulkUpdate", responseJson);

  const userErrors =
    responseJson?.data?.productVariantsBulkUpdate?.userErrors ?? [];

  if (userErrors.length > 0) {
    traceError(requestId, "productVariantsBulkUpdate failed", {
      step: "updateProductVariantsPrice",
      productId,
      userErrors,
      responseJson,
    });
    return {
      success: false,
      reason: userErrors.map((error) => error.message).join(", "),
      responseJson,
    };
  }

  trace(requestId, "UPDATE", "productVariantsBulkUpdate (success)", {
    productId,
    returnedProductId:
      responseJson?.data?.productVariantsBulkUpdate?.product?.id ?? null,
  });

  return { success: true };
}

export async function recalculateAllProductPrices(admin, rates, options = {}) {
  const requestId = options.requestId ?? createPricingRequestId();

  const numericRates = {
    goldRate: Number(rates.goldRate),
    silverRate: Number(rates.silverRate),
    gst: Number(rates.gst),
  };

  trace(requestId, "DATA", "Recalculation rates source: validated request payload (not re-read from metafields)", {
    goldRate: numericRates.goldRate,
    silverRate: numericRates.silverRate,
    gst: numericRates.gst,
  });

  if (
    !Number.isFinite(numericRates.goldRate) ||
    !Number.isFinite(numericRates.silverRate) ||
    !Number.isFinite(numericRates.gst)
  ) {
    traceError(requestId, "Invalid numeric rates after coercion", {
      step: "recalculateAllProductPrices",
      numericRates,
    });
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

  try {
    while (hasNextPage) {
      const pageResponse = await fetchProductPage(admin, afterCursor);
      logGraphqlErrors(requestId, `fetchProductPage page ${pageIndex}`, pageResponse);

      const products = pageResponse?.data?.products;

      if (!products) {
        traceError(requestId, "Failed to fetch products for pricing recalculation", {
          step: "fetchProductPage",
          pageIndex,
          afterCursor,
          responseJson: pageResponse,
        });
        throw new Error("Failed to fetch products for pricing recalculation.");
      }

      const productEdges = products.edges ?? [];

      trace(requestId, "PRODUCT", "Product page fetched", {
        pageIndex,
        countOnPage: productEdges.length,
        hasNextPage: Boolean(products.pageInfo?.hasNextPage),
        sample: productEdges.slice(0, 5).map(({ node }) => ({
          id: node.id,
          handle: node.handle,
          title: node.title,
        })),
      });

      if (productEdges.length === 0 && pageIndex === 0) {
        traceError(requestId, "No products returned from Shopify", {
          step: "fetchProductPage",
        });
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

            pricingLog("product_input", {
              productId: node.id,
              title: node.title,
              variantCount: node.variants?.edges?.length ?? 0,
              rates: numericRates,
            });

            trace(requestId, "PRODUCT", "Processing product", {
              productId: node.id,
              title: node.title,
              handle: node.handle,
              variantCount: node.variants?.edges?.length ?? 0,
            });

            const variantEdges = node.variants?.edges ?? [];
            const variantUpdates = [];

            for (const edge of variantEdges) {
              const variantNode = edge.node;
              const metalType = variantNode.metalType?.value ?? "";
              const weight = Number(variantNode.weight?.value);
              const makingCharges = Number(variantNode.makingCharges?.value);

              pricingLog("variant_input", {
                productId: node.id,
                productTitle: node.title,
                variantId: variantNode.id,
                variantTitle: variantNode.title ?? "",
                raw: {
                  metalType: variantNode.metalType?.value ?? null,
                  weight: variantNode.weight?.value ?? null,
                  makingCharges: variantNode.makingCharges?.value ?? null,
                },
                parsed: {
                  metalType,
                  weight,
                  makingCharges,
                },
              });

              if (!metalType) {
                trace(requestId, "CALCULATION", "Skipped: No metal type", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                });
                pricingLog("skip_variant_missing_metal_type", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? "",
                });
                continue;
              }

              if (!Number.isFinite(weight) || weight <= 0) {
                trace(requestId, "CALCULATION", "Skipped: Missing weight", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  rawWeight: variantNode.weight?.value ?? null,
                  parsedWeight: weight,
                });
                pricingLog("skip_variant_invalid_weight", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? "",
                  rawWeight: variantNode.weight?.value ?? null,
                  parsedWeight: weight,
                });
                continue;
              }

              if (!Number.isFinite(makingCharges) || makingCharges < 0) {
                trace(requestId, "CALCULATION", "Skipped: Invalid metafield", {
                  reason: "making_charges invalid or negative",
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  rawMakingCharges: variantNode.makingCharges?.value ?? null,
                });
                pricingLog("skip_variant_invalid_making_charges", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? "",
                  rawMakingCharges: variantNode.makingCharges?.value ?? null,
                  parsedMakingCharges: makingCharges,
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
                trace(requestId, "CALCULATION", "Skipped: Invalid metafield", {
                  detail: "metal_type must be gold or silver",
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  metalType,
                });
                pricingLog("skip_variant_unknown_metal_type", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? "",
                  metalType,
                  normalizedType: String(metalType || "").toLowerCase(),
                  expected: ["gold", "silver"],
                });
                continue;
              }

              const breakdown = getPriceBreakdown({
                metalType,
                weight,
                makingCharges,
                rates: numericRates,
              });

              trace(requestId, "CALCULATION", "Variant priced", {
                productId: node.id,
                productTitle: node.title,
                variantId: variantNode.id,
                baseSubtotal: breakdown?.subtotal,
                appliedFormula: breakdown?.formula,
                formulaWithValues: breakdown?.formulaWithValues,
                newPrice: calculatedPrice,
              });

              variantUpdates.push({
                id: variantNode.id,
                price: calculatedPrice.toFixed(2),
              });
            }

            if (variantUpdates.length === 0) {
              trace(requestId, "CALCULATION", "Skipped: No valid variants for product", {
                productId: node.id,
                productTitle: node.title,
                variantCount: variantEdges.length,
              });
              pricingLog("skip_product_no_valid_variants", {
                productId: node.id,
                productTitle: node.title,
                variantCount: variantEdges.length,
              });
              return { status: "skipped" };
            }

            const updateResult = await updateProductVariantsPrice(
              admin,
              node.id,
              variantUpdates,
              requestId,
            );

            if (!updateResult.success) {
              pricingLog("update_failed", {
                productId: node.id,
                title: node.title,
                reason: updateResult.reason,
              });
              return {
                status: "failed",
                message: `${node.title}: ${updateResult.reason}`,
              };
            }

            pricingLog("updated", {
              productId: node.id,
              title: node.title,
              variantCount: variantUpdates.length,
            });

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

    console.log(`[SUMMARY] requestId=${requestId}`);
    console.log(
      `Processed: ${processed}\nUpdated: ${updated}\nSkipped: ${skipped}\nFailed: ${failed}`,
    );
    trace(requestId, "SUMMARY", "Recalculation complete", {
      processed,
      updated,
      skipped,
      failed,
    });

    return {
      processed,
      updated,
      skipped,
      failed,
      failures: failures.slice(0, 10),
      requestId,
    };
  } catch (error) {
    traceError(requestId, "recalculateAllProductPrices threw", {
      step: "recalculateAllProductPrices",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
