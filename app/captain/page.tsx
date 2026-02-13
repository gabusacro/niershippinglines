import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";

/** Captain and deck crew share the same dashboard (manifest, trips). Redirect to dashboard. */
export default async function CaptainPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const allowed = ["admin", "captain", "crew"].includes(user.role ?? "");
  if (!allowed) redirect(ROUTES.dashboard);
  redirect(ROUTES.dashboard);
}
