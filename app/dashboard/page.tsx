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
}: {
  loggedInEmail: string;
  passengerName?: string;
  loggedInAddress?: string;
}) {
  const trips = await getUpcomingTrips();
  return (
    <TripCalendar
      trips={trips}
      loggedInEmail={loggedInEmail}
      passengerName={passengerName}
      loggedInAddress={loggedInAddress ?? ""}
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

  if (user.role === "admin") {
    redirect(ROUTES.admin);
  }

  const params = await searchParams;
  const roleLabel: Record<string, string> = {
    admin: "Admin",
    captain: "Captain",
    ticket_booth: "Ticket booth",
    crew: "Deck crew",
    passenger: "Passenger",
  };
  const yourRoleLabel = roleLabel[user.role] ?? user.role;
  const isPassenger = user.role === "passenger";
  const isAdmin = false; // admin is redirected above

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

  // ticket_booth sees ALL boats' trips today (not assigned to a specific vessel)
  let ticketBoothManifestData: {
    boatIds: string[];
    todayTrips: Awaited<ReturnType<typeof getTodaysTripsForBoats>>;
    currentTrip: ReturnType<typeof getCurrentTripFromTodays>;
    selectedTripId: string | null;
    manifest: Awaited<ReturnType<typeof getTripManifestData>>;
  } | null = null;

  if (user.role === "ticket_booth") {
    // ticket_booth sees all boats — pass empty array to get all trips
    // We reuse getCrewCaptainAssignedBoatIds but for ticket_booth we fetch all boats
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
      {isPassenger ? (
        <div className="mt-2 text-[#0f766e]">
          <p>
            Welcome{showWelcomeName ? <>, <strong>{showWelcomeName}</strong></> : null}. Passenger Account.
          </p>
          {!displayName && (
            <p className="mt-1 text-sm text-[#0f766e]/80">
              Set your name so we can greet you properly:
            </p>
          )}
          {!displayName && <SetDisplayNameForm />}
          {displayName && (
            <div className="mt-4">
              <p className="text-sm font-medium text-[#134e4a]">Your address (for tickets and Coast Guard manifest)</p>
              <p className="mt-0.5 text-xs text-[#0f766e]/80">
                Used on tickets and manifest. Group/family bookings use this by default.
              </p>
              <SetAddressForm initialAddress={user.address ?? ""} />
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[#0f766e]">
          Welcome, {welcomeName || user.email || "User"}. Your role: <strong>{yourRoleLabel}</strong>.
        </p>
     )}

      {isPassenger && params.ref ? <ClaimBookingFromRef refParam={params.ref} /> : null}
      {isPassenger ? <ClaimGuestBookingsByEmail /> : null}
      {isPassenger ? (
        <>
          {/* Warning notice (orange) — passenger has received a warning */}
          {passengerRestriction && passengerRestriction.booking_warnings >= 1 && !isBlockedNow(passengerRestriction) && (
            <div className="mt-6 rounded-2xl border-2 border-amber-500 bg-amber-50 p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-amber-900">Notice about your account</h2>
              <p className="mt-2 text-sm text-amber-800">
                We&apos;ve noticed some issues with your recent booking activity. Please ensure you only book when you intend to complete payment. Repeated abuse may result in temporary or permanent restrictions on your account.
              </p>
            </div>
          )}
          {/* Blocked notice — passenger is restricted from booking */}
          {passengerRestriction && isBlockedNow(passengerRestriction) && (
            <div className="mt-6 rounded-2xl border-2 border-red-400 bg-red-50 p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-red-900">Account temporarily restricted</h2>
              <p className="mt-2 text-sm text-red-800">
                We noticed unusual activity and have temporarily restricted your account from making new bookings. If you believe this is an error, please contact us at{" "}
                <a href="mailto:gabu.sacro@gmail.com" className="font-semibold underline">gabu.sacro@gmail.com</a>.
              </p>
            </div>
          )}
          <FindBookingByReference />

          {/* Awaiting payment — no proof uploaded yet */}
          {awaitingPayment.length > 0 && (
            <div className="mt-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-amber-900">
                Awaiting payment — needs your attention
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                You have {awaitingPayment.length} booking{awaitingPayment.length !== 1 ? "s" : ""} that need payment. Pay via GCash or at the ticket booth, then upload proof to confirm your trip.
              </p>
              <ul className="mt-4 space-y-3">
                {awaitingPayment.map((b) => {
                  const routeName = b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/dashboard/bookings/${b.reference}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 transition-colors hover:border-amber-400 hover:bg-amber-50/50"
                      >
                        <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                        <span className="text-sm text-[#134e4a]">{routeName}</span>
                        <span className="font-semibold text-[#134e4a]">
                          ₱{(b.total_amount_cents / 100).toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {GCASH_NUMBER && (
                <p className="mt-3 text-sm text-amber-800">
                  <strong>GCash:</strong> Send amount to {GCASH_NUMBER} ({GCASH_ACCOUNT_NAME}). Put the reference in the message.
                </p>
              )}
              <Link
                href={ROUTES.myBookings}
                className="mt-4 inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                View all my bookings →
              </Link>
            </div>
          )}

          {/* Awaiting confirmation — proof uploaded, waiting for admin */}
          {awaitingConfirmation.length > 0 && (
            <div className="mt-6 rounded-2xl border-2 border-teal-400 bg-teal-50 p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-teal-900">
                Awaiting Confirmation — Please wait while we process the transaction
              </h2>
              <p className="mt-1 text-sm text-teal-800">
                You have {awaitingConfirmation.length} booking{awaitingConfirmation.length !== 1 ? "s" : ""} with payment proof submitted. We&apos;ll verify and confirm your trip soon.
              </p>
              <ul className="mt-4 space-y-3">
                {awaitingConfirmation.map((b) => {
                  const routeName = b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/dashboard/bookings/${b.reference}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-white px-4 py-3 transition-colors hover:border-teal-400 hover:bg-teal-50/50"
                      >
                        <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                        <span className="text-sm text-[#134e4a]">{routeName}</span>
                        <span className="font-semibold text-[#134e4a]">
                          ₱{(b.total_amount_cents / 100).toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href={ROUTES.myBookings}
                className="mt-4 inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                View all my bookings →
              </Link>
            </div>
          )}

          {recentlyConfirmed.length > 0 && (
            <ConfirmationToast items={recentlyConfirmed.map((b) => ({ reference: b.reference }))} siteName={branding.site_name} />
          )}
          {recentlyConfirmed.length > 0 && (
            <div className="mt-6 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-emerald-900">
                Payment confirmed — tickets ready
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                Your payment was confirmed. You can print or view your tickets now.
              </p>
              <ul className="mt-4 space-y-2">
                {recentlyConfirmed.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                    <PrintTicketsTrigger reference={b.reference} siteName={branding.site_name} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {refundedBookings.length > 0 && (
            <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-amber-900">
                Refund notice ({refundedBookings.length} ticket{refundedBookings.length !== 1 ? "s" : ""})
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                {branding.site_name} has refunded your ticket(s). The amount has been processed. We apologize for any inconvenience.
              </p>
              <ul className="mt-4 space-y-2">
                {refundedBookings.map((b) => {
                  const routeName = b.trip_snapshot_route_name ?? b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                  const passengerNames = Array.isArray(b.passenger_names) && b.passenger_names.length > 0
                    ? b.passenger_names.join(", ")
                    : b.customer_full_name ?? `${b.passenger_count} passenger${b.passenger_count !== 1 ? "s" : ""}`;
                  return (
                    <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3">
                      <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                      <span className="text-sm text-amber-800">
                        ₱{(b.total_amount_cents / 100).toLocaleString()} · {routeName}
                      </span>
                      <span className="text-sm text-amber-700">· {passengerNames}</span>
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

<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={ROUTES.book}
              className="group flex flex-col rounded-2xl border-2 border-[#0c7b93] bg-[#0c7b93] p-6 text-white shadow-lg shadow-[#0c7b93]/20 transition-all hover:border-[#0f766e] hover:bg-[#0f766e] hover:shadow-xl hover:shadow-[#0c7b93]/25"
            >
              <span className="text-2xl font-bold">Book a trip</span>
              <span className="mt-2 text-sm opacity-90">Siargao ↔ Surigao · Dinagat ↔ Surigao</span>
            </Link>
            <Link
              href={ROUTES.schedule}
              className="group flex flex-col rounded-2xl border-2 border-[#0c7b93] bg-white p-6 text-[#134e4a] transition-all hover:border-[#0f766e] hover:bg-[#0c7b93]/5"
            >
              <span className="text-xl font-bold">View schedule</span>
              <span className="mt-2 text-sm text-[#0f766e]">Departure times and routes</span>
            </Link>
            <Link
              href={ROUTES.myBookings}
              className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-6 text-[#134e4a] transition-all hover:border-[#0c7b93] hover:bg-[#0c7b93]/5"
            >
              <span className="text-xl font-bold">My bookings</span>
              <span className="mt-2 text-sm text-[#0f766e]">Your reservations and references</span>
            </Link>
            <Link
              href={ROUTES.account}
              className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-6 text-[#134e4a] transition-all hover:border-[#0c7b93] hover:bg-[#0c7b93]/5"
            >
              <span className="text-xl font-bold">Account</span>
              <span className="mt-2 text-sm text-[#0f766e]">Profile and password</span>
            </Link>
          </div>


          <TripCalendarWrapper
            loggedInEmail={user.email ?? ""}
            passengerName={welcomeName ?? undefined}
            loggedInAddress={user.address ?? ""}
          />

          
        </>
      ) : isAdmin ? (
        <>
          <p className="mt-1 text-sm text-[#0f766e]/80">
            Manage reports, vessels, and assign crew. No first-admin link — admin is already set up.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href={ROUTES.admin}
              className="rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93]/5 p-5 text-left transition-colors hover:bg-[#0c7b93]/10"
            >
              <h2 className="font-semibold text-[#134e4a]">Dashboard</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Today&apos;s totals: passengers boarded, vessels active, revenue, fuel.</p>
            </Link>
            <Link
              href={ROUTES.adminReports}
              className="rounded-xl border-2 border-[#0c7b93] px-5 py-5 text-left transition-colors hover:bg-[#0c7b93]/10"
            >
              <h2 className="font-semibold text-[#134e4a]">Reports</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Per-vessel today: passenger board, revenue, fuel, net revenue.</p>
            </Link>
            <Link
              href={ROUTES.adminVessels}
              className="rounded-xl border-2 border-[#0c7b93] px-5 py-5 text-left transition-colors hover:bg-[#0c7b93]/10"
            >
              <h2 className="font-semibold text-[#134e4a]">Vessels</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Edit vessel name, capacity, fuel per trip, rate; assign captain, crew, ticket booth.</p>
            </Link>
          </div>
        </>
      ) : user.role === "ticket_booth" ? (
        <div className="mt-6 space-y-4">
          <DashboardAutoRefresh intervalSeconds={90} />
          <p className="mt-1 text-sm text-[#0f766e]/80">
            Serve walk-ins: take cash or GCash, confirm payment by reference, view booking history, and process refunds or reschedules when needed.
          </p>

          {/* Pending payments notice */}
          {pendingPreviewBooth.count > 0 && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-amber-900">Pending payments ({pendingPreviewBooth.count})</h2>
                  <p className="mt-0.5 text-sm text-amber-800">Confirm payments so passengers receive tickets on time.</p>
                </div>
                <Link
                  href={ROUTES.adminPendingPayments}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
                >
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

          {/* Today's manifest — ticket booth sees all vessels */}
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
        <>
          {crewCaptainData.boatIds.length === 0 ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-[#0f766e]/80">
                You have no vessel assignments. Contact admin to be assigned to a vessel so you can see the manifest and today&apos;s trips.
              </p>
              <p className="text-sm text-[#134e4a] font-medium">
                You can still scan tickets to verify passengers:
              </p>
              <Link
                href={ROUTES.crewScan}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors"
              >
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
            <Link
              href={ROUTES.account}
              className="inline-flex rounded-xl border-2 border-teal-200 bg-white px-5 py-4 text-left transition-colors hover:border-[#0c7b93] hover:bg-[#0c7b93]/5"
            >
              <h2 className="font-semibold text-[#134e4a]">Account</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your profile and password.</p>
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#0f766e]/80">
            Crew and captain access are assigned per vessel by admin. You only see the areas you have access to.
          </p>
          <div className="mt-6">
            <Link
              href={ROUTES.account}
              className="inline-flex rounded-xl border-2 border-teal-200 bg-white px-5 py-4 text-left transition-colors hover:border-[#0c7b93] hover:bg-[#0c7b93]/5"
            >
              <h2 className="font-semibold text-[#134e4a]">Account</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your profile and password.</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
