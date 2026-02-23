import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ROUTES, ADMIN_FEE_CENTS_PER_PASSENGER, GCASH_FEE_CENTS } from "@/lib/constants";
import { FeesForm } from "./FeesForm";

export const metadata = {
  title: "Fees & charges",
  description: "Set Platform Service Fee, Payment Processing Fee, and passenger fare discounts — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminFeesPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const { data } = await supabase
    .from("fee_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const settings = {
    admin_fee_cents_per_passenger: Number(data?.admin_fee_cents_per_passenger) || ADMIN_FEE_CENTS_PER_PASSENGER,
    gcash_fee_cents: Number(data?.gcash_fee_cents) || GCASH_FEE_CENTS,
    admin_fee_label: data?.admin_fee_label ?? "Platform Service Fee",
    gcash_fee_label: data?.gcash_fee_label ?? "Payment Processing Fee",
    admin_fee_applies_walkin: data?.admin_fee_applies_walkin ?? true,   
    gcash_fee_show_breakdown: data?.gcash_fee_show_breakdown ?? true,   
    child_min_age: data?.child_min_age ?? 3,
    child_max_age: data?.child_max_age ?? 10,
    child_discount_percent: Number(data?.child_discount_percent ?? 50),
    infant_max_age: data?.infant_max_age ?? 2,
    infant_is_free: data?.infant_is_free ?? true,
    senior_discount_percent: Number(data?.senior_discount_percent ?? 20),
    pwd_discount_percent: Number(data?.pwd_discount_percent ?? 20),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-[#134e4a]">Fees & Charges</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        Configure platform fees, fee label names, and passenger fare discount rules (senior, PWD, child, infant).
      </p>
      <FeesForm initial={settings} />
    </div>
  );
}
