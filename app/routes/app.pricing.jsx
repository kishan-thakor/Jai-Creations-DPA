import { useEffect } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import {
  fetchShopPricingRates,
  recalculateAllProductPrices,
  saveShopPricingRates,
  trace,
  traceError,
  validatePricingInput,
} from "../services/pricing.server";
import { createPricingRequestId } from "../utils/pricingRequestId.js";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { rates } = await fetchShopPricingRates(admin);

  return { rates };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const requestIdRaw = formData.get("requestId");
  const requestIdFromForm =
    typeof requestIdRaw === "string" ? requestIdRaw.trim() : "";
  const requestId =
    requestIdFromForm.length > 0 ? requestIdFromForm : createPricingRequestId();

  const url = new URL(request.url);
  const formValues = {
    goldRate: String(formData.get("goldRate") ?? ""),
    silverRate: String(formData.get("silverRate") ?? ""),
    gst: String(formData.get("gst") ?? ""),
  };

  trace(requestId, "API", "Pricing action invoked", {
    route: "routes/app.pricing",
    path: url.pathname,
    method: request.method,
    shop: session?.shop ?? null,
    body: formValues,
  });

  const validation = validatePricingInput(formValues);

  if (!validation.isValid) {
    trace(requestId, "API", "Validation failed; skipping save and recalculation", {
      fieldErrors: validation.errors,
    });
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: validation.errors,
      values: formValues,
      requestId,
    };
  }

  try {
    try {
      await saveShopPricingRates(admin, validation.values, { requestId });
    } catch (error) {
      traceError(requestId, "saveShopPricingRates failed", {
        step: "saveShopPricingRates",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }

    try {
      const summary = await recalculateAllProductPrices(admin, validation.values, {
        requestId,
      });

      return {
        status: "success",
        message: "Pricing rates saved and product prices recalculated.",
        fieldErrors: {},
        values: {
          goldRate: String(validation.values.goldRate),
          silverRate: String(validation.values.silverRate),
          gst: String(validation.values.gst),
        },
        summary,
        requestId,
      };
    } catch (error) {
      traceError(requestId, "recalculateAllProductPrices failed", {
        step: "recalculateAllProductPrices",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  } catch (error) {
    traceError(requestId, "Pricing action failed", {
      step: "action",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save pricing settings. Please try again.",
      fieldErrors: {},
      values: formValues,
      requestId,
    };
  }
};

export default function PricingRoute() {
  const { rates } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isSubmitting =
    navigation.state === "submitting" &&
    navigation.formMethod?.toLowerCase() === "post";

  const values = actionData?.values ?? rates;
  const fieldErrors = actionData?.fieldErrors ?? {};

  useEffect(() => {
    if (!actionData?.status || !actionData?.message) return;

    const isError = actionData.status === "error";
    shopify.toast.show(actionData.message, { isError });
  }, [actionData?.status, actionData?.message, shopify]);

  return (
    <s-page heading="Dynamic Pricing">
      <Form
        method="post"
        onSubmit={(event) => {
          const form = event.currentTarget;
          const id = createPricingRequestId();
          const hidden = form.elements.namedItem("requestId");
          if (hidden && "value" in hidden) {
            hidden.value = id;
          }

          const fd = new FormData(form);
          const payload = {
            goldRate: fd.get("goldRate"),
            silverRate: fd.get("silverRate"),
            gst: fd.get("gst"),
            requestId: fd.get("requestId"),
          };

          console.log(
            "[FRONTEND]",
            JSON.stringify({
              message: "Change Pricing Triggered",
              timestamp: new Date().toISOString(),
              payload,
            }),
          );
        }}
      >
        <input type="hidden" name="requestId" defaultValue="" />

        <s-section heading="Metal Rates and GST">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Gold Rate (₹/g)"
              name="goldRate"
              type="number"
              step="0.01"
              min="0.01"
              value={values.goldRate}
              required
            />
            {fieldErrors.goldRate ? (
              <s-text as="p" tone="critical">
                {fieldErrors.goldRate}
              </s-text>
            ) : null}

            <s-text-field
              label="Silver Rate (₹/g)"
              name="silverRate"
              type="number"
              step="0.01"
              min="0.01"
              value={values.silverRate}
              required
            />
            {fieldErrors.silverRate ? (
              <s-text as="p" tone="critical">
                {fieldErrors.silverRate}
              </s-text>
            ) : null}

            <s-text-field
              label="GST (%)"
              name="gst"
              type="number"
              step="0.01"
              min="0.01"
              value={values.gst}
              required
            />
            {fieldErrors.gst ? (
              <s-text as="p" tone="critical">
                {fieldErrors.gst}
              </s-text>
            ) : null}

            <s-button
              type="submit"
              variant="primary"
              {...(isSubmitting ? { loading: true } : {})}
            >
              Save &amp; Recalculate Prices
            </s-button>
          </s-stack>
        </s-section>

        <s-section heading="Last recalculation result">
          {actionData?.summary ? (
            <s-stack direction="block" gap="small">
              {actionData.requestId ? (
                <s-text as="p" tone="subdued">
                  Request ID: {actionData.requestId}
                </s-text>
              ) : null}
              <s-text as="p">Processed: {actionData.summary.processed}</s-text>
              <s-text as="p">Updated: {actionData.summary.updated}</s-text>
              <s-text as="p">Skipped: {actionData.summary.skipped}</s-text>
              <s-text as="p">Failed: {actionData.summary.failed}</s-text>
              {actionData.summary.failures?.length > 0 ? (
                <s-box
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <pre style={{ margin: 0 }}>
                    <code>{JSON.stringify(actionData.summary.failures, null, 2)}</code>
                  </pre>
                </s-box>
              ) : null}
            </s-stack>
          ) : (
            <s-text as="p" tone="subdued">
              Save rates to trigger product price recalculation.
            </s-text>
          )}
        </s-section>
      </Form>
    </s-page>
  );
}
