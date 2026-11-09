import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  EmailRelationSummary,
  EntryField,
  FieldKind,
  ParsedEntryDraft,
  VaultEntry,
  VaultSnapshotResponse,
  VaultStatus,
} from "../types/vault";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase().replace(":@", "@");
}

export function looksLikeEmail(val: string): boolean {
  const cleaned = normalizeEmail(val);
  const atIndex = cleaned.indexOf("@");
  if (atIndex <= 0) return false;
  const local = cleaned.slice(0, atIndex);
  const domain = cleaned.slice(atIndex + 1);
  return (
    local.length > 0 &&
    domain.includes(".") &&
    !domain.startsWith(".") &&
    !domain.endsWith(".")
  );
}

export function classifyField(key: string, value: string): FieldKind {
  const k = key.trim().toLowerCase();
  const v = value.trim().toLowerCase();

  const secretKeywords = [
    "pass",
    "password",
    "pwd",
    "sandi",
    "pin",
    "key",
    "apikey",
    "api_key",
    "api-key",
    "token",
    "secret",
    "recovery",
    "otp",
    "2fa",
    "seed",
    "phrase",
    "cvv",
    "private",
  ];
  if (secretKeywords.some((kw) => k.includes(kw))) {
    return "secret";
  }

  const emailKeywords = ["email", "e-mail", "mail", "gmail"];
  if (emailKeywords.some((kw) => k === kw || k.endsWith(kw)) || looksLikeEmail(v)) {
    return "email";
  }

  const urlKeywords = ["url", "link", "web", "website", "site", "domain"];
  if (
    urlKeywords.some((kw) => k === kw) ||
    v.startsWith("http://") ||
    v.startsWith("https://")
  ) {
    return "url";
  }

  return "text";
}

function extractInlineTags(line: string): { cleanLine: string; tags: string[] } {
  const tags: string[] = [];
  const keptWords: string[] = [];

  for (const token of line.split(/\s+/)) {
    if (!token) continue;
    if (token.startsWith("#")) {
      const cleaned = token
        .slice(1)
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .toLowerCase();
      if (cleaned.length > 0) {
        tags.push(cleaned);
        continue;
      }
    }
    keptWords.push(token);
  }

  return { cleanLine: keptWords.join(" "), tags };
}

export function parseEntryText(raw: string): ParsedEntryDraft | null {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const tags: string[] = [];
  const { cleanLine: cleanTitle, tags: firstTags } = extractInlineTags(firstLine);
  for (const t of firstTags) {
    if (!tags.includes(t)) tags.push(t);
  }

  const title = cleanTitle.length > 0 ? cleanTitle : firstLine;
  const fields: EntryField[] = [];
  const notesLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const { cleanLine: lineWithoutTags, tags: lineTags } = extractInlineTags(lines[i]);
    for (const t of lineTags) {
      if (!tags.includes(t)) tags.push(t);
    }
    if (!lineWithoutTags) continue;

    const colonIdx = lineWithoutTags.indexOf(":");
    if (colonIdx !== -1) {
      const rawKey = lineWithoutTags.slice(0, colonIdx).trim();
      const rawVal = lineWithoutTags.slice(colonIdx + 1).trim();
      if (
        rawKey.length > 0 &&
        rawKey.length <= 40 &&
        rawKey.toLowerCase() !== "http" &&
        rawKey.toLowerCase() !== "https" &&
        rawVal.length > 0
      ) {
        fields.push({
          key: rawKey,
          value: rawVal,
          kind: classifyField(rawKey, rawVal),
        });
        continue;
      }
    }

    notesLines.push(lineWithoutTags);
  }

  return {
    title,
    raw_text: normalized,
    fields,
    tags,
    notes: notesLines.join("\n"),
  };
}

