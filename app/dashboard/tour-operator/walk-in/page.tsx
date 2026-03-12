import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import OperatorWalkInPage from "./OperatorWalkInPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Walk-in Booking — Tour Operator" };

export default async function Page() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");
  return <OperatorWalkInPage />;
}
