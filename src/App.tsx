import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  At,
  ClipboardText,
  FunnelSimple,
  Hash,
  NotePencil,
  Plus,
  Star,
  X,
} from "@phosphor-icons/react";
import { BackupSettingsModal } from "./components/BackupSettingsModal";
import { BulkPasteModal } from "./components/BulkPasteModal";
import { EntryCard } from "./components/EntryCard";
import { QuickEntryModal } from "./components/QuickEntryModal";
import { SidebarRail } from "./components/SidebarRail";
import { TopCommandBar } from "./components/TopCommandBar";
import { UnlockScreen } from "./components/UnlockScreen";
import {
  bulkImportFromRaw,
  deleteEntry,
  disableWindowsHello,
  enableWindowsHello,
  exportVaultBackup,
  filterEntries,
  getVaultStatus,
  initOrUnlockVault,
  lockVault,
  queryVault,
  recoverFromBak,
  restoreVaultBackup,
  subscribeVaultLocked,
  toggleFavorite,
  unlockWithWindowsHello,
  updateAutoLockMinutes,
  upsertEntryFromRaw,
} from "./lib/tauri-api";
import type {
  EmailRelationSummary,
  VaultEntry,
  VaultSnapshotResponse,
  VaultStatus,
} from "./types/vault";

const INITIAL_STATUS: VaultStatus = {
  exists: false,
  backup_exists: false,
  unlocked: false,
  vault_path: "storage-local.vault",
  auto_lock_minutes: 5,
  windows_hello_available: false,
  windows_hello_enabled: false,
};