export function parseBulkText(rawBulk: string): ParsedEntryDraft[] {
  const normalized = rawBulk.replace(/\r\n/g, "\n");
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of normalized.split("\n")) {
    if (line.trim().length === 0) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n"));
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n"));
  }

  const results: ParsedEntryDraft[] = [];
  for (const block of blocks) {
    const parsed = parseEntryText(block);
    if (parsed) results.push(parsed);
  }
  return results;
}

export function entryEmails(entry: VaultEntry): string[] {
  const emails: string[] = [];
  for (const field of entry.fields) {
    if (field.kind === "email" || looksLikeEmail(field.value)) {
      const norm = normalizeEmail(field.value);
      if (norm && !emails.includes(norm)) {
        emails.push(norm);
      }
    }
  }
  return emails;
}

export function buildEmailRelations(entries: VaultEntry[]): EmailRelationSummary[] {
  const map = new Map<string, { entry_ids: string[]; titles: string[] }>();

  for (const entry of entries) {
    for (const email of entryEmails(entry)) {
      const existing = map.get(email) ?? { entry_ids: [], titles: [] };
      existing.entry_ids.push(entry.id);
      existing.titles.push(entry.title);
      map.set(email, existing);
    }
  }

  const summaries: EmailRelationSummary[] = Array.from(map.entries()).map(
    ([email, group]) => ({
      email,
      count: group.entry_ids.length,
      entry_ids: group.entry_ids,
      titles: group.titles,
    })
  );

  summaries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.email.localeCompare(b.email);
  });

  return summaries;
}

export function filterEntries(
  entries: VaultEntry[],
  query: string,
  emailFilter?: string | null,
  tagFilter?: string | null,
  favoritesOnly = false
): VaultEntry[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const targetEmail = emailFilter ? normalizeEmail(emailFilter) : "";
  const targetTag = tagFilter
    ? tagFilter.trim().replace(/^#+/, "").toLowerCase()
    : "";

  return entries.filter((entry) => {
    if (favoritesOnly && !entry.favorite) return false;
    if (targetEmail && !entryEmails(entry).includes(targetEmail)) return false;
    if (
      targetTag &&
      !entry.tags.some((t) => t.toLowerCase() === targetTag)
    ) {
      return false;
    }
    if (tokens.length === 0) return true;

    const fieldsText = entry.fields
      .map(
        (f) =>
          `${f.key.toLowerCase()} ${f.value.toLowerCase()} ${normalizeEmail(
            f.value
          )}`
      )
      .join(" ");
    const haystack = `${entry.title.toLowerCase()} ${entry.notes.toLowerCase()} ${entry.tags
      .join(" ")
      .toLowerCase()} ${fieldsText}`;

    return tokens.every((tok) => haystack.includes(tok));
  });
}

function collectUniqueTags(entries: VaultEntry[]): string[] {
  const set = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const norm = tag.trim().toLowerCase();
      if (norm) set.add(norm);
    }
  }
  return Array.from(set).sort();
}

interface MockVaultStore {
  exists: boolean;
  backupExists: boolean;
  unlocked: boolean;
  vaultPath: string;
  autoLockMinutes: number;
  windowsHelloAvailable: boolean;
  windowsHelloEnabled: boolean;
  masterPassword: string | null;
  entries: VaultEntry[];
  backupEntries: VaultEntry[];
  exportedBackups: Map<
    string,
    { entries: VaultEntry[]; masterPassword: string; autoLockMinutes: number }
  >;
  nextIdCounter: number;
}

const DEFAULT_VAULT_PATH =
  "C:\\Users\\LocalUser\\AppData\\Roaming\\com.fathur.storagelocal\\storage-local.vault";

let mockStore: MockVaultStore = {
  exists: false,
  backupExists: false,
  unlocked: false,
  vaultPath: DEFAULT_VAULT_PATH,
  autoLockMinutes: 5,
  windowsHelloAvailable: true,
  windowsHelloEnabled: false,
  masterPassword: null,
  entries: [],
  backupEntries: [],
  exportedBackups: new Map(),
  nextIdCounter: 1,
};

