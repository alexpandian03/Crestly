import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* ------------------------------------------------------------------ *
 * Choosing the organization a superadmin works on.
 *
 * The bar above every page and the dialog under it read the same list, so an organization that
 * the dialog offers has to be one the bar will then accept.
 * ------------------------------------------------------------------ */

const auth = { activeClientId: "", selectActiveClient: vi.fn() };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));

const api = { get: vi.fn() };
vi.mock("../../services/api", () => ({ default: api }));

const { useClientOptions } = await import("./useClientOptions");
const { OrgBar, OrgPicker } = await import("./OrgBar");

const active = { _id: "64b00000000000000000000a", name: "Test Club", isActive: true };
const retired = { _id: "64b00000000000000000000b", name: "Rotary Club", isActive: false };

/** The bar, the dialog and the picked organization, as the shell wires them. */
function Shell() {
  const [picked, setPicked] = useState("");
  const [open, setOpen] = useState(false);
  auth.activeClientId = picked;
  auth.selectActiveClient = (id) => setPicked(id || "");
  const org = useClientOptions(true);
  const ask = () => {
    org.reload();
    setOpen(true);
  };
  return (
    <>
      <OrgBar selected={org.selected} onChange={ask} />
      <OrgPicker
        open={open}
        clients={org.clients}
        currentId={picked}
        loading={org.loading}
        onClose={() => setOpen(false)}
        onPick={org.select}
      />
    </>
  );
}

let user;

beforeEach(() => {
  user = userEvent.setup();
  api.get.mockReset().mockResolvedValue({
    data: { success: true, data: { clients: [active, retired] } },
  });
});

describe("the organization picker", () => {
  it("narrows the list as words are typed", async () => {
    render(<Shell />);
    await user.click(await screen.findByRole("button", { name: "Select organization" }));
    await user.type(screen.getByLabelText("Search organizations"), "Rotary");
    expect(await screen.findByRole("button", { name: /^Rotary Club/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Test Club" })).toBe(null);
  });

  it("works on an organization that is still running", async () => {
    render(<Shell />);
    await user.click(await screen.findByRole("button", { name: "Select organization" }));
    await user.click(await screen.findByRole("button", { name: "Test Club" }));
    expect(await screen.findByText("Test Club")).toBeInTheDocument();
    expect(screen.getByText("Working on")).toBeInTheDocument();
  });

  it("says so when an organization cannot be worked on", async () => {
    render(<Shell />);
    await user.click(await screen.findByRole("button", { name: "Select organization" }));
    const stopped = await screen.findByRole("button", { name: /^Rotary Club/ });
    expect(stopped).toBeDisabled();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    await user.click(stopped);
    expect(screen.getByText(/Select an organization to open/)).toBeInTheDocument();
  });
});
