import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { resetMockVaultForTests } from "../lib/tauri-api";

describe("Storage Local — Dark Obsidian UI & End-to-End Vault Workflow", () => {
  beforeEach(() => {
    resetMockVaultForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("validates empty master password and initializes/unlocks the vault", async () => {
    render(<App />);

    const submitBtn = screen.getByRole("button", {
      name: /Buat Vault Baru|Buka Vault/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Master Password tidak boleh kosong/i)
    ).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/Master Password \/ PIN/i);
    fireEvent.change(passwordInput, { target: { value: "master-obsidian-99" } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Brankas Lokal Anda Masih Kosong/i)
    ).toBeInTheDocument();
  });

  it("adds a chat-formatted entry, normalizes test:@gmail.com, masks secrets, and copies with 30s auto-clear badge", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Master Password \/ PIN/i), {
      target: { value: "secret-pin-123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Buat Vault Baru|Buka Vault/i })
    );

    const openQuickAddBtn = await screen.findByRole("button", {
      name: /\+ Catatan Baru/i,
    });
    fireEvent.click(openQuickAddBtn);

    const rawInput = screen.getByLabelText(/Format Chat/i);
    fireEvent.change(rawInput, {
      target: {
        value: "amazon video #streaming\nemail: test:@gmail.com\npass: test123",
      },
    });

    // Verify live preview shows normalized email
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("amazon video")).toBeInTheDocument();
    expect(within(dialog).getByText("test@gmail.com")).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Simpan Catatan/i })
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Card is rendered with masked password by default
    expect(screen.getByText("amazon video")).toBeInTheDocument();
    expect(screen.queryByText("test123")).not.toBeInTheDocument();
    expect(screen.getByText("••••••••••")).toBeInTheDocument();

    // Reveal secret
    const revealBtn = screen.getByRole("button", {
      name: /Tampilkan pass untuk amazon video/i,
    });
    fireEvent.click(revealBtn);
    expect(screen.getByText("test123")).toBeInTheDocument();

    // Hide secret again
    const hideBtn = screen.getByRole("button", {
      name: /Sembunyikan pass untuk amazon video/i,
    });
    fireEvent.click(hideBtn);
    expect(screen.queryByText("test123")).not.toBeInTheDocument();

    // Copy secret and verify 30s auto-clear feedback badge
    const copyPassBtn = screen.getByRole("button", {
      name: /Salin pass dari amazon video/i,
    });
    fireEvent.click(copyPassBtn);
    expect(
      await screen.findByText(/Tersalin · Auto-clear 30d/i)
    ).toBeInTheDocument();
  });

  it("migrates multiple accounts via Bulk Paste, filters via Reverse Email Relation Lookup, and clears DOM on Lock", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Master Password \/ PIN/i), {
      target: { value: "vault-pass-777" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Buat Vault Baru|Buka Vault/i })
    );

    // 1. Add first entry with double-colon typo email
    fireEvent.click(
      await screen.findByRole("button", { name: /\+ Catatan Baru/i })
    );
    fireEvent.change(screen.getByLabelText(/Format Chat/i), {
      target: {
        value: "amazon video #streaming\nemail: test:@gmail.com\npass: amz123",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Simpan Catatan/i }));
    await waitFor(() => {
      expect(screen.getByText("amazon video")).toBeInTheDocument();
    });

    // 2. Bulk paste 3 accounts (xbox, netflix, openai)
    fireEvent.click(
      screen.getByRole("button", { name: /Bulk Paste WA\/TG/i })
    );
    const bulkTextarea = screen.getByLabelText(/Tempel Kumpulan Catatan Chat/i);
    fireEvent.change(bulkTextarea, {
      target: {
        value: [
          "xbox #game",
          "pass: xboxpass123",
          "",
          "netflix #streaming",
          "email: test@gmail.com",
          "pass: nfpass999",
          "",
          "openai #work",
          "email: dev@company.io",
          "key: sk-secret-openai",
        ].join("\n"),
      },
    });

    expect(
      await screen.findByText(/Terdeteksi 3 akun siap di-import/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Import 3 Akun ke Vault/i })
    );

    await waitFor(() => {
      expect(screen.getByText("xbox")).toBeInTheDocument();
      expect(screen.getByText("netflix")).toBeInTheDocument();
      expect(screen.getByText("openai")).toBeInTheDocument();
      expect(screen.getByText("amazon video")).toBeInTheDocument();
    });

    // 3. Click test@gmail.com in Relasi Email sidebar and verify Reverse Email Lookup
    const emailSidebarSection = screen.getByRole("region", {
      name: /Relasi Email/i,
    });
    const emailRelationBtn = within(emailSidebarSection).getByRole("button", {
      name: /test@gmail\.com/i,
    });
    fireEvent.click(emailRelationBtn);

    // Banner shows 2 accounts tied to test@gmail.com
    const filterBanner = await screen.findByRole("region", {
      name: /Filter Relasi Email Aktif/i,
    });
    expect(filterBanner).toHaveTextContent(
      /Menampilkan 2 akun yang terhubung ke test@gmail\.com/i
    );

    // amazon video and netflix remain visible; xbox and openai are filtered out
    expect(screen.getByText("amazon video")).toBeInTheDocument();
    expect(screen.getByText("netflix")).toBeInTheDocument();
    expect(screen.queryByText("xbox")).not.toBeInTheDocument();
    expect(screen.queryByText("openai")).not.toBeInTheDocument();

    // 4. Lock the vault and verify all credentials disappear from the DOM
    fireEvent.click(screen.getByRole("button", { name: /Lock Vault/i }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Master Password \/ PIN/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("amazon video")).not.toBeInTheDocument();
    expect(screen.queryByText("netflix")).not.toBeInTheDocument();
  });
});
