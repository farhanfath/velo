import React, { useRef } from "react";
import {
  ClipboardText,
  GearSix,
  LockSimple,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";

interface TopCommandBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  totalDisplayed: number;
  onOpenQuickAdd: () => void;
  onOpenBulkPaste: () => void;
  onOpenSettings: () => void;
  onLockVault: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  searchQuery,
  onSearchChange,
  totalDisplayed,
  onOpenQuickAdd,
  onOpenBulkPaste,
  onOpenSettings,
  onLockVault,
  searchInputRef,
}) => {
  const internalRef = useRef<HTMLInputElement | null>(null);
  const inputRef = searchInputRef ?? internalRef;

  return (
    <header className="bg-[#121215] border-b border-white/[0.07] px-5 py-3">
      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 max-w-2xl">
          <div className="flex items-center gap-2.5 shrink-0 self-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#10B981]">
              <ShieldCheck size={18} weight="duotone" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#F4F4F5] leading-tight">
                Storage Local
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#10B981] font-mono tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>Terbuka</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-1">
            <label
              htmlFor="vault-search-input"
              className="text-xs font-medium text-[#A1A1AA]"
            >
              Cari Akun, Email, Key, atau Tag
            </label>
            <div className="relative flex items-center">
              <MagnifyingGlass
                size={16}
                weight="regular"
                className="absolute left-3 text-[#A1A1AA] pointer-events-none"
              />
              <input
                ref={inputRef}
                id="vault-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Ketik nama aplikasi, email, atau #tag..."
                className="w-full bg-[#09090B] border border-white/[0.07] rounded-lg pl-9 pr-24 py-1.5 text-sm text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    aria-label="Bersihkan pencarian"
                    className="p-1 rounded text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] active:scale-[0.98] transition-all duration-150"
                  >
                    <X size={14} weight="regular" />
                  </button>
                )}
                <span className="px-1.5 py-0.5 rounded bg-[#18181C] border border-white/[0.07] text-[11px] font-mono tabular-nums text-[#A1A1AA]">
                  {totalDisplayed}
                </span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[#09090B] border border-white/[0.07] text-[11px] font-mono tabular-nums text-[#A1A1AA]">
                  Ctrl+K
                </kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            className="px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#09090B] font-semibold text-xs flex items-center gap-2 active:scale-[0.98] transition-all duration-150"
          >
            <Plus size={15} weight="bold" />
            <span>+ Catatan Baru</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 rounded bg-[#09090B]/20 text-[#09090B] font-mono tabular-nums text-[10px]">
              Ctrl+N
            </kbd>
          </button>

          <button
            type="button"
            onClick={onOpenBulkPaste}
            className="px-3 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#F4F4F5] font-medium text-xs flex items-center gap-2 active:scale-[0.98] transition-all duration-150"
          >
            <ClipboardText size={15} weight="regular" className="text-[#10B981]" />
            <span>Bulk Paste WA/TG</span>
            <kbd className="hidden xl:inline-block px-1.5 py-0.5 rounded bg-[#121215] border border-white/[0.07] text-[#A1A1AA] font-mono tabular-nums text-[10px]">
              Ctrl+Shift+V
            </kbd>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#F4F4F5] font-medium text-xs flex items-center gap-2 active:scale-[0.98] transition-all duration-150"
          >
            <GearSix size={15} weight="regular" className="text-[#A1A1AA]" />
            <span>Backup & Settings</span>
          </button>

          <button
            type="button"
            onClick={onLockVault}
            className="px-3 py-2 rounded-lg bg-[#09090B] hover:bg-[#F43F5E]/15 border border-white/[0.07] hover:border-[#F43F5E]/40 text-[#F4F4F5] hover:text-[#F43F5E] font-medium text-xs flex items-center gap-2 active:scale-[0.98] transition-all duration-150"
          >
            <LockSimple size={15} weight="regular" />
            <span>Lock Vault</span>
            <kbd className="hidden xl:inline-block px-1.5 py-0.5 rounded bg-[#121215] border border-white/[0.07] text-[#A1A1AA] font-mono tabular-nums text-[10px]">
              Ctrl+L
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};
