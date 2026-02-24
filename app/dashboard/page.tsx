import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getUpcomingTrips } from "@/lib/dashboard/get-upcoming-trips";
import { getPendingPaymentBookings } from "@/lib/dashboard/get-pending-payment-bookings";
import { getRecentlyConfirmedBookings } from "@/lib/dashboard/get-recently-confirmed-bookings";
import { getRefundedBookings } from "@/lib/dashboard/get-refunded-bookings";
import { getPendingPaymentsPreview } from "@/lib/admin/pending-payments-preview";
import { TripCalendar } from "@/app/dashboard/TripCalendar";
import { PrintTicketsTrigger } from "@/components/tickets/PrintTicketsTrigger";
import { ConfirmationToast } from "@/components/dashboard/ConfirmationToast";
import { FindBookingByReference } from "@/components/dashboard/FindBookingByReference";
import { ClaimBookingFromRef } from "@/components/dashboard/ClaimBookingFromRef";
import { ClaimGuestBookingsByEmail } from "@/components/dashboard/ClaimGuestBookingsByEmail";
import { SetDisplayNameForm } from "@/app/dashboard/SetDisplayNameForm";
import { SetAddressForm } from "@/app/dashboard/SetAddressForm";
import { DashboardAutoRefresh } from "@/components/dashboard/DashboardAutoRefresh";
import { ROUTES, GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { getSiteBranding } from "@/lib/site-branding";
import { getCrewCaptainAssignedBoatIds } from "@/lib/dashboard/get-crew-captain-assigned-boats";
import {
  getTodaysTripsForBoats,
  getCurrentTripFromTodays,
} from "@/lib/dashboard/get-todays-trips-for-boats";
import { getTripManifestData } from "@/lib/admin/trip-manifest";
import { getPassengerRestrictions, isBlockedNow } from "@/lib/dashboard/get-passenger-restrictions";
import { CrewCaptainManifestSection } from "@/app/dashboard/CrewCaptainManifestSection";
import { DiscoverSiargao } from "@/components/dashboard/DiscoverSiargao";

export async function generateMetadata() {
  const branding = await getSiteBranding();
  return { title: "Dashboard", description: `Dashboard — ${branding.site_name}` };
}

/** Always fetch fresh user so "Set your name" disappears after save. */
export const dynamic = "force-dynamic";

async function TripCalendarWrapper({
  loggedInEmail,
  passengerName,
  loggedInAddress,
  loggedInGender,
  loggedInBirthdate,
  loggedInNationality,
}: {
  loggedInEmail: string;
  passengerName?: string;
  loggedInAddress?: string;
  loggedInGender?: string;
  loggedInBirthdate?: string;
  loggedInNationality?: string;
}) {
  const trips = await getUpcomingTrips();
  return (
    <TripCalendar
      trips={trips}
      loggedInEmail={loggedInEmail}
      passengerName={passengerName}
      loggedInAddress={loggedInAddress ?? ""}
      loggedInGender={loggedInGender ?? ""}
      loggedInBirthdate={loggedInBirthdate ?? ""}
      loggedInNationality={loggedInNationality ?? ""}
    />
  );
}

type DashboardSearchParams = Promise<{ tripId?: string; ref?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect(ROUTES.login);
  }

  const role = user.role as string;
  if (role === "admin") {
    redirect(ROUTES.admin);
  }
  if (role === "investor") {
    redirect("/investor");
  }

  const params = await searchParams;
  const roleLabel: Record<string, string> = {
    admin: "Admin",
    captain: "Captain",
    ticket_booth: "Ticket booth",
    crew: "Deck crew",
    passenger: "Passenger",
    vessel_owner: "Vessel Owner",
    investor: "Investor",
  };
  const yourRoleLabel = roleLabel[user.role] ?? user.role;
  const isPassenger = user.role === "passenger";
  const loggedInEmail = user.email ?? "";
  const passengerName = user.fullName ?? "";
  const loggedInAddress = user.address ?? "";
  const isAdmin = false;

  const displayName = user.fullName?.trim() || null;
  const salutation = user.salutation?.trim() || null;
  const welcomeName = displayName
    ? (salutation ? `${salutation}. ${displayName}` : displayName)
    : null;
  const showWelcomeName = welcomeName ?? (user.email ? null : "User");

  const [branding, passengerRestriction, allPending, recentlyConfirmed, refundedBookings, pendingPreviewBooth] = await Promise.all([
    getSiteBranding(),
    isPassenger ? getPassengerRestrictions(user.id) : Promise.resolve(null),
    isPassenger ? getPendingPaymentBookings(user.id) : Promise.resolve([]),
    isPassenger ? getRecentlyConfirmedBookings(user.id) : Promise.resolve([]),
    isPassenger ? getRefundedBookings(user.id) : Promise.resolve([]),
    user.role === "ticket_booth" ? getPendingPaymentsPreview() : Promise.resolve({ count: 0, items: [] }),
  ]);

  const awaitingPayment = allPending.filter((b) => !b.payment_proof_path);
  const awaitingConfirmation = allPending.filter((b) => !!b.payment_proof_path);

  // Fetch manifest data for crew, captain, AND ticket_booth
  let crewCaptainData: {
    boatIds: string[];
    todayTrips: Awaited<ReturnType<typeof getTodaysTripsForBoats>>;
    currentTrip: ReturnType<typeof getCurrentTripFromTodays>;
    selectedTripId: string | null;
    manifest: Awaited<ReturnType<typeof getTripManifestData>>;
  } | null = null;

  if (user.role === "crew" || user.role === "captain") {
    const boatIds = await getCrewCaptainAssignedBoatIds(user.id);
    const todayTrips = await getTodaysTripsForBoats(boatIds);
    const currentTrip = getCurrentTripFromTodays(todayTrips);
    const selectedTripId =
      params.tripId && todayTrips.some((t) => t.id === params.tripId)
        ? params.tripId
        : currentTrip?.id ?? null;
    const manifest = selectedTripId ? await getTripManifestData(selectedTripId) : null;
    crewCaptainData = { boatIds, todayTrips, currentTrip, selectedTripId, manifest };
  }

  let ticketBoothManifestData: {
    boatIds: string[];
    todayTrips: Awaited<ReturnType<typeof getTodaysTripsForBoats>>;
    currentTrip: ReturnType<typeof getCurrentTripFromTodays>;
    selectedTripId: string | null;
    manifest: Awaited<ReturnType<typeof getTripManifestData>>;
  } | null = null;

  if (user.role === "ticket_booth") {
    const { data: allBoats } = await (await import("@/lib/supabase/server")).createClient()
      .then((sb) => sb.from("boats").select("id"));
    const boatIds = (allBoats ?? []).map((b: { id: string }) => b.id);
    const todayTrips = await getTodaysTripsForBoats(boatIds);
    const currentTrip = getCurrentTripFromTodays(todayTrips);
    const selectedTripId =
      params.tripId && todayTrips.some((t) => t.id === params.tripId)
        ? params.tripId
        : currentTrip?.id ?? null;
    const manifest = selectedTripId ? await getTripManifestData(selectedTripId) : null;
    ticketBoothManifestData = { boatIds, todayTrips, currentTrip, selectedTripId, manifest };
  }

  // ─── Total confirmed trips count for hero stat ────────────────────────────
  // recentlyConfirmed is available; for total we use allPending length + confirmed
  // We'll pass the count of recentlyConfirmed as a proxy — you can wire a real total later
  const totalTrips = recentlyConfirmed.length + awaitingConfirmation.length + awaitingPayment.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PASSENGER DASHBOARD
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isPassenger ? (
        <div className="space-y-6">

          {/* ① HERO WELCOME BANNER */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-white shadow-lg">
            {/* Wave pattern overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40 Q30 20 60 40 Q90 60 120 40' stroke='white' fill='none' stroke-width='2'/%3E%3Cpath d='M0 50 Q30 30 60 50 Q90 70 120 50' stroke='white' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
                backgroundSize: "240px 120px",
                backgroundRepeat: "repeat",
              }}
            />
            {/* Palm decoration */}
            <span className="pointer-events-none absolute -right-4 top-0 select-none text-[8rem] leading-none opacity-[0.07]">🌴</span>

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
                  Passenger Dashboard
                </p>
                <h1 className="mt-1 font-bold text-3xl leading-tight">
                  {showWelcomeName ? (
                    <>Welcome back, {showWelcomeName}! 👋</>
                  ) : (
                    <>Welcome aboard! 👋</>
                  )}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/75">
                  {loggedInAddress && (
                    <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-medium">
                      📍 {loggedInAddress}
                    </span>
                  )}
                  {!displayName && (
                    <span className="text-white/60 text-xs">Set your name so we can greet you properly</span>
                  )}
                </div>
              </div>
              {/* Trip stat card */}
              {totalTrips > 0 && (
                <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center backdrop-blur-sm">
                  <div className="text-3xl font-bold leading-none">{totalTrips}</div>
                  <div className="mt-1 text-xs text-white/65 tracking-wide">Active Bookings</div>
                </div>
              )}
            </div>

            {/* Address editor — shown inline in hero */}
            {displayName && (
              <div className="relative mt-4 border-t border-white/15 pt-4">
                <p className="text-xs font-semibold text-white/70 mb-1">
                  📋 Address for tickets & Coast Guard manifest
                </p>
                <SetAddressForm initialAddress={user.address ?? ""} />
              </div>
            )}
            {!displayName && (
              <div className="relative mt-4 border-t border-white/15 pt-4">
                <SetDisplayNameForm />
              </div>
            )}
          </div>

          {/* Claim guest bookings */}
          {params.ref ? <ClaimBookingFromRef refParam={params.ref} /> : null}
          <ClaimGuestBookingsByEmail />

          {/* ② ACCOUNT RESTRICTION NOTICES */}
          {passengerRestriction && passengerRestriction.booking_warnings >= 1 && !isBlockedNow(passengerRestriction) && (
            <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-amber-900">⚠️ Notice about your account</h2>
              <p className="mt-2 text-sm text-amber-800">
                We&apos;ve noticed some issues with your recent booking activity. Please ensure you only book when you intend to complete payment. Repeated abuse may result in temporary or permanent restrictions on your account.
              </p>
            </div>
          )}
          {passengerRestriction && isBlockedNow(passengerRestriction) && (
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-red-900">🚫 Account temporarily restricted</h2>
              <p className="mt-2 text-sm text-red-800">
                We noticed unusual activity and have temporarily restricted your account from making new bookings. If you believe this is an error, please contact us at{" "}
                <a href="mailto:gabu.sacro@gmail.com" className="font-semibold underline">gabu.sacro@gmail.com</a>.
              </p>
            </div>
          )}

          {/* ③ BOOKING STATUS — side by side cards */}
          {(awaitingPayment.length > 0 || awaitingConfirmation.length > 0 || recentlyConfirmed.length > 0 || refundedBookings.length > 0) && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">My Active Bookings</p>
              <div className="grid gap-4 sm:grid-cols-2">

                {/* Awaiting payment */}
                {awaitingPayment.length > 0 && (
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
                        ⏳ Awaiting Payment
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {awaitingPayment.map((b) => {
                        const routeName = b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                        return (
                          <li key={b.id}>
                            <Link
                              href={`/dashboard/bookings/${b.reference}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-amber-400 hover:shadow-md"
                            >
                              <div>
                                <div className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</div>
                                <div className="text-xs text-[#6B8886] mt-0.5">{routeName}</div>
                              </div>
                              <div className="font-bold text-[#134e4a]">₱{(b.total_amount_cents / 100).toLocaleString()}</div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {GCASH_NUMBER && (
                      <p className="mt-3 text-xs text-amber-800">
                        <strong>GCash:</strong> {GCASH_NUMBER} ({GCASH_ACCOUNT_NAME})
                      </p>
                    )}
                    <Link
                      href={ROUTES.myBookings}
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600"
                    >
                      View all bookings →
                    </Link>
                  </div>
                )}

                {/* Awaiting confirmation */}
                {awaitingConfirmation.length > 0 && (
                  <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.2)]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-teal-800">
                        🕐 Awaiting Confirmation
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {awaitingConfirmation.map((b) => {
                        const routeName = b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                        return (
                          <li key={b.id}>
                            <Link
                              href={`/dashboard/bookings/${b.reference}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-teal-400 hover:shadow-md"
                            >
                              <div>
                                <div className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</div>
                                <div className="text-xs text-[#6B8886] mt-0.5">{routeName}</div>
                              </div>
                              <div className="font-bold text-[#134e4a]">₱{(b.total_amount_cents / 100).toLocaleString()}</div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <Link
                      href={ROUTES.myBookings}
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-700"
                    >
                      View all bookings →
                    </Link>
                  </div>
                )}

                {/* Confirmed / tickets ready */}
                {recentlyConfirmed.length > 0 && (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(5,150,105,0.2)]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-800">
                        ✅ Confirmed — Tickets Ready
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {recentlyConfirmed.map((b) => (
                        <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                          <span className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</span>
                          <PrintTicketsTrigger reference={b.reference} siteName={branding.site_name} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Refunded */}
                {refundedBookings.length > 0 && (
                  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
                        💸 Refund Notice ({refundedBookings.length})
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-amber-800">
                      {branding.site_name} has refunded your ticket(s). The amount has been processed.
                    </p>
                    <ul className="space-y-2">
                      {refundedBookings.map((b) => {
                        const routeName = b.trip_snapshot_route_name ?? b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                        const passengerNames = Array.isArray(b.passenger_names) && b.passenger_names.length > 0
                          ? b.passenger_names.join(", ")
                          : b.customer_full_name ?? `${b.passenger_count} passenger${b.passenger_count !== 1 ? "s" : ""}`;
                        return (
                          <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3">
                            <span className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</span>
                            <span className="text-xs text-amber-800">₱{(b.total_amount_cents / 100).toLocaleString()} · {routeName}</span>
                            <Link
                              href={`/dashboard/bookings/${b.reference}`}
                              className="ml-auto rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                            >
                              View details
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confirmation toast */}
          {recentlyConfirmed.length > 0 && (
            <ConfirmationToast items={recentlyConfirmed.map((b) => ({ reference: b.reference }))} siteName={branding.site_name} />
          )}

          {/* ④ QUICK ACTION GRID */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Quick Actions</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href={ROUTES.book}
                className="group flex flex-col rounded-2xl border-2 border-[#0c7b93] bg-[#0c7b93] p-5 text-white shadow-lg shadow-[#0c7b93]/20 transition-all hover:bg-[#0f766e] hover:shadow-xl hover:-translate-y-0.5"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">🚢</span>
                <span className="text-lg font-bold">Book a Trip</span>
                <span className="mt-1 text-xs text-white/75">Siargao ↔ Surigao · Dinagat ↔ Surigao</span>
              </Link>
              <Link
                href={ROUTES.myBookings}
                className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-5 text-[#134e4a] shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4F2] text-xl">🎫</span>
                <span className="text-lg font-bold">My Bookings</span>
                <span className="mt-1 text-xs text-[#6B8886]">Your reservations and references</span>
              </Link>
              <Link
                href={ROUTES.schedule}
                className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-5 text-[#134e4a] shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4F2] text-xl">🗓️</span>
                <span className="text-lg font-bold">View Schedule</span>
                <span className="mt-1 text-xs text-[#6B8886]">Departure times and routes</span>
              </Link>
              <Link
                href={ROUTES.account}
                className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-5 text-[#134e4a] shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4F2] text-xl">👤</span>
                <span className="text-lg font-bold">My Account</span>
                <span className="mt-1 text-xs text-[#6B8886]">Profile and password</span>
              </Link>
            </div>
          </div>

          {/* ⑤ TRIP SCHEDULE CALENDAR */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Scheduled Trips</p>
            <TripCalendarWrapper
              loggedInEmail={user.email ?? ""}
              passengerName={user.fullName ?? ""}
              loggedInAddress={user.address ?? ""}
              loggedInGender={user?.gender ?? ""}
              loggedInBirthdate={user?.birthdate ?? ""}
              loggedInNationality={user?.nationality ?? ""}
            />
          </div>

          {/* ⑥ DISCOVER SIARGAO */}
          <DiscoverSiargao />

          {/* ⑦ FIND BOOKING BY REFERENCE — utility, moved to bottom */}
          <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-2xl">🔍</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#134e4a] text-sm">Find a Booking by Reference</p>
                <p className="text-xs text-[#6B8886] mt-0.5">Enter your reference code (e.g. L7HHU7NCHR) to retrieve any booking</p>
              </div>
            </div>
            <div className="mt-3">
              <FindBookingByReference />
            </div>
          </div>

        </div>

      ) : isAdmin ? (
        /* ── ADMIN (redirected above, kept for safety) ─── */
        <>
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email || "User"}. Your role: <strong>{yourRoleLabel}</strong>.</p>
          <p className="mt-1 text-sm text-[#0f766e]/80">
            Manage reports, vessels, and assign crew. No first-admin link — admin is already set up.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href={ROUTES.admin} className="rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93]/5 p-5 text-left transition-colors hover:bg-[#0c7b93]/10">
              <h2 className="font-semibold text-[#134e4a]">Dashboard</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Today&apos;s totals: passengers boarded, vessels active, revenue, fuel.</p>
            </Link>
            <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-[#0c7b93] px-5 py-5 text-left transition-colors hover:bg-[#0c7b93]/10">
              <h2 className="font-semibold text-[#134e4a]">Reports</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Per-vessel today: passenger board, revenue, fuel, net revenue.</p>
            </Link>
            <Link href={ROUTES.adminVessels} className="rounded-xl border-2 border-[#0c7b93] px-5 py-5 text-left transition-colors hover:bg-[#0c7b93]/10">
              <h2 className="font-semibold text-[#134e4a]">Vessels</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Edit vessel name, capacity, fuel per trip, rate; assign captain, crew, ticket booth.</p>
            </Link>
          </div>
        </>

      ) : user.role === "ticket_booth" ? (
        /* ── TICKET BOOTH ──────────────────────────────── */
        <div className="mt-6 space-y-4">
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email || "User"}. Your role: <strong>{yourRoleLabel}</strong>.</p>
          <DashboardAutoRefresh intervalSeconds={90} />
          <p className="mt-1 text-sm text-[#0f766e]/80">
            Serve walk-ins: take cash or GCash, confirm payment by reference, view booking history, and process refunds or reschedules when needed.
          </p>
          {pendingPreviewBooth.count > 0 && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-amber-900">Pending payments ({pendingPreviewBooth.count})</h2>
                  <p className="mt-0.5 text-sm text-amber-800">Confirm payments so passengers receive tickets on time.</p>
                </div>
                <Link href={ROUTES.adminPendingPayments} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">
                  View all →
                </Link>
              </div>
              <ul className="mt-4 space-y-2">
                {pendingPreviewBooth.items.map((b) => (
                  <li key={b.reference} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
                    <Link href={ROUTES.adminPendingPayments} className="font-mono font-semibold text-[#0c7b93] hover:underline">{b.reference}</Link>
                    <span className="text-sm text-[#134e4a]">{b.customer_full_name} · ₱{(b.total_amount_cents / 100).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href={ROUTES.adminPendingPayments} className="rounded-xl border-2 border-[#0c7b93] px-5 py-4 text-left transition-colors hover:bg-[#0c7b93]/10">
              <h2 className="font-semibold text-[#134e4a]">Pending payments</h2>
              <p className="mt-1 text-sm text-[#0f766e]">See walk-ins who paid by reference; confirm when they show proof.</p>
            </Link>
            <Link href={ROUTES.adminBookings} className="rounded-xl border-2 border-[#0c7b93] px-5 py-4 text-left transition-colors hover:bg-[#0c7b93]/10">
              <h2 className="font-semibold text-[#134e4a]">Booking history</h2>
              <p className="mt-1 text-sm text-[#0f766e]">View all bookings; open any to process refund or reschedule.</p>
            </Link>
            <Link href={ROUTES.adminManualBooking} className="rounded-xl border-2 border-teal-200 px-5 py-4 text-left transition-colors hover:bg-teal-50">
              <h2 className="font-semibold text-[#134e4a]">Add walk-in booking</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Create booking when you collect payment at the booth.</p>
            </Link>
            <Link href={ROUTES.adminFlagged} className="rounded-xl border-2 border-teal-200 px-5 py-4 text-left transition-colors hover:bg-teal-50">
              <h2 className="font-semibold text-[#134e4a]">Flagged accounts</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Passengers with warnings or booking restrictions.</p>
            </Link>
            <Link href={ROUTES.account} className="rounded-xl border-2 border-teal-200 px-5 py-4 text-left transition-colors hover:bg-teal-50">
              <h2 className="font-semibold text-[#134e4a]">Account</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your profile and password.</p>
            </Link>
            <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-teal-200 px-5 py-4 text-left transition-colors hover:bg-teal-50">
              <h2 className="font-semibold text-[#134e4a]">Reports & manifests</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Daily/weekly/monthly/yearly reports; trip manifests.</p>
            </Link>
          </div>
          {ticketBoothManifestData && (
            <div className="mt-6">
              <h2 className="text-lg font-bold text-[#134e4a] mb-1">Today&apos;s passenger manifest</h2>
              <p className="text-sm text-[#0f766e]/80 mb-4">Live check-in and boarding status for all vessels today.</p>
              <CrewCaptainManifestSection
                roleLabel={yourRoleLabel}
                todayTrips={ticketBoothManifestData.todayTrips}
                currentTrip={ticketBoothManifestData.currentTrip}
                selectedTripId={ticketBoothManifestData.selectedTripId}
                manifest={ticketBoothManifestData.manifest}
              />
            </div>
          )}
        </div>

      ) : (user.role === "crew" || user.role === "captain") && crewCaptainData ? (
        /* ── CREW / CAPTAIN ────────────────────────────── */
        <>
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email || "User"}. Your role: <strong>{yourRoleLabel}</strong>.</p>
          {crewCaptainData.boatIds.length === 0 ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-[#0f766e]/80">
                You have no vessel assignments. Contact admin to be assigned to a vessel so you can see the manifest and today&apos;s trips.
              </p>
              <p className="text-sm text-[#134e4a] font-medium">You can still scan tickets to verify passengers:</p>
              <Link href={ROUTES.crewScan} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors">
                Scan ticket (QR code)
              </Link>
            </div>
          ) : (
            <CrewCaptainManifestSection
              roleLabel={yourRoleLabel}
              todayTrips={crewCaptainData.todayTrips}
              currentTrip={crewCaptainData.currentTrip}
              selectedTripId={crewCaptainData.selectedTripId}
              manifest={crewCaptainData.manifest}
            />
          )}
          <div className="mt-6">
            <Link href={ROUTES.account} className="inline-flex rounded-xl border-2 border-teal-200 bg-white px-5 py-4 text-left transition-colors hover:border-[#0c7b93] hover:bg-[#0c7b93]/5">
              <h2 className="font-semibold text-[#134e4a]">Account</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your profile and password.</p>
            </Link>
          </div>
        </>

      ) : user.role === "vessel_owner" ? (
        /* ── VESSEL OWNER ──────────────────────────────── */
        <>
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email || "User"}. Your role: <strong>{yourRoleLabel}</strong>.</p>
          <p className="mt-1 text-sm text-[#0f766e]/80">
            View your vessel&apos;s earnings, passengers, fuel costs, and your patronage bonus from the platform revenue pool.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/vessel-owner" className="rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93]/5 p-5 text-left transition-colors hover:bg-[#0c7b93]/10">
              <h2 className="font-semibold text-[#134e4a]">🚢 Vessel Dashboard</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your vessel&apos;s trips, passengers, fare revenue, fuel costs, net earnings, and patronage bonus.</p>
            </Link>
            <Link href={ROUTES.account} className="rounded-xl border-2 border-teal-200 p-5 text-left transition-colors hover:bg-teal-50">
              <h2 className="font-semibold text-[#134e4a]">Account</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your profile and password.</p>
            </Link>
          </div>
        </>

      ) : (
        /* ── FALLBACK ──────────────────────────────────── */
        <>
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email || "User"}. Your role: <strong>{yourRoleLabel}</strong>.</p>
          <p className="mt-1 text-sm text-[#0f766e]/80">
            Crew and captain access are assigned per vessel by admin. You only see the areas you have access to.
          </p>
          <div className="mt-6">
            <Link href={ROUTES.account} className="inline-flex rounded-xl border-2 border-teal-200 bg-white px-5 py-4 text-left transition-colors hover:border-[#0c7b93] hover:bg-[#0c7b93]/5">
              <h2 className="font-semibold text-[#134e4a]">Account</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your profile and password.</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
