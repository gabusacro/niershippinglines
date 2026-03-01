import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import AdminIdVerificationsClient from "./AdminIdVerificationsClient";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "ID Verifications — Admin" };
}

export default async function AdminIdVerificationsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!["admin","ticket_booth"].includes(user.role ?? "")) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AdminIdVerificationsClient />
    </div>
  );
}
