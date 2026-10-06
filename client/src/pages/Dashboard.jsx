import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  Database,
  Server,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    setError(null);
    try {
      const res = await api.get("/health");
      setHealth(res.data);
    } catch (err) {
      setError(err.message || "Failed to reach API");
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="container-page section-pad space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl">
            {user?.name
              ? `Welcome back, ${user.name.split(" ")[0]}`
              : "Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your poster workspace
          </p>
        </div>
        <Link
          to="/create"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-4 py-2.5 rounded-btn text-sm transition-colors shadow-soft"
        >
          <Sparkles className="w-4 h-4" />
          Create poster
        </Link>
      </div>

      {/* Quick-action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/create"
          className="group flex items-start gap-4 p-5 bg-canvas border border-line rounded-card shadow-soft hover:border-primary/40 hover:shadow-md transition-all"
        >
          <div className="p-2.5 rounded-btn bg-primary/10 text-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-heading group-hover:text-primary transition-colors">
              Create a poster
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Describe your event and get an on-brand poster in seconds.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          to="/posters"
          className="group flex items-start gap-4 p-5 bg-canvas border border-line rounded-card shadow-soft hover:border-primary/40 hover:shadow-md transition-all"
        >
          <div className="p-2.5 rounded-btn bg-primary/10 text-primary shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-heading group-hover:text-primary transition-colors">
              My posters
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Download or re-generate previous posters.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* System status (collapsed detail) */}
      <div className="bg-canvas border border-line rounded-card shadow-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Activity className="w-4 h-4 text-success" />
            System status
          </div>
          <button
            onClick={fetchHealth}
            className="text-xs px-3 py-1.5 rounded-btn border border-line text-muted-foreground hover:text-heading hover:border-primary/40 transition-colors"
          >
            Refresh
          </button>
        </div>

        {loadingHealth ? (
          <div className="animate-pulse flex gap-3">
            <div className="h-3 bg-line rounded w-1/4" />
            <div className="h-3 bg-line rounded w-1/6" />
          </div>
        ) : error ? (
          <div className="p-3 bg-danger/5 border border-danger/20 rounded-btn text-danger text-sm">
            ⚠ API check failed: {error}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                icon: <Server className="w-3.5 h-3.5" />,
                label: "API",
                value: health?.status,
                sub: `Uptime ${health?.uptime}s`,
              },
              {
                icon: <Database className="w-3.5 h-3.5" />,
                label: "Database",
                value: health?.db,
                sub: "MongoDB",
              },
              {
                icon: <ShieldCheck className="w-3.5 h-3.5" />,
                label: "Environment",
                value: health?.environment,
                sub: health?.vercel ? "Vercel" : "Local",
              },
              {
                icon: <Layers className="w-3.5 h-3.5" />,
                label: "Checked at",
                value: new Date(health?.timestamp).toLocaleTimeString(),
                sub: "/api/health",
              },
            ].map(({ icon, label, value, sub }) => (
              <div
                key={label}
                className="p-3 bg-section rounded-btn border border-line/60"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-wider mb-1.5">
                  {icon} {label}
                </div>
                <div className="text-sm font-semibold text-heading capitalize truncate">
                  {value}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {sub}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