export const App: React.FC = () => {
  const [status, setStatus] = useState<VaultStatus>(INITIAL_STATUS);
  const [allEntries, setAllEntries] = useState<VaultEntry[]>([]);
  const [emailRelations, setEmailRelations] = useState<EmailRelationSummary[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const applySnapshot = useCallback((snap: VaultSnapshotResponse) => {
    setStatus(snap.status);
    setAllEntries(snap.entries);
    setEmailRelations(snap.email_relations);
    setTags(snap.tags);
  }, []);

  const clearSessionState = useCallback((nextStatus?: VaultStatus) => {
    setAllEntries([]);
    setEmailRelations([]);
    setTags([]);
    setSearchQuery("");
    setSelectedEmail(null);
    setSelectedTag(null);
    setFavoritesOnly(false);
    setIsQuickModalOpen(false);
    setEditingEntry(null);
    setIsBulkModalOpen(false);
    setIsSettingsModalOpen(false);
    if (nextStatus) {
      setStatus(nextStatus);
    } else {
      setStatus((prev) => ({ ...prev, unlocked: false }));
    }
  }, []);

  useEffect(() => {
    getVaultStatus()
      .then((s) => setStatus(s))
      .catch(() => {});

    let unlisten: (() => void) | null = null;
    subscribeVaultLocked(() => {
      clearSessionState();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, [clearSessionState]);

  const handleLockVault = useCallback(async () => {
    const nextStatus = await lockVault();
    clearSessionState(nextStatus);
  }, [clearSessionState]);

  useEffect(() => {
    if (!status.unlocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "n") {
        e.preventDefault();
        setEditingEntry(null);
        setIsQuickModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "v") {
        e.preventDefault();
        setIsBulkModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "l") {
        e.preventDefault();
        void handleLockVault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status.unlocked, handleLockVault]);

  const displayedEntries = useMemo(() => {
    return filterEntries(
      allEntries,
      searchQuery,
      selectedEmail,
      selectedTag,
      favoritesOnly
    );
  }, [allEntries, searchQuery, selectedEmail, selectedTag, favoritesOnly]);

  // Also keep backend activity/query synchronized when filters change in Tauri runtime
  useEffect(() => {
    if (!status.unlocked) return;
    queryVault({
      query: searchQuery,
      emailFilter: selectedEmail,
      tagFilter: selectedTag,
      favoritesOnly,
    }).catch(() => {});
  }, [
    status.unlocked,
    searchQuery,
    selectedEmail,
    selectedTag,
    favoritesOnly,
  ]);

  const handleUnlock = async (
    masterPassword: string,
    customPath?: string | null,
    enableWindowsHelloAfterUnlock?: boolean
  ) => {
    const snap = await initOrUnlockVault(masterPassword, customPath);
    applySnapshot(snap);
    if (enableWindowsHelloAfterUnlock && snap.status.windows_hello_available) {
      try {
        const nextStatus = await enableWindowsHello(masterPassword);
        setStatus(nextStatus);
      } catch {
        // Vault remains unlocked even if Windows Hello enrollment was canceled
      }
    }
  };

  const handleUnlockWithWindowsHello = async (customPath?: string | null) => {
    const snap = await unlockWithWindowsHello(customPath);
    applySnapshot(snap);
  };

  const handleEnableWindowsHello = async () => {
    const nextStatus = await enableWindowsHello();
    setStatus(nextStatus);
  };

  const handleDisableWindowsHello = async () => {
    const nextStatus = await disableWindowsHello();
    setStatus(nextStatus);
  };

  const handleRecoverBak = async (masterPassword: string) => {
    const snap = await recoverFromBak(masterPassword);
    applySnapshot(snap);
  };

  const handleSaveEntry = async (params: {
    id?: string | null;
    rawText: string;
    favorite: boolean;
  }) => {
    const snap = await upsertEntryFromRaw({
      id: params.id,
      rawText: params.rawText,
      favorite: params.favorite,
    });
    applySnapshot(snap);
  };

  const handleBulkImport = async (rawBulk: string) => {
    const snap = await bulkImportFromRaw(rawBulk);
    applySnapshot(snap);
  };

  const handleToggleFavorite = async (id: string) => {
    const snap = await toggleFavorite(id);
    applySnapshot(snap);
  };

  const handleDeleteEntry = async (id: string) => {
    const snap = await deleteEntry(id);
    applySnapshot(snap);
  };

  const handleUpdateAutoLock = async (minutes: number) => {
    const nextStatus = await updateAutoLockMinutes(minutes);
    setStatus(nextStatus);
  };

  const handleExportBackup = async (destinationPath: string) => {
    await exportVaultBackup(destinationPath);
  };

  const handleRestoreBackup = async (
    sourcePath: string,
    masterPassword: string
  ) => {
    const snap = await restoreVaultBackup(sourcePath, masterPassword);
    applySnapshot(snap);
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedEmail(null);
    setSelectedTag(null);
    setFavoritesOnly(false);
  };

  if (!status.unlocked) {
    return (
      <UnlockScreen
        status={status}
        onUnlock={handleUnlock}
        onUnlockWithWindowsHello={handleUnlockWithWindowsHello}
        onRecoverFromBak={handleRecoverBak}
      />
    );
  }

  const hasActiveFilter =
    Boolean(selectedEmail) ||
    Boolean(selectedTag) ||
    favoritesOnly ||
    Boolean(searchQuery.trim());

  return (
    <div className="min-h-[100dvh] bg-[#09090B] text-[#F4F4F5] flex flex-col">
      <TopCommandBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalDisplayed={displayedEntries.length}
        onOpenQuickAdd={() => {
          setEditingEntry(null);
          setIsQuickModalOpen(true);
        }}
        onOpenBulkPaste={() => setIsBulkModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLockVault={handleLockVault}
        searchInputRef={searchInputRef}
      />

      <div className="flex-1 max-w-[1440px] w-full mx-auto flex flex-col lg:flex-row">
        <SidebarRail
          totalAllCount={allEntries.length}
          favoritesOnly={favoritesOnly}
          selectedEmail={selectedEmail}
          selectedTag={selectedTag}
          emailRelations={emailRelations}
          tags={tags}
          status={status}
          onSelectAll={resetAllFilters}
          onSelectFavorites={() => {
            setFavoritesOnly((prev) => !prev);
            setSelectedEmail(null);
            setSelectedTag(null);
          }}
          onSelectEmail={(email) => {
            setSelectedEmail(email);
          }}
          onSelectTag={(tag) => {
            setSelectedTag(tag);
          }}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        <main className="flex-1 p-5 sm:p-6 space-y-5">
          {selectedEmail && (
            <div
              role="region"
              aria-label="Filter Relasi Email Aktif"
              className="px-4 py-3 rounded-xl bg-[#121215] border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 text-xs">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#10B981]">
                  <At size={16} weight="bold" />
                </span>
                <span className="text-[#F4F4F5] font-medium">
                  Menampilkan{" "}
                  <strong className="font-mono tabular-nums text-[#10B981]">
                    {displayedEntries.length}
                  </strong>{" "}
                  akun yang terhubung ke{" "}
                  <code className="font-mono tabular-nums text-[#10B981] font-semibold">
                    {selectedEmail}
                  </code>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="px-2.5 py-1 rounded-md bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] inline-flex items-center gap-1 active:scale-[0.98] transition-all duration-150"
              >
                <X size={13} weight="regular" />
                <span>Hapus Filter Email</span>
              </button>
            </div>
          )}

          {(selectedTag || favoritesOnly) && !selectedEmail && (
            <div className="px-4 py-2.5 rounded-xl bg-[#121215] border border-white/[0.07] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[#F4F4F5]">
                <FunnelSimple size={15} weight="duotone" className="text-[#10B981]" />
                <span>Filter aktif:</span>
                {favoritesOnly && (
                  <span className="px-2 py-0.5 rounded bg-[#09090B] border border-white/[0.07] inline-flex items-center gap-1 text-[#F59E0B]">
                    <Star size={12} weight="fill" />
                    <span>Favorit</span>
                  </span>
                )}
                {selectedTag && (
                  <span className="px-2 py-0.5 rounded bg-[#09090B] border border-white/[0.07] font-mono tabular-nums inline-flex items-center gap-1 text-[#10B981]">
                    <Hash size={12} weight="bold" />
                    <span>{selectedTag}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 rounded-md bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#A1A1AA] hover:text-[#F4F4F5] active:scale-[0.98] transition-all duration-150"
              >
                Reset Filter
              </button>
            </div>
          )}

          {allEntries.length === 0 ? (
            <section className="bg-[#121215] border border-white/[0.07] rounded-xl p-8 sm:p-10 max-w-2xl">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#10B981] mb-4">
                <NotePencil size={22} weight="duotone" />
              </div>

              <h2 className="text-lg font-semibold text-[#F4F4F5] mb-1.5">
                Brankas Lokal Anda Masih Kosong
              </h2>
              <p className="text-sm text-[#A1A1AA] leading-relaxed mb-6">
                Mulai tambahkan kredensial dengan gaya chat biasa atau pindahkan
                seluruh riwayat akun dari WhatsApp, Telegram Saved Messages, dan
                Notepad sekaligus.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingEntry(null);
                    setIsQuickModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#09090B] text-xs font-semibold flex items-center gap-2 active:scale-[0.98] transition-all duration-150"
                >
                  <Plus size={15} weight="bold" />
                  <span>Tambah Catatan Pertama</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-4 py-2.5 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#F4F4F5] text-xs font-medium flex items-center gap-2 active:scale-[0.98] transition-all duration-150"
                >
                  <ClipboardText size={15} weight="regular" className="text-[#10B981]" />
                  <span>Migrasi Bulk Paste WA/TG</span>
                </button>
              </div>
            </section>
          ) : displayedEntries.length === 0 ? (
            <section className="bg-[#121215] border border-white/[0.07] rounded-xl p-8 max-w-xl space-y-3">
              <h2 className="text-base font-semibold text-[#F4F4F5]">
                Tidak Ada Akun yang Cocok
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Tidak ditemukan catatan yang sesuai dengan kata kunci atau filter
                relasi email yang sedang dipilih.
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#09090B] text-xs font-semibold active:scale-[0.98] transition-all duration-150"
                >
                  Tampilkan Semua Akun
                </button>
              )}
            </section>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              {displayedEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  activeEmailFilter={selectedEmail}
                  onSelectEmail={(email) =>
                    setSelectedEmail((prev) => (prev === email ? null : email))
                  }
                  onSelectTag={(tag) =>
                    setSelectedTag((prev) => (prev === tag ? null : tag))
                  }
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={(target) => {
                    setEditingEntry(target);
                    setIsQuickModalOpen(true);
                  }}
                  onDelete={handleDeleteEntry}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <QuickEntryModal
        isOpen={isQuickModalOpen}
        editingEntry={editingEntry}
        onClose={() => {
          setIsQuickModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
      />

      <BulkPasteModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImportBulk={handleBulkImport}
      />

      <BackupSettingsModal
        isOpen={isSettingsModalOpen}
        status={status}
        onClose={() => setIsSettingsModalOpen(false)}
        onUpdateAutoLock={handleUpdateAutoLock}
        onEnableWindowsHello={handleEnableWindowsHello}
        onDisableWindowsHello={handleDisableWindowsHello}
        onExportBackup={handleExportBackup}
        onRestoreBackup={handleRestoreBackup}
        onRecoverFromBak={handleRecoverBak}
      />
    </div>
  );
};

export default App;
