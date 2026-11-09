export type FieldKind = "email" | "secret" | "url" | "text";

export interface EntryField {
  key: string;
  value: string;
  kind: FieldKind;
}

export interface VaultEntry {
  id: string;
  title: string;
  raw_text: string;
  fields: EntryField[];
  tags: string[];
  notes: string;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParsedEntryDraft {
  title: string;
  raw_text: string;
  fields: EntryField[];
  tags: string[];
  notes: string;
}

export interface EmailRelationSummary {
  email: string;
  count: number;
  entry_ids: string[];
  titles: string[];
}

export interface VaultStatus {
  exists: boolean;
  backup_exists: boolean;
  unlocked: boolean;
  vault_path: string;
  auto_lock_minutes: number;
  windows_hello_available: boolean;
  windows_hello_enabled: boolean;
}

export interface VaultSnapshotResponse {
  entries: VaultEntry[];
  email_relations: EmailRelationSummary[];
  tags: string[];
  status: VaultStatus;
}
