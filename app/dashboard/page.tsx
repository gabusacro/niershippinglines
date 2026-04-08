import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getUpcomingTrips } from "@/lib/dashboard/get-upcoming-trips";
import { getPendingPaymentBookings } from "@/lib/dashboard/get-pending-payment-bookings";
import { getRecentlyConfirmedBookings } from "@/lib/dashboard/get-recently-confirmed-bookings";
import { getRefundedBookings } from "@/lib/dashboard/get-refunded-bookings";
import { TripCalendar } from "@/app/dashboard/TripCalendar";
import { PrintTicketsTrigger } from "@/components/tickets/PrintTicketsTrigger";
import { ConfirmationToast } from "@/components/dashboard/ConfirmationToast";
import { FindBookingByReference } from "@/components/dashboard/FindBookingByReference";
import { ClaimBookingFromRef } from "@/components/dashboard/ClaimBookingFromRef";
import { ClaimGuestBookingsByEmail } from "@/components/dashboard/ClaimGuestBookingsByEmail";
import { SetDisplayNameForm } from "@/app/dashboard/SetDisplayNameForm";
import { SetAddressForm } from "@/app/dashboard/SetAddressForm";
import { ROUTES, GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { getSiteBranding } from "@/lib/site-branding";
import { getCrewCaptainAssignedBoatIds } from "@/lib/dashboard/get-crew-captain-assigned-boats";
import {
  getTodaysTripsForBoats,
  getCurrentTripFromTodays,
} from "@/lib/dashboard/get-todays-trips-for-boats";
import { getUpcomingTripsForBoats } from "@/lib/dashboard/get-upcoming-trips-for-boats";
import { getTripManifestData } from "@/lib/admin/trip-manifest";
import { getPassengerRestrictions, isBlockedNow } from "@/lib/dashboard/get-passenger-restrictions";
import { CrewCaptainManifestSection } from "@/app/dashboard/CrewCaptainManifestSection";
import { DiscoverSiargao } from "@/components/dashboard/DiscoverSiargao";
import { getDiscoverItems } from "@/lib/dashboard/get-discover-items";
import { DashboardShareWidget } from "@/components/dashboard/DashboardShareWidget";
import { TicketBoothDashboard } from "@/components/dashboard/TicketBoothDashboard";
import { PassengerActiveTickets } from "@/components/dashboard/PassengerActiveTickets";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const branding = await getSiteBranding();
  return { title: "Dashboard", description: `Dashboard — ${branding.site_name}` };
}

export const dynamic = "force-dynamic";

function peso(cents: number) {
  const amount = Math.round(cents / 100);
  return `₱${amount.toLocaleString()}`;
}

