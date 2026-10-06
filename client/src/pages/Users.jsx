import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const inputClass =
  "w-full bg-section border border-line rounded-btn px-3.5 py-2.5 text-sm text-heading focus:outline-none focus:border-primary/60 transition-colors";
const passwordIsValid = (value) =>
  value.length >= 10 &&
  value.length <= 72 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value);
const itemId = (item) => item?.id || item?._id;

function displayDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
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
    setFeedback({ type: "", message: "" });
    if (!passwordIsValid(password)) {
      setFeedback({
        type: "error",
        message:
          "Password must be 10–72 characters and include a letter and a number.",
      });
      return;
    }
    if (isSuperadmin && !clientId) {
      setFeedback({
        type: "error",
        message: "Select an organization for this account.",
      });
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
      setFeedback({
        type: "error",
        message:
          err.response?.data?.error?.message ||
          "We could not create this account.",
      });
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
    <div className="container-page section-pad space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-primary" />
            {isSuperadmin ? "Users" : "Team"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage account access and temporary passwords.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((show) => !show)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />{" "}
          {showAddForm ? "Close form" : "Add member"}
        </button>
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-card text-sm flex items-center gap-3 border ${feedback.type === "success" ? "bg-success/5 border-success/20 text-success" : "bg-danger/5 border-danger/20 text-danger"}`}
          role="status"
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {temporaryPassword && (
        <div
          className="p-5 rounded-card border border-primary/30 bg-primary/5 space-y-3"
          role="status"
        >
          <div>
            <h2 className="text-base">
              Temporary password for {temporaryPassword.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Copy it now. It is shown only once.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={temporaryPassword.value}
              className="input-field font-mono"
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              onClick={copyTemporaryPassword}
              className="btn-primary"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              type="button"
              onClick={() => setTemporaryPassword(null)}
              className="btn-ghost"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="card-surface p-6 space-y-5">
          <div className="flex items-center gap-2 font-semibold text-heading">
            <UserPlus className="w-4 h-4 text-primary" /> New account
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">
                  Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div
              className={`grid gap-4 ${isSuperadmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  10–72 characters, including a letter and number.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className={inputClass}
                >
                  <option value="clientadmin">Client admin</option>
                  <option value="user">Poster creator</option>
                </select>
              </div>
              {isSuperadmin && (
                <div>
                  <label className="block text-sm font-medium text-heading mb-1.5">
                    Organization
                  </label>
                  <select
                    required
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className={inputClass}
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
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {submitting ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card-surface overflow-x-auto">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-heading">
            <UserCheck className="w-4 h-4 text-primary" /> Directory
          </div>
          <span className="text-xs text-muted-foreground">
            {usersList.length} accounts
          </span>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : usersList.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          <table className="w-full min-w-[850px] text-sm text-left">
            <thead className="bg-section border-b border-line text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3.5 px-5">Name</th>
                <th className="py-3.5 px-5">Email</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Last login</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {usersList.map((member) => {
                const id = itemId(member);
                const active = member.isActive !== false;
                const isSelf = id === (user?.id || user?._id);
                return (
                  <tr key={id} className="hover:bg-section/60">
                    <td className="py-4 px-5 font-medium text-heading">
                      {member.name}
                    </td>
                    <td className="py-4 px-5 text-muted-foreground">
                      {member.email}
                    </td>
                    <td className="py-4 px-5">
                      <span className="rounded-chip border border-line px-2.5 py-1 text-xs font-semibold uppercase text-primary">
                        {member.role === "superadmin"
                          ? "Superadmin"
                          : member.role === "clientadmin"
                            ? "Client admin"
                            : "User"}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`text-xs font-medium ${active ? "text-success" : "text-danger"}`}
                      >
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-xs text-muted-foreground">
                      {displayDate(member.lastLoginAt || member.lastLogin)}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={
                            actionId === id ||
                            (!isSuperadmin && isSelf && active)
                          }
                          onClick={() => toggleActive(member)}
                          className="px-3 py-1.5 rounded-btn border border-line text-xs font-medium hover:border-primary disabled:opacity-50"
                        >
                          {active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === id}
                          onClick={() => resetPassword(member)}
                          className="px-3 py-1.5 rounded-btn border border-line text-xs font-medium hover:border-primary disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
