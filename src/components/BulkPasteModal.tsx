import React, { useEffect, useState } from "react";
import {
  At,
  Check,
  ClipboardText,
  Key,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  normalizeEmail,
  parseBulkPreview,
  parseBulkText,
} from "../lib/tauri-api";
import type { ParsedEntryDraft } from "../types/vault";

interface BulkPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBulk: (rawBulk: string) => Promise<void>;
}

export const BulkPasteModal: React.FC<BulkPasteModalProps> = ({
  isOpen,
  onClose,
  onImportBulk,
}) => {
  const [rawBulk, setRawBulk] = useState("");
  const [drafts, setDrafts] = useState<ParsedEntryDraft[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRawBulk("");
    setDrafts([]);
    setErrorMessage(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const immediate = parseBulkText(rawBulk);
    setDrafts(immediate);

    let cancelled = false;
    parseBulkPreview(rawBulk)
      .then((res) => {
        if (!cancelled) {
          setDrafts(res);
        }
      })
      .catch(() => {
        // Fallback already set
      });

    return () => {
      cancelled = true;
    };
  }, [rawBulk, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (drafts.length === 0) {
      setErrorMessage(
        "Tidak ada blok catatan valid untuk diimpor. Pisahkan setiap akun dengan baris kosong."
      );
      return;
    }

    setIsImporting(true);
    try {
      await onImportBulk(rawBulk);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Gagal mengimpor catatan massal";
      setErrorMessage(msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-paste-modal-title"
      className="fixed inset-0 z-50 bg-[#09090B]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl bg-[#121215] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ClipboardText size={20} weight="duotone" className="text-[#10B981]" />
            <div>
              <h2
                id="bulk-paste-modal-title"
                className="text-base font-semibold text-[#F4F4F5]"
              >
                Bulk Paste Migrator (WhatsApp / Telegram / Notepad)
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Tempel banyak blok catatan sekaligus dengan pemisah satu baris kosong antar akun.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal bulk paste"
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] active:scale-[0.98] transition-all duration-150"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 flex flex-col gap-2">
              <label
                htmlFor="bulk-paste-raw-input"
                className="text-sm font-medium text-[#F4F4F5]"
              >
                Tempel Kumpulan Catatan Chat
              </label>

              <textarea
                id="bulk-paste-raw-input"
                rows={11}
                value={rawBulk}
                onChange={(e) => {
                  setRawBulk(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
                placeholder={
                  "xbox #game\nemail: test@gmail.com\npass: xb123\n\nnetflix #streaming\nemail: test@gmail.com\npass: nf999\n\nopenai api #work\nkey: sk-live-12345"
                }
                className="w-full bg-[#09090B] border border-white/[0.07] rounded-lg p-3.5 text-sm font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] leading-relaxed resize-y transition-colors duration-150"
              />

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/30 flex items-start gap-2 text-xs text-[#F43F5E]"
                >
                  <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{errorMessage}</p>
                    <p className="text-[#A1A1AA] mt-0.5">
                      Pastikan setiap blok akun dipisahkan oleh baris kosong (Enter 2 kali).
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#F4F4F5]">
                  Terdeteksi {drafts.length} akun siap di-import
                </span>
                <span className="px-2 py-0.5 rounded bg-[#09090B] border border-white/[0.07] text-xs font-mono tabular-nums text-[#10B981]">
                  {drafts.length} blok
                </span>
              </div>

              <div className="flex-1 bg-[#09090B] border border-white/[0.07] rounded-lg max-h-[290px] overflow-y-auto divide-y divide-white/[0.06]">
                {drafts.length === 0 ? (
                  <div className="p-8 text-center space-y-1">
                    <p className="text-xs font-medium text-[#A1A1AA]">
                      Belum ada blok catatan yang terdeteksi
                    </p>
                    <p className="text-xs text-[#52525B]">
                      Tempel riwayat pesan dari Saved Messages atau Notepad di sebelah kiri untuk melihat daftar akun.
                    </p>
                  </div>
                ) : (
                  drafts.map((draft, i) => (
                    <div key={`${draft.title}-${i}`} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#F4F4F5]">
                          {draft.title}
                        </span>
                        {draft.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {draft.tags.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded bg-[#121215] border border-white/[0.07] text-[10px] font-mono tabular-nums text-[#10B981]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {draft.fields.length > 0 && (
                        <div className="space-y-1">
                          {draft.fields.map((field, fIdx) => (
                            <div
                              key={`${field.key}-${fIdx}`}
                              className="flex items-center justify-between text-xs font-mono tabular-nums"
                            >
                              <span className="text-[#A1A1AA]">{field.key}</span>
                              {field.kind === "email" ? (
                                <span className="text-[#10B981] inline-flex items-center gap-1">
                                  <At size={12} weight="bold" />
                                  <span>{normalizeEmail(field.value)}</span>
                                </span>
                              ) : field.kind === "secret" ? (
                                <span className="text-[#52525B] inline-flex items-center gap-1">
                                  <Key size={12} weight="regular" className="text-[#F59E0B]" />
                                  <span>••••••••••</span>
                                </span>
                              ) : (
                                <span className="text-[#F4F4F5] truncate max-w-[200px]">
                                  {field.value}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-[#09090B] border-t border-white/[0.07] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#121215] hover:bg-[#18181C] border border-white/[0.07] text-xs font-medium text-[#F4F4F5] active:scale-[0.98] transition-all duration-150"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isImporting}
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#09090B] text-xs font-semibold flex items-center gap-1.5 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
            >
              <Check size={15} weight="bold" />
              <span>Import {drafts.length} Akun ke Vault</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