export function resetMockVaultForTests(): void {
  mockStore = {
    exists: false,
    backupExists: false,
    unlocked: false,
    vaultPath: DEFAULT_VAULT_PATH,
    autoLockMinutes: 5,
    windowsHelloAvailable: true,
    windowsHelloEnabled: false,
    masterPassword: null,
    entries: [],
    backupEntries: [],
    exportedBackups: new Map(),
    nextIdCounter: 1,
  };
}

function getMockStatus(): VaultStatus {
  return {
    exists: mockStore.exists,
    backup_exists: mockStore.backupExists,
    unlocked: mockStore.unlocked,
    vault_path: mockStore.vaultPath,
    auto_lock_minutes: mockStore.autoLockMinutes,
    windows_hello_available: mockStore.windowsHelloAvailable,
    windows_hello_enabled: mockStore.windowsHelloEnabled,
  };
}

function getMockSnapshot(overrideEntries?: VaultEntry[]): VaultSnapshotResponse {
  if (!mockStore.unlocked) {
    throw new Error("Vault terkunci");
  }
  return {
    entries: overrideEntries ? [...overrideEntries] : [...mockStore.entries],
    email_relations: buildEmailRelations(mockStore.entries),
    tags: collectUniqueTags(mockStore.entries),
    status: getMockStatus(),
  };
}

function snapshotBackupBeforeSave(): void {
  if (mockStore.exists) {
    mockStore.backupEntries = mockStore.entries.map((e) => ({
      ...e,
      fields: e.fields.map((f) => ({ ...f })),
      tags: [...e.tags],
    }));
    mockStore.backupExists = true;
  }
}

export async function getVaultStatus(): Promise<VaultStatus> {
  if (isTauriRuntime()) {
    return invoke<VaultStatus>("get_vault_status");
  }
  return getMockStatus();
}

export async function initOrUnlockVault(
  masterPassword: string,
  customPath?: string | null
): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("init_or_unlock_vault", {
      masterPassword,
      customPath: customPath ?? null,
    });
  }

  const trimmed = masterPassword.trim();
  if (!trimmed) {
    throw new Error("Master password tidak boleh kosong");
  }

  if (customPath && customPath.trim().length > 0) {
    mockStore.vaultPath = customPath.trim();
  }

  if (mockStore.exists) {
    if (mockStore.masterPassword !== masterPassword) {
      throw new Error("Master Password salah atau file vault tidak valid");
    }
  } else {
    mockStore.exists = true;
    mockStore.masterPassword = masterPassword;
  }

  mockStore.unlocked = true;
  return getMockSnapshot();
}

export async function lockVault(): Promise<VaultStatus> {
  if (isTauriRuntime()) {
    return invoke<VaultStatus>("lock_vault");
  }
  mockStore.unlocked = false;
  return getMockStatus();
}

export async function enableWindowsHello(
  masterPassword?: string | null
): Promise<VaultStatus> {
  if (isTauriRuntime()) {
    return invoke<VaultStatus>("enable_windows_hello", {
      masterPassword: masterPassword ?? null,
    });
  }

  if (!mockStore.windowsHelloAvailable) {
    throw new Error(
      "Windows Hello tidak tersedia atau belum dikonfigurasi di perangkat Windows ini."
    );
  }

  const trimmed = masterPassword?.trim();
  if (trimmed) {
    if (mockStore.exists && mockStore.masterPassword !== trimmed) {
      throw new Error("Master Password salah atau file vault tidak valid");
    }
  } else if (!mockStore.unlocked || !mockStore.masterPassword) {
    throw new Error(
      "Buka vault terlebih dahulu atau masukkan Master Password untuk mengaktifkan Windows Hello."
    );
  }

  mockStore.windowsHelloEnabled = true;
  return getMockStatus();
}

