"use client";

import { useEffect, useState } from "react";
import { Sun, Wave } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const SIARGAO_LAT = 9.75;
const SIARGAO_LON = 126.05;

interface WeatherData {
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  weather_id: number;
  pop?: number;
}

interface TideData {
  high_tide_time: string | null;
  low_tide_time: string | null;
  entry_date: string;
}

/** Response from GET /api/tide when WorldTides API is configured */
interface TideApiData {
  source: "worldtides";
  highTideTime: string | null;
  lowTideTime: string | null;
  nextLowTideTime: string | null;
  tideNow: "high" | "low" | null;
  extremesToday?: { type: "High" | "Low"; time: string }[];
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return null;
  return (h % 24) * 60 + (isNaN(m) ? 0 : m);
}

function formatTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${h12}:${isNaN(m) ? "00" : String(m).padStart(2, "0")} ${ampm}`;
}

function getTideNow(lowMin: number | null, highMin: number | null, nowMin: number): "high" | "low" | null {
  if (lowMin == null || highMin == null) return null;
  const distToLow = Math.min(Math.abs(nowMin - lowMin), Math.abs(nowMin - lowMin + 24 * 60), Math.abs(nowMin - lowMin - 24 * 60));
  const distToHigh = Math.min(Math.abs(nowMin - highMin), Math.abs(nowMin - highMin + 24 * 60), Math.abs(nowMin - highMin - 24 * 60));
  return distToLow <= distToHigh ? "low" : "high";
}

function getWaveLabel(windMs: number): string {
  if (windMs < 2) return "Calm / Small waves";
  if (windMs < 5) return "Small–moderate waves";
  if (windMs < 10) return "Moderate waves";
  return "Big / choppy waves";
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [tide, setTide] = useState<TideData | null>(null);
  const [tideApi, setTideApi] = useState<TideApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const load = async () => {
      if (!key) {
        setLoading(false);
        return;
      }
      try {
        const [weatherRes, tideRes, supabase] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${SIARGAO_LAT}&lon=${SIARGAO_LON}&appid=${key}&units=metric`),
          fetch("/api/tide").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          (async () => {
            try {
              return createClient();
            } catch {
              return null;
            }
          })(),
        ]);

        if (!weatherRes.ok) throw new Error("Weather unavailable");
        const w = await weatherRes.json();
        setWeather({
          temp: Math.round(w.main.temp),
          feels_like: Math.round(w.main.feels_like),
          description: w.weather[0]?.description ?? "",
          icon: w.weather[0]?.icon ?? "",
          humidity: w.main.humidity ?? 0,
          wind_speed: w.wind?.speed ?? 0,
          weather_id: w.weather[0]?.id ?? 0,
          pop: w.pop,
        });

        if (tideRes?.source === "worldtides") {
          setTideApi(tideRes);
        } else if (supabase) {
          const { data } = await supabase.from("tide_entries").select("entry_date, high_tide_time, low_tide_time").eq("entry_date", today).maybeSingle();
          if (data) setTide(data);
        }
      } catch {
        setError("Could not load weather");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading && !weather) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white/80 p-4 sm:p-5 animate-pulse">
        <div className="h-5 w-32 bg-teal-100 rounded mb-3" />
        <div className="h-8 w-20 bg-teal-100 rounded" />
      </div>
    );
  }

  if (error || !weather) return null;

  const iconUrl = `https://openweathermap.org/img/wn/${weather.icon}@2x.png`;
  const isRain = weather.weather_id >= 500 && weather.weather_id < 600 || weather.description.toLowerCase().includes("rain") || (weather.pop != null && weather.pop > 0.5);
  const waveLabel = getWaveLabel(weather.wind_speed);
  const goodSurf = !isRain && weather.wind_speed >= 2 && weather.wind_speed <= 12;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const useApi = tideApi != null;
  const highTime = useApi ? tideApi.highTideTime : formatTime(tide?.high_tide_time ?? null);
  const lowTime = useApi ? tideApi.lowTideTime : formatTime(tide?.low_tide_time ?? null);
  const tideNow = useApi ? tideApi.tideNow : getTideNow(parseTimeToMinutes(tide?.low_tide_time ?? null) ?? 0, parseTimeToMinutes(tide?.high_tide_time ?? null) ?? 0, nowMin);
  const nextLowFormatted = useApi ? (tideApi.nextLowTideTime ?? lowTime) : formatTime(tide?.low_tide_time ?? null);
  const lowMin = parseTimeToMinutes(tide?.low_tide_time ?? null);
  const goodMagpupungko = tideNow === "low" || (!useApi && lowMin != null && Math.abs(nowMin - lowMin) <= 90) || (useApi && tideNow === "low");

  const hasTide = useApi || tide != null;

  return (
    <div className="rounded-2xl border border-teal-200 bg-white/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-center gap-2 bg-[#0c7b93]/10 px-4 py-2 border-b border-teal-100">
        <Sun size={18} className="text-[#f59e0b] shrink-0" />
        <span className="text-sm font-semibold text-[#134e4a]">Siargao Weather & Forecast</span>
      </div>

      <div className="p-4 sm:p-5">
        {/* Landscape on md+: two columns. Mobile: single column. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Left: current weather, Rain, Waves */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={iconUrl} alt="" className="w-12 h-12 sm:w-14 sm:h-14 animate-weather-icon" />
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-[#134e4a]">{weather.temp}°C</p>
                  <p className="text-sm text-[#0f766e] capitalize">{weather.description}</p>
                  <p className="text-xs text-[#0f766e]/80">Feels like {weather.feels_like}°C · Humidity {weather.humidity}%</p>
                </div>
              </div>
              <div className="text-right text-xs text-[#0f766e]">
                <p className="font-medium text-[#134e4a]">Wind {weather.wind_speed} m/s</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#fef9e7] border border-teal-100 p-3">
              <p className="text-sm font-semibold text-[#134e4a]">Rain</p>
              <p className="text-sm text-[#0f766e]">{isRain ? "Yes — expect rain." : "No rain expected."}</p>
            </div>

            <div className="rounded-xl bg-[#fef9e7] border border-teal-100 p-3 flex items-center gap-2">
              <Wave size={20} className="text-[#0c7b93] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#134e4a]">Waves</p>
                <p className="text-sm text-[#0f766e]">{waveLabel}</p>
              </div>
            </div>
          </div>

          {/* Right: Tide, Surf, Magpupungko */}
          <div className="space-y-4">
            <div className="rounded-xl bg-[#fef9e7] border border-teal-100 p-3">
              <p className="text-sm font-semibold text-[#134e4a]">Tide today</p>
              {hasTide ? (
                <>
                  {useApi && tideApi.extremesToday && tideApi.extremesToday.length > 0 ? (
                    <div className="text-sm text-[#0f766e] space-y-1">
                      {tideApi.extremesToday.map((ex, i) => (
                        <p key={i}>
                          {ex.type === "High" ? "High" : "Low"} tide — {ex.time}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#0f766e]">
                      High tide {highTime !== "—" ? highTime : "—"} · Low tide {lowTime !== "—" ? lowTime : "—"}
                    </p>
                  )}
                  <p className="text-sm font-medium text-[#134e4a] mt-1">
                    Now: {tideNow === "high" ? "High tide" : tideNow === "low" ? "Low tide" : "—"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#0f766e]">Tide times not set for today. Add times in admin.</p>
              )}
            </div>

            <div className="rounded-xl bg-[#0c7b93]/10 border border-teal-200 p-3">
              <p className="text-sm font-semibold text-[#134e4a]">Good time to surf?</p>
              <p className="text-sm text-[#0f766e]">
                {goodSurf ? "Yes — conditions are reasonable for surfing." : isRain ? "Rain expected — less ideal." : weather.wind_speed < 2 ? "Very light wind — waves may be small." : "Strong wind — choppy. Check local break."}
              </p>
            </div>

            <div className="rounded-xl bg-[#0d9488]/10 border border-teal-200 p-3">
              <p className="text-sm font-semibold text-[#134e4a]">Magpupungko rock pools</p>
              <p className="text-sm text-[#0f766e]">
                Best at low tide so you can see the pools and rocks. {hasTide ? (
                  goodMagpupungko ? (
                    <span className="font-medium text-[#0f766e]">Good time to visit today — around low tide.</span>
                  ) : (
                    <>Best time today: around {nextLowFormatted} (next low tide).</>
                  )
                ) : (
                  "Add tide times (or WorldTides API key) to see the best time to visit today."
                )}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
