"use client";

import { UnitPreference } from "@/lib/types";

interface UnitToggleProps {
  value: UnitPreference;
  onChange: (unit: UnitPreference) => void;
}

export function UnitToggle({ value, onChange }: UnitToggleProps) {
  return (
    <div className="inline-flex items-center border border-black">
      <button
        onClick={() => onChange("metric")}
        className={`px-3 py-1 text-[10px] font-[family-name:var(--font-pixel)] uppercase tracking-[0.12em] transition-colors ${
          value === "metric"
            ? "bg-black text-white"
            : "bg-transparent text-gray hover:text-black"
        }`}
      >
        Metric
      </button>

      <button
        onClick={() => onChange("imperial")}
        className={`px-3 py-1 text-[10px] font-[family-name:var(--font-pixel)] uppercase tracking-[0.12em] transition-colors ${
          value === "imperial"
            ? "bg-black text-white"
            : "bg-transparent text-gray hover:text-black"
        }`}
      >
        Imperial
      </button>
    </div>
  );
}
