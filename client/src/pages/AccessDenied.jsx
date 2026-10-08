import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";

function homeForRole(role) {
  if (role === "superadmin") return "/clients";
  if (role === "clientadmin") return "/dashboard";
  return "/create";
}

export default function AccessDenied() {
  const location = useLocation();
  const { user } = useAuth();
  const [message] = useState(
    () =>
      location.state?.message ||
      sessionStorage.getItem("accessDeniedMessage") ||
      "You don't have access to that page.",
  );

  useEffect(() => {
    sessionStorage.removeItem("accessDeniedMessage");
  }, []);

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md rounded-[8px] border border-[#E5E7EB] bg-white p-8 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-[#DC2626] mx-auto" />
        <h1 className="text-[24px] font-semibold text-[#111827] tracking-tight">
          You don&apos;t have access
        </h1>
        <p className="text-sm text-[#6B7280]">{message}</p>
        <Button
          asChild
          className="h-9 gap-1.5 rounded-[6px] bg-[#2563EB] text-sm font-medium text-white shadow-none hover:bg-[#1D4ED8]"
        >
          <Link to={homeForRole(user?.role)}>
            <ArrowLeft className="w-4 h-4" />
            Return to your workspace
          </Link>
        </Button>
      </div>
    </div>
  );
}
