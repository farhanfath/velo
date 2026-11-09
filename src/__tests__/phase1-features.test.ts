import { describe, expect, it } from "vitest";
import {
  generatePassphrase,
  generatePassword,
  generatePin,
} from "../lib/generator";
import {
  disableAutostart,
  enableAutostart,
  isAutostartEnabled,
} from "../lib/tauri-api";

describe("Phase 1 — Built-in Generator & Utilities", () => {
  it("generates 20-character complex passwords by default", () => {
    const pwd = generatePassword();
    expect(pwd.length).toBe(20);
    // Should contain mixed characters
    expect(/[A-Z]/.test(pwd)).toBe(true);
    expect(/[a-z]/.test(pwd)).toBe(true);
    expect(/[0-9]/.test(pwd)).toBe(true);
  });

  it("generates custom length password without symbols if requested", () => {
    const pwd = generatePassword({ length: 32, symbols: false });
    expect(pwd.length).toBe(32);
    expect(/[!@#$%^&*_\-+=]/.test(pwd)).toBe(false);
  });

  it("generates 4-word hyphenated passphrases by default", () => {
    const phrase = generatePassphrase();
    const parts = phrase.split("-");
    expect(parts.length).toBe(4);
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
    }
  });

  it("generates 6-digit numeric PINs by default", () => {
    const pin = generatePin();
    expect(pin.length).toBe(6);
    expect(/^\d{6}$/.test(pin)).toBe(true);
  });

  it("handles mock autostart toggle gracefully in non-tauri environment", async () => {
    expect(await isAutostartEnabled()).toBe(false);
    await enableAutostart();
    expect(await isAutostartEnabled()).toBe(true);
    await disableAutostart();
    expect(await isAutostartEnabled()).toBe(false);
  });
});
