import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "Sign up",
  description: `Create account — ${APP_NAME}`,
};

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-[#134e4a]">Sign up</h1>
      <p className="mt-2 text-[#0f766e]">
        Create an account. An admin will approve your role (crew, ticket booth, captain).
      </p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-[#0f766e]">
        Already have an account?{" "}
        <Link href={ROUTES.login} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">
          Log in
        </Link>
      </p>
    </div>
  );
}
