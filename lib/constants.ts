// App-wide constants

export const APP_NAME = "Travela Siargao";

export const ROUTES = {
  home: "/",
  schedule: "/schedule",
  book: "/book",
  attractions: "/attractions",
  weather: "/weather",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
  account: "/account",
  myBookings: "/dashboard/bookings",
  firstAdminSetup: "/first-admin-setup",
  admin: "/admin",
  adminReports: "/admin/reports",
  adminVessels: "/admin/vessels",
  adminSchedule: "/admin/schedule",
  adminPendingPayments: "/admin/pending-payments",
  adminBookings: "/admin/bookings",
  adminManualBooking: "/admin/manual-booking",
  adminBranding: "/admin/branding",
  adminAnnouncements: "/admin/announcements",
  adminFlagged: "/admin/flagged",
  adminFees: "/admin/fees",
  crew: "/crew",
  crewScan: "/crew/scan",
  captain: "/captain",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export const ROUTE_OPTIONS = [
  { origin: "Siargao Island", destination: "Surigao City", label: "Siargao ↔ Surigao" },
  { origin: "Dinagat", destination: "Surigao City", label: "Dinagat ↔ Surigao City" },
] as const;

export const DEVELOPER_LINK = "https://www.gabrielsacro.com/";
export const DEVELOPER_COPYRIGHT = "© 2026 Gabriel Sacro. All rights reserved.";

/** GCash deposit for booking payments (shown on confirmation). */
export const GCASH_NUMBER = process.env.NEXT_PUBLIC_GCASH_NUMBER ?? "09463657331";
export const GCASH_ACCOUNT_NAME = process.env.NEXT_PUBLIC_GCASH_ACCOUNT_NAME ?? "Gabriel Sacro";

/** Fees added to booking total. To change these, edit here; see docs/WHERE_FEES_AND_FARES_ARE_SET.md. */
export const GCASH_FEE_CENTS = 1500; // ₱15 per transaction (online/GCash only; walk-in = 0)
export const ADMIN_FEE_CENTS_PER_PASSENGER = 2000; // ₱20 per passenger

/** Passenger-initiated reschedule (MARINA: P10–10% before departure). */
export const RESCHEDULE_FEE_PERCENT = 10;
export const RESCHEDULE_GCASH_FEE_CENTS = 1500; // ₱15 GCash transaction fee

/** Important notices shown on booking forms and tickets. */
export const BOOKING_NOTICES = [
  "Port or terminal fees are not included in the fare.",
  "Excess baggage (over 30 kg) may be subject to crew assessment. Hand carry is limited to 30 kg and below.",
  "For a smooth experience, please arrive 30–60 minutes before boarding so you don't miss your trip.",
  "Once the vessel has departed, we’re unable to offer refunds or rebooking. Arriving early helps ensure you don’t miss your sailing.",
] as const;

/** Fuel price per liter (PHP). Used for net revenue: fuel cost = liters × this; e.g. 100 L = ₱6,140. */
export const FUEL_PESOS_PER_LITER = 61.4;
