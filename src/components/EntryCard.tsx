import React, { useEffect, useState } from "react";
import {
  At,
  Check,
  Copy,
  Eye,
  EyeSlash,
  Globe,
  PencilSimple,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { copyToClipboard, normalizeEmail } from "../lib/tauri-api";
import type { VaultEntry } from "../types/vault";

interface EntryCardProps {
  entry: VaultEntry;
  activeEmailFilter: string | null;
  onSelectEmail: (email: string) => void;
  onSelectTag: (tag: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (entry: VaultEntry) => void;
  onDelete: (id: string) => void;
}

export const EntryCard: React.FC<EntryCardProps> = ({
  entry,
  activeEmailFilter,
  onSelectEmail,
  onSelectTag,
  onToggleFavorite,
  onEdit,
  onDelete,
}) => {
  const [revealedIndices, setRevealedIndices] = useState<Record<number, boolean>>(
    {}
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedIsSecret, setCopiedIsSecret] = useState<boolean>(false);

  useEffect(() => {
    if (copiedIndex === null) return;
    const timer = window.setTimeout(() => {
      setCopiedIndex(null);
      setCopiedIsSecret(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [copiedIndex]);

  const toggleReveal = (idx: number) => {
    setRevealedIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleCopy = async (idx: number, value: string, isSecret: boolean) => {
    const cleanValue = isSecret ? value : normalizeEmailIfEmail(idx, value);
    await copyToClipboard(cleanValue, isSecret);
    setCopiedIndex(idx);
    setCopiedIsSecret(isSecret);
  };

  const normalizeEmailIfEmail = (idx: number, value: string): string => {
    const field = entry.fields[idx];
    if (field && field.kind === "email") {
      return normalizeEmail(value);
    }
    return value;
  };

  return (
    <article className="bg-[#121215] border border-white/[0.07] rounded-xl overflow-hidden flex flex-col justify-between transition-colors duration-150">
      <div>
        <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleFavorite(entry.id)}
                aria-label={
                  entry.favorite
                    ? `Hapus ${entry.title} dari favorit`
                    : `Tandai ${entry.title} sebagai favorit`
                }
                className="p-1 -ml-1 rounded text-[#A1A1AA] hover:text-[#F59E0B] active:scale-[0.98] transition-all duration-150"
              >
                <Star
                  size={16}
                  weight={entry.favorite ? "fill" : "regular"}
                  className={entry.favorite ? "text-[#F59E0B]" : "text-[#A1A1AA]"}
                />
              </button>
              <h3 className="text-base font-semibold text-[#F4F4F5] truncate">
                {entry.title}
              </h3>
            </div>

            {entry.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onSelectTag(tag)}
                    className="px-2 py-0.5 rounded bg-[#09090B] hover:bg-[#18181C] border border-white/[0.07] text-[11px] font-mono tabular-nums text-[#A1A1AA] hover:text-[#F4F4F5] active:scale-[0.98] transition-all duration-150"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label={`Edit ${entry.title}`}
              className="px-2 py-1 rounded-md text-xs text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181C] flex items-center gap-1 active:scale-[0.98] transition-all duration-150"
            >
              <PencilSimple size={14} weight="regular" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              aria-label={`Hapus ${entry.title}`}
              className="px-2 py-1 rounded-md text-xs text-[#A1A1AA] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 flex items-center gap-1 active:scale-[0.98] transition-all duration-150"
            >
              <Trash size={14} weight="regular" />
              <span>Hapus</span>
            </button>
          </div>
        </div>

        {entry.fields.length > 0 && (
          <div className="divide-y divide-white/[0.06]">
            {entry.fields.map((field, idx) => {
              const isSecret = field.kind === "secret";
              const isEmail = field.kind === "email";
              const isUrl = field.kind === "url";
              const isRevealed = !!revealedIndices[idx];
              const isCopied = copiedIndex === idx;
              const normalizedEmail = isEmail ? normalizeEmail(field.value) : "";
              const isEmailActive =
                isEmail && activeEmailFilter === normalizedEmail;

              return (
                <div
                  key={`${field.key}-${idx}`}
                  className="px-4 py-2.5 hover:bg-[#18181C] flex items-center justify-between gap-3 transition-colors duration-150"
                >
                  <span className="text-xs font-mono tabular-nums text-[#A1A1AA] shrink-0 min-w-[72px]">
                    {field.key}
                  </span>

                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {isEmail ? (
                      <button
                        type="button"
                        onClick={() => onSelectEmail(normalizedEmail)}
                        title={`Lihat semua akun dengan email ${normalizedEmail}`}
                        className={`px-2 py-0.5 rounded text-xs font-mono tabular-nums inline-flex items-center gap-1.5 max-w-full truncate active:scale-[0.98] transition-all duration-150 ${
                          isEmailActive
                            ? "bg-emerald-500/20 text-[#10B981] border border-emerald-500/40"
                            : "bg-[#09090B] hover:bg-[#121215] text-[#F4F4F5] border border-white/[0.07]"
                        }`}
                      >
                        <At size={13} weight="regular" className="text-[#10B981] shrink-0" />
                        <span className="truncate">{normalizedEmail}</span>
                      </button>
                    ) : isSecret ? (
                      <span
                        className={`text-xs font-mono tabular-nums truncate ${
                          isRevealed ? "text-[#F4F4F5]" : "text-[#52525B]"
                        }`}
                      >
                        {isRevealed ? field.value : "••••••••••"}
                      </span>
                    ) : isUrl ? (
                      <span className="text-xs font-mono tabular-nums text-[#F4F4F5] inline-flex items-center gap-1.5 truncate">
                        <Globe size={13} weight="regular" className="text-[#A1A1AA] shrink-0" />
                        <span className="truncate">{field.value}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-mono tabular-nums text-[#F4F4F5] truncate">
                        {field.value}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSecret && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(idx)}
                        aria-label={
                          isRevealed
                            ? `Sembunyikan ${field.key} untuk ${entry.title}`
                            : `Tampilkan ${field.key} untuk ${entry.title}`
                        }
                        className="px-2 py-1 rounded bg-[#09090B] hover:bg-[#121215] border border-white/[0.07] text-[11px] text-[#A1A1AA] hover:text-[#F4F4F5] inline-flex items-center gap-1 active:scale-[0.98] transition-all duration-150"
                      >
                        {isRevealed ? (
                          <>
                            <EyeSlash size={13} weight="regular" />
                            <span>Sembunyikan</span>
                          </>
                        ) : (
                          <>
                            <Eye size={13} weight="regular" />
                            <span>Tampilkan</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopy(idx, field.value, isSecret)}
                      aria-label={`Salin ${field.key} dari ${entry.title}`}
                      className={`px-2 py-1 rounded border text-[11px] font-mono tabular-nums inline-flex items-center gap-1 active:scale-[0.98] transition-all duration-150 ${
                        isCopied
                          ? "bg-emerald-500/15 border-emerald-500/40 text-[#10B981]"
                          : "bg-[#09090B] hover:bg-[#121215] border-white/[0.07] text-[#A1A1AA] hover:text-[#F4F4F5]"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check size={13} weight="bold" />
                          <span>
                            {copiedIsSecret
                              ? "Tersalin · Auto-clear 30d"
                              : "Tersalin"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} weight="regular" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {entry.notes && (
        <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#09090B]/50 text-xs text-[#A1A1AA] whitespace-pre-line font-mono tabular-nums">
          {entry.notes}
        </div>
      )}
    </article>
  );
};
