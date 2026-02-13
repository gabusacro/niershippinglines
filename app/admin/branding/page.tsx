import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getSiteBranding } from "@/lib/site-branding";
import { ROUTES } from "@/lib/constants";
import { BrandingForm } from "./BrandingForm";

export const metadata = {
  title: "Site branding",
  description: "Edit site name, routes text, and tagline — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const branding = await getSiteBranding();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-[#134e4a]">Site branding</h1>
      <p className="mt-2 text-sm text-[#0f766e]">
        These values appear on the public site (home, header, footer), tickets, manifest, and booking emails. Change them here to rebrand across the app.
      </p>
      <BrandingForm initial={branding} />
    </div>
  );
}
