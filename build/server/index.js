var _a;
import { jsx, jsxs } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, UNSAFE_withComponentProps, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, redirect, UNSAFE_withErrorBoundaryProps, useRouteError, useNavigation, useFetcher } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import "dotenv/config";
import "@shopify/shopify-app-react-router/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.October25;
const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, reactRouterContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        ServerRouter,
        {
          context: reactRouterContext,
          url: request.url
        }
      ),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width,initial-scale=1"
      }), /* @__PURE__ */ jsx("link", {
        rel: "preconnect",
        href: "https://cdn.shopify.com/"
      }), /* @__PURE__ */ jsx("link", {
        rel: "stylesheet",
        href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
const action$4 = async ({
  request
}) => {
  const {
    payload,
    session,
    topic,
    shop
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4
}, Symbol.toStringTag, { value: "Module" }));
const action$3 = async ({
  request
}) => {
  const {
    shop,
    session,
    topic
  } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.deleteMany({
      where: {
        shop
      }
    });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const loader$5 = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const action$2 = async ({
  request
}) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
const route$1 = UNSAFE_withComponentProps(function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const {
    errors
  } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, {
    embedded: false,
    children: /* @__PURE__ */ jsx("s-page", {
      children: /* @__PURE__ */ jsx(Form, {
        method: "post",
        children: /* @__PURE__ */ jsxs("s-section", {
          heading: "Log in",
          children: [/* @__PURE__ */ jsx("s-text-field", {
            name: "shop",
            label: "Shop domain",
            details: "example.myshopify.com",
            value: shop,
            onChange: (e) => setShop(e.currentTarget.value),
            autocomplete: "on",
            error: errors.shop
          }), /* @__PURE__ */ jsx("s-button", {
            type: "submit",
            children: "Log in"
          })]
        })
      })
    })
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: route$1,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_12o3y_1";
const heading = "_heading_12o3y_11";
const text = "_text_12o3y_12";
const content = "_content_12o3y_22";
const form = "_form_12o3y_27";
const label = "_label_12o3y_35";
const input = "_input_12o3y_43";
const button = "_button_12o3y_47";
const list = "_list_12o3y_51";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$4 = async ({
  request
}) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return {
    showForm: Boolean(login)
  };
};
const route = UNSAFE_withComponentProps(function App2() {
  const {
    showForm
  } = useLoaderData();
  return /* @__PURE__ */ jsx("div", {
    className: styles.index,
    children: /* @__PURE__ */ jsxs("div", {
      className: styles.content,
      children: [/* @__PURE__ */ jsx("h1", {
        className: styles.heading,
        children: "A short heading about [your app]"
      }), /* @__PURE__ */ jsx("p", {
        className: styles.text,
        children: "A tagline about [your app] that describes your value proposition."
      }), showForm && /* @__PURE__ */ jsxs(Form, {
        className: styles.form,
        method: "post",
        action: "/auth/login",
        children: [/* @__PURE__ */ jsxs("label", {
          className: styles.label,
          children: [/* @__PURE__ */ jsx("span", {
            children: "Shop domain"
          }), /* @__PURE__ */ jsx("input", {
            className: styles.input,
            type: "text",
            name: "shop"
          }), /* @__PURE__ */ jsx("span", {
            children: "e.g: my-shop-domain.myshopify.com"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: styles.button,
          type: "submit",
          children: "Log in"
        })]
      }), /* @__PURE__ */ jsxs("ul", {
        className: styles.list,
        children: [/* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        }), /* @__PURE__ */ jsxs("li", {
          children: [/* @__PURE__ */ jsx("strong", {
            children: "Product feature"
          }), ". Some detail about your feature and its benefit to your customer."]
        })]
      })]
    })
  });
});
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: route,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const loader$3 = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const headers$2 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$2,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async ({
  request
}) => {
  await authenticate.admin(request);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || ""
  };
};
const app = UNSAFE_withComponentProps(function App3() {
  const {
    apiKey
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider, {
    embedded: true,
    apiKey,
    children: [/* @__PURE__ */ jsx("s-app-nav", {
      children: /* @__PURE__ */ jsx("s-link", {
        href: "/app/pricing",
        children: "Home"
      })
    }), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  return boundary.error(useRouteError());
});
const headers$1 = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: app,
  headers: headers$1,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const app_additional = UNSAFE_withComponentProps(function AdditionalPage() {
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "Additional page",
    children: [/* @__PURE__ */ jsxs("s-section", {
      heading: "Multiple pages",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: ["The app template comes with an additional page which demonstrates how to create multiple pages within app navigation using", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/tools/app-bridge",
          target: "_blank",
          children: "App Bridge"
        }), "."]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: ["To create your own page and have it show up in the app navigation, add a page inside ", /* @__PURE__ */ jsx("code", {
          children: "app/routes"
        }), ", and a link to it in the", " ", /* @__PURE__ */ jsx("code", {
          children: "<ui-nav-menu>"
        }), " component found in", " ", /* @__PURE__ */ jsx("code", {
          children: "app/routes/app.jsx"
        }), "."]
      })]
    }), /* @__PURE__ */ jsx("s-section", {
      slot: "aside",
      heading: "Resources",
      children: /* @__PURE__ */ jsx("s-unordered-list", {
        children: /* @__PURE__ */ jsx("s-list-item", {
          children: /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav",
            target: "_blank",
            children: "App nav best practices"
          })
        })
      })
    })]
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: app_additional
}, Symbol.toStringTag, { value: "Module" }));
function createPricingRequestId() {
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const suffix = String(Math.floor(Math.random() * 900) + 100);
  return `pricing-${date}-${suffix}`;
}
const SHOP_PRICING_NAMESPACE = "pricing";
const PRODUCT_METAFIELD_NAMESPACE = "custom";
const SHOP_METAFIELD_KEYS = {
  goldRate: "gold_rate",
  silverRate: "silver_rate",
  gst: "gst"
};
const PRODUCTS_PAGE_SIZE = 50;
const UPDATE_BATCH_SIZE = 25;
const BATCH_DELAY_MS = 250;
const DEBUG_PRICING = process.env.DEBUG_PRICING === "true";
function trace(requestId, tag, message, data) {
  const payload = data !== void 0 ? { requestId, message, ...data } : { requestId, message };
  console.log(`[${tag}]`, JSON.stringify(payload));
}
function traceError(requestId, message, data) {
  trace(requestId, "ERROR", message, data);
}
function pricingLog(label2, data) {
  if (!DEBUG_PRICING) return;
  console.log(`[pricing] ${label2}`, JSON.stringify(data, null, 2));
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
function validatePricingInput(input2) {
  const parsed = {
    goldRate: parsePositiveNumber(input2.goldRate),
    silverRate: parsePositiveNumber(input2.silverRate),
    gst: parsePositiveNumber(input2.gst)
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
    isValid: Object.keys(errors).length === 0
  };
}
async function fetchShopPricingRates(admin, options = {}) {
  var _a2, _b, _c, _d;
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
    `
  );
  const responseJson = await response.json();
  if (requestId) {
    logGraphqlErrors(requestId, "fetchShopPricingRates", responseJson);
  }
  const shop = (_a2 = responseJson == null ? void 0 : responseJson.data) == null ? void 0 : _a2.shop;
  if (!(shop == null ? void 0 : shop.id)) {
    if (requestId) {
      traceError(requestId, "Unable to fetch shop details for pricing", {
        step: "fetchShopPricingRates",
        responseJson
      });
    }
    throw new Error("Unable to fetch shop details for pricing.");
  }
  return {
    shopId: shop.id,
    rates: {
      goldRate: ((_b = shop.goldRate) == null ? void 0 : _b.value) ?? "",
      silverRate: ((_c = shop.silverRate) == null ? void 0 : _c.value) ?? "",
      gst: ((_d = shop.gst) == null ? void 0 : _d.value) ?? ""
    }
  };
}
function logGraphqlErrors(requestId, context, responseJson) {
  const errors = responseJson == null ? void 0 : responseJson.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    traceError(requestId, `GraphQL errors (${context})`, {
      step: context,
      errors
    });
  }
}
async function saveShopPricingRates(admin, rates, options = {}) {
  var _a2, _b, _c, _d;
  const requestId = options.requestId ?? createPricingRequestId();
  trace(requestId, "DATA", "saveShopPricingRates: fetching shop pricing metafields", {
    source: "Shopify Admin GraphQL (shop metafields, namespace pricing)"
  });
  const { shopId, rates: existingRates } = await fetchShopPricingRates(admin, {
    requestId
  });
  const fetched = {
    goldRate: existingRates.goldRate === "" ? null : existingRates.goldRate,
    silverRate: existingRates.silverRate === "" ? null : existingRates.silverRate,
    gst: existingRates.gst === "" ? null : existingRates.gst
  };
  trace(requestId, "DATA", "Fetched existing shop rate metafields (before save)", {
    fetched
  });
  if (fetched.goldRate == null && fetched.silverRate == null && fetched.gst == null) {
    trace(
      requestId,
      "DATA",
      "NOTE: all pricing metafields were empty on shop (first save or unset)",
      {}
    );
  }
  const metafields = [
    {
      ownerId: shopId,
      namespace: SHOP_PRICING_NAMESPACE,
      key: SHOP_METAFIELD_KEYS.goldRate,
      type: "number_decimal",
      value: String(rates.goldRate)
    },
    {
      ownerId: shopId,
      namespace: SHOP_PRICING_NAMESPACE,
      key: SHOP_METAFIELD_KEYS.silverRate,
      type: "number_decimal",
      value: String(rates.silverRate)
    },
    {
      ownerId: shopId,
      namespace: SHOP_PRICING_NAMESPACE,
      key: SHOP_METAFIELD_KEYS.gst,
      type: "number_decimal",
      value: String(rates.gst)
    }
  ];
  trace(requestId, "DATA", "Writing validated rates to shop metafields (metafieldsSet)", {
    payload: {
      goldRate: rates.goldRate,
      silverRate: rates.silverRate,
      gst: rates.gst
    }
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
    { variables: { metafields } }
  );
  const responseJson = await response.json();
  logGraphqlErrors(requestId, "metafieldsSet", responseJson);
  const userErrors = ((_b = (_a2 = responseJson == null ? void 0 : responseJson.data) == null ? void 0 : _a2.metafieldsSet) == null ? void 0 : _b.userErrors) ?? [];
  if (userErrors.length > 0) {
    traceError(requestId, "saveShopPricingRates: metafieldsSet userErrors", {
      step: "saveShopPricingRates",
      userErrors,
      responseJson
    });
    throw new Error(
      `Failed to save pricing rates: ${userErrors.map((error) => error.message).join(", ")}`
    );
  }
  trace(requestId, "DATA", "Shop pricing metafields saved successfully", {
    metafields: ((_d = (_c = responseJson == null ? void 0 : responseJson.data) == null ? void 0 : _c.metafieldsSet) == null ? void 0 : _d.metafields) ?? []
  });
}
function getPriceBreakdown({ metalType, weight, makingCharges, rates }) {
  const normalizedType = String(metalType || "").toLowerCase();
  const metalRate = normalizedType === "gold" ? rates.goldRate : normalizedType === "silver" ? rates.silverRate : null;
  if (!metalRate) {
    return null;
  }
  const subtotal = weight * metalRate + makingCharges;
  const finalPrice = roundToTwo(subtotal + subtotal * rates.gst / 100);
  const formula = `final = round(subtotal + subtotal * gst/100, 2) where subtotal = weight * metalRate + makingCharges`;
  const formulaWithValues = `subtotal=${weight}*${metalRate}+${makingCharges}=${subtotal}; final=round(${subtotal}+${subtotal}*${rates.gst}/100,2)=${finalPrice}`;
  return {
    normalizedType,
    metalRate,
    subtotal,
    finalPrice,
    formula,
    formulaWithValues
  };
}
function calculateFinalPrice({ metalType, weight, makingCharges, rates }) {
  const breakdown = getPriceBreakdown({
    metalType,
    weight,
    makingCharges,
    rates
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
        after: afterCursor
      }
    }
  );
  return response.json();
}
async function updateProductVariantsPrice(admin, productId, variantUpdates, requestId) {
  var _a2, _b, _c, _d, _e;
  if (variantUpdates.length === 0) {
    return { success: false, reason: "NO_VARIANTS" };
  }
  trace(requestId, "UPDATE", "productVariantsBulkUpdate (request)", {
    productId,
    variantUpdates: variantUpdates.map((v) => ({ id: v.id, price: v.price }))
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
        variants: variantUpdates
      }
    }
  );
  const responseJson = await response.json();
  logGraphqlErrors(requestId, "productVariantsBulkUpdate", responseJson);
  const userErrors = ((_b = (_a2 = responseJson == null ? void 0 : responseJson.data) == null ? void 0 : _a2.productVariantsBulkUpdate) == null ? void 0 : _b.userErrors) ?? [];
  if (userErrors.length > 0) {
    traceError(requestId, "productVariantsBulkUpdate failed", {
      step: "updateProductVariantsPrice",
      productId,
      userErrors,
      responseJson
    });
    return {
      success: false,
      reason: userErrors.map((error) => error.message).join(", "),
      responseJson
    };
  }
  trace(requestId, "UPDATE", "productVariantsBulkUpdate (success)", {
    productId,
    returnedProductId: ((_e = (_d = (_c = responseJson == null ? void 0 : responseJson.data) == null ? void 0 : _c.productVariantsBulkUpdate) == null ? void 0 : _d.product) == null ? void 0 : _e.id) ?? null
  });
  return { success: true };
}
async function recalculateAllProductPrices(admin, rates, options = {}) {
  var _a2, _b, _c, _d;
  const requestId = options.requestId ?? createPricingRequestId();
  const numericRates = {
    goldRate: Number(rates.goldRate),
    silverRate: Number(rates.silverRate),
    gst: Number(rates.gst)
  };
  trace(requestId, "DATA", "Recalculation rates source: validated request payload (not re-read from metafields)", {
    goldRate: numericRates.goldRate,
    silverRate: numericRates.silverRate,
    gst: numericRates.gst
  });
  if (!Number.isFinite(numericRates.goldRate) || !Number.isFinite(numericRates.silverRate) || !Number.isFinite(numericRates.gst)) {
    traceError(requestId, "Invalid numeric rates after coercion", {
      step: "recalculateAllProductPrices",
      numericRates
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
      const products = (_a2 = pageResponse == null ? void 0 : pageResponse.data) == null ? void 0 : _a2.products;
      if (!products) {
        traceError(requestId, "Failed to fetch products for pricing recalculation", {
          step: "fetchProductPage",
          pageIndex,
          afterCursor,
          responseJson: pageResponse
        });
        throw new Error("Failed to fetch products for pricing recalculation.");
      }
      const productEdges = products.edges ?? [];
      trace(requestId, "PRODUCT", "Product page fetched", {
        pageIndex,
        countOnPage: productEdges.length,
        hasNextPage: Boolean((_b = products.pageInfo) == null ? void 0 : _b.hasNextPage),
        sample: productEdges.slice(0, 5).map(({ node }) => ({
          id: node.id,
          handle: node.handle,
          title: node.title
        }))
      });
      if (productEdges.length === 0 && pageIndex === 0) {
        traceError(requestId, "No products returned from Shopify", {
          step: "fetchProductPage"
        });
      }
      for (let index2 = 0; index2 < productEdges.length; index2 += UPDATE_BATCH_SIZE) {
        const batch = productEdges.slice(index2, index2 + UPDATE_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async ({ node }) => {
            var _a3, _b2, _c2, _d2, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
            processed += 1;
            pricingLog("product_input", {
              productId: node.id,
              title: node.title,
              variantCount: ((_b2 = (_a3 = node.variants) == null ? void 0 : _a3.edges) == null ? void 0 : _b2.length) ?? 0,
              rates: numericRates
            });
            trace(requestId, "PRODUCT", "Processing product", {
              productId: node.id,
              title: node.title,
              handle: node.handle,
              variantCount: ((_d2 = (_c2 = node.variants) == null ? void 0 : _c2.edges) == null ? void 0 : _d2.length) ?? 0
            });
            const variantEdges = ((_e = node.variants) == null ? void 0 : _e.edges) ?? [];
            const variantUpdates = [];
            for (const edge of variantEdges) {
              const variantNode = edge.node;
              const metalType = ((_f = variantNode.metalType) == null ? void 0 : _f.value) ?? "";
              const weight = Number((_g = variantNode.weight) == null ? void 0 : _g.value);
              const makingCharges = Number((_h = variantNode.makingCharges) == null ? void 0 : _h.value);
              pricingLog("variant_input", {
                productId: node.id,
                productTitle: node.title,
                variantId: variantNode.id,
                variantTitle: variantNode.title ?? "",
                raw: {
                  metalType: ((_i = variantNode.metalType) == null ? void 0 : _i.value) ?? null,
                  weight: ((_j = variantNode.weight) == null ? void 0 : _j.value) ?? null,
                  makingCharges: ((_k = variantNode.makingCharges) == null ? void 0 : _k.value) ?? null
                },
                parsed: {
                  metalType,
                  weight,
                  makingCharges
                }
              });
              if (!metalType) {
                trace(requestId, "CALCULATION", "Skipped: No metal type", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id
                });
                pricingLog("skip_variant_missing_metal_type", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? ""
                });
                continue;
              }
              if (!Number.isFinite(weight) || weight <= 0) {
                trace(requestId, "CALCULATION", "Skipped: Missing weight", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  rawWeight: ((_l = variantNode.weight) == null ? void 0 : _l.value) ?? null,
                  parsedWeight: weight
                });
                pricingLog("skip_variant_invalid_weight", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? "",
                  rawWeight: ((_m = variantNode.weight) == null ? void 0 : _m.value) ?? null,
                  parsedWeight: weight
                });
                continue;
              }
              if (!Number.isFinite(makingCharges) || makingCharges < 0) {
                trace(requestId, "CALCULATION", "Skipped: Invalid metafield", {
                  reason: "making_charges invalid or negative",
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  rawMakingCharges: ((_n = variantNode.makingCharges) == null ? void 0 : _n.value) ?? null
                });
                pricingLog("skip_variant_invalid_making_charges", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? "",
                  rawMakingCharges: ((_o = variantNode.makingCharges) == null ? void 0 : _o.value) ?? null,
                  parsedMakingCharges: makingCharges
                });
                continue;
              }
              const calculatedPrice = calculateFinalPrice({
                metalType,
                weight,
                makingCharges,
                rates: numericRates
              });
              if (calculatedPrice === null) {
                trace(requestId, "CALCULATION", "Skipped: Invalid metafield", {
                  detail: "metal_type must be gold or silver",
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  metalType
                });
                pricingLog("skip_variant_unknown_metal_type", {
                  productId: node.id,
                  productTitle: node.title,
                  variantId: variantNode.id,
                  variantTitle: variantNode.title ?? "",
                  metalType,
                  normalizedType: String(metalType || "").toLowerCase(),
                  expected: ["gold", "silver"]
                });
                continue;
              }
              const breakdown = getPriceBreakdown({
                metalType,
                weight,
                makingCharges,
                rates: numericRates
              });
              trace(requestId, "CALCULATION", "Variant priced", {
                productId: node.id,
                productTitle: node.title,
                variantId: variantNode.id,
                baseSubtotal: breakdown == null ? void 0 : breakdown.subtotal,
                appliedFormula: breakdown == null ? void 0 : breakdown.formula,
                formulaWithValues: breakdown == null ? void 0 : breakdown.formulaWithValues,
                newPrice: calculatedPrice
              });
              variantUpdates.push({
                id: variantNode.id,
                price: calculatedPrice.toFixed(2)
              });
            }
            if (variantUpdates.length === 0) {
              trace(requestId, "CALCULATION", "Skipped: No valid variants for product", {
                productId: node.id,
                productTitle: node.title,
                variantCount: variantEdges.length
              });
              pricingLog("skip_product_no_valid_variants", {
                productId: node.id,
                productTitle: node.title,
                variantCount: variantEdges.length
              });
              return { status: "skipped" };
            }
            const updateResult = await updateProductVariantsPrice(
              admin,
              node.id,
              variantUpdates,
              requestId
            );
            if (!updateResult.success) {
              pricingLog("update_failed", {
                productId: node.id,
                title: node.title,
                reason: updateResult.reason
              });
              return {
                status: "failed",
                message: `${node.title}: ${updateResult.reason}`
              };
            }
            pricingLog("updated", {
              productId: node.id,
              title: node.title,
              variantCount: variantUpdates.length
            });
            return { status: "updated" };
          })
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
      hasNextPage = Boolean((_c = products.pageInfo) == null ? void 0 : _c.hasNextPage);
      afterCursor = ((_d = products.pageInfo) == null ? void 0 : _d.endCursor) ?? null;
      pageIndex += 1;
    }
    console.log(`[SUMMARY] requestId=${requestId}`);
    console.log(
      `Processed: ${processed}
Updated: ${updated}
Skipped: ${skipped}
Failed: ${failed}`
    );
    trace(requestId, "SUMMARY", "Recalculation complete", {
      processed,
      updated,
      skipped,
      failed
    });
    return {
      processed,
      updated,
      skipped,
      failed,
      failures: failures.slice(0, 10),
      requestId
    };
  } catch (error) {
    traceError(requestId, "recalculateAllProductPrices threw", {
      step: "recalculateAllProductPrices",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
    throw error;
  }
}
const loader$1 = async ({
  request
}) => {
  const {
    admin
  } = await authenticate.admin(request);
  const {
    rates
  } = await fetchShopPricingRates(admin);
  return {
    rates
  };
};
const action$1 = async ({
  request
}) => {
  const {
    admin,
    session
  } = await authenticate.admin(request);
  const formData = await request.formData();
  const requestIdRaw = formData.get("requestId");
  const requestIdFromForm = typeof requestIdRaw === "string" ? requestIdRaw.trim() : "";
  const requestId = requestIdFromForm.length > 0 ? requestIdFromForm : createPricingRequestId();
  const url = new URL(request.url);
  const formValues = {
    goldRate: String(formData.get("goldRate") ?? ""),
    silverRate: String(formData.get("silverRate") ?? ""),
    gst: String(formData.get("gst") ?? "")
  };
  trace(requestId, "API", "Pricing action invoked", {
    route: "routes/app.pricing",
    path: url.pathname,
    method: request.method,
    shop: (session == null ? void 0 : session.shop) ?? null,
    body: formValues
  });
  const validation = validatePricingInput(formValues);
  if (!validation.isValid) {
    trace(requestId, "API", "Validation failed; skipping save and recalculation", {
      fieldErrors: validation.errors
    });
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: validation.errors,
      values: formValues,
      requestId
    };
  }
  try {
    try {
      await saveShopPricingRates(admin, validation.values, {
        requestId
      });
    } catch (error) {
      traceError(requestId, "saveShopPricingRates failed", {
        step: "saveShopPricingRates",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : void 0
      });
      throw error;
    }
    try {
      const summary = await recalculateAllProductPrices(admin, validation.values, {
        requestId
      });
      return {
        status: "success",
        message: "Pricing rates saved and product prices recalculated.",
        fieldErrors: {},
        values: {
          goldRate: String(validation.values.goldRate),
          silverRate: String(validation.values.silverRate),
          gst: String(validation.values.gst)
        },
        summary,
        requestId
      };
    } catch (error) {
      traceError(requestId, "recalculateAllProductPrices failed", {
        step: "recalculateAllProductPrices",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : void 0
      });
      throw error;
    }
  } catch (error) {
    traceError(requestId, "Pricing action failed", {
      step: "action",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to save pricing settings. Please try again.",
      fieldErrors: {},
      values: formValues,
      requestId
    };
  }
};
const app_pricing = UNSAFE_withComponentProps(function PricingRoute() {
  var _a2, _b;
  const {
    rates
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const shopify2 = useAppBridge();
  const isSubmitting = navigation.state === "submitting" && ((_a2 = navigation.formMethod) == null ? void 0 : _a2.toLowerCase()) === "post";
  const values = (actionData == null ? void 0 : actionData.values) ?? rates;
  const fieldErrors = (actionData == null ? void 0 : actionData.fieldErrors) ?? {};
  useEffect(() => {
    if (!(actionData == null ? void 0 : actionData.status) || !(actionData == null ? void 0 : actionData.message)) return;
    const isError = actionData.status === "error";
    shopify2.toast.show(actionData.message, {
      isError
    });
  }, [actionData == null ? void 0 : actionData.status, actionData == null ? void 0 : actionData.message, shopify2]);
  return /* @__PURE__ */ jsx("s-page", {
    heading: "Dynamic Pricing",
    children: /* @__PURE__ */ jsxs(Form, {
      method: "post",
      onSubmit: (event) => {
        const form2 = event.currentTarget;
        const id = createPricingRequestId();
        const hidden = form2.elements.namedItem("requestId");
        if (hidden && "value" in hidden) {
          hidden.value = id;
        }
        const fd = new FormData(form2);
        const payload = {
          goldRate: fd.get("goldRate"),
          silverRate: fd.get("silverRate"),
          gst: fd.get("gst"),
          requestId: fd.get("requestId")
        };
        console.log("[FRONTEND]", JSON.stringify({
          message: "Change Pricing Triggered",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          payload
        }));
      },
      children: [/* @__PURE__ */ jsx("input", {
        type: "hidden",
        name: "requestId",
        defaultValue: ""
      }), /* @__PURE__ */ jsx("s-section", {
        heading: "Metal Rates and GST",
        children: /* @__PURE__ */ jsxs("s-stack", {
          direction: "block",
          gap: "base",
          children: [/* @__PURE__ */ jsx("s-text-field", {
            label: "Gold Rate (₹/g)",
            name: "goldRate",
            type: "number",
            step: "0.01",
            min: "0.01",
            value: values.goldRate,
            required: true
          }), fieldErrors.goldRate ? /* @__PURE__ */ jsx("s-text", {
            as: "p",
            tone: "critical",
            children: fieldErrors.goldRate
          }) : null, /* @__PURE__ */ jsx("s-text-field", {
            label: "Silver Rate (₹/g)",
            name: "silverRate",
            type: "number",
            step: "0.01",
            min: "0.01",
            value: values.silverRate,
            required: true
          }), fieldErrors.silverRate ? /* @__PURE__ */ jsx("s-text", {
            as: "p",
            tone: "critical",
            children: fieldErrors.silverRate
          }) : null, /* @__PURE__ */ jsx("s-text-field", {
            label: "GST (%)",
            name: "gst",
            type: "number",
            step: "0.01",
            min: "0.01",
            value: values.gst,
            required: true
          }), fieldErrors.gst ? /* @__PURE__ */ jsx("s-text", {
            as: "p",
            tone: "critical",
            children: fieldErrors.gst
          }) : null, /* @__PURE__ */ jsx("s-button", {
            type: "submit",
            variant: "primary",
            ...isSubmitting ? {
              loading: true
            } : {},
            children: "Save & Recalculate Prices"
          })]
        })
      }), /* @__PURE__ */ jsx("s-section", {
        heading: "Last recalculation result",
        children: (actionData == null ? void 0 : actionData.summary) ? /* @__PURE__ */ jsxs("s-stack", {
          direction: "block",
          gap: "small",
          children: [actionData.requestId ? /* @__PURE__ */ jsxs("s-text", {
            as: "p",
            tone: "subdued",
            children: ["Request ID: ", actionData.requestId]
          }) : null, /* @__PURE__ */ jsxs("s-text", {
            as: "p",
            children: ["Processed: ", actionData.summary.processed]
          }), /* @__PURE__ */ jsxs("s-text", {
            as: "p",
            children: ["Updated: ", actionData.summary.updated]
          }), /* @__PURE__ */ jsxs("s-text", {
            as: "p",
            children: ["Skipped: ", actionData.summary.skipped]
          }), /* @__PURE__ */ jsxs("s-text", {
            as: "p",
            children: ["Failed: ", actionData.summary.failed]
          }), ((_b = actionData.summary.failures) == null ? void 0 : _b.length) > 0 ? /* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(actionData.summary.failures, null, 2)
              })
            })
          }) : null]
        }) : /* @__PURE__ */ jsx("s-text", {
          as: "p",
          tone: "subdued",
          children: "Save rates to trigger product price recalculation."
        })
      })]
    })
  });
});
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: app_pricing,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const loader = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const action = async ({
  request
}) => {
  const {
    admin
  } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][Math.floor(Math.random() * 4)];
  const response = await admin.graphql(`#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
            demoInfo: metafield(namespace: "$app", key: "demo_info") {
              jsonValue
            }
          }
        }
      }`, {
    variables: {
      product: {
        title: `${color} Snowboard`,
        metafields: [{
          namespace: "$app",
          key: "demo_info",
          value: "Created by React Router Template"
        }]
      }
    }
  });
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(`#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`, {
    variables: {
      productId: product.id,
      variants: [{
        id: variantId,
        price: "100.00"
      }]
    }
  });
  const variantResponseJson = await variantResponse.json();
  const metaobjectResponse = await admin.graphql(`#graphql
    mutation shopifyReactRouterTemplateUpsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject {
          id
          handle
          title: field(key: "title") {
            jsonValue
          }
          description: field(key: "description") {
            jsonValue
          }
        }
        userErrors {
          field
          message
        }
      }
    }`, {
    variables: {
      handle: {
        type: "$app:example",
        handle: "demo-entry"
      },
      metaobject: {
        fields: [{
          key: "title",
          value: "Demo Entry"
        }, {
          key: "description",
          value: "This metaobject was created by the Shopify app template to demonstrate the metaobject API."
        }]
      }
    }
  });
  const metaobjectResponseJson = await metaobjectResponse.json();
  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
    metaobject: metaobjectResponseJson.data.metaobjectUpsert.metaobject
  };
};
const app__index = UNSAFE_withComponentProps(function Index() {
  var _a2, _b, _c, _d;
  const fetcher = useFetcher();
  const shopify2 = useAppBridge();
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  useEffect(() => {
    var _a3, _b2;
    if ((_b2 = (_a3 = fetcher.data) == null ? void 0 : _a3.product) == null ? void 0 : _b2.id) {
      shopify2.toast.show("Product created");
    }
  }, [(_b = (_a2 = fetcher.data) == null ? void 0 : _a2.product) == null ? void 0 : _b.id, shopify2]);
  const generateProduct = () => fetcher.submit({}, {
    method: "POST"
  });
  return /* @__PURE__ */ jsxs("s-page", {
    heading: "Shopify app template",
    children: [/* @__PURE__ */ jsx("s-button", {
      slot: "primary-action",
      onClick: generateProduct,
      children: "Generate a product"
    }), /* @__PURE__ */ jsx("s-section", {
      heading: "Congrats on creating a new Shopify app 🎉",
      children: /* @__PURE__ */ jsxs("s-paragraph", {
        children: ["This embedded app template uses", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/tools/app-bridge",
          target: "_blank",
          children: "App Bridge"
        }), " ", "interface examples like an", " ", /* @__PURE__ */ jsx("s-link", {
          href: "/app/additional",
          children: "additional page in the app nav"
        }), ", as well as an", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql",
          target: "_blank",
          children: "Admin GraphQL"
        }), " ", "mutation demo, to provide a starting point for app development."]
      })
    }), /* @__PURE__ */ jsxs("s-section", {
      heading: "Get started with products",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: ["Generate a product with GraphQL and get the JSON output for that product. Learn more about the", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate",
          target: "_blank",
          children: "productCreate"
        }), " ", "mutation in our API references. Includes a product", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/build/custom-data/metafields",
          target: "_blank",
          children: "metafield"
        }), " ", "and", " ", /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/build/custom-data/metaobjects",
          target: "_blank",
          children: "metaobject"
        }), "."]
      }), /* @__PURE__ */ jsxs("s-stack", {
        direction: "inline",
        gap: "base",
        children: [/* @__PURE__ */ jsx("s-button", {
          onClick: generateProduct,
          ...isLoading ? {
            loading: true
          } : {},
          children: "Generate a product"
        }), ((_c = fetcher.data) == null ? void 0 : _c.product) && /* @__PURE__ */ jsx("s-button", {
          onClick: () => {
            var _a3, _b2, _c2, _d2;
            (_d2 = (_c2 = shopify2.intents).invoke) == null ? void 0 : _d2.call(_c2, "edit:shopify/Product", {
              value: (_b2 = (_a3 = fetcher.data) == null ? void 0 : _a3.product) == null ? void 0 : _b2.id
            });
          },
          target: "_blank",
          variant: "tertiary",
          children: "Edit product"
        })]
      }), ((_d = fetcher.data) == null ? void 0 : _d.product) && /* @__PURE__ */ jsx("s-section", {
        heading: "productCreate mutation",
        children: /* @__PURE__ */ jsxs("s-stack", {
          direction: "block",
          gap: "base",
          children: [/* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.product, null, 2)
              })
            })
          }), /* @__PURE__ */ jsx("s-heading", {
            children: "productVariantsBulkUpdate mutation"
          }), /* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.variant, null, 2)
              })
            })
          }), /* @__PURE__ */ jsx("s-heading", {
            children: "metaobjectUpsert mutation"
          }), /* @__PURE__ */ jsx("s-box", {
            padding: "base",
            borderWidth: "base",
            borderRadius: "base",
            background: "subdued",
            children: /* @__PURE__ */ jsx("pre", {
              style: {
                margin: 0
              },
              children: /* @__PURE__ */ jsx("code", {
                children: JSON.stringify(fetcher.data.metaobject, null, 2)
              })
            })
          })]
        })
      })]
    }), /* @__PURE__ */ jsxs("s-section", {
      slot: "aside",
      heading: "App template specs",
      children: [/* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Framework: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://reactrouter.com/",
          target: "_blank",
          children: "React Router"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Interface: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/app-home/using-polaris-components",
          target: "_blank",
          children: "Polaris web components"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "API: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/api/admin-graphql",
          target: "_blank",
          children: "GraphQL"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Custom data: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://shopify.dev/docs/apps/build/custom-data",
          target: "_blank",
          children: "Metafields & metaobjects"
        })]
      }), /* @__PURE__ */ jsxs("s-paragraph", {
        children: [/* @__PURE__ */ jsx("s-text", {
          children: "Database: "
        }), /* @__PURE__ */ jsx("s-link", {
          href: "https://www.prisma.io/",
          target: "_blank",
          children: "Prisma"
        })]
      })]
    }), /* @__PURE__ */ jsx("s-section", {
      slot: "aside",
      heading: "Next steps",
      children: /* @__PURE__ */ jsxs("s-unordered-list", {
        children: [/* @__PURE__ */ jsxs("s-list-item", {
          children: ["Build an", " ", /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/getting-started/build-app-example",
            target: "_blank",
            children: "example app"
          })]
        }), /* @__PURE__ */ jsxs("s-list-item", {
          children: ["Explore Shopify's API with", " ", /* @__PURE__ */ jsx("s-link", {
            href: "https://shopify.dev/docs/apps/tools/graphiql-admin-api",
            target: "_blank",
            children: "GraphiQL"
          })]
        })]
      })
    })]
  });
});
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: app__index,
  headers,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-CJk0MDyU.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/root-CDqzdkIw.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-BdpFReNW.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js", "/assets/AppProxyProvider-D6H-7l2P.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/route-EKJjgdiO.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js"], "css": ["/assets/route-Xpdx9QZl.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/app-tmA5WCFc.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js", "/assets/AppProxyProvider-D6H-7l2P.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.additional": { "id": "routes/app.additional", "parentId": "routes/app", "path": "additional", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.additional-CGU6oPok.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app.pricing": { "id": "routes/app.pricing", "parentId": "routes/app", "path": "pricing", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app.pricing-BsFNz3e9.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js", "/assets/useAppBridge-Bj34gXAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app._index-D6BBnH9f.js", "imports": ["/assets/chunk-UVKPFVEO-H-OZ_vkh.js", "/assets/useAppBridge-Bj34gXAL.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-c9c6434d.js", "version": "c9c6434d", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_passThroughRequests": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route4
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/app.additional": {
    id: "routes/app.additional",
    parentId: "routes/app",
    path: "additional",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/app.pricing": {
    id: "routes/app.pricing",
    parentId: "routes/app",
    path: "pricing",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route9
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
