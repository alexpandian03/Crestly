import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const passwordIsValid = (value) =>
  value.length >= 10 &&
  value.length <= 72 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value);

const itemId = (item) => item?.id || item?._id;

function formatRole(role) {
  if (role === "superadmin") return "Super admin";
  if (role === "clientadmin") return "Client admin";
  return "User";
}

function formatLoginDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Users() {
  const { user, activeClientId } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const [usersList, setUsersList] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(isSuperadmin ? "clientadmin" : "user");
  const [clientId, setClientId] = useState(activeClientId || "");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [dialogError, setDialogError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersResponse, clientsResponse] = await Promise.all([
        api.get("/users"),
        isSuperadmin ? api.get("/clients") : Promise.resolve(null),
      ]);
      setUsersList(usersResponse.data?.data?.users || []);
      if (clientsResponse) {
        const nextClients = clientsResponse.data?.data?.clients || [];
        setClients(nextClients);
        setClientId(
          (current) =>
            current || activeClientId || itemId(nextClients[0]) || "",
        );
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.error?.message ||
          "We could not load the user list.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isSuperadmin]);

  useEffect(() => {
    if (isSuperadmin && activeClientId) setClientId(activeClientId);
  }, [activeClientId, isSuperadmin]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setDialogError("");
    if (!passwordIsValid(password)) {
      setDialogError(
        "Password must be 10–72 characters and include at least one letter and one number.",
      );
      return;
    }
    if (isSuperadmin && !clientId) {
      setDialogError("Select an organization for this account.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      };
      if (isSuperadmin) payload.clientId = clientId;
      const response = await api.post("/users", payload);
      const createdUser = response.data?.data?.user;
      setFeedback({
        type: "success",
        message: `${createdUser?.name || "User"} was added successfully.`,
      });
      setName("");
      setEmail("");
      setPassword("");
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      setDialogError(
        err.response?.data?.error?.message ||
          "We could not create this account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (member) => {
    const id = itemId(member);
    const isSelf = id === (user?.id || user?._id);
    if (!isSuperadmin && isSelf && member.isActive !== false) {
      setFeedback({
        type: "error",
        message: "You cannot deactivate your own account.",
      });
      return;
    }
    try {
      setActionId(id);
      await api.patch(`/users/${id}`, { isActive: member.isActive === false });
      setFeedback({
        type: "success",
        message: `${member.name} was ${member.isActive === false ? "activated" : "deactivated"}.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.error?.message ||
          "We could not update this account.",
      });
    } finally {
      setActionId("");
    }
  };

  const resetPassword = async (member) => {
    const id = itemId(member);
    try {
      setActionId(id);
      setTemporaryPassword(null);
      const response = await api.post(`/users/${id}/reset-password`);
      const value = response.data?.data?.temporaryPassword;
      if (!value) throw new Error("No temporary password was returned.");
      setTemporaryPassword({ name: member.name, value });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.error?.message ||
          err.message ||
          "We could not reset the password.",
      });
    } finally {
      setActionId("");
    }
  };

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword.value);
      toast.success("Temporary password copied.");
    } catch {
      setFeedback({
        type: "error",
        message:
          "Copy failed. Select the temporary password and copy it manually.",
      });
    }
  };

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
              {isSuperadmin ? "Users" : "Team"}
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Manage account access and temporary passwords.
            </p>
          </div>
          <Button
            onClick={() => {
              setDialogError("");
              setShowAddForm(true);
            }}
            className="h-9 px-3.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors shadow-none"
          >
            <Plus className="w-4 h-4" />
            <span>Add member</span>
          </Button>
        </div>

        {/* Feedback message banner */}
        {feedback.message && (
          <div
            className={`p-3 rounded-[8px] border text-xs flex items-center justify-between gap-3 ${
              feedback.type === "success"
                ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]"
                : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
            }`}
            role="status"
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setFeedback({ type: "", message: "" })}
              className="p-0.5 text-[#9CA3AF] hover:text-[#111827]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Temporary password alert banner */}
        {temporaryPassword && (
          <div
            className="p-4 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] space-y-3"
            role="status"
          >
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">
                Temporary password for {temporaryPassword.name}
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Copy it now. It is shown only once.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 max-w-md">
              <Input
                readOnly
                value={temporaryPassword.value}
                className="h-9 font-mono text-sm rounded-[6px] border-[#E5E7EB] bg-white text-[#111827]"
                onFocus={(event) => event.target.select()}
              />
              <Button
                type="button"
                onClick={copyTemporaryPassword}
                className="h-9 px-3 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium shrink-0 gap-1.5 shadow-none"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTemporaryPassword(null)}
                className="h-9 px-3 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] shrink-0"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Table container: 1px-bordered 8px-radius, no shadow */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white overflow-hidden">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] border-b border-[#E5E7EB] hover:bg-[#FAFAFA]">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Name
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Email
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Role
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Status
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Last login
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index} className="border-b border-[#E5E7EB]">
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-32 rounded-[4px]" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-44 rounded-[4px]" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-20 rounded-[4px]" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-16 rounded-[4px]" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-24 rounded-[4px]" />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Skeleton className="h-8 w-36 ml-auto rounded-[6px]" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : usersList.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-medium text-[#111827]">
                No members found
              </p>
              <p className="text-xs text-[#6B7280]">
                Add a team member to give them access to create posters.
              </p>
              <Button
                onClick={() => {
                  setDialogError("");
                  setShowAddForm(true);
                }}
                className="mt-2 h-9 px-3.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add member</span>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] border-b border-[#E5E7EB] hover:bg-[#FAFAFA]">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Name
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Email
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Role
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Status
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Last login
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersList.map((member) => {
                  const id = itemId(member);
                  const active = member.isActive !== false;
                  const isSelf = id === (user?.id || user?._id);
                  return (
                    <TableRow
                      key={id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <TableCell className="px-4 py-3 font-medium text-sm text-[#111827]">
                        {member.name}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-[#6B7280]">
                        {member.email}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-[#6B7280]">
                        {formatRole(member.role)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              active ? "bg-[#16A34A]" : "bg-[#9CA3AF]"
                            }`}
                          />
                          <span
                            className={
                              active
                                ? "text-[#16A34A] font-medium"
                                : "text-[#6B7280]"
                            }
                          >
                            {active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-[#6B7280]">
                        {formatLoginDate(
                          member.lastLoginAt || member.lastLogin,
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionId === id}
                            onClick={() => resetPassword(member)}
                            className="h-8 px-2.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50 inline-flex items-center gap-1.5 shadow-none"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>Reset password</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={
                              actionId === id ||
                              (!isSuperadmin && isSelf && active)
                            }
                            onClick={() => toggleActive(member)}
                            className="h-8 px-2.5 rounded-[6px] text-xs font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] disabled:opacity-50"
                          >
                            {active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Add member Dialog */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="sm:max-w-md rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">
                Add team member
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280]">
                Create a new account with an initial temporary password.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#111827]">
                  Name
                </label>
                <Input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Alex Smith"
                  className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#111827]">
                  Email
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="alex@organization.com"
                  className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#111827]">
                  Temporary password
                </label>
                <Input
                  type="password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 10 characters"
                  className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827]"
                />
                <p className="text-[11px] text-[#6B7280]">
                  10–72 characters, including at least one letter and one number.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#111827]">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="h-9 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 text-sm text-[#111827] outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                >
                  <option value="user">User</option>
                  <option value="clientadmin">Client admin</option>
                </select>
              </div>

              {isSuperadmin && (
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#111827]">
                    Organization
                  </label>
                  <select
                    required
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className="h-9 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 text-sm text-[#111827] outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                  >
                    <option value="">Select organization</option>
                    {clients.map((client) => (
                      <option key={itemId(client)} value={itemId(client)}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dialogError && (
                <p className="text-xs text-[#DC2626] leading-snug">
                  {dialogError}
                </p>
              )}

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="h-9 px-3 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium shadow-none disabled:opacity-50 gap-1.5"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>{submitting ? "Adding…" : "Add member"}</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
