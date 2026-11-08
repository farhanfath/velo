import React from "react";
import {
  At,
  Clock,
  FolderSimple,
  GearSix,
  Hash,
  Star,
} from "@phosphor-icons/react";
import type { EmailRelationSummary, VaultStatus } from "../types/vault";

interface SidebarRailProps {
  totalAllCount: number;
  favoritesOnly: boolean;
  selectedEmail: string | null;
  selectedTag: string | null;
  emailRelations: EmailRelationSummary[];
  tags: string[];
  status: VaultStatus;
  onSelectAll: () => void;
  onSelectFavorites: () => void;
  onSelectEmail: (email: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  onOpenSettings: () => void;
}

export const SidebarRail: React.FC<SidebarRailProps> = ({
  totalAllCount,
  favoritesOnly,
  selectedEmail,
  selectedTag,
  emailRelations,
  tags,
  status,
  onSelectAll,
  onSelectFavorites,
  onSelectEmail,
  onSelectTag,
  onOpenSettings,
}) => {
  const isAllActive = !favoritesOnly && !selectedEmail && !selectedTag;

  return (
    <aside className="w-full lg:w-[260px] shrink-0 bg-[#121215] border-b lg:border-b-0 lg:border-r border-white/[0.07] flex flex-col justify-between p-4 gap-6">
      <div className="space-y-6">
        <nav aria-label="Filter Utama" className="space-y-1">
          <button
            type="button"
            onClick={onSelectAll}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between active:scale-[0.98] transition-all duration-150 ${
              isAllActive
                ? "bg-[#18181C] text-[#F4F4F5] border border-emerald-500/30"
                : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] border border-transparent"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FolderSimple
                size={16}
                weight={isAllActive ? "duotone" : "regular"}
                className={isAllActive ? "text-[#10B981]" : "text-[#A1A1AA]"}
              />
              <span>Semua Akun</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#09090B] border border-white/[0.07] font-mono tabular-nums text-[11px] text-[#F4F4F5]">
              {totalAllCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectFavorites}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between active:scale-[0.98] transition-all duration-150 ${
              favoritesOnly
                ? "bg-[#18181C] text-[#F4F4F5] border border-emerald-500/30"
                : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] border border-transparent"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Star
                size={16}
                weight={favoritesOnly ? "fill" : "regular"}
                className={favoritesOnly ? "text-[#F59E0B]" : "text-[#A1A1AA]"}
              />
              <span>Favorit</span>
            </span>
          </button>
        </nav>

        <section aria-label="Relasi Email" className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-1.5">
              <At size={15} weight="duotone" className="text-[#10B981]" />
              <span>Relasi Email</span>
            </h2>
            <span className="text-[11px] font-mono tabular-nums text-[#A1A1AA]">
              {emailRelations.length}
            </span>
          </div>

          {emailRelations.length === 0 ? (
            <p className="px-2 text-xs text-[#A1A1AA]">
              Belum ada email terdeteksi di catatan.
            </p>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {emailRelations.map((rel) => {
                const active = selectedEmail === rel.email;
                return (
                  <button
                    key={rel.email}
                    type="button"
                    onClick={() => onSelectEmail(active ? null : rel.email)}
                    className={`w-full px-2.5 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 active:scale-[0.98] transition-all duration-150 ${
                      active
                        ? "bg-[#18181C] text-[#F4F4F5] border border-emerald-500/40"
                        : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] border border-transparent"
                    }`}
                  >
                    <span
                      className="font-mono tabular-nums truncate"
                      title={rel.email}
                    >
                      {rel.email}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono tabular-nums text-[11px] shrink-0 ${
                        active
                          ? "bg-[#10B981] text-[#09090B] font-semibold"
                          : "bg-[#09090B] text-[#F4F4F5] border border-white/[0.07]"
                      }`}
                    >
                      {rel.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section aria-label="Kategori Tag" className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-1.5">
              <Hash size={15} weight="duotone" className="text-[#10B981]" />
              <span>Kategori</span>
            </h2>
            <span className="text-[11px] font-mono tabular-nums text-[#A1A1AA]">
              {tags.length}
            </span>
          </div>

          {tags.length === 0 ? (
            <p className="px-2 text-xs text-[#A1A1AA]">
              Tambahkan <code className="font-mono text-[#F4F4F5]">#tag</code> di catatan untuk mengelompokkan akun.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 px-1">
              {tags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onSelectTag(active ? null : tag)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums active:scale-[0.98] transition-all duration-150 ${
                      active
                        ? "bg-[#10B981] text-[#09090B] font-semibold"
                        : "bg-[#09090B] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] border border-white/[0.07]"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="pt-4 border-t border-white/[0.07] space-y-2">
        <div className="px-2 flex items-center justify-between text-xs text-[#A1A1AA]">
          <span className="flex items-center gap-1.5">
            <Clock size={14} weight="regular" className="text-[#10B981]" />
            <span>Auto-Lock</span>
          </span>
          <span className="font-mono tabular-nums text-[#F4F4F5]">
            {status.auto_lock_minutes === 0
              ? "Nonaktif"
              : `${status.auto_lock_minutes} menit`}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full px-3 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] flex items-center justify-between active:scale-[0.98] transition-all duration-150"
        >
          <span className="flex items-center gap-2">
            <GearSix size={15} weight="regular" />
            <span> Pengaturan & Backup</span>
          </span>
          <kbd className="font-mono tabular-nums text-[10px] text-[#A1A1AA]">
            .vault
          </kbd>
        </button>
      </div>
    </aside>
  );
};
