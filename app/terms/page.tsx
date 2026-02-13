import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Terms and Conditions",
  description: `Terms of service, booking policy, refunds, and reschedule — ${APP_NAME}`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href={ROUTES.home} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Home
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-[#134e4a]">Terms and Conditions</h1>
      <p className="mt-2 text-sm text-[#0f766e]">Last updated: February 2026</p>

      <div className="mt-8 space-y-8 text-[#134e4a]">
        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">1. Acceptance of Terms</h2>
          <p className="mt-2 text-sm leading-relaxed">
            By accessing or using {APP_NAME} website and services, you agree to be bound by these Terms and Conditions,
            our <Link href={ROUTES.privacy} className="text-[#0c7b93] underline hover:no-underline">Privacy Policy</Link>,
            and our booking, refund, and reschedule policies outlined below. If you do not agree, please do not use our website.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">2. Booking Policy</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Bookings are confirmed upon payment verification. You must provide accurate passenger details. Port or terminal
            fees are not included in the fare. Excess baggage (over 30 kg) shall be subject to crew assessment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">3. Refund Policy</h2>
          <p className="mt-2 text-sm leading-relaxed">
            <strong>No refunds</strong> unless due to weather disturbance or vessel cancellation initiated by {APP_NAME}.
            In such cases, refunds will be processed in accordance with our procedures. For all other circumstances,
            tickets are non-refundable.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            <strong>How to request a refund.</strong> If your trip qualifies (weather disturbance or vessel cancellation),
            go to <Link href={ROUTES.myBookings} className="text-[#0c7b93] underline hover:no-underline">My Bookings</Link>,
            open your booking details, and use the <strong>Request refund</strong> button. Select the reason and submit.
            Our team will review and process valid requests. Refunds are sent via GCash to the original payment method.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">4. Reschedule and Schedule Change (Passenger-Initiated)</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Per MARINA and maritime regulations, passenger-initiated rebooking is allowed subject to penalties. Carrier-initiated changes (weather, technical) are free.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>
              Reschedule is <strong>only allowed at least 24 hours before</strong> the scheduled departure.
            </li>
            <li>
              <strong>Within 24 hours of departure:</strong> no changes or reschedules are permitted.
            </li>
            <li>
              <strong>After departure:</strong> we’re unable to offer refunds or rebooking. We kindly ask that you arrive at the port <strong>30 minutes to 1 hour</strong> before boarding so you don’t miss your sailing. We’ll do our best to notify you of any schedule changes.
            </li>
            <li>
              Passenger-initiated reschedule fee: <strong>10%</strong> of the fare plus <strong>₱15</strong> GCash transaction fee. Subject to seat availability; fare difference may apply if rates have changed.
            </li>
            <li>
              <strong>How to change schedule.</strong> Go to <Link href={ROUTES.myBookings} className="text-[#0c7b93] underline hover:no-underline">My Bookings</Link>, open your booking, and use <strong>Change schedule</strong>. Select the new date and time (same route only). Pay the fee at the ticket booth before boarding.
            </li>
            <li>
              Carrier-initiated (weather disturbance, vessel cancellation, technical issues): rebooking <strong>free of charge</strong> or full refund per our refund policy.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#134e4a]">5. Contact</h2>
          <p className="mt-2 text-sm leading-relaxed">
            For questions about these terms or your booking, contact us at the ticket booth or through our official channels.
          </p>
        </section>
      </div>
    </div>
  );
}
