import { useEffect } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import {
  fetchShopPricingRates,
  recalculateAllProductPrices,
  saveShopPricingRates,
  validatePricingInput,
} from "../services/pricing.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { rates } = await fetchShopPricingRates(admin);

  return { rates };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const formValues = {
    goldRate: String(formData.get("goldRate") ?? ""),
    silverRate: String(formData.get("silverRate") ?? ""),
    gst: String(formData.get("gst") ?? ""),
  };

  const validation = validatePricingInput(formValues);

  if (!validation.isValid) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: validation.errors,
      values: formValues,
    };
  }

  try {
    await saveShopPricingRates(admin, validation.values);
    const summary = await recalculateAllProductPrices(admin, validation.values);

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
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save pricing settings. Please try again.",
      fieldErrors: {},
      values: formValues,
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
      <Form method="post">
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
