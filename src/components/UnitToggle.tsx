"use client";

import { UnitPreference } from "@/lib/types";

interface UnitToggleProps {
  value: UnitPreference;
  onChange: (unit: UnitPreference) => void;
}

export function UnitToggle({ value, onChange }: UnitToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange("metric")}
        className={`px-3 py-1 text-sm rounded ${
          value === "metric" ? "bg-white text-black font-bold" : "bg-transparent text-gray-400"
        }`}
      >
        Metric
      </button>
      <button
        onClick={() => onChange("imperial")}
        className={`px-3 py-1 text-sm rounded ${
          value === "imperial" ? "bg-white text-black font-bold" : "bg-transparent text-gray-400"
        }`}
      >
        Imperial
      </button>
    </div>
  );
}
