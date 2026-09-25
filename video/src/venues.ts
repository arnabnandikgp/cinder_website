// These are the user's target venues, not claims of live integrations or partnerships.
// Names and artwork are deliberately local: renders require no network access.
export const venues = [
  { id: "bulk", label: "BULK", asset: "venues/bulk.svg", size: 76 },
  { id: "pacifica", label: "Pacifica", asset: "venues/pacifica.svg", size: 96 },
  { id: "velocity", label: "Velocity", asset: "venues/velocity.svg", size: 96 },
  { id: "phoenix", label: "Phoenix", asset: "venues/phoenix.svg", size: 80 },
  { id: "gmtrade", label: "GMTrade", asset: "venues/gmtrade.svg", size: 90 },
] as const;
