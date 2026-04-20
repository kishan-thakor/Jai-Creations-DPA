export function createPricingRequestId() {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = String(Math.floor(Math.random() * 900) + 100);
  return `pricing-${date}-${suffix}`;
}
