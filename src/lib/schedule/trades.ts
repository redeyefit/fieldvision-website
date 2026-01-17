// Trade categories for construction schedules
// Shared between client and server code

export const TRADE_CATEGORIES = [
  'General Conditions',
  'Site Work',
  'Concrete',
  'Masonry',
  'Metals',
  'Wood & Plastics',
  'Thermal & Moisture',
  'Doors & Windows',
  'Finishes',
  'Specialties',
  'Equipment',
  'Furnishings',
  'Special Construction',
  'Conveying Systems',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Fire Protection',
  'Demolition',
  'Cleanup',
] as const;

export type TradeCategory = (typeof TRADE_CATEGORIES)[number];
