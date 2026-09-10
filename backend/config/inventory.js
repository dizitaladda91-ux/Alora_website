// Inventory is deliberately disabled until the business starts tracking real
// quantities. Set INVENTORY_TRACKING_ENABLED=true in the deployment environment
// only after every sellable variant has an accurate stock value.
export const inventoryTrackingEnabled = () =>
  String(process.env.INVENTORY_TRACKING_ENABLED || "").trim().toLowerCase() === "true";
