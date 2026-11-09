import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpotlightOverlay } from "../components/SpotlightOverlay";
import type { VaultEntry, VaultStatus } from "../types/vault";

const mockStatusUnlocked: VaultStatus = {
  exists: true,
  backup_exists: true,
  unlocked: true,
  vault_path: "D:\\test.vault",
  auto_lock_minutes: 5,
  windows_hello_available: true,
  windows_hello_enabled: true,
};

const mockStatusLocked: VaultStatus = {
  ...mockStatusUnlocked,
  unlocked: false,
};

const mockEntries: VaultEntry[] = [
  {
    id: "1",
    title: "Netflix Streaming",
    raw_text: "Netflix Streaming\nemail: netflix@test.com\npass: netpass123",
    fields: [
      { key: "email", value: "netflix@test.com", kind: "email" },
      { key: "pass", value: "netpass123", kind: "secret" },
    ],
    tags: ["streaming"],
    notes: "",
    favorite: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Amazon Prime",
    raw_text: "Amazon Prime\nemail: amazon@test.com\npass: amzpass456",
    fields: [
      { key: "email", value: "amazon@test.com", kind: "email" },
      { key: "pass", value: "amzpass456", kind: "secret" },
    ],
    tags: ["shopping"],
    notes: "",
    favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe("SpotlightOverlay Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters entries by title, email, or tag and allows keyboard selection", async () => {
    const onCopySecret = vi.fn().mockResolvedValue(undefined);
    const onCopyEmail = vi.fn().mockResolvedValue(undefined);
    const onExpandToFull = vi.fn();
    const onClose = vi.fn();
    const onUnlock = vi.fn().mockResolvedValue(undefined);
    const onUnlockWithWindowsHello = vi.fn().mockResolvedValue(undefined);

    render(
      <SpotlightOverlay
        status={mockStatusUnlocked}
        entries={mockEntries}
        onCopySecret={onCopySecret}
        onCopyEmail={onCopyEmail}
        onExpandToFull={onExpandToFull}
        onClose={onClose}
        onUnlock={onUnlock}
        onUnlockWithWindowsHello={onUnlockWithWindowsHello}
      />
    );

    expect(screen.getByText("Netflix Streaming")).toBeInTheDocument();
    expect(screen.getByText("Amazon Prime")).toBeInTheDocument();

    // Type query "amazon"
    const input = screen.getByPlaceholderText(/Cari akun, email/i);
    fireEvent.change(input, { target: { value: "amazon" } });

    expect(screen.queryByText("Netflix Streaming")).not.toBeInTheDocument();
    expect(screen.getByText("Amazon Prime")).toBeInTheDocument();

    // Press Enter to copy password
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCopySecret).toHaveBeenCalledWith(mockEntries[1]);

    // Press Tab to copy email
    fireEvent.keyDown(input, { key: "Tab" });
    expect(onCopyEmail).toHaveBeenCalledWith(mockEntries[1]);

    // Press Esc to close
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders locked view when vault is locked and provides Windows Hello quick-unlock", () => {
    const onUnlockWithWindowsHello = vi.fn().mockResolvedValue(undefined);

    render(
      <SpotlightOverlay
        status={mockStatusLocked}
        entries={mockEntries}
        onCopySecret={vi.fn()}
        onCopyEmail={vi.fn()}
        onExpandToFull={vi.fn()}
        onClose={vi.fn()}
        onUnlock={vi.fn()}
        onUnlockWithWindowsHello={onUnlockWithWindowsHello}
      />
    );

    expect(screen.getByText(/Velo Spotlight — Brankas Terkunci/i)).toBeInTheDocument();
    const helloBtn = screen.getByRole("button", {
      name: /Buka Cepat dengan Windows Hello/i,
    });
    expect(helloBtn).toBeInTheDocument();
    fireEvent.click(helloBtn);
    expect(onUnlockWithWindowsHello).toHaveBeenCalled();
  });
});
