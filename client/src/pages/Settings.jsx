import React from "react";
import { Link } from "react-router-dom";
import { Images, LayoutTemplate, Palette } from "lucide-react";
import DesignModesCard from "../components/brand/DesignModesCard";

/** Where the rules of this organization live: what people may do, not what a poster looks like. */
const SHORTCUTS = [
  {
    to: "/brand-kit",
    icon: Palette,
    title: "Brand kit",
    desc: "Your logo, name, contact details, colours and fonts.",
  },
  {
    to: "/templates",
    icon: LayoutTemplate,
    title: "Templates",
    desc: "Layouts your team picks when they make a poster.",
  },
  {
    to: "/posters",
    icon: Images,
    title: "Posters",
    desc: "Everything your organization has made so far.",
  },
];

export default function Settings() {
  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
            Settings
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Choices about how your organization works. These do not change what
            a poster looks like — that stays in the brand kit and the templates.
          </p>
        </div>

        <DesignModesCard />

        <div className="grid gap-4 sm:grid-cols-3">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card-surface p-4 space-y-2 hover:border-[#D1D5DB] transition-colors"
            >
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-heading">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-snug">
                {item.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
