import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Sign up",
  description: "Create account — redirects to sign in page",
};

export default function SignupPage() {
  redirect(`${ROUTES.login}?mode=signup`);
}
