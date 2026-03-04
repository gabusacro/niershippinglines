"use client";

import { useEffect, useState } from "react";
import { Sun, Wave } from "@/components/icons";

const SIARGAO_LAT = 9.75;
const SIARGAO_LON = 126.05;

interface WeatherState {
  temp: number;
  feels_like: number;
  description: string;
  humidity: number;
  wind_speed: number; // km/h
  wind_dir: string;
  precip: number; // mm
  is_day: boolean;
  weather_code: number;
}

function getWeatherDescription(code: number, isDay: boolean): { label: string; emoji: string } {
  if (code === 0) return { label: isDay ? "Clear sky" : "Clear night", emoji: isDay ? "☀️" : "🌙" };
  if (code <= 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code <= 49) return { label: "Foggy", emoji: "🌫️" };
  if (code <= 59) return { label: "Drizzle", emoji: "🌦️" };
  if (code <= 69) return { label: "Rain", emoji: "🌧️" };
  if (code <= 79) return { label: "Snow / sleet", emoji: "🌨️" };
  if (code <= 82) return { label: "Rain showers", emoji: "🌦️" };
  if (code <= 84) return { label: "Heavy showers", emoji: "⛈️" };
  if (code <= 99) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Unknown", emoji: "🌡️" };
}

function getWindDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "N";
}

function getSeaCondition(windKmh: number): { label: string; color: string; safe: boolean } {
  if (windKmh < 15) return { label: "Calm — good sailing conditions", color: "text-emerald-700", safe: true };
  if (windKmh < 25) return { label: "Light chop — generally safe", color: "text-emerald-700", safe: true };
  if (windKmh < 40) return { label: "Moderate waves — exercise caution", color: "text-amber-700", safe: false };
  if (windKmh < 55) return { label: "Rough seas — small vessels at risk", color: "text-red-700", safe: false };
  return { label: "Very rough — sailing not advised", color: "text-red-700", safe: false };
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Open-Meteo: free, no API key, open source
        const url = [
          "https://api.open-meteo.com/v1/forecast",
          `?latitude=${SIARGAO_LAT}&longitude=${SIARGAO_LON}`,
          "&current=temperature_2m,relative_humidity_2m,apparent_temperature",
          ",precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
          "&wind_speed_unit=kmh&timezone=Asia%2FManila",
        ].join("");

        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        const c = data.current;

        setWeather({
          temp: Math.round(c.temperature_2m),
          feels_like: Math.round(c.apparent_temperature),
          humidity: c.relative_humidity_2m,
          wind_speed: Math.round(c.wind_speed_10m),
          wind_dir: getWindDir(c.wind_direction_10m),
          precip: c.precipitation ?? 0,
          is_day: c.is_day === 1,
          weather_code: c.weather_code,
          description: getWeatherDescription(c.weather_code, c.is_day === 1).label,
        });

        const now = new Date();
        setLastUpdated(
          now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white/80 p-5 animate-pulse text-center">
        <div className="h-5 w-40 bg-teal-100 rounded mx-auto mb-3" />
        <div className="h-10 w-24 bg-teal-100 rounded mx-auto" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white/80 p-5 text-center">
        <p className="text-sm text-[#0f766e]">Weather data unavailable. Check{" "}
          <a href="https://www.pagasa.dost.gov.ph" target="_blank" rel="noopener noreferrer"
            className="font-bold text-[#0c7b93] underline">PAGASA</a> for official forecast.
        </p>
      </div>
    );
  }

  const { label, emoji } = getWeatherDescription(weather.weather_code, weather.is_day);
  const sea = getSeaCondition(weather.wind_speed);
  const isRain = weather.precip > 0 || weather.weather_code >= 51;

  return (
    <div className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 bg-[#0c7b93]/10 px-4 py-2.5 border-b border-teal-100">
        <Sun size={16} className="text-[#f59e0b] shrink-0" />
        <span className="text-sm font-bold text-[#134e4a]">Siargao Live Weather</span>
        {lastUpdated && (
          <span className="text-xs text-[#0f766e]/60 ml-1">· updated {lastUpdated}</span>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Main temp row */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-5xl">{emoji}</span>
          <div className="text-center">
            <p className="text-4xl font-black text-[#134e4a]">{weather.temp}°C</p>
            <p className="text-sm font-semibold text-[#0f766e] capitalize">{label}</p>
            <p className="text-xs text-[#0f766e]/70">Feels like {weather.feels_like}°C</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-3 py-2.5">
            <p className="text-xs font-bold text-[#0f766e] uppercase tracking-wide">Humidity</p>
            <p className="text-lg font-black text-[#134e4a]">{weather.humidity}%</p>
          </div>
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-3 py-2.5">
            <p className="text-xs font-bold text-[#0f766e] uppercase tracking-wide">Wind</p>
            <p className="text-lg font-black text-[#134e4a]">{weather.wind_speed} <span className="text-sm font-semibold">km/h</span></p>
            <p className="text-xs text-[#0f766e]">{weather.wind_dir}</p>
          </div>
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-3 py-2.5">
            <p className="text-xs font-bold text-[#0f766e] uppercase tracking-wide">Rain</p>
            <p className="text-lg font-black text-[#134e4a]">{weather.precip} <span className="text-sm font-semibold">mm</span></p>
          </div>
        </div>

        {/* Sea condition banner */}
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
          sea.safe
            ? "bg-emerald-50 border-emerald-200"
            : weather.wind_speed >= 40
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <Wave size={20} className={`shrink-0 ${sea.safe ? "text-emerald-600" : weather.wind_speed >= 40 ? "text-red-600" : "text-amber-600"}`} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#134e4a]">Sea Conditions</p>
            <p className={`text-sm font-semibold ${sea.color}`}>{sea.label}</p>
          </div>
        </div>

        {/* Rain notice */}
        {isRain && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-2">
            <span className="text-lg">🌧️</span>
            <p className="text-sm font-semibold text-blue-800">
              Rain expected today — bring a rain jacket and waterproof your bags.
            </p>
          </div>
        )}

        {/* PAGASA official link */}
        <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-center">
          <p className="text-xs text-[#0f766e] font-semibold">
            Weather data via{" "}
            <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer"
              className="font-bold text-[#0c7b93] hover:underline">Open-Meteo</a>
            {" "}· Official PH forecast:{" "}
            <a href="https://www.pagasa.dost.gov.ph/marine/gale-warning" target="_blank" rel="noopener noreferrer"
              className="font-bold text-[#0c7b93] hover:underline">PAGASA Gale Warning</a>
            {" "}·{" "}
            <a href="https://www.pagasa.dost.gov.ph/weather#daily-weather-forecast" target="_blank" rel="noopener noreferrer"
              className="font-bold text-[#0c7b93] hover:underline">Daily Forecast</a>
          </p>
        </div>
      </div>
    </div>
  );
}
