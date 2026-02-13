import { APP_NAME, ROUTES } from "@/lib/constants";
import { Sun } from "@/components/icons";
import { WeatherWidget } from "@/components/weather/WeatherWidget";
import Link from "next/link";

export const metadata = {
  title: "Weather",
  description: `Live weather for Siargao — ${APP_NAME}`,
};

export default function WeatherPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 mb-8">
        <div className="rounded-full bg-[#0c7b93]/10 p-3 w-fit">
          <Sun size={28} className="text-[#f59e0b]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#134e4a] sm:text-2xl">Siargao Weather</h1>
          <p className="text-sm text-[#0f766e] sm:text-base">Live conditions for the island. Data from OpenWeather.</p>
        </div>
      </div>

      <div className="mb-8">
        <WeatherWidget />
      </div>

      <p className="text-sm text-[#0f766e] text-center">
        <Link href={ROUTES.home} className="font-semibold text-[#0c7b93] hover:underline">← Back to home</Link>
      </p>
    </div>
  );
}
