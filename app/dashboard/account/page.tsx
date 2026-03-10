import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Account",
};

export default async function AccountPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return <AccountClient user={user} />;
}