export async function disableWindowsHello(): Promise<VaultStatus> {
  if (isTauriRuntime()) {
    return invoke<VaultStatus>("disable_windows_hello");
  }
  mockStore.windowsHelloEnabled = false;
  return getMockStatus();
}

export async function unlockWithWindowsHello(
  customPath?: string | null
): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("unlock_with_windows_hello", {
      customPath: customPath ?? null,
    });
  }

  if (customPath && customPath.trim().length > 0) {
    mockStore.vaultPath = customPath.trim();
  }

  if (!mockStore.exists || !mockStore.windowsHelloEnabled) {
    throw new Error("Windows Hello belum diaktifkan untuk vault ini.");
  }

  mockStore.unlocked = true;
  return getMockSnapshot();
}

export async function parsePreview(
  rawText: string
): Promise<ParsedEntryDraft | null> {
  if (isTauriRuntime()) {
    return invoke<ParsedEntryDraft | null>("parse_preview", { rawText });
  }
  return parseEntryText(rawText);
}

export async function parseBulkPreview(
  rawBulk: string
): Promise<ParsedEntryDraft[]> {
  if (isTauriRuntime()) {
    return invoke<ParsedEntryDraft[]>("parse_bulk_preview", { rawBulk });
  }
  return parseBulkText(rawBulk);
}

export async function upsertEntryFromRaw(params: {
  id?: string | null;
  rawText: string;
  favorite?: boolean | null;
}): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("upsert_entry_from_raw", {
      id: params.id ?? null,
      rawText: params.rawText,
      favorite: params.favorite ?? null,
    });
  }

  if (!mockStore.unlocked) {
    throw new Error("Vault terkunci");
  }

  const draft = parseEntryText(params.rawText);
  if (!draft) {
    throw new Error("Catatan tidak boleh kosong");
  }

  snapshotBackupBeforeSave();
  const now = new Date().toISOString();
  const targetId = params.id?.trim() || "";

  if (targetId) {
    const idx = mockStore.entries.findIndex((e) => e.id === targetId);
    if (idx !== -1) {
      const existing = mockStore.entries[idx];
      mockStore.entries[idx] = {
        ...existing,
        title: draft.title,
        raw_text: draft.raw_text,
        fields: draft.fields,
        tags: draft.tags,
        notes: draft.notes,
        favorite: params.favorite ?? existing.favorite,
        updated_at: now,
      };
    } else {
      mockStore.entries.unshift({
        id: targetId,
        title: draft.title,
        raw_text: draft.raw_text,
        fields: draft.fields,
        tags: draft.tags,
        notes: draft.notes,
        favorite: params.favorite ?? false,
        created_at: now,
        updated_at: now,
      });
    }
  } else {
    const newId = `entry-${mockStore.nextIdCounter++}`;
    mockStore.entries.unshift({
      id: newId,
      title: draft.title,
      raw_text: draft.raw_text,
      fields: draft.fields,
      tags: draft.tags,
      notes: draft.notes,
      favorite: params.favorite ?? false,
      created_at: now,
      updated_at: now,
    });
  }

  return getMockSnapshot();
}

export async function bulkImportFromRaw(
  rawBulk: string
): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("bulk_import_from_raw", { rawBulk });
  }

  if (!mockStore.unlocked) {
    throw new Error("Vault terkunci");
  }

  const drafts = parseBulkText(rawBulk);
  if (drafts.length === 0) {
    throw new Error("Tidak ada blok catatan valid untuk diimpor");
  }

  snapshotBackupBeforeSave();
  const now = new Date().toISOString();
  const imported: VaultEntry[] = drafts.map((draft) => ({
    id: `entry-${mockStore.nextIdCounter++}`,
    title: draft.title,
    raw_text: draft.raw_text,
    fields: draft.fields,
    tags: draft.tags,
    notes: draft.notes,
    favorite: false,
    created_at: now,
    updated_at: now,
  }));

  mockStore.entries = [...imported, ...mockStore.entries];
  return getMockSnapshot();
}

