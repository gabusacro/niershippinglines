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
  admin: "/admin",
  crew: "/crew",
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
