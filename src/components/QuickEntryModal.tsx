import React, { useEffect, useState } from "react";
import {
  At,
  Check,
  Key,
  NotePencil,
  Sparkle,
  Star,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { normalizeEmail, parseEntryText, parsePreview } from "../lib/tauri-api";
import {
  generatePassword,
  generatePassphrase,
  generatePin,
} from "../lib/generator";
import type { ParsedEntryDraft, VaultEntry } from "../types/vault";

interface QuickEntryModalProps {
  isOpen: boolean;
  editingEntry: VaultEntry | null;
  onClose: () => void;
  onSave: (params: {
    id?: string | null;
    rawText: string;
    favorite: boolean;
  }) => Promise<void>;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  editingEntry,
  onClose,
  onSave,
}) => {
  const [rawText, setRawText] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [preview, setPreview] = useState<ParsedEntryDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [generatorBadge, setGeneratorBadge] = useState<string | null>(null);

  const insertGeneratedSecret = (key: string, secretValue: string) => {
    setRawText((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) {
        return `${key}: ${secretValue}`;
      }
      return `${trimmed}\n${key}: ${secretValue}`;
    });
    setGeneratorBadge(`${key}: disisipkan`);
    setTimeout(() => setGeneratorBadge(null), 2500);
  };

  useEffect(() => {
    if (!isOpen) return;
    const initialRaw = editingEntry ? editingEntry.raw_text : "";
    const initialFav = editingEntry ? editingEntry.favorite : false;
    setRawText(initialRaw);
    setFavorite(initialFav);
    setPreview(parseEntryText(initialRaw));
    setErrorMessage(null);
  }, [isOpen, editingEntry]);

  useEffect(() => {
    if (!isOpen) return;
    const immediate = parseEntryText(rawText);
    setPreview(immediate);

    let cancelled = false;
    parsePreview(rawText)
      .then((res) => {
        if (!cancelled) {
          setPreview(res);
        }
      })
      .catch(() => {
        // Fallback to local parseEntryText already set
      });

    return () => {
      cancelled = true;
    };
  }, [rawText, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!rawText.trim()) {
      setErrorMessage(
        "Catatan tidak boleh kosong. Ketik minimal baris judul pada kolom input."
      );
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        id: editingEntry?.id ?? null,
        rawText,
        favorite,
      });
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Gagal menyimpan catatan";
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-entry-modal-title"
      className="fixed inset-0 z-50 bg-[#09090B]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl bg-[#121215] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NotePencil size={20} weight="duotone" className="text-[#10B981]" />
            <h2
              id="quick-entry-modal-title"
              className="text-base font-semibold text-[#F4F4F5]"
            >
              {editingEntry ? "Edit Catatan Akun" : "Tambah Catatan Gaya Chat"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal catatan"
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] active:scale-[0.98] transition-all duration-150"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="quick-entry-raw-input"
                  className="text-sm font-medium text-[#F4F4F5]"
                >
                  Format Chat (Baris 1 = Judul, Baris berikutnya = key: value)
                </label>

                <button
                  type="button"
                  onClick={() => setFavorite((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border active:scale-[0.98] transition-all duration-150 ${
                    favorite
                      ? "bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#F59E0B]"
                      : "bg-[#09090B] border-white/[0.07] text-[#A1A1AA] hover:text-[#F4F4F5]"
                  }`}
                >
                  <Star size={14} weight={favorite ? "fill" : "regular"} />
                  <span>Favorit</span>
                </button>
              </div>

              <textarea
                id="quick-entry-raw-input"
                rows={9}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder={
                  "amazon video #streaming\nemail: test@gmail.com\npass: test123\npin: 9988"
                }
                className="w-full bg-[#09090B] border border-white/[0.07] rounded-lg p-3.5 text-sm font-mono tabular-nums text-[#F4F4F5] placeholder:text-[#52525B] focus:border-[#10B981] leading-relaxed resize-y transition-colors duration-150"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-0.5">
                <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                  <Sparkle size={14} weight="duotone" className="text-[#10B981]" />
                  <span>Generator Sandi:</span>
                  {generatorBadge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-[#10B981] font-mono animate-fade-in">
                      {generatorBadge}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      insertGeneratedSecret("pass", generatePassword({ length: 20 }))
                    }
                    title="Sisipkan password 20 karakter acak kuat"
                    className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#10B981] hover:border-[#10B981]/50 transition-colors cursor-pointer"
                  >
                    + Pass (20)
                  </button>
                  <button
                    type="button"
                    onClick={() => insertGeneratedSecret("pass", generatePassphrase(4))}
                    title="Sisipkan passphrase 4 kata yang mudah diingat"
                    className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#38BDF8] hover:border-[#38BDF8]/50 transition-colors cursor-pointer"
                  >
                    + Passphrase (4 kata)
                  </button>
                  <button
                    type="button"
                    onClick={() => insertGeneratedSecret("pin", generatePin(6))}
                    title="Sisipkan PIN 6 angka acak"
                    className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[#F59E0B] hover:border-[#F59E0B]/50 transition-colors cursor-pointer"
                  >
                    + PIN (6 digit)
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#A1A1AA]">
                Gunakan tanda pagar seperti{" "}
                <code className="font-mono text-[#F4F4F5]">#streaming</code> atau{" "}
                <code className="font-mono text-[#F4F4F5]">#game</code> untuk
                kategori otomatis. Tekan{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-[#09090B] border border-white/[0.07] font-mono tabular-nums text-[11px] text-[#F4F4F5]">
                  Ctrl+Enter
                </kbd>{" "}
                untuk menyimpan cepat.
              </p>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/30 flex items-start gap-2 text-xs text-[#F43F5E]"
                >
                  <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{errorMessage}</p>
                    <p className="text-[#A1A1AA] mt-0.5">
                      Contoh input valid: ketik nama layanan di baris pertama lalu email atau password di baris kedua.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 flex flex-col gap-2">
              <div className="text-sm font-medium text-[#F4F4F5]">
                Pratinjau Struktur Otomatis
              </div>

              <div className="flex-1 bg-[#09090B] border border-white/[0.07] rounded-lg p-4 flex flex-col justify-between">
                {!preview ? (
                  <div className="my-auto text-center py-8 space-y-1">
                    <p className="text-xs font-medium text-[#A1A1AA]">
                      Belum ada teks untuk dipratinjau
                    </p>
                    <p className="text-xs text-[#52525B]">
                      Hasil deteksi judul, relasi email, dan sandi rahasia akan tampil secara langsung di sini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="pb-2.5 border-b border-white/[0.07] space-y-1.5">
                      <div className="text-sm font-semibold text-[#F4F4F5]">
                        {preview.title}
                      </div>
                      {preview.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {preview.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded bg-[#121215] border border-white/[0.07] text-[11px] font-mono tabular-nums text-[#10B981]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {preview.fields.length > 0 ? (
                      <div className="divide-y divide-white/[0.06]">
                        {preview.fields.map((field, idx) => (
                          <div
                            key={`${field.key}-${idx}`}
                            className="py-2 flex items-center justify-between gap-2 text-xs font-mono tabular-nums"
                          >
                            <span className="text-[#A1A1AA]">{field.key}</span>
                            {field.kind === "email" ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[#10B981] inline-flex items-center gap-1 truncate">
                                <At size={12} weight="bold" />
                                <span>{normalizeEmail(field.value)}</span>
                              </span>
                            ) : field.kind === "secret" ? (
                              <span className="text-[#52525B] inline-flex items-center gap-1">
                                <Key size={12} weight="regular" className="text-[#F59E0B]" />
                                <span>••••••••••</span>
                              </span>
                            ) : (
                              <span className="text-[#F4F4F5] truncate">
                                {field.value}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#A1A1AA]">
                        Tidak ada baris <code className="font-mono">key: value</code>{" "}
                        (disimpan sebagai catatan judul/teks bebas).
                      </p>
                    )}

                    {preview.notes && (
                      <div className="pt-2 border-t border-white/[0.06] text-xs font-mono tabular-nums text-[#A1A1AA] whitespace-pre-line">
                        {preview.notes}
                      </div>
                    )}
                  </div>
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
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#09090B] text-xs font-semibold flex items-center gap-1.5 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
            >
              <Check size={15} weight="bold" />
              <span>Simpan Catatan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
