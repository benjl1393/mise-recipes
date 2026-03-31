"use client";

import { UnitPreference } from "@/lib/types";

interface UnitToggleProps {
  value: UnitPreference;
  onChange: (unit: UnitPreference) => void;
}

export function UnitToggle({ value, onChange }: UnitToggleProps) {
  return (
    <div className="flex items-center border border-border">
      <button
        onClick={() => onChange("metric")}
        className={`px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
          value === "metric"
            ? "bg-accent text-text font-semibold"
            : "bg-transparent text-text-secondary hover:text-text"
        }`}
      >
        Metric
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={() => onChange("imperial")}
        className={`px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
          value === "imperial"
            ? "bg-accent text-text font-semibold"
            : "bg-transparent text-text-secondary hover:text-text"
        }`}
      >
        Imperial
      </button>
    </div>
  );
}
