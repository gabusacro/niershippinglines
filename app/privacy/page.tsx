import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Privacy Policy",
  description: `How we collect, use, and protect your data — ${APP_NAME}`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href={ROUTES.home} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Home
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-[#134e4a]">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[#0f766e]">Last updated: February 2026</p>

      <div className="mt-8 space-y-8 text-[#134e4a]">
        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">1. Information We Collect</h2>
          <p className="mt-2 text-sm leading-relaxed">
            We collect information you provide when booking: name, email, mobile number, address, and passenger details.
            This is used for ticketing, Coast Guard manifest, and to contact you about your trip.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">2. How We Use Your Information</h2>
          <p className="mt-2 text-sm leading-relaxed">
            We use your data to process bookings, send payment and confirmation emails, maintain manifests for regulatory
            compliance, process refund requests (see our <Link href={ROUTES.terms} className="text-[#0c7b93] underline hover:no-underline">Terms and Conditions</Link> for refund policy),
            and improve our services. We do not sell your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">3. Data Storage and Security</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Your data is stored securely. Payment proof uploads are used only for verification and are not shared with
            third parties except as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">4. Cookies and Usage</h2>
          <p className="mt-2 text-sm leading-relaxed">
            We may use session storage and similar technologies to remember your preferences and whether you have
            accepted our terms. By using our website, you consent to such use as described in our Terms and Conditions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">5. Contact</h2>
          <p className="mt-2 text-sm leading-relaxed">
            For privacy-related inquiries, contact us at the ticket booth or through our official channels.
          </p>
        </section>
      </div>
    </div>
  );
}
