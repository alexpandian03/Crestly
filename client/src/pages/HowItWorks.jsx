import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { APP_NAME } from "../config/brand";
import { Button } from "../components/ui/button";

const STEPS = [
  {
    n: "1",
    title: "Describe the event",
    body: "Name, date, time, and place in everyday words.",
  },
  {
    n: "2",
    title: "Pick a layout",
    body: "Choose a template. Header and footer stay in place.",
  },
  {
    n: "3",
    title: "Review the middle",
    body: `${APP_NAME} fills only the center. Your brand header and footer stay put.`,
  },
  {
    n: "4",
    title: "Download",
    body: "Save as PNG, JPG, or PDF and share.",
  },
];

export default function HowItWorks() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="pb-6 border-b border-[#E5E7EB]">
        <h1 className="text-[24px] font-semibold text-[#111827] tracking-tight">
          How it works
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Four steps from a short description to a finished poster.
        </p>
      </div>

      <ol className="space-y-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="rounded-[8px] border border-[#E5E7EB] bg-white p-4 flex items-start gap-3.5"
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] text-xs font-semibold text-[#111827] flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">{s.title}</h2>
              <p className="text-xs text-[#6B7280] mt-1">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Button
        asChild
        className="h-9 gap-1.5 rounded-[6px] bg-[#2563EB] text-sm font-medium text-white shadow-none hover:bg-[#1D4ED8]"
      >
        <Link to="/">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </Button>
    </div>
  );
}
