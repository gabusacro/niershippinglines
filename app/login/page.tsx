import { Suspense } from "react";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { AuthForm } from "./AuthForm";
import Link from "next/link";

export const metadata = {
  title: "Sign In",
  description: `Sign in or create account — ${APP_NAME}`,
};

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<div className="mt-6 h-48 animate-pulse rounded-lg bg-teal-100" />}>
        <AuthForm />
      </Suspense>
      <div className="mt-6 text-center">
        <Link href={ROUTES.home} className="text-sm font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
