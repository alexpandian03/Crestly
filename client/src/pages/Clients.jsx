import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { Plus, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Skeleton } from "../components/ui/skeleton";

export default function Clients() {
  const { activeClientId, selectActiveClient } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("starter");
  const [feedback, setFeedback] = useState({ type: null, message: "" });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clients");
      if (res.data?.success) setClients(res.data?.data?.clients || []);
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.error?.message ||
          err.message ||
          "Failed to load organisations",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setCreating(true);
      setFeedback({ type: null, message: "" });
      const res = await api.post("/clients", { name: name.trim(), plan });
      if (res.data?.success) {
        const createdClient = res.data?.data?.client;
        setFeedback({
          type: "success",
          message: `"${createdClient?.name || name.trim()}" registered successfully.`,
        });
        setName("");
        setPlan("starter");
        setShowModal(false);
        fetchClients();
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.error?.message ||
          err.message ||
          "Failed to create organisation",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-[24px] font-semibold text-[#111827] tracking-tight">
            Organisations
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage registered client tenants and their service tiers.
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="h-9 gap-1.5 rounded-[6px] bg-[#2563EB] text-sm font-medium text-white shadow-none hover:bg-[#1D4ED8]"
        >
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </div>

      {/* Feedback banner */}
      {feedback.message && (
        <div
          role="status"
          className={`p-3 rounded-[6px] text-xs flex items-center gap-2 border ${
            feedback.type === "success"
              ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Table container */}
      <div className="rounded-[8px] border border-[#E5E7EB] bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-4 w-44 rounded" />
                <Skeleton className="h-4 w-28 rounded hidden md:block" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-8 w-24 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="h-10 w-10 text-[#9CA3AF] mx-auto" />
            <h3 className="text-sm font-semibold text-[#111827]">
              No organisations yet
            </h3>
            <p className="text-xs text-[#6B7280]">
              Register your first client organisation to get started.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModal(true)}
              className="mt-2 h-8 rounded-[6px] border-[#E5E7EB] text-xs font-medium text-[#111827] shadow-none hover:bg-[#F3F4F6]"
            >
              Add organisation
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] border-b border-[#E5E7EB] hover:bg-[#FAFAFA]">
                  <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Name
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] hidden md:table-cell">
                    Tenant ID
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Plan
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Status
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] hidden sm:table-cell">
                    Created
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const id = client.id || client._id;
                  const isActive = client.isActive !== false;
                  return (
                    <TableRow
                      key={id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <TableCell className="py-3 px-4 text-sm font-medium text-[#111827]">
                        {client.name}
                      </TableCell>
                      <TableCell className="py-3 px-4 font-mono text-xs text-[#6B7280] hidden md:table-cell">
                        {id}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs capitalize text-[#4B5563]">
                        {client.plan || "starter"}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#374151]">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isActive ? "bg-[#16A34A]" : "bg-[#9CA3AF]"
                            }`}
                          />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-[#6B7280] hidden sm:table-cell">
                        {client.createdAt
                          ? new Date(client.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!isActive || activeClientId === id}
                          onClick={() => selectActiveClient(id)}
                          className="h-7 rounded-[6px] border-[#E5E7EB] text-xs font-medium text-[#111827] shadow-none hover:bg-[#F3F4F6] disabled:opacity-40"
                        >
                          {activeClientId === id ? "Selected" : "Work as client"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Client Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md rounded-[8px] border-[#E5E7EB] bg-white p-6 shadow-none">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#111827]">
              Register new client
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Create a new client tenant organization and assign a plan tier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="client-name"
                className="text-xs font-medium text-[#111827]"
              >
                Organisation name
              </Label>
              <Input
                id="client-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nike Global"
                className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] shadow-none focus-visible:ring-1 focus-visible:ring-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="client-plan"
                className="text-xs font-medium text-[#111827]"
              >
                Plan
              </Label>
              <Select value={plan} onValueChange={(val) => setPlan(val)}>
                <SelectTrigger
                  id="client-plan"
                  className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] shadow-none focus:ring-1 focus:ring-[#2563EB]"
                >
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent className="rounded-[6px] border-[#E5E7EB]">
                  <SelectItem value="free" className="text-sm">
                    Free
                  </SelectItem>
                  <SelectItem value="starter" className="text-sm">
                    Starter
                  </SelectItem>
                  <SelectItem value="pro" className="text-sm">
                    Pro
                  </SelectItem>
                  <SelectItem value="enterprise" className="text-sm">
                    Enterprise
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowModal(false)}
                className="h-9 rounded-[6px] text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="h-9 rounded-[6px] bg-[#2563EB] text-xs font-medium text-white shadow-none hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