export async function deleteEntry(id: string): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("delete_entry", { id });
  }

  if (!mockStore.unlocked) {
    throw new Error("Vault terkunci");
  }

  const before = mockStore.entries.length;
  const remaining = mockStore.entries.filter((e) => e.id !== id);
  if (remaining.length === before) {
    throw new Error("Entri tidak ditemukan");
  }

  snapshotBackupBeforeSave();
  mockStore.entries = remaining;
  return getMockSnapshot();
}

export async function toggleFavorite(
  id: string
): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("toggle_favorite", { id });
  }

  if (!mockStore.unlocked) {
    throw new Error("Vault terkunci");
  }

  const target = mockStore.entries.find((e) => e.id === id);
  if (!target) {
    throw new Error("Entri tidak ditemukan");
  }

  snapshotBackupBeforeSave();
  target.favorite = !target.favorite;
  target.updated_at = new Date().toISOString();
  return getMockSnapshot();
}

export async function queryVault(params: {
  query: string;
  emailFilter?: string | null;
  tagFilter?: string | null;
  favoritesOnly: boolean;
}): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("query_vault", {
      query: params.query,
      emailFilter: params.emailFilter ?? null,
      tagFilter: params.tagFilter ?? null,
      favoritesOnly: params.favoritesOnly,
    });
  }

  if (!mockStore.unlocked) {
    throw new Error("Vault terkunci");
  }

  const filtered = filterEntries(
    mockStore.entries,
    params.query,
    params.emailFilter,
    params.tagFilter,
    params.favoritesOnly
  );
  return getMockSnapshot(filtered);
}

export async function updateAutoLockMinutes(
  minutes: number
): Promise<VaultStatus> {
  if (isTauriRuntime()) {
    return invoke<VaultStatus>("update_auto_lock_minutes", { minutes });
  }

  if (!mockStore.unlocked) {
    throw new Error("Vault terkunci");
  }

  mockStore.autoLockMinutes = minutes;
  return getMockStatus();
}

export async function changeMasterPassword(
  currentPassword: string,
  newPassword: string
): Promise<VaultStatus> {
  if (isTauriRuntime()) {
    return invoke<VaultStatus>("change_master_password", {
      currentPassword,
      newPassword,
    });
  }

  if (!mockStore.unlocked) {
    throw new Error("Buka vault terlebih dahulu untuk mengganti Master Password.");
  }
  if (mockStore.masterPassword && mockStore.masterPassword !== currentPassword.trim()) {
    throw new Error("Master Password saat ini salah.");
  }
  const trimmed = newPassword.trim();
  if (!trimmed) {
    throw new Error("Master Password baru tidak boleh kosong.");
  }
  if (trimmed === currentPassword.trim()) {
    throw new Error("Master Password baru tidak boleh sama dengan password saat ini.");
  }

  mockStore.masterPassword = trimmed;
  return getMockStatus();
}

export async function exportVaultBackup(
  destinationPath: string
): Promise<void> {
  if (isTauriRuntime()) {
    return invoke<void>("export_vault_backup", { destinationPath });
  }

  const trimmed = destinationPath.trim();
  if (!trimmed) {
    throw new Error("Path tujuan backup tidak boleh kosong");
  }
  if (!mockStore.exists || !mockStore.masterPassword) {
    throw new Error("File vault belum tersedia untuk diekspor");
  }

  mockStore.exportedBackups.set(trimmed, {
    entries: mockStore.entries.map((e) => ({
      ...e,
      fields: e.fields.map((f) => ({ ...f })),
      tags: [...e.tags],
    })),
    masterPassword: mockStore.masterPassword,
    autoLockMinutes: mockStore.autoLockMinutes,
  });
}

