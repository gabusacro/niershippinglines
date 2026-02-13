import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { CrewTicketScanner } from "./CrewTicketScanner";

export default async function CrewScanPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(user.role ?? "");
  if (!allowed) redirect(ROUTES.dashboard);

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href={ROUTES.dashboard} className="text-sm font-semibold text-[#0c7b93] hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
      <h1 className="text-xl font-bold text-[#134e4a]">Scan ticket</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        Use your phone camera to scan the QR code on the passenger&apos;s ticket. Confirm and check in.
      </p>
      <div className="mt-6">
        <CrewTicketScanner />
      </div>
    </div>
  );
}