// ── Parking bookings fetch ────────────────────────────────────────────────────
async function getPendingParkingBookings(userId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("parking_reservations")
      .select("id, reference, status, total_amount_cents, lot_snapshot_name, vehicle_count, park_date_start")
      .eq("customer_profile_id", userId)
      .in("status", ["pending_payment", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(5);
    return data ?? [];
  } catch {
    return [];
  }
}

async function TripCalendarWrapper({
  loggedInEmail, passengerName, loggedInAddress,
  loggedInGender, loggedInBirthdate, loggedInNationality,
}: {
  loggedInEmail: string; passengerName?: string; loggedInAddress?: string;
  loggedInGender?: string; loggedInBirthdate?: string; loggedInNationality?: string;
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
  if (!user) redirect(ROUTES.login);

  const role = user.role as string;
  if (role === "admin")         redirect(ROUTES.admin);
  if (role === "investor")      redirect("/investor");
  if (role === "tour_operator")  redirect("/dashboard/tour-operator");
  if (role === "tour_guide")     redirect("/dashboard/tour-guide");
  if (role === "vessel_owner")   redirect("/vessel-owner");
  if (role === "parking_owner")  redirect("/parking-owner");
  if (role === "parking_crew")   redirect("/dashboard/parking-crew");

  const params = await searchParams;
  const roleLabel: Record<string, string> = {
    admin: "Admin", captain: "Captain", ticket_booth: "Ticket booth",
    crew: "Deck crew", passenger: "Passenger",
    vessel_owner: "Vessel Owner", investor: "Investor",
  };
  const yourRoleLabel   = roleLabel[user.role] ?? user.role;
  const isPassenger     = user.role === "passenger";
  const loggedInEmail   = user.email ?? "";
  const loggedInAddress = user.address ?? "";
  const isAdmin         = false;

  const displayName  = user.fullName?.trim() || null;
  const salutation   = user.salutation?.trim() || null;
  const welcomeName  = displayName
    ? (salutation ? `${salutation}. ${displayName}` : displayName)
    : null;
  const showWelcomeName = welcomeName ?? (user.email ? null : "User");

  const [
    branding, passengerRestriction, allPending,
    recentlyConfirmed, refundedBookings, discoverItems,
    pendingParkingBookings,
  ] = await Promise.all([
    getSiteBranding(),
    isPassenger ? getPassengerRestrictions(user.id) : Promise.resolve(null),
    isPassenger ? getPendingPaymentBookings(user.id) : Promise.resolve([]),
    isPassenger ? getRecentlyConfirmedBookings(user.id) : Promise.resolve([]),
    isPassenger ? getRefundedBookings(user.id) : Promise.resolve([]),
    isPassenger ? getDiscoverItems() : Promise.resolve([]),
    isPassenger ? getPendingParkingBookings(user.id) : Promise.resolve([]),
  ]);

  // ── Fetch passenger avatar ───────────────────────────────────────────────
  let passengerAvatarUrl: string | null = null;
  if (isPassenger) {
    const sb = await createClient();
    const { data: passengerProfile } = await sb
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    passengerAvatarUrl = passengerProfile?.avatar_url ?? null;
  }

  const awaitingPayment      = allPending.filter(b => !b.payment_proof_path);
  const awaitingConfirmation = allPending.filter(b => !!b.payment_proof_path);
  const totalTrips = recentlyConfirmed.length + awaitingConfirmation.length + awaitingPayment.length;

  // ── Crew / Captain data ──────────────────────────────────────────────────
  let crewCaptainData: {
    boatIds: string[];
    todayTrips: Awaited<ReturnType<typeof getTodaysTripsForBoats>>;
    upcomingTrips: Awaited<ReturnType<typeof getUpcomingTripsForBoats>>;
    currentTrip: ReturnType<typeof getCurrentTripFromTodays>;
    selectedTripId: string | null;
    manifest: Awaited<ReturnType<typeof getTripManifestData>>;
    avatarUrl: string | null;
  } | null = null;

  if (user.role === "crew" || user.role === "captain") {
    const boatIds       = await getCrewCaptainAssignedBoatIds(user.id);
    const todayTrips    = await getTodaysTripsForBoats(boatIds);
    const upcomingTrips = await getUpcomingTripsForBoats(boatIds);
    const currentTrip   = getCurrentTripFromTodays(todayTrips);
    const selectedTripId =
      params.tripId && todayTrips.some(t => t.id === params.tripId)
        ? params.tripId
        : currentTrip?.id ?? null;
    const manifest = selectedTripId ? await getTripManifestData(selectedTripId) : null;
    const sb = await createClient();
    const { data: crewProfile } = await sb.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
    crewCaptainData = { boatIds, todayTrips, upcomingTrips, currentTrip, selectedTripId, manifest, avatarUrl: crewProfile?.avatar_url ?? null };
  }

  // ── Ticket Booth data ────────────────────────────────────────────────────
  let ticketBoothData: {
    vesselName: string | null;
    boatId: string | null;
    boatIds: string[];
    todayTrips: Awaited<ReturnType<typeof getTodaysTripsForBoats>>;
    upcomingTrips: Awaited<ReturnType<typeof getUpcomingTripsForBoats>>;
    currentTrip: ReturnType<typeof getCurrentTripFromTodays>;
    selectedTripId: string | null;
    manifest: Awaited<ReturnType<typeof getTripManifestData>>;
    avatarUrl: string | null;
    pendingPayments: { reference: string; customer_full_name: string; total_amount_cents: number }[];
    issuedToday: { reference: string; customer_full_name: string; total_amount_cents: number; passenger_count: number; created_at: string; trip_id: string | null; issuer_name: string; issuer_role: string }[];
  } | null = null;

  if (user.role === "ticket_booth") {
    const sb = await createClient();
    const { data: assignments } = await sb
      .from("boat_assignments")
      .select("boat_id, boats(id, name)")
      .eq("profile_id", user.id)
      .eq("assignment_role", "ticket_booth");

    const firstAssignment = (assignments ?? [])[0] as {
      boat_id: string;
      boats: { id: string; name: string } | { id: string; name: string }[] | null;
    } | undefined;

    const boatId = firstAssignment?.boat_id ?? null;
    const boatRecord = firstAssignment
      ? (Array.isArray(firstAssignment.boats) ? firstAssignment.boats[0] : firstAssignment.boats) as { id: string; name: string } | null
      : null;
    const vesselName = boatRecord?.name ?? null;
    const boatIds = boatId ? [boatId] : [];

    const todayTrips    = boatIds.length > 0 ? await getTodaysTripsForBoats(boatIds) : [];
    const upcomingTrips = boatIds.length > 0 ? await getUpcomingTripsForBoats(boatIds) : [];
    const currentTrip   = getCurrentTripFromTodays(todayTrips);
    const selectedTripId =
      params.tripId && todayTrips.some(t => t.id === params.tripId)
        ? params.tripId
        : currentTrip?.id ?? null;
    const manifest = selectedTripId ? await getTripManifestData(selectedTripId) : null;

    const tripIds = todayTrips.map(t => t.id);
    const { data: pendingRaw } = tripIds.length > 0
      ? await sb.from("bookings")
          .select("reference, customer_full_name, total_amount_cents")
          .eq("status", "pending_payment")
          .not("payment_proof_path", "is", null)
          .in("trip_id", tripIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : { data: [] };

    const todayTripIds = todayTrips.map(t => t.id);
    const { data: issuedRaw } = todayTripIds.length > 0
      ? await sb.from("bookings")
          .select("reference, customer_full_name, total_amount_cents, passenger_count, created_at, trip_id, creator:profiles!bookings_created_by_fkey(full_name, role)")
          .in("trip_id", todayTripIds)
          .eq("is_walk_in", true)
          .not("status", "in", '("cancelled","refunded")')
          .order("created_at", { ascending: false })
      : { data: [] };

    const { data: boothProfile } = await sb.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();

    ticketBoothData = {
      avatarUrl: boothProfile?.avatar_url ?? null,
      vesselName, boatId, boatIds, todayTrips, upcomingTrips, currentTrip, selectedTripId, manifest,
      pendingPayments: (pendingRaw ?? []).map(b => ({
        reference: (b as { reference: string }).reference ?? "",
        customer_full_name: (b as { customer_full_name: string }).customer_full_name ?? "",
        total_amount_cents: (b as { total_amount_cents: number }).total_amount_cents ?? 0,
      })),
      issuedToday: (issuedRaw ?? []).map(b => {
        const bx = b as { reference?: string; customer_full_name?: string; total_amount_cents?: number; passenger_count?: number; created_at?: string; trip_id?: string; creator?: { full_name?: string; role?: string } | null };
        const creator = Array.isArray(bx.creator) ? bx.creator[0] : bx.creator;
        return {
          reference: bx.reference ?? "",
          customer_full_name: bx.customer_full_name ?? "",
          total_amount_cents: bx.total_amount_cents ?? 0,
          passenger_count: bx.passenger_count ?? 0,
          created_at: bx.created_at ?? "",
          trip_id: bx.trip_id ?? null,
          issuer_name: (creator as { full_name?: string } | null)?.full_name ?? "Unknown",
          issuer_role: (creator as { role?: string } | null)?.role ?? "—",
        };
      }),
    };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

{isPassenger ? (
  <div className="space-y-6">

    {/* ── HERO BANNER ── */}
    <div
      className="relative overflow-hidden rounded-3xl shadow-xl"
      style={{ background: "linear-gradient(155deg, #022c3a 0%, #0c4a6e 50%, #0891b2 100%)" }}
    >
      {/* Wave decoration */}
      <svg className="absolute bottom-0 left-0 w-full opacity-[0.12] pointer-events-none" viewBox="0 0 480 50" preserveAspectRatio="none" height="50">
        <path d="M0,25 C80,45 160,5 240,25 C320,45 400,5 480,25 L480,50 L0,50Z" fill="white"/>
        <path d="M0,35 C120,50 240,12 360,35 C420,44 460,28 480,35 L480,50 L0,50Z" fill="white" opacity=".5"/>
      </svg>

      <div className="relative px-6 pt-7 pb-6">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className="shrink-0 relative">
            {passengerAvatarUrl ? (
              <img
                src={passengerAvatarUrl}
                alt={displayName ?? "Profile"}
                className="rounded-2xl object-cover border-2 border-white/25 shadow-lg"
                style={{ width: 64, height: 64 }}
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/20 shadow-lg"
                style={{ background: "rgba(255,255,255,0.13)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#022c3a]" />
          </div>

          {/* Name + location */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
              Passenger Dashboard
            </p>
            <h1 className="mt-1 font-extrabold text-white leading-tight" style={{ fontSize: "clamp(1.15rem,4vw,1.6rem)" }}>
              {showWelcomeName ? <>Welcome back, {showWelcomeName}!</> : <>Welcome aboard!</>}
            </h1>
            {loggedInAddress && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.13)", color: "rgba(255,255,255,0.8)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {loggedInAddress}
              </div>
            )}
          </div>

          {/* Active bookings badge */}
          {totalTrips > 0 && (
            <div
              className="shrink-0 rounded-2xl border border-white/20 px-5 py-3 text-center"
              style={{ background: "rgba(255,255,255,0.11)" }}
            >
              <div className="text-3xl font-black text-white leading-none">{totalTrips}</div>
              <div className="mt-1 text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>Active<br/>Bookings</div>
            </div>
          )}
        </div>

        {/* Address / name form */}
        <div className="mt-5 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.13)" }}>
          {displayName ? (
            <>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Address for tickets &amp; Coast Guard manifest
              </p>
              <SetAddressForm initialAddress={user.address ?? ""} />
            </>
          ) : (
            <SetDisplayNameForm />
          )}
        </div>
      </div>
    </div>

    {params.ref ? <ClaimBookingFromRef refParam={params.ref} /> : null}
    <ClaimGuestBookingsByEmail />

    {/* ── Restriction notices ── */}
    {passengerRestriction && passengerRestriction.booking_warnings >= 1 && !isBlockedNow(passengerRestriction) && (
      <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Notice about your account
        </h2>
        <p className="mt-2 text-xs text-amber-800 leading-relaxed">
          We&apos;ve noticed some issues with your recent booking activity. Please ensure you only book when you intend to complete payment. Repeated abuse may result in restrictions.
        </p>
      </div>
    )}
    {passengerRestriction && isBlockedNow(passengerRestriction) && (
      <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-red-900 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Account temporarily restricted
        </h2>
        <p className="mt-2 text-xs text-red-800 leading-relaxed">
          We noticed unusual activity and have temporarily restricted your account from making new bookings. If you believe this is an error, please contact us at{" "}
          <a href="mailto:gabu.sacro@gmail.com" className="font-bold underline">gabu.sacro@gmail.com</a>.
        </p>
      </div>
    )}

    {/* ── Active Tickets ── */}
    {recentlyConfirmed.length > 0 && (
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Your Active Tickets</p>
        <PassengerActiveTickets
          tickets={recentlyConfirmed.map(b => ({
            id: b.id,
            reference: b.reference,
            trip_snapshot_departure_date: b.trip_snapshot_departure_date ?? null,
            trip_snapshot_departure_time: b.trip_snapshot_departure_time ?? null,
            trip_snapshot_route_name: b.trip_snapshot_route_name ?? null,
            refund_status: b.refund_status ?? null,
            passenger_count: b.passenger_count ?? 1,
          }))}
        />
      </div>
    )}

    {/* ── Ferry Booking Status ── */}
    {(awaitingPayment.length > 0 || awaitingConfirmation.length > 0 || refundedBookings.length > 0) && (
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Booking Status</p>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Awaiting Payment */}
          {awaitingPayment.length > 0 && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-800">Awaiting Payment</span>
              </div>
              <ul className="space-y-2">
                {awaitingPayment.map(b => {
                  const routeName = b.trip?.route?.display_name
                    ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                  return (
                    <li key={b.id}>
                      <Link href={`/dashboard/bookings/${b.reference}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-amber-400 hover:shadow-md">
                        <div>
                          <div className="font-mono text-sm font-bold text-[#0c7b93]">{b.reference}</div>
                          <div className="text-xs text-[#6B8886] mt-0.5">{routeName}</div>
                        </div>
                        <div className="font-bold text-[#134e4a]">{peso(b.total_amount_cents)}</div>
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
              <Link href={ROUTES.myBookings}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600">
                View all bookings →
              </Link>
            </div>
          )}

          {/* Awaiting Confirmation */}
          {awaitingConfirmation.length > 0 && (
            <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.2)]" />
                <span className="text-xs font-bold uppercase tracking-widest text-teal-800">Awaiting Confirmation</span>
              </div>
              <p className="mb-2 text-xs text-teal-700">Payment proof submitted — waiting for admin to confirm.</p>
              <ul className="space-y-2">
                {awaitingConfirmation.map(b => {
                  const routeName = b.trip?.route?.display_name
                    ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
                  return (
                    <li key={b.id}>
                      <Link href={`/dashboard/bookings/${b.reference}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-teal-400 hover:shadow-md">
                        <div>
                          <div className="font-mono text-sm font-bold text-[#0c7b93]">{b.reference}</div>
                          <div className="text-xs text-[#6B8886] mt-0.5">{routeName}</div>
                        </div>
                        <div className="font-bold text-[#134e4a]">{peso(b.total_amount_cents)}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link href={ROUTES.myBookings}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-700">
                View all bookings →
              </Link>
            </div>
          )}

          {/* Refunded */}
          {refundedBookings.length > 0 && (
            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Recent Refunds</span>
              </div>
              <ul className="space-y-2">
                {refundedBookings.map(b => (
                  <li key={b.id}>
                    <Link href={`/dashboard/bookings/${b.reference}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-slate-400 hover:shadow-md">
                      <div className="font-mono text-sm font-bold text-[#0c7b93]">{b.reference}</div>
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">Refunded</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    )}

    {/* ── Parking Bookings ── */}
    {pendingParkingBookings.length > 0 && (
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Parking Bookings</p>
        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-800">Active Parking Bookings</span>
          </div>
          <ul className="space-y-2">
            {pendingParkingBookings.map(b => {
              const isPending = b.status === "pending_payment";
              return (
                <li key={b.id}>
                  <Link href={`/dashboard/parking/${b.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
                    <div>
                      <div className="font-mono text-sm font-bold text-[#0c7b93]">{b.reference}</div>
                      <div className="text-xs text-[#6B8886] mt-0.5">
                        {b.lot_snapshot_name ?? "Parking"} · {b.vehicle_count} vehicle{b.vehicle_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        isPending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {isPending ? "Pending" : "Confirmed"}
                      </span>
                      <span className="font-bold text-[#134e4a]">{peso(b.total_amount_cents)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/dashboard/parking"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700">
            View all parking bookings →
          </Link>
        </div>
      </div>
    )}

    {recentlyConfirmed.length > 0 && (
      <ConfirmationToast
        items={recentlyConfirmed.map(b => ({ reference: b.reference }))}
        siteName={branding.site_name}
      />
    )}

    {/* ── Quick Actions ── */}
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Quick Actions</p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {/* Primary — Book a Trip */}
        <Link href={ROUTES.book}
          className="col-span-2 sm:col-span-1 group flex flex-col rounded-2xl border-2 border-[#0c4a6e] p-5 text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
          style={{ background: "linear-gradient(145deg,#022c3a,#0c4a6e 55%,#0891b2)" }}>
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.14)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </span>
          <span className="text-base font-bold">Book a Trip</span>
          <span className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Siargao ↔ Surigao · Dinagat ↔ Surigao</span>
        </Link>

        {[
          { href: ROUTES.myBookings, icon: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z", title: "My Bookings", sub: "Reservations & references" },
          { href: ROUTES.schedule, icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", title: "View Schedule", sub: "Departure times & routes" },
          { href: "/parking", icon: "M1 3h15v13H1zM16 8h4l3 5v3h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", title: "Book Parking", sub: "Near Surigao City Port, from ₱250/day" },
          { href: "/dashboard/parking", icon: "M3 3h18v18H3zM9 9h1.5a1.5 1.5 0 0 1 0 3H9v3M9 9V6", title: "My Parking", sub: "Your parking bookings" },
          { href: ROUTES.account, icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", title: "My Account", sub: "Profile & password" },
        ].map(({ href, icon, title, sub }) => (
          <Link key={href} href={href}
            className="group flex flex-col rounded-2xl border-2 border-teal-100 bg-white p-5 text-[#134e4a] shadow-sm transition-all hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon}/>
              </svg>
            </span>
            <span className="text-sm font-bold">{title}</span>
            <span className="mt-1 text-xs text-[#6B8886]">{sub}</span>
          </Link>
        ))}
      </div>
    </div>

    {/* ── Trip Calendar ── */}
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

    <DiscoverSiargao items={discoverItems} />

    {/* ── Find Booking ── */}
    <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <div>
          <p className="font-bold text-[#134e4a] text-sm">Find a Booking by Reference</p>
          <p className="text-xs text-[#6B8886] mt-0.5">Enter your reference code to retrieve any booking</p>
        </div>
      </div>
      <FindBookingByReference />
    </div>

    <DashboardShareWidget />

  </div>

























        


      ) : user.role === "ticket_booth" ? (
        <TicketBoothDashboard
          avatarUrl={ticketBoothData?.avatarUrl ?? null}
          ownerName={welcomeName ?? user.email ?? "Ticket Booth"}
          vesselName={ticketBoothData?.vesselName ?? null}
          boatId={ticketBoothData?.boatId ?? null}
          todayTrips={ticketBoothData?.todayTrips ?? []}
          upcomingTrips={ticketBoothData?.upcomingTrips ?? []}
          selectedTripId={ticketBoothData?.selectedTripId ?? null}
          manifest={ticketBoothData?.manifest ?? null}
          pendingPayments={ticketBoothData?.pendingPayments ?? []}
          issuedToday={ticketBoothData?.issuedToday ?? []}
          loggedInEmail={loggedInEmail}
          loggedInAddress={loggedInAddress}
        />

      ) : (user.role === "crew" || user.role === "captain") && crewCaptainData ? (
        <>
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email}. Your role: <strong>{yourRoleLabel}</strong>.</p>
          {crewCaptainData.boatIds.length === 0 ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-[#0f766e]/80">You have no vessel assignments. Contact admin to be assigned to a vessel.</p>
              <Link href={ROUTES.crewScan}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors">
                Scan ticket (QR code)
              </Link>
            </div>
          ) : (
            <CrewCaptainManifestSection
              roleLabel={yourRoleLabel}
              role={user.role}
              todayTrips={crewCaptainData.todayTrips}
              upcomingTrips={crewCaptainData.upcomingTrips}
              currentTrip={crewCaptainData.currentTrip}
              selectedTripId={crewCaptainData.selectedTripId}
              manifest={crewCaptainData.manifest}
              ownerName={welcomeName ?? user.email ?? undefined}
              avatarUrl={crewCaptainData.avatarUrl ?? null}
              loggedInEmail={loggedInEmail}
              loggedInAddress={loggedInAddress}
            />
          )}
        </>

      ) : user.role === "vessel_owner" ? (
        <>
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email}. Your role: <strong>Vessel Owner</strong>.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/vessel-owner"
              className="rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93]/5 p-5 text-left transition-colors hover:bg-[#0c7b93]/10">
              <h2 className="font-semibold text-[#134e4a]">🚢 Vessel Dashboard</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your vessel trips, passengers, fare revenue, and patronage bonus.</p>
            </Link>
            <Link href={ROUTES.account}
              className="rounded-xl border-2 border-teal-200 p-5 text-left transition-colors hover:bg-teal-50">
              <h2 className="font-semibold text-[#134e4a]">Account</h2>
              <p className="mt-1 text-sm text-[#0f766e]">Your profile and password.</p>
            </Link>
          </div>
        </>

      ) : (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-4xl shadow-sm mx-auto">🚢</div>
            <div>
              <h1 className="text-2xl font-black text-[#134e4a]">
                Welcome, {welcomeName || user.email?.split("@")[0] || "Traveler"}!
              </h1>
              <p className="mt-2 text-sm text-[#0f766e]">
                You&apos;re signed in as{" "}
                <span className="font-semibold inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-800 px-2.5 py-0.5 text-xs">
                  {yourRoleLabel}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm text-left space-y-3">
              <p className="text-sm font-semibold text-[#134e4a]">Your account is set up</p>
              <p className="text-sm text-[#0f766e]">
                Your role doesn&apos;t have a dedicated dashboard yet, or you may be in the process of being assigned to a vessel or tour.
                Contact the admin if you think something is wrong.
              </p>
              <div className="pt-2 border-t border-teal-100 space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#0f766e]">
                  <span className="text-teal-500">✓</span> Account email: <strong>{user.email}</strong>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#0f766e]">
                  <span className="text-teal-500">✓</span> Role: <strong>{yourRoleLabel}</strong>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={ROUTES.account}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors shadow-sm">
                👤 My Account
              </Link>
              <a href="mailto:support@travelasiargao.com"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-teal-200 bg-white px-6 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
                ✉️ Contact Admin
              </a>
            </div>
            <p className="text-xs text-[#0f766e]/40">Travela Siargao · support@travelasiargao.com</p>
          </div>
        </div>
      )}
    </div>
  );
}