export async function restoreVaultBackup(
  sourcePath: string,
  masterPassword: string
): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("restore_vault_backup", {
      sourcePath,
      masterPassword,
    });
  }

  const trimmedPath = sourcePath.trim();
  if (!trimmedPath) {
    throw new Error("Path sumber backup tidak boleh kosong");
  }
  if (!masterPassword.trim()) {
    throw new Error("Master password tidak boleh kosong");
  }

  const saved = mockStore.exportedBackups.get(trimmedPath);
  if (saved) {
    if (saved.masterPassword !== masterPassword) {
      throw new Error("Master Password salah atau file backup tidak valid");
    }
    snapshotBackupBeforeSave();
    mockStore.entries = saved.entries.map((e) => ({ ...e }));
    mockStore.autoLockMinutes = saved.autoLockMinutes;
    mockStore.masterPassword = masterPassword;
    mockStore.exists = true;
    mockStore.unlocked = true;
    return getMockSnapshot();
  }

  // Fallback for custom path restore in mock mode
  if (mockStore.masterPassword && mockStore.masterPassword !== masterPassword) {
    throw new Error("Master Password salah atau file backup tidak valid");
  }
  mockStore.masterPassword = masterPassword;
  mockStore.exists = true;
  mockStore.unlocked = true;
  return getMockSnapshot();
}

export async function recoverFromBak(
  masterPassword: string
): Promise<VaultSnapshotResponse> {
  if (isTauriRuntime()) {
    return invoke<VaultSnapshotResponse>("recover_from_bak", {
      masterPassword,
    });
  }

  if (!mockStore.backupExists) {
    throw new Error("File cadangan .vault.bak belum tersedia");
  }
  if (mockStore.masterPassword && mockStore.masterPassword !== masterPassword) {
    throw new Error("Master Password salah untuk memulihkan .vault.bak");
  }

  mockStore.entries = mockStore.backupEntries.map((e) => ({ ...e }));
  mockStore.unlocked = true;
  return getMockSnapshot();
}

export async function copyToClipboard(
  value: string,
  isSecret: boolean
): Promise<void> {
  if (isTauriRuntime()) {
    return invoke<void>("copy_to_clipboard", { value, isSecret });
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API may be restricted in headless test runner
    }
  }
}

export async function subscribeVaultLocked(
  onLocked: () => void
): Promise<UnlistenFn> {
  if (isTauriRuntime()) {
    return listen("vault://locked", () => {
      onLocked();
    });
  }
  return () => {};
}

export async function pickVaultSavePath(
  defaultPath?: string
): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "Pilih Lokasi Ekspor Backup Velo",
        defaultPath: defaultPath || "D:\\Backup\\storage-local-backup.vault",
        filters: [{ name: "Velo Vault (*.vault)", extensions: ["vault"] }],
      });
      return path;
    } catch (e) {
      console.warn("Failed to open save dialog:", e);
      return null;
    }
  }
  return null;
}

export async function pickVaultOpenPath(
  title?: string
): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        title: title || "Pilih File Velo Vault (.vault)",
        multiple: false,
        directory: false,
        filters: [{ name: "Velo Vault (*.vault)", extensions: ["vault"] }],
      });
      if (typeof path === "string") return path;
      return null;
    } catch (e) {
      console.warn("Failed to open file picker:", e);
      return null;
    }
  }
  return null;
}

let mockAutostart = false;

export async function isAutostartEnabled(): Promise<boolean> {
  if (isTauriRuntime()) {
    try {
      const { isEnabled } = await import("@tauri-apps/plugin-autostart");
      return await isEnabled();
    } catch (e) {
      console.warn("Failed to check autostart status:", e);
      return false;
    }
  }
  return mockAutostart;
}

export async function enableAutostart(): Promise<void> {
  if (isTauriRuntime()) {
    const { enable } = await import("@tauri-apps/plugin-autostart");
    await enable();
    return;
  }
  mockAutostart = true;
}

export async function disableAutostart(): Promise<void> {
  if (isTauriRuntime()) {
    const { disable } = await import("@tauri-apps/plugin-autostart");
    await disable();
    return;
  }
  mockAutostart = false;
}
