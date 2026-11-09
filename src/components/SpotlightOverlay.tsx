import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsOutSimple,
  CheckCircle,
  Copy,
  Fingerprint,
  Key,
  LockKey,
  MagnifyingGlass,
  Star,
  X,
} from "@phosphor-icons/react";
import type { VaultEntry, VaultStatus } from "../types/vault";

interface SpotlightOverlayProps {
  status: VaultStatus;
  entries: VaultEntry[];
  onCopySecret: (entry: VaultEntry, fieldKey?: string) => Promise<void>;
  onCopyEmail: (entry: VaultEntry) => Promise<void>;
  onExpandToFull: () => void;
  onClose: () => void;
  onUnlock: (password: string) => Promise<void>;
  onUnlockWithWindowsHello: () => Promise<void>;
}

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  status,
  entries,
  onCopySecret,
  onCopyEmail,
  onExpandToFull,
  onClose,
  onUnlock,
  onUnlockWithWindowsHello,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus inputs automatically
  useEffect(() => {
    if (status.unlocked) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else {
      unlockInputRef.current?.focus();
    }
  }, [status.unlocked]);

  // Filter entries based on query
  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      if (entry.title.toLowerCase().includes(q)) return true;
      if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
      return entry.fields.some(
        (f) =>
          f.key.toLowerCase().includes(q) ||
          (f.kind !== "secret" && f.value.toLowerCase().includes(q))
      );
    });
  }, [entries, query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep selected item visible in scroll view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (selectedEl && typeof selectedEl.scrollIntoView === "function") {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Keyboard navigation & actions
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "o" || e.key === "O")) {
      e.preventDefault();
      onExpandToFull();
      return;
    }

    if (!status.unlocked) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredEntries.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredEntries.length);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredEntries.length > 0) {
        setSelectedIndex((prev) =>
          prev === 0 ? filteredEntries.length - 1 : prev - 1
        );
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const target = filteredEntries[selectedIndex];
      if (target) {
        await handleCopyPassword(target);
      }
      return;
    }

    if (e.key === "Tab" || (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault();
      const target = filteredEntries[selectedIndex];
      if (target) {
        await handleCopyEmail(target);
      }
      return;
    }
  };

  const handleCopyPassword = async (entry: VaultEntry) => {
    try {
      await onCopySecret(entry);
      setCopiedFeedback(`Password ${entry.title} tersalin!`);
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err) {
      console.error("Gagal menyalin password:", err);
    }
  };

  const handleCopyEmail = async (entry: VaultEntry) => {
    try {
      await onCopyEmail(entry);
      setCopiedFeedback(`Email ${entry.title} tersalin!`);
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err) {
      console.error("Gagal menyalin email:", err);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      setUnlockError("Masukkan Master Password / PIN.");
      return;
    }
    setUnlockError(null);
    setIsUnlocking(true);
    try {
      await onUnlock(unlockPassword);
      setUnlockPassword("");
    } catch (err) {
      setUnlockError(
        err instanceof Error ? err.message : "Password brankas salah"
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleWindowsHelloUnlock = async () => {
    setUnlockError(null);
    setIsUnlocking(true);
    try {
      await onUnlockWithWindowsHello();
    } catch (err) {
      setUnlockError(
        err instanceof Error ? err.message : "Windows Hello dibatalkan/gagal"
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  // Render Compact Unlock Mode if Vault is Locked
  if (!status.unlocked) {
    return (
      <div
        className="w-full h-full min-h-[380px] bg-[#09090B] text-[#F4F4F5] flex flex-col justify-between p-6 select-none"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <LockKey size={16} weight="duotone" className="text-[#10B981]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#F4F4F5]">
                Velo Spotlight — Brankas Terkunci
              </h2>
              <p className="text-[11px] text-[#A1A1AA]">
                Buka brankas untuk mencari dan menyalin password instan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onExpandToFull}
              title="Buka Layar Penuh (Ctrl+O)"
              className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] transition-colors cursor-pointer"
            >
              <ArrowsOutSimple size={16} weight="regular" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Tutup (Esc)"
              className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] transition-colors cursor-pointer"
            >
              <X size={16} weight="regular" />
            </button>
          </div>
        </div>

        <div className="py-4 space-y-4 my-auto">
          {status.windows_hello_enabled && (
            <button
              type="button"
              disabled={isUnlocking}
              onClick={handleWindowsHelloUnlock}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#09090B] font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              <Fingerprint size={18} weight="bold" />
              <span>Buka Cepat dengan Windows Hello</span>
            </button>
          )}

          {status.windows_hello_enabled && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-[11px] font-mono text-[#52525B]">ATAU</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>
          )}

          <form onSubmit={handleUnlockSubmit} className="space-y-3">
            <div className="flex gap-2">
              <input
                ref={unlockInputRef}
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Masukkan Master Password / PIN..."
                disabled={isUnlocking}
                className="flex-1 bg-[#121215] border border-white/[0.08] focus:border-[#10B981] rounded-xl px-3.5 py-2 text-xs font-mono text-[#F4F4F5] placeholder:text-[#52525B] outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isUnlocking}
                className="px-4 py-2 bg-[#121215] hover:bg-[#18181C] border border-white/[0.08] rounded-xl text-xs font-medium text-[#F4F4F5] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isUnlocking ? "Membuka..." : "Buka"}
              </button>
            </div>

            {unlockError && (
              <p className="text-[11px] text-[#F43F5E] font-medium">
                {unlockError}
              </p>
            )}
          </form>
        </div>

        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#A1A1AA] font-mono">
          <span>Tekan Esc untuk menutup</span>
          <span className="text-[#52525B]">Ctrl+Shift+Space</span>
        </div>
      </div>
    );
  }

  // Render Unlocked Spotlight Quick-Search Palette
  return (
    <div
      className="w-full h-full min-h-[380px] bg-[#09090B] text-[#F4F4F5] flex flex-col justify-between overflow-hidden select-none"
      onKeyDown={handleKeyDown}
    >
      {/* Top Search Bar */}
      <div className="p-3.5 border-b border-white/[0.08] flex items-center gap-3 shrink-0 bg-[#0e0e11]">
        <MagnifyingGlass
          size={20}
          weight="duotone"
          className="text-[#10B981] shrink-0 ml-1"
        />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari akun, email, atau #tags... (↑ ↓ pilih, ↵ salin password)"
          className="flex-1 bg-transparent text-sm font-medium text-[#F4F4F5] placeholder:text-[#52525B] outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-1 rounded-md text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
          >
            <X size={14} />
          </button>
        )}

        <div className="flex items-center gap-1 border-l border-white/[0.08] pl-2 shrink-0">
          <button
            type="button"
            onClick={onExpandToFull}
            title="Buka Layar Penuh (Ctrl+O)"
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] transition-colors cursor-pointer"
          >
            <ArrowsOutSimple size={16} weight="regular" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Tutup (Esc)"
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] transition-colors cursor-pointer"
          >
            <X size={16} weight="regular" />
          </button>
        </div>
      </div>

      {/* Results List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto divide-y divide-white/[0.04] p-1.5 scrollbar-thin"
      >
        {filteredEntries.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4">
            <MagnifyingGlass size={28} weight="duotone" className="text-[#52525B] mb-2" />
            <p className="text-xs text-[#A1A1AA] font-medium">
              {query ? `Tidak ada akun yang cocok dengan "${query}"` : "Brankas masih kosong"}
            </p>
            <p className="text-[11px] text-[#52525B] mt-1">
              Buka layar penuh (Ctrl+O) untuk menambahkan akun baru.
            </p>
          </div>
        ) : (
          filteredEntries.map((entry, index) => {
            const isSelected = index === selectedIndex;
            const primaryEmail = entry.fields.find((f) => f.kind === "email")?.value;
            const hasSecret = entry.fields.some((f) => f.kind === "secret");

            return (
              <div
                key={entry.id}
                data-index={index}
                onClick={() => {
                  setSelectedIndex(index);
                  handleCopyPassword(entry);
                }}
                className={`px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors duration-100 ${
                  isSelected
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-[#F4F4F5]"
                    : "hover:bg-[#121215] border border-transparent text-[#A1A1AA]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {entry.favorite ? (
                    <Star
                      size={14}
                      weight="fill"
                      className="text-amber-400 shrink-0"
                    />
                  ) : (
                    <Key
                      size={14}
                      weight="duotone"
                      className={`shrink-0 ${
                        isSelected ? "text-[#10B981]" : "text-[#52525B]"
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#F4F4F5] truncate">
                        {entry.title}
                      </span>
                      {entry.tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#18181C] text-[#A1A1AA] border border-white/[0.05]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    {primaryEmail && (
                      <span className="text-[11px] font-mono text-[#A1A1AA] truncate block mt-0.5">
                        {primaryEmail}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasSecret && (
                    <span className="text-xs font-mono tracking-widest text-[#52525B]">
                      ••••••••
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPassword(entry);
                    }}
                    title="Salin Password (Enter)"
                    className={`p-1.5 rounded-md text-xs font-mono flex items-center gap-1 transition-colors ${
                      isSelected
                        ? "bg-[#10B981] text-[#09090B] font-semibold"
                        : "bg-[#18181C] text-[#A1A1AA] hover:text-[#F4F4F5]"
                    }`}
                  >
                    <Copy size={13} weight="bold" />
                    <span className="hidden sm:inline">Pass</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Shortcuts Help Bar */}
      <div className="px-3.5 py-2.5 bg-[#0e0e11] border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#A1A1AA] font-mono shrink-0">
        <div className="flex items-center gap-3">
          {copiedFeedback ? (
            <span className="text-[#10B981] font-medium flex items-center gap-1.5 animate-pulse">
              <CheckCircle size={14} weight="fill" />
              {copiedFeedback}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 rounded bg-[#18181C] border border-white/[0.08] text-[10px] text-[#F4F4F5]">
                  ↵
                </kbd>
                <span>Salin Pass</span>
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <kbd className="px-1 py-0.2 rounded bg-[#18181C] border border-white/[0.08] text-[10px] text-[#F4F4F5]">
                  Tab
                </kbd>
                <span>Salin Email</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-[#52525B]">
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="px-1 py-0.2 rounded bg-[#18181C] border border-white/[0.08] text-[10px] text-[#A1A1AA]">
              Ctrl+O
            </kbd>
            <span>Penuh</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.2 rounded bg-[#18181C] border border-white/[0.08] text-[10px] text-[#A1A1AA]">
              Esc
            </kbd>
            <span>Tutup</span>
          </span>
        </div>
      </div>
    </div>
  );
};
