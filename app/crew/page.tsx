import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";

/** Crew and captain share the same dashboard (manifest, trips). Redirect to dashboard. */
export default async function CrewPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(user.role ?? "");
  if (!allowed) redirect(ROUTES.dashboard);
  redirect(ROUTES.dashboard);
}
