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

export async function generateMetadata() {
  const branding = await getSiteBranding();
  return { title: "Dashboard", description: `Dashboard — ${branding.site_name}` };
}

export const dynamic = "force-dynamic";

// ── FIX: pinned locale helper so server and browser always format the same way ──
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
  if (role === "tour_operator") redirect("/dashboard/tour-operator");
  if (role === "tour_guide")    redirect("/dashboard/tour-guide");
  if (role === "vessel_owner")  redirect("/vessel-owner");

  const params = await searchParams;
  const roleLabel: Record<string, string> = {
    admin: "Admin", captain: "Captain", ticket_booth: "Ticket booth",
    crew: "Deck crew", passenger: "Passenger",
    vessel_owner: "Vessel Owner", investor: "Investor",
  };
  const yourRoleLabel  = roleLabel[user.role] ?? user.role;
  const isPassenger    = user.role === "passenger";
  const loggedInEmail  = user.email ?? "";
  const loggedInAddress = user.address ?? "";
  const isAdmin = false;

  const displayName  = user.fullName?.trim() || null;
  const salutation   = user.salutation?.trim() || null;
  const welcomeName  = displayName
    ? (salutation ? `${salutation}. ${displayName}` : displayName)
    : null;
  const showWelcomeName = welcomeName ?? (user.email ? null : "User");

  const [
    branding, passengerRestriction, allPending,
    recentlyConfirmed, refundedBookings, discoverItems,
  ] = await Promise.all([
    getSiteBranding(),
    isPassenger ? getPassengerRestrictions(user.id) : Promise.resolve(null),
    isPassenger ? getPendingPaymentBookings(user.id) : Promise.resolve([]),
    isPassenger ? getRecentlyConfirmedBookings(user.id) : Promise.resolve([]),
    isPassenger ? getRefundedBookings(user.id) : Promise.resolve([]),
    isPassenger ? getDiscoverItems() : Promise.resolve([]),
  ]);

  const awaitingPayment      = allPending.filter(b => !b.payment_proof_path);
  const awaitingConfirmation = allPending.filter(b => !!b.payment_proof_path);

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
    const { data: crewProfile } = await (await import("@/lib/supabase/server"))
      .createClient().then(sb => sb.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle());
    crewCaptainData = { boatIds, todayTrips, upcomingTrips, currentTrip, selectedTripId, manifest, avatarUrl: crewProfile?.avatar_url ?? null };  }

  // ── Ticket Booth data — ONLY assigned vessel ─────────────────────────────
  let ticketBoothData: {
    vesselName: string | null;
    boatId: string | null;
    boatIds: string[];
    todayTrips: Awaited<ReturnType<typeof getTodaysTripsForBoats>>;
    upcomingTrips: Awaited<ReturnType<typeof getUpcomingTripsForBoats>>;
    currentTrip: ReturnType<typeof getCurrentTripFromTodays>;
    selectedTripId: string | null;
    manifest: Awaited<ReturnType<typeof getTripManifestData>>;
    avatarUrl: string | null;  // ← ADD THIS LINE
    pendingPayments: { reference: string; customer_full_name: string; total_amount_cents: number }[];
    issuedToday: { reference: string; customer_full_name: string; total_amount_cents: number; passenger_count: number; created_at: string }[];
  } | null = null;

  if (user.role === "ticket_booth") {
    const sb = await (await import("@/lib/supabase/server")).createClient();

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
      ? (Array.isArray(firstAssignment.boats)
          ? firstAssignment.boats[0]
          : firstAssignment.boats) as { id: string; name: string } | null
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

    // ── FIX: compute date string once ──
    const todayManila = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const tripIds = todayTrips.map(t => t.id);

    const { data: pendingRaw } = tripIds.length > 0
      ? await sb
          .from("bookings")
          .select("reference, customer_full_name, total_amount_cents")
          .eq("status", "pending_payment")
          .not("payment_proof_path", "is", null)
          .in("trip_id", tripIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : { data: [] };

    const { data: issuedRaw } = await sb
      .from("bookings")
      .select("reference, customer_full_name, total_amount_cents, passenger_count, created_at")
      .eq("created_by", user.id)
      .eq("booking_source", "ticket_booth_walk_in")
      .gte("created_at", `${todayManila}T00:00:00+08:00`)
      .order("created_at", { ascending: false });




      const { data: boothProfile } = await sb
  .from("profiles")
  .select("avatar_url")
  .eq("id", user.id)
  .maybeSingle();




    ticketBoothData = {
      avatarUrl: boothProfile?.avatar_url ?? null,
      vesselName,
      boatId,
      boatIds,
      todayTrips,
      upcomingTrips,
      currentTrip,
      selectedTripId,
      manifest,
      pendingPayments: (pendingRaw ?? []).map(b => ({
        reference: (b as { reference: string }).reference ?? "",
        customer_full_name: (b as { customer_full_name: string }).customer_full_name ?? "",
        total_amount_cents: (b as { total_amount_cents: number }).total_amount_cents ?? 0,
      })),
      issuedToday: (issuedRaw ?? []).map(b => ({
        reference: (b as { reference: string }).reference ?? "",
        customer_full_name: (b as { customer_full_name: string }).customer_full_name ?? "",
        total_amount_cents: (b as { total_amount_cents: number }).total_amount_cents ?? 0,
        passenger_count: (b as { passenger_count: number }).passenger_count ?? 0,
        created_at: (b as { created_at: string }).created_at ?? "",
      })),
    };
  }

  const totalTrips = recentlyConfirmed.length + awaitingConfirmation.length + awaitingPayment.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

      {isPassenger ? (
        <div className="space-y-6">

          {/* HERO WELCOME BANNER */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-white shadow-lg">
            <div className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40 Q30 20 60 40 Q90 60 120 40' stroke='white' fill='none' stroke-width='2'/%3E%3Cpath d='M0 50 Q30 30 60 50 Q90 70 120 50' stroke='white' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
                backgroundSize: "240px 120px",
                backgroundRepeat: "repeat",
              }}
            />
            <span className="pointer-events-none absolute -right-4 top-0 select-none text-[8rem] leading-none opacity-[0.07]">🌴</span>

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Passenger Dashboard</p>
                <h1 className="mt-1 font-bold text-3xl leading-tight">
                  {showWelcomeName ? <>Welcome back, {showWelcomeName}! 👋</> : <>Welcome aboard! 👋</>}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/75">
                  {loggedInAddress && (
                    <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-medium">📍 {loggedInAddress}</span>
                  )}
                  {!displayName && (
                    <span className="text-white/60 text-xs">Set your name so we can greet you properly</span>
                  )}
                </div>
              </div>
              {totalTrips > 0 && (
                <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center backdrop-blur-sm">
                  <div className="text-3xl font-bold leading-none">{totalTrips}</div>
                  <div className="mt-1 text-xs text-white/65 tracking-wide">Active Bookings</div>
                </div>
              )}
            </div>

            {displayName && (
              <div className="relative mt-4 border-t border-white/15 pt-4">
                <p className="text-xs font-semibold text-white/70 mb-1">📋 Address for tickets & Coast Guard manifest</p>
                <SetAddressForm initialAddress={user.address ?? ""} />
              </div>
            )}
            {!displayName && (
              <div className="relative mt-4 border-t border-white/15 pt-4">
                <SetDisplayNameForm />
              </div>
            )}
          </div>

          {params.ref ? <ClaimBookingFromRef refParam={params.ref} /> : null}
          <ClaimGuestBookingsByEmail />

          {/* RESTRICTION NOTICES */}
          {passengerRestriction && passengerRestriction.booking_warnings >= 1 && !isBlockedNow(passengerRestriction) && (
            <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-amber-900">⚠️ Notice about your account</h2>
              <p className="mt-2 text-sm text-amber-800">
                We&apos;ve noticed some issues with your recent booking activity. Please ensure you only
                book when you intend to complete payment. Repeated abuse may result in temporary or
                permanent restrictions on your account.
              </p>
            </div>
          )}
          {passengerRestriction && isBlockedNow(passengerRestriction) && (
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-red-900">🚫 Account temporarily restricted</h2>
              <p className="mt-2 text-sm text-red-800">
                We noticed unusual activity and have temporarily restricted your account from making new
                bookings. If you believe this is an error, please contact us at{" "}
                <a href="mailto:gabu.sacro@gmail.com" className="font-semibold underline">gabu.sacro@gmail.com</a>.
              </p>
            </div>
          )}

          {/* BOOKING STATUS CARDS */}
          {(awaitingPayment.length > 0 || awaitingConfirmation.length > 0 || recentlyConfirmed.length > 0 || refundedBookings.length > 0) && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">My Active Bookings</p>
              <div className="grid gap-4 sm:grid-cols-2">

                {awaitingPayment.length > 0 && (
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-800">⏳ Awaiting Payment</span>
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
                                <div className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</div>
                                <div className="text-xs text-[#6B8886] mt-0.5">{routeName}</div>
                              </div>
                              {/* ── FIX: pinned locale via peso() helper ── */}
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
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600">
                      View all bookings →
                    </Link>
                  </div>
                )}

                {awaitingConfirmation.length > 0 && (
                  <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.2)]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-teal-800">🕐 Awaiting Confirmation</span>
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
                                <div className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</div>
                                <div className="text-xs text-[#6B8886] mt-0.5">{routeName}</div>
                              </div>
                              {/* ── FIX: pinned locale via peso() helper ── */}
                              <div className="font-bold text-[#134e4a]">{peso(b.total_amount_cents)}</div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <Link href={ROUTES.myBookings}
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-700">
                      View all bookings →
                    </Link>
                  </div>
                )}

                {recentlyConfirmed.length > 0 && (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(5,150,105,0.2)]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-800">✅ Confirmed — Tickets Ready</span>
                    </div>
                    <p className="mb-2 text-xs text-emerald-700">Your tickets are confirmed. Show QR code when boarding.</p>
                    <ul className="space-y-2">
                      {recentlyConfirmed.map(b => {
                        const refundBadge =
                          b.refund_status === "pending"      ? { emoji: "⏳", label: "Refund pending",      color: "bg-amber-100 text-amber-800"    } :
                          b.refund_status === "under_review" ? { emoji: "🔍", label: "Refund under review", color: "bg-blue-100 text-blue-800"      } :
                          b.refund_status === "approved"     ? { emoji: "✅", label: "Refund approved",     color: "bg-emerald-100 text-emerald-800" } :
                          b.refund_status === "processed"    ? { emoji: "💸", label: "Refunded",            color: "bg-teal-100 text-teal-800"       } :
                          b.refund_status === "rejected"     ? { emoji: "❌", label: "Refund rejected",     color: "bg-red-100 text-red-800"         } :
                          null;
                        const isRescheduleRequested = !!b.reschedule_requested_at;
                        return (
                          <li key={b.id} className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</div>
                                {b.trip_snapshot_departure_date && (
                                  <div className="text-xs text-[#6B8886] mt-0.5">
                                    {b.trip_snapshot_departure_date}
                                    {b.trip_snapshot_departure_time ? ` · ${b.trip_snapshot_departure_time}` : ""}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {refundBadge && (
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${refundBadge.color}`}>
                                    {refundBadge.emoji} {refundBadge.label}
                                  </span>
                                )}
                                {isRescheduleRequested && (
                                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                                    🔄 Reschedule requested
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/dashboard/bookings/${b.reference}`}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                                View &amp; Print Ticket
                              </Link>
                              <PrintTicketsTrigger reference={b.reference} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Link href={ROUTES.myBookings}
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700">
                      View all bookings →
                    </Link>
                  </div>
                )}

                {refundedBookings.length > 0 && (
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-600">💸 Recent Refunds</span>
                    </div>
                    <ul className="space-y-2">
                      {refundedBookings.map(b => (
                        <li key={b.id}>
                          <Link href={`/dashboard/bookings/${b.reference}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-slate-400 hover:shadow-md">
                            <div className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</div>
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

          {recentlyConfirmed.length > 0 && (
            <ConfirmationToast
              items={recentlyConfirmed.map(b => ({ reference: b.reference }))}
              siteName={branding.site_name}
            />
          )}

          {/* QUICK ACTIONS */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Quick Actions</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link href={ROUTES.book}
                className="group flex flex-col rounded-2xl border-2 border-[#0c7b93] bg-[#0c7b93] p-5 text-white shadow-lg shadow-[#0c7b93]/20 transition-all hover:bg-[#0f766e] hover:shadow-xl hover:-translate-y-0.5">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">🚢</span>
                <span className="text-lg font-bold">Book a Trip</span>
                <span className="mt-1 text-xs text-white/75">Siargao ↔ Surigao · Dinagat ↔ Surigao</span>
              </Link>
              <Link href={ROUTES.myBookings}
                className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-5 text-[#134e4a] shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md hover:-translate-y-0.5">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4F2] text-xl">🎫</span>
                <span className="text-lg font-bold">My Bookings</span>
                <span className="mt-1 text-xs text-[#6B8886]">Your reservations and references</span>
              </Link>
              <Link href={ROUTES.schedule}
                className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-5 text-[#134e4a] shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md hover:-translate-y-0.5">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4F2] text-xl">🗓️</span>
                <span className="text-lg font-bold">View Schedule</span>
                <span className="mt-1 text-xs text-[#6B8886]">Departure times and routes</span>
              </Link>
              <Link href={ROUTES.account}
                className="group flex flex-col rounded-2xl border-2 border-teal-200 bg-white p-5 text-[#134e4a] shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md hover:-translate-y-0.5">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4F2] text-xl">👤</span>
                <span className="text-lg font-bold">My Account</span>
                <span className="mt-1 text-xs text-[#6B8886]">Profile and password</span>
              </Link>
            </div>
          </div>

          {/* TRIP CALENDAR */}
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

          <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-2xl">🔍</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#134e4a] text-sm">Find a Booking by Reference</p>
                <p className="text-xs text-[#6B8886] mt-0.5">Enter your reference code to retrieve any booking</p>
              </div>
            </div>
            <div className="mt-3"><FindBookingByReference /></div>
          </div>

          <DashboardShareWidget />

        </div>

      ) : isAdmin ? (
        <>
          <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
          <p className="mt-2 text-[#0f766e]">Welcome, {welcomeName || user.email}. Your role: <strong>Admin</strong>.</p>
        </>

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
              <p className="text-sm text-[#0f766e]/80">
                You have no vessel assignments. Contact admin to be assigned to a vessel.
              </p>
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
