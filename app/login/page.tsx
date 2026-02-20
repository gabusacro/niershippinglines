import { Suspense } from "react";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { AuthForm } from "./AuthForm";
import Link from "next/link";

export const metadata = {
  title: "Sign in",
  description: `Sign in or create account — ${APP_NAME}`,
};

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold text-[#134e4a]">Sign in</h1>
      
      <Suspense fallback={<div className="mt-6 h-48 animate-pulse rounded-lg bg-teal-100" />}>
        <AuthForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-[#0f766e]">
        <Link href={ROUTES.home} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
