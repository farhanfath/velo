import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  DownloadSimple,
  Fingerprint,
  FolderOpen,
  GearSix,
  Key,
  Keyboard,
  RocketLaunch,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { VaultStatus } from "../types/vault";
import {
  disableAutostart,
  enableAutostart,
  isAutostartEnabled,
  pickVaultOpenPath,
  pickVaultSavePath,
} from "../lib/tauri-api";

interface BackupSettingsModalProps {
  isOpen: boolean;
  status: VaultStatus;
  onClose: () => void;
  onUpdateAutoLock: (minutes: number) => Promise<void>;
  onEnableWindowsHello: () => Promise<void>;
  onDisableWindowsHello: () => Promise<void>;
  onChangeMasterPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onExportBackup: (destinationPath: string) => Promise<void>;
  onRestoreBackup: (sourcePath: string, masterPassword: string) => Promise<void>;
  onRecoverFromBak: (masterPassword: string) => Promise<void>;
}

const AUTO_LOCK_OPTIONS = [
  { label: "1 menit", value: 1 },
  { label: "5 menit", value: 5 },
  { label: "15 menit", value: 15 },
  { label: "30 menit", value: 30 },
  { label: "Nonaktif", value: 0 },
];

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  isOpen,
  status,
  onClose,
  onUpdateAutoLock,
  onEnableWindowsHello,
  onDisableWindowsHello,
  onChangeMasterPassword,
  onExportBackup,
  onRestoreBackup,
  onRecoverFromBak,
}) => {
  const [exportPath, setExportPath] = useState(
    "D:\\Backup\\storage-local-backup.vault"
  );
  const [restorePath, setRestorePath] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [bakPassword, setBakPassword] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmNewPwd, setConfirmNewPwd] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [shortcutMode, setShortcutMode] = useState<"spotlight" | "full">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("velo_default_shortcut_mode");
      if (saved === "spotlight" || saved === "full") return saved;
    }
    return "spotlight";
  });

  const handleShortcutModeChange = (mode: "spotlight" | "full") => {
    setShortcutMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("velo_default_shortcut_mode", mode);
    }
    setSuccessMessage(
      mode === "spotlight"
        ? "Pintasan Ctrl+Shift+Space akan membuka Mode Spotlight ringkas."
        : "Pintasan Ctrl+Shift+Space akan membuka Jendela Penuh."
    );
  };

  useEffect(() => {
    if (isOpen) {
      isAutostartEnabled().then(setAutostartEnabled).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const clearFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleAutoLockChange = async (minutes: number) => {
    clearFeedback();
    setIsBusy(true);
    try {
      await onUpdateAutoLock(minutes);
      setSuccessMessage(
        minutes === 0
          ? "Auto-Lock dinonaktifkan."
          : `Auto-Lock diperbarui menjadi ${minutes} menit.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal memperbarui Auto-Lock"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleAutostart = async () => {
    clearFeedback();
    setIsBusy(true);
    try {
      if (autostartEnabled) {
        await disableAutostart();
        setAutostartEnabled(false);
        setSuccessMessage("Autostart saat Windows menyala dinonaktifkan.");
      } else {
        await enableAutostart();
        setAutostartEnabled(true);
        setSuccessMessage(
          "Velo akan otomatis berjalan di background saat Windows menyala."
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Gagal mengatur autostart"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleWindowsHello = async () => {
    clearFeedback();
    setIsBusy(true);
    try {
      if (status.windows_hello_enabled) {
        await onDisableWindowsHello();
        setSuccessMessage(
          "Windows Hello Quick-Unlock telah dinonaktifkan untuk perangkat ini."
        );
      } else {
        await onEnableWindowsHello();
        setSuccessMessage(
          "Windows Hello Quick-Unlock berhasil diaktifkan untuk perangkat ini."
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Gagal memperbarui status Windows Hello"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleChangeMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (!currentPwd.trim()) {
      setErrorMessage("Masukkan Master Password saat ini.");
      return;
    }
    if (!newPwd.trim()) {
      setErrorMessage("Master Password baru tidak boleh kosong.");
      return;
    }
    if (newPwd.trim() !== confirmNewPwd.trim()) {
      setErrorMessage("Konfirmasi Master Password baru tidak cocok.");
      return;
    }

    setIsBusy(true);
    try {
      await onChangeMasterPassword(currentPwd, newPwd);
      setSuccessMessage("Master Password brankas berhasil diperbarui.");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmNewPwd("");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Gagal memperbarui Master Password"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (!exportPath.trim()) {
      setErrorMessage("Path tujuan ekspor .vault tidak boleh kosong.");
      return;
    }

    setIsBusy(true);
    try {
      await onExportBackup(exportPath.trim());
      setSuccessMessage(`Backup terenkripsi berhasil diekspor ke ${exportPath.trim()}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal mengekspor backup .vault"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (!restorePath.trim()) {
      setErrorMessage("Masukkan lokasi file .vault yang ingin dipulihkan.");
      return;
    }
    if (!restorePassword.trim()) {
      setErrorMessage("Masukkan Master Password dari file backup tersebut.");
      return;
    }

    setIsBusy(true);
    try {
      await onRestoreBackup(restorePath.trim(), restorePassword);
      setRestorePassword("");
      setSuccessMessage("Vault berhasil dipulihkan dari file backup.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal memulihkan file backup"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRecoverBak = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (!bakPassword.trim()) {
      setErrorMessage(
        "Masukkan Master Password untuk memulihkan dari cadangan .vault.bak."
      );
      return;
    }

    setIsBusy(true);
    try {
      await onRecoverFromBak(bakPassword);
      setBakPassword("");
      setSuccessMessage("Vault berhasil dipulihkan dari cadangan otomatis .vault.bak.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal memulihkan dari .vault.bak"
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-settings-modal-title"
      className="fixed inset-0 z-50 bg-[#09090B]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-3xl bg-[#121215] border border-white/[0.07] rounded-xl overflow-hidden max-h-[90dvh] flex flex-col">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <GearSix size={20} weight="duotone" className="text-[#10B981]" />
            <h2
              id="backup-settings-modal-title"
              className="text-base font-semibold text-[#F4F4F5]"
            >
              Backup 1-File & Pengaturan Keamanan
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] active:scale-[0.98] transition-all duration-150"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto divide-y divide-white/[0.07] space-y-6">
          {(errorMessage || successMessage) && (
            <div className="pb-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/30 flex items-start gap-2 text-xs text-[#F43F5E]"
                >
                  <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{errorMessage}</p>
                    <p className="text-[#A1A1AA] mt-0.5">
                      Periksa kembali path file dan pastikan Master Password sesuai.
                    </p>
                  </div>
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-[#10B981]"
                >
                  <CheckCircle size={16} weight="fill" className="shrink-0" />
                  <span className="font-medium">{successMessage}</span>
                </div>
              )}
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} weight="duotone" className="text-[#10B981]" />
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Batas Waktu Auto-Lock & Pintasan Global
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                <Keyboard size={15} weight="regular" />
                <span>Summon / Hide:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#09090B] border border-white/[0.07] font-mono tabular-nums text-[11px] text-[#F4F4F5]">
                  Ctrl+Shift+Space
                </kbd>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {AUTO_LOCK_OPTIONS.map((opt) => {
                const active = status.auto_lock_minutes === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAutoLockChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums border active:scale-[0.98] transition-all duration-150 ${
                      active
                        ? "bg-[#10B981] text-[#09090B] border-[#10B981] font-semibold"
                        : "bg-[#09090B] hover:bg-[#18181C] text-[#F4F4F5] border-white/[0.07]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[#A1A1AA]">
                Mode Tampilan Saat Shortcut (Ctrl+Shift+Space) Dipanggil:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleShortcutModeChange("spotlight")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border active:scale-[0.98] transition-all cursor-pointer ${
                    shortcutMode === "spotlight"
                      ? "bg-[#10B981] text-[#09090B] border-[#10B981] font-semibold"
                      : "bg-[#09090B] hover:bg-[#18181C] text-[#A1A1AA] border-white/[0.07]"
                  }`}
                >
                  Mode Spotlight (Ringkas · Rekomendasi)
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutModeChange("full")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border active:scale-[0.98] transition-all cursor-pointer ${
                    shortcutMode === "full"
                      ? "bg-[#10B981] text-[#09090B] border-[#10B981] font-semibold"
                      : "bg-[#09090B] hover:bg-[#18181C] text-[#A1A1AA] border-white/[0.07]"
                  }`}
                >
                  Mode Jendela Penuh
                </button>
              </div>
            </div>
          </section>

          <section className="pt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RocketLaunch size={18} weight="duotone" className="text-[#10B981]" />
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Startup Windows (Autostart)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums border ${
                    autostartEnabled
                      ? "bg-emerald-500/15 border-emerald-500/30 text-[#10B981]"
                      : "bg-[#09090B] border-white/[0.07] text-[#A1A1AA]"
                  }`}
                >
                  {autostartEnabled ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={handleToggleAutostart}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border active:scale-[0.98] transition-all duration-150 disabled:opacity-50 cursor-pointer ${
                  autostartEnabled
                    ? "bg-[#09090B] hover:bg-[#18181C] text-[#F43F5E] border-[#F43F5E]/30"
                    : "bg-[#10B981] hover:bg-emerald-400 text-[#09090B] border-[#10B981]"
                }`}
              >
                {autostartEnabled ? "Nonaktifkan Autostart" : "Aktifkan Autostart"}
              </button>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Buka Velo secara otomatis di System Tray saat login Windows dengan argumen <code className="text-[#F4F4F5] bg-[#09090B] px-1 py-0.5 rounded border border-white/[0.07] font-mono">--minimized</code>, siap dipanggil kapan saja dengan shortcut global <kbd className="px-1 py-0.5 rounded bg-[#09090B] border border-white/[0.07] font-mono text-[11px] text-[#F4F4F5]">Ctrl+Shift+Space</kbd>.
            </p>
          </section>

          <section className="pt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Fingerprint size={18} weight="duotone" className="text-[#10B981]" />
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Windows Hello Quick-Unlock (DPAPI)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums border ${
                    status.windows_hello_enabled
                      ? "bg-emerald-500/15 border-emerald-500/30 text-[#10B981]"
                      : "bg-[#09090B] border-white/[0.07] text-[#A1A1AA]"
                  }`}
                >
                  {status.windows_hello_enabled
                    ? "Aktif"
                    : status.windows_hello_available
                      ? "Belum Aktif"
                      : "Tidak Tersedia di Perangkat Ini"}
                </span>
              </div>

              {status.windows_hello_available && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleToggleWindowsHello}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border active:scale-[0.98] transition-all duration-150 disabled:opacity-50 ${
                    status.windows_hello_enabled
                      ? "bg-[#09090B] hover:bg-[#18181C] text-[#F43F5E] border-[#F43F5E]/30"
                      : "bg-[#10B981] hover:bg-emerald-400 text-[#09090B] border-[#10B981]"
                  }`}
                >
                  {status.windows_hello_enabled
                    ? "Nonaktifkan Windows Hello"
                    : "Aktifkan Windows Hello"}
                </button>
              )}
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Simpan kunci pembuka terenkripsi Windows DPAPI lokal yang terikat ke akun Windows ini, sehingga Anda dapat membuka vault dengan PIN Windows, Sidik Jari, atau Wajah tanpa mengetik ulang Master Password.
            </p>
          </section>

          <form onSubmit={handleChangeMasterPassword} noValidate className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <Key size={18} weight="duotone" className="text-[#10B981]" />
              <h3 className="text-sm font-semibold text-[#F4F4F5]">
                Ganti Master Password Brankas
              </h3>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Mengenkripsi ulang seluruh data brankas secara atomik dengan Master Password baru menggunakan Argon2id + XChaCha20-Poly1305. Kredensial Windows Hello juga otomatis diperbarui.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="current-master-password"
                  className="text-xs font-medium text-[#A1A1AA]"
                >
                  Password Saat Ini
                </label>
                <input
                  id="current-master-password"
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Master Password lama..."
                  className="bg-[#09090B] border border-white/[0.07] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="new-master-password"
                  className="text-xs font-medium text-[#A1A1AA]"
                >
                  Password Baru
                </label>
                <input
                  id="new-master-password"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Password baru..."
                  className="bg-[#09090B] border border-white/[0.07] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirm-new-master-password"
                  className="text-xs font-medium text-[#A1A1AA]"
                >
                  Konfirmasi Password Baru
                </label>
                <input
                  id="confirm-new-master-password"
                  type="password"
                  value={confirmNewPwd}
                  onChange={(e) => setConfirmNewPwd(e.target.value)}
                  placeholder="Ulangi password baru..."
                  className="bg-[#09090B] border border-white/[0.07] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#F4F4F5] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 cursor-pointer"
            >
              Simpan Master Password Baru
            </button>
          </form>

          <form onSubmit={handleExport} noValidate className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <DownloadSimple size={18} weight="duotone" className="text-[#10B981]" />
              <h3 className="text-sm font-semibold text-[#F4F4F5]">
                Ekspor Cadangan 1-File (.vault)
              </h3>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="export-backup-path"
                className="text-xs font-medium text-[#A1A1AA]"
              >
                Lokasi Tujuan File Backup (.vault)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    id="export-backup-path"
                    type="text"
                    value={exportPath}
                    onChange={(e) => setExportPath(e.target.value)}
                    className="flex-1 bg-[#09090B] border border-white/[0.07] rounded-lg px-3.5 py-2 text-xs font-mono tabular-nums text-[#F4F4F5] focus:border-[#10B981] transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const p = await pickVaultSavePath(exportPath);
                      if (p) setExportPath(p);
                    }}
                    title="Pilih lokasi simpan file dengan Windows Explorer"
                    className="px-2.5 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#A1A1AA] hover:text-[#F4F4F5] text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <FolderOpen size={15} weight="duotone" />
                    <span>Pilih...</span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#09090B] text-xs font-semibold shrink-0 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                >
                  Ekspor Backup
                </button>
              </div>
            </div>
          </form>

          <form onSubmit={handleRestore} noValidate className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <UploadSimple size={18} weight="duotone" className="text-[#10B981]" />
              <h3 className="text-sm font-semibold text-[#F4F4F5]">
                Pulihkan dari File .vault Eksternal
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="restore-source-path"
                  className="text-xs font-medium text-[#A1A1AA]"
                >
                  Path File Sumber (.vault)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="restore-source-path"
                    type="text"
                    value={restorePath}
                    onChange={(e) => setRestorePath(e.target.value)}
                    placeholder="D:\Backup\storage-local-backup.vault"
                    className="flex-1 bg-[#09090B] border border-white/[0.07] rounded-lg px-3.5 py-2 text-xs font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const p = await pickVaultOpenPath("Pilih File Backup Velo (.vault)");
                      if (p) setRestorePath(p);
                    }}
                    title="Cari file .vault dari Windows Explorer"
                    className="px-2.5 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#A1A1AA] hover:text-[#F4F4F5] text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <FolderOpen size={15} weight="duotone" />
                    <span>Pilih...</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="restore-master-password"
                  className="text-xs font-medium text-[#A1A1AA]"
                >
                  Master Password Backup
                </label>
                <input
                  id="restore-master-password"
                  type="password"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="Master Password..."
                  className="bg-[#09090B] border border-white/[0.07] rounded-lg px-3.5 py-2 text-xs font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#F4F4F5] active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
            >
              Pulihkan File Backup
            </button>
          </form>

          <form onSubmit={handleRecoverBak} noValidate className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockCounterClockwise
                  size={18}
                  weight="duotone"
                  className="text-[#F59E0B]"
                />
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Pemulihan Darurat (.vault.bak)
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#A1A1AA]">
                {status.backup_exists
                  ? "Cadangan .bak tersedia"
                  : "Cadangan .bak belum dibuat"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="recover-bak-password"
                className="text-xs font-medium text-[#A1A1AA]"
              >
                Master Password untuk .vault.bak
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="recover-bak-password"
                  type="password"
                  value={bakPassword}
                  onChange={(e) => setBakPassword(e.target.value)}
                  placeholder="Masukkan Master Password..."
                  className="flex-1 bg-[#09090B] border border-white/[0.07] rounded-lg px-3.5 py-2 text-xs font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                />
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-4 py-2 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#F4F4F5] shrink-0 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
                >
                  Pulihkan dari .vault.bak
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-3.5 bg-[#09090B] border-t border-white/[0.07] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#121215] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#F4F4F5] active:scale-[0.98] transition-all duration-150"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
