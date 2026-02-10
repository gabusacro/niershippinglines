import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Log in",
  description: `Log in — ${APP_NAME}`,
};

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold text-[#134e4a]">Log in</h1>
      <p className="mt-2 text-[#0f766e]">
        Crew, captain & admin sign-in.
      </p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-[#0f766e]">
        No account?{" "}
        <Link href={ROUTES.signup} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">
          Sign up
        </Link>
      </p>
    </div>
  );
}
