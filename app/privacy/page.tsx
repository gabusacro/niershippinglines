import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Privacy Policy",
  description: `Privacy policy and data protection — ${APP_NAME}`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href={ROUTES.home} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Home
      </Link>

      <h1 className="mt-6 text-2xl font-bold text-[#134e4a]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#0f766e]">Last updated: February 2026</p>

      <div className="mt-8 space-y-8 text-[#134e4a]">

        {/* 1 */}
        <section>
          <h2 className="text-lg font-semibold">1. Introduction</h2>
          <p className="mt-2 text-sm leading-relaxed">
            {APP_NAME} (“Platform,” “we,” “us,” or “our”) respects your privacy and is committed to protecting personal data in accordance with the Philippine Data Privacy Act of 2012 and regulations of the National Privacy Commission.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            By accessing or using our Platform, you acknowledge that you have read, understood, and agreed to this Privacy Policy.
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-lg font-semibold">2. Information We Collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Full name</li>
            <li>Contact number</li>
            <li>Email address (if provided)</li>
            <li>Travel and booking details</li>
            <li>Payment confirmation information</li>
            <li>Device and browser information</li>
            <li>IP address and system logs</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            You are responsible for ensuring that the information you provide is accurate and complete.
          </p>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-lg font-semibold">3. Discount Verification (Optional ID Collection)</h2>
          <p className="mt-2 text-sm leading-relaxed">
            For passengers claiming senior citizen, PWD, student, or other legally recognized discounts, we may require submission of a valid government-issued identification card strictly for verification purposes.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Submission of identification is voluntary and required only for discount eligibility.</li>
            <li>We do not collect identification documents unless a discount is being claimed.</li>
            <li>Failure to provide valid identification may result in denial of the discounted rate.</li>
            <li>Identification information is used solely for verification and regulatory compliance.</li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-lg font-semibold">4. Purpose of Processing</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Ticket booking and issuance</li>
            <li>Passenger manifest submission</li>
            <li>Compliance with maritime and port regulations</li>
            <li>Payment verification</li>
            <li>Refund and rescheduling requests</li>
            <li>Fraud prevention and system security</li>
            <li>Customer support</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            We do not sell or trade personal data.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-lg font-semibold">5. Third-Party Sharing and Disclosures</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Independent vessel operators</li>
            <li>Maritime and port authorities</li>
            <li>Payment processors</li>
            <li>Government agencies or law enforcement when legally required</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            The Platform operates solely as a booking intermediary and does not control how independent vessel operators manage or secure their internal systems.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-lg font-semibold">6. Infrastructure and Data Storage</h2>
          <p className="mt-2 text-sm leading-relaxed">
            The Platform utilizes secure cloud infrastructure and managed database services provided by reputable third-party providers, including Supabase.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            These providers implement their own technical and organizational safeguards, including encrypted transmission and controlled server environments.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            While we select service providers that maintain commercially reasonable security standards, we do not directly control the internal infrastructure, security configurations, or operational practices of third-party systems.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-lg font-semibold">7. Security Measures and Risk Acknowledgment</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Encrypted data transmission (HTTPS)</li>
            <li>Role-based administrative access controls</li>
            <li>Authentication and credential protections</li>
            <li>Managed cloud database infrastructure</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            However, no method of transmission over the internet is completely secure, and no electronic storage system is immune from cyber threats. Unauthorized access, data breaches, or system compromises may occur despite safeguards.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            By using the Platform, you acknowledge that digital transactions inherently involve risk, absolute security cannot be guaranteed, and the Platform shall not be liable for unauthorized access, cyber-attacks, data interception, system intrusion, or third-party infrastructure breaches beyond our reasonable control.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-lg font-semibold">8. Data Retention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Regulatory compliance</li>
            <li>Financial record-keeping</li>
            <li>Operational auditing</li>
            <li>Legal defense and dispute resolution</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            After the applicable retention period, data may be securely deleted or anonymized.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-lg font-semibold">9. Limitation of Liability</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Indirect, incidental, or consequential damages</li>
            <li>Data misuse by independent third parties</li>
            <li>Unauthorized access resulting from cyber incidents beyond our reasonable control</li>
            <li>Damages arising from failures or compromises of third-party infrastructure providers</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            Nothing in this Privacy Policy limits rights granted under applicable Philippine law.
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-lg font-semibold">10. User Consent</h2>
          <p className="mt-2 text-sm leading-relaxed">
            By accessing or using the Platform, you consent to the collection, use, disclosure, and processing of your personal information as described in this Privacy Policy.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-lg font-semibold">11. Updates to This Policy</h2>
          <p className="mt-2 text-sm leading-relaxed">
            We may update this Privacy Policy from time to time. Continued use of the Platform after any changes constitutes acceptance of the revised policy.
          </p>
        </section>

      </div>
    </div>
  );
}