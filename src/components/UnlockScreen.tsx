import React, { useState } from "react";
import {
  ClockCounterClockwise,
  Eye,
  EyeSlash,
  FolderOpen,
  Key,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import type { VaultStatus } from "../types/vault";

interface UnlockScreenProps {
  status: VaultStatus;
  onUnlock: (masterPassword: string, customPath?: string | null) => Promise<void>;
  onRecoverFromBak: (masterPassword: string) => Promise<void>;
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({
  status,
  onUnlock,
  onRecoverFromBak,
}) => {
  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showCustomPath, setShowCustomPath] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!masterPassword.trim()) {
      setErrorMessage(
        "Master Password tidak boleh kosong. Masukkan sandi atau PIN utama untuk melanjutkan."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onUnlock(
        masterPassword,
        showCustomPath && customPath.trim() ? customPath.trim() : null
      );
      setMasterPassword("");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Master Password salah atau file vault tidak valid";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverBak = async () => {
    setErrorMessage(null);
    if (!masterPassword.trim()) {
      setErrorMessage(
        "Masukkan Master Password terlebih dahulu sebelum memulihkan cadangan .vault.bak."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onRecoverFromBak(masterPassword);
      setMasterPassword("");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Gagal memulihkan dari .vault.bak";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#09090B] text-[#F4F4F5] flex items-center">
      <div className="w-full max-w-[1120px] mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <section className="lg:col-span-7 bg-[#121215] border border-white/[0.07] rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/velo-logo.png"
              alt="Velo Logo"
              className="w-11 h-11 rounded-lg border border-emerald-500/30 object-cover shrink-0"
            />
            <div>
              <h1 className="text-xl font-semibold text-[#F4F4F5] tracking-tight">
                Velo
              </h1>
              <p className="text-sm text-[#A1A1AA]">
                {status.exists
                  ? "Masukkan Master Password untuk mendekripsi brankas lokal Anda."
                  : "Buat Master Password untuk menginisialisasi brankas lokal terenkripsi."}
              </p>
            </div>
          </div>

          <div className="mb-6 py-2.5 px-3 rounded-lg bg-[#09090B] border border-white/[0.07] flex items-center justify-between gap-3">
            <span className="text-xs text-[#A1A1AA] shrink-0">Lokasi Vault</span>
            <span
              className="text-xs font-mono tabular-nums text-[#F4F4F5] truncate"
              title={status.vault_path}
            >
              {status.vault_path}
            </span>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="unlock-master-password"
                className="text-sm font-medium text-[#F4F4F5]"
              >
                Master Password / PIN
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[#A1A1AA] pointer-events-none">
                  <Key size={18} weight="regular" />
                </span>
                <input
                  id="unlock-master-password"
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => {
                    setMasterPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Masukkan Master Password atau PIN..."
                  autoFocus
                  className="w-full bg-[#09090B] border border-white/[0.07] rounded-lg pl-10 pr-11 py-2.5 text-sm font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? "Sembunyikan Master Password"
                      : "Tampilkan Master Password"
                  }
                  className="absolute right-2.5 p-1.5 rounded-md text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] active:scale-[0.98] transition-all duration-150"
                >
                  {showPassword ? (
                    <EyeSlash size={18} weight="regular" />
                  ) : (
                    <Eye size={18} weight="regular" />
                  )}
                </button>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Kunci diturunkan secara lokal dengan Argon2id dan dienkripsi menggunakan XChaCha20-Poly1305.
              </p>
            </div>

            {showCustomPath && (
              <div className="flex flex-col gap-2 pt-1">
                <label
                  htmlFor="unlock-custom-path"
                  className="text-sm font-medium text-[#F4F4F5]"
                >
                  Lokasi File .vault Kustom
                </label>
                <input
                  id="unlock-custom-path"
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="Contoh: D:\Backup\storage-local.vault"
                  className="w-full bg-[#09090B] border border-white/[0.07] rounded-lg px-3.5 py-2 text-sm font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] transition-colors duration-150"
                />
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/30 flex items-start gap-2.5 text-xs text-[#F43F5E]"
              >
                <WarningCircle size={18} weight="fill" className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{errorMessage}</p>
                  <p className="text-[#A1A1AA]">
                    Periksa kembali ejaan sandi atau gunakan tombol pemulihan .vault.bak di bawah jika file utama rusak.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#09090B] font-semibold text-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
              >
                {status.exists ? "Buka Vault" : "Buat Vault Baru"}
              </button>

              <button
                type="button"
                onClick={() => setShowCustomPath((prev) => !prev)}
                className="px-3.5 py-2.5 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#F4F4F5] flex items-center gap-2 active:scale-[0.98] transition-all duration-150"
              >
                <FolderOpen size={16} weight="regular" />
                <span>Pilih File .vault Lain</span>
              </button>

              <button
                type="button"
                onClick={handleRecoverBak}
                disabled={isSubmitting}
                className="px-3.5 py-2.5 rounded-lg bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] flex items-center gap-2 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
              >
                <ClockCounterClockwise size={16} weight="regular" />
                <span>Pulihkan dari .vault.bak</span>
              </button>
            </div>
          </form>
        </section>

        <aside className="lg:col-span-5 bg-[#121215] border border-white/[0.07] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} weight="duotone" className="text-[#10B981]" />
            <h2 className="text-base font-semibold text-[#F4F4F5]">
              Arsitektur Zero-Server Lokal
            </h2>
          </div>

          <div className="divide-y divide-white/[0.06] text-xs text-[#A1A1AA]">
            <div className="py-3 space-y-1">
              <div className="font-medium text-[#F4F4F5]">
                Format Input Gaya Chat
              </div>
              <p>
                Ketik judul di baris pertama dan pasangan{" "}
                <code className="font-mono text-[#F4F4F5]">key: value</code> di
                baris berikutnya seperti mencatat di WhatsApp atau Telegram.
              </p>
            </div>

            <div className="py-3 space-y-1">
              <div className="font-medium text-[#F4F4F5]">
                Indeks Relasi Email Otomatis
              </div>
              <p>
                Lacak seluruh akun layanan yang terhubung ke satu alamat email
                secara instan dalam satu klik.
              </p>
            </div>

            <div className="py-3 space-y-1">
              <div className="font-medium text-[#F4F4F5]">
                Keamanan Memori & Clipboard
              </div>
              <p>
                Auto-lock otomatis membersihkan RAM dengan{" "}
                <code className="font-mono text-[#F4F4F5]">zeroize</code> dan
                menghapus password dari clipboard setelah{" "}
                <span className="font-mono tabular-nums text-[#F4F4F5]">30d</span>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};
