// App-wide constants

export const APP_NAME = "Nier Shipping Lines";

export const ROUTES = {
  home: "/",
  schedule: "/schedule",
  book: "/book",
  attractions: "/attractions",
  weather: "/weather",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
  myBookings: "/dashboard/bookings",
  firstAdminSetup: "/first-admin-setup",
  admin: "/admin",
  adminReports: "/admin/reports",
  adminVessels: "/admin/vessels",
  adminSchedule: "/admin/schedule",
  adminPendingPayments: "/admin/pending-payments",
  adminBookings: "/admin/bookings",
  adminManualBooking: "/admin/manual-booking",
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

/** Fuel price per liter (PHP). Used for net revenue: fuel cost = liters × this; e.g. 100 L = ₱6,140. */
export const FUEL_PESOS_PER_LITER = 61.4;
