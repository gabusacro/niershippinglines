import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { getAuthUser } from "@/lib/auth/get-user";
import { getTripManifestData } from "@/lib/admin/trip-manifest";
import { ROUTES } from "@/lib/constants";
import { getSiteBranding } from "@/lib/site-branding";
import { ManifestDocument } from "./ManifestDocument";
import { WalkInNamesForm } from "./WalkInNamesForm";
import { ManifestActions } from "./ManifestActions";
import { ReconcileWalkInButton } from "./ReconcileWalkInButton";

export const metadata = {
  title: "Passenger manifest",
  description: "Passenger manifest for Philippine Coast Guard — Nier Shipping Lines",
};

export const dynamic = "force-dynamic";

export default async function TripManifestPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const isAdmin = user.role === "admin";
  const isTicketBooth = user.role === "ticket_booth";
  if (!isAdmin && !isTicketBooth) redirect(ROUTES.dashboard);

  const { tripId } = await params;
  const data = await getTripManifestData(tripId);
  if (!data) notFound();

  const branding = await getSiteBranding();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000");
  const manifestUrl = `${baseUrl}/manifest/${tripId}`;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div>
            <Link href={ROUTES.adminReports} className="text-sm font-semibold text-[#0c7b93] hover:underline">
              ← Back to Reports
            </Link>
            <h1 className="mt-1 text-xl font-bold text-[#134e4a]">
              Passenger manifest — {data.vesselName}
            </h1>
            <p className="text-sm text-[#0f766e]">
              {data.routeName} · {data.departureDate} · {data.departureTime}
            </p>
          </div>
          <ManifestActions
            tripId={tripId}
            vesselName={data.vesselName}
            routeName={data.routeName}
            departureDate={data.departureDate}
            departureTime={data.departureTime}
            shareUrl={manifestUrl}
          />
        </div>

        <div className="mb-6 print:hidden">
          <WalkInNamesForm
            tripId={tripId}
            maxSeats={data.availableSeats}
            canEdit={isAdmin || isTicketBooth}
          />
          <ReconcileWalkInButton tripId={tripId} walkInNoNames={data.walkInNoNames} />
        </div>

        <ManifestDocument data={data} manifestUrl={manifestUrl} appName={branding.site_name} />
      </div>
    </div>
  );
}
