import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Terms and Conditions",
  description: `Terms of service, booking policy, liability, refunds — ${APP_NAME}`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href={ROUTES.home} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Home
      </Link>

      <h1 className="mt-6 text-2xl font-bold text-[#134e4a]">
        Terms and Conditions
      </h1>
      <p className="mt-2 text-sm text-[#0f766e]">Last updated: February 2026</p>

      <div className="mt-8 space-y-8 text-[#134e4a]">

        {/* 1 */}
        <section>
          <h2 className="text-lg font-semibold">1. Platform Nature</h2>
          <p className="mt-2 text-sm leading-relaxed">
            {APP_NAME} is a digital booking and ticketing platform that facilitates reservations 
            between passengers and independent vessel operators. We are not a vessel owner, 
            not a maritime transport provider, and not a common carrier.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            The transportation contract exists solely between the passenger and the vessel operator.
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-lg font-semibold">2. Independent Vessel Operators</h2>
          <p className="mt-2 text-sm leading-relaxed">
            All trips listed on {APP_NAME} are operated by independent vessel operators 
            regulated by Philippine maritime authorities.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Vessel operators are solely responsible for:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Vessel seaworthiness and safety equipment</li>
            <li>Crew licensing and competence</li>
            <li>Navigation and weather decisions</li>
            <li>Passenger safety onboard</li>
            <li>Compliance with maritime laws and regulations</li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-lg font-semibold">3. Limitation of Liability</h2>
          <p className="mt-2 text-sm leading-relaxed">
            {APP_NAME} shall not be liable for maritime accidents, delays, weather-related 
            disruptions, mechanical failures, passenger injury, loss of baggage, or 
            incidents occurring during boarding, transport, or disembarkation.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Any claim arising from transport must be directed to the vessel operator.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            To the maximum extent permitted by law, our liability is limited to the booking 
            service fee paid through this platform.
          </p>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-lg font-semibold">4. Booking Policy</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Bookings are confirmed upon payment verification. You must provide accurate 
            passenger information. Incorrect details may result in denied boarding.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Sea travel involves inherent risks. By booking, you acknowledge and accept 
            these risks.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-lg font-semibold">5. Refund Policy</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Refunds may be granted only for eligible cases such as weather disturbance 
            or vessel cancellation initiated by the operator.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            For all other circumstances, tickets are non-refundable unless otherwise stated.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Refund requests must be submitted via{" "}
            <Link href={ROUTES.myBookings} className="text-[#0c7b93] underline hover:no-underline">
              My Bookings
            </Link>.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-lg font-semibold">6. Reschedule Policy</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>Reschedule allowed at least 24 hours before departure.</li>
            <li>No changes within 24 hours of departure.</li>
            <li>Missed trips are non-refundable.</li>
            <li>Reschedule fees may apply.</li>
            <li>Carrier-initiated changes are free of charge.</li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-lg font-semibold">7. Indemnification</h2>
          <p className="mt-2 text-sm leading-relaxed">
            You agree to indemnify and hold harmless {APP_NAME} from claims arising 
            from maritime incidents, passenger injury during transport, or disputes 
            with vessel operators.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-lg font-semibold">8. Amendments</h2>
          <p className="mt-2 text-sm leading-relaxed">
            We may update these Terms at any time. Continued use of the platform 
            constitutes acceptance of the updated Terms.
          </p>
        </section>

      </div>
    </div>
  );
}