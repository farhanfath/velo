use crate::models::{EmailRelationSummary, VaultData, VaultEntry, VaultStatus};
use crate::parser::{parse_bulk_text, parse_entry_text};
use crate::search::{build_email_relations, filter_entries};
use crate::storage::{backup_path_for, export_vault_copy, load_vault, save_vault_atomic};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;
use zeroize::Zeroizing;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultSnapshotResponse {
    pub entries: Vec<VaultEntry>,
    pub email_relations: Vec<EmailRelationSummary>,
    pub tags: Vec<String>,
    pub status: VaultStatus,
}

pub struct InnerSession {
    pub vault_path: PathBuf,
    pub data: Option<VaultData>,
    pub master_password: Option<Zeroizing<String>>,
    pub last_active: Instant,
    pub auto_lock_minutes: u32,
}

pub struct AppState {
    pub session: Mutex<InnerSession>,
}

impl AppState {
    pub fn new(default_vault_path: PathBuf) -> Self {
        Self {
            session: Mutex::new(InnerSession {
                vault_path: default_vault_path,
                data: None,
                master_password: None,
                last_active: Instant::now(),
                auto_lock_minutes: 5,
            }),
        }
    }

    fn status_from_guard(guard: &InnerSession) -> VaultStatus {
        let bak = backup_path_for(&guard.vault_path);
        VaultStatus {
            exists: guard.vault_path.exists(),
            backup_exists: bak.exists(),
            unlocked: guard.data.is_some(),
            vault_path: guard.vault_path.display().to_string(),
            auto_lock_minutes: guard.auto_lock_minutes,
        }
    }

    fn collect_unique_tags(entries: &[VaultEntry]) -> Vec<String> {
        let mut tags: Vec<String> = Vec::new();
        for entry in entries {
            for tag in &entry.tags {
                let normalized = tag.trim().to_lowercase();
                if !normalized.is_empty() && !tags.contains(&normalized) {
                    tags.push(normalized);
                }
            }
        }
        tags.sort();
        tags
    }

    fn snapshot_from_guard(
        guard: &InnerSession,
        override_entries: Option<Vec<VaultEntry>>,
    ) -> Result<VaultSnapshotResponse, String> {
        let data = guard
            .data
            .as_ref()
            .ok_or_else(|| "Vault terkunci".to_string())?;
        let email_relations = build_email_relations(&data.entries);
        let tags = Self::collect_unique_tags(&data.entries);
        let entries = override_entries.unwrap_or_else(|| data.entries.clone());
        let status = Self::status_from_guard(guard);

        Ok(VaultSnapshotResponse {
            entries,
            email_relations,
            tags,
            status,
        })
    }

    pub fn status(&self) -> VaultStatus {
        let guard = self.session.lock().expect("lock session");
        Self::status_from_guard(&guard)
    }

    pub fn lock(&self) {
        let mut guard = self.session.lock().expect("lock session");
        guard.data = None;
        guard.master_password = None;
    }

    pub fn touch(&self) {
        let mut guard = self.session.lock().expect("lock session");
        guard.last_active = Instant::now();
    }

    pub fn check_idle_and_lock(&self) -> bool {
        let mut guard = self.session.lock().expect("lock session");
        if guard.data.is_none() || guard.auto_lock_minutes == 0 {
            return false;
        }
        let timeout = Duration::from_secs(u64::from(guard.auto_lock_minutes) * 60);
        if guard.last_active.elapsed() >= timeout {
            guard.data = None;
            guard.master_password = None;
            return true;
        }
        false
    }

    pub fn unlock_or_init(
        &self,
        master_password: &str,
        custom_path: Option<&str>,
    ) -> Result<VaultSnapshotResponse, String> {
        if master_password.trim().is_empty() {
            return Err("Master password tidak boleh kosong".to_string());
        }

        let mut guard = self.session.lock().expect("lock session");
        if let Some(cp) = custom_path {
            let trimmed = cp.trim();
            if !trimmed.is_empty() {
                guard.vault_path = PathBuf::from(trimmed);
            }
        }

        let path = guard.vault_path.clone();
        let data = if path.exists() {
            load_vault(&path, master_password).map_err(|e| e.to_string())?
        } else {
            let mut fresh = VaultData::default();
            fresh.auto_lock_minutes = guard.auto_lock_minutes;
            save_vault_atomic(&path, &fresh, master_password).map_err(|e| e.to_string())?;
            fresh
        };

        guard.auto_lock_minutes = data.auto_lock_minutes;
        guard.data = Some(data);
        guard.master_password = Some(Zeroizing::new(master_password.to_string()));
        guard.last_active = Instant::now();

        Self::snapshot_from_guard(&guard, None)
    }

    pub fn upsert_raw(
        &self,
        id: Option<String>,
        raw_text: &str,
        favorite: Option<bool>,
    ) -> Result<VaultSnapshotResponse, String> {
        if self.check_idle_and_lock() {
            return Err("Vault terkunci".to_string());
        }

        let draft = parse_entry_text(raw_text)
            .ok_or_else(|| "Catatan tidak boleh kosong".to_string())?;

        let mut guard = self.session.lock().expect("lock session");
        if guard.data.is_none() || guard.master_password.is_none() {
            return Err("Vault terkunci".to_string());
        }

        let now = chrono::Utc::now().to_rfc3339();
        {
            let data = guard.data.as_mut().expect("unlocked data");
            let normalized_id = id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

            if let Some(target_id) = normalized_id {
                if let Some(existing) = data.entries.iter_mut().find(|e| e.id == target_id) {
                    existing.title = draft.title;
                    existing.raw_text = draft.raw_text;
                    existing.fields = draft.fields;
                    existing.tags = draft.tags;
                    existing.notes = draft.notes;
                    if let Some(fav) = favorite {
                        existing.favorite = fav;
                    }
                    existing.updated_at = now;
                } else {
                    data.entries.insert(
                        0,
                        VaultEntry {
                            id: target_id,
                            title: draft.title,
                            raw_text: draft.raw_text,
                            fields: draft.fields,
                            tags: draft.tags,
                            notes: draft.notes,
                            favorite: favorite.unwrap_or(false),
                            created_at: now.clone(),
                            updated_at: now,
                        },
                    );
                }
            } else {
                data.entries.insert(
                    0,
                    VaultEntry {
                        id: Uuid::new_v4().to_string(),
                        title: draft.title,
                        raw_text: draft.raw_text,
                        fields: draft.fields,
                        tags: draft.tags,
                        notes: draft.notes,
                        favorite: favorite.unwrap_or(false),
                        created_at: now.clone(),
                        updated_at: now,
                    },
                );
            }
        }

        let path = guard.vault_path.clone();
        let pwd = guard
            .master_password
            .as_ref()
            .expect("master password")
            .as_str();
        let data_ref = guard.data.as_ref().expect("unlocked data");
        save_vault_atomic(&path, data_ref, pwd).map_err(|e| e.to_string())?;

        guard.last_active = Instant::now();
        Self::snapshot_from_guard(&guard, None)
    }

    pub fn bulk_import_raw(&self, raw_bulk: &str) -> Result<VaultSnapshotResponse, String> {
        if self.check_idle_and_lock() {
            return Err("Vault terkunci".to_string());
        }

        let drafts = parse_bulk_text(raw_bulk);
        if drafts.is_empty() {
            return Err("Tidak ada blok catatan valid untuk diimpor".to_string());
        }

        let mut guard = self.session.lock().expect("lock session");
        if guard.data.is_none() || guard.master_password.is_none() {
            return Err("Vault terkunci".to_string());
        }

        let now = chrono::Utc::now().to_rfc3339();
        {
            let data = guard.data.as_mut().expect("unlocked data");
            let mut imported: Vec<VaultEntry> = drafts
                .into_iter()
                .map(|draft| VaultEntry {
                    id: Uuid::new_v4().to_string(),
                    title: draft.title,
                    raw_text: draft.raw_text,
                    fields: draft.fields,
                    tags: draft.tags,
                    notes: draft.notes,
                    favorite: false,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                })
                .collect();
            imported.append(&mut data.entries);
            data.entries = imported;
        }

        let path = guard.vault_path.clone();
        let pwd = guard
            .master_password
            .as_ref()
            .expect("master password")
            .as_str();
        let data_ref = guard.data.as_ref().expect("unlocked data");
        save_vault_atomic(&path, data_ref, pwd).map_err(|e| e.to_string())?;

        guard.last_active = Instant::now();
        Self::snapshot_from_guard(&guard, None)
    }

    pub fn delete_entry_by_id(&self, id: &str) -> Result<VaultSnapshotResponse, String> {
        if self.check_idle_and_lock() {
            return Err("Vault terkunci".to_string());
        }

        let mut guard = self.session.lock().expect("lock session");
        if guard.data.is_none() || guard.master_password.is_none() {
            return Err("Vault terkunci".to_string());
        }

        {
            let data = guard.data.as_mut().expect("unlocked data");
            let before = data.entries.len();
            data.entries.retain(|e| e.id != id);
            if data.entries.len() == before {
                return Err("Entri tidak ditemukan".to_string());
            }
        }

        let path = guard.vault_path.clone();
        let pwd = guard
            .master_password
            .as_ref()
            .expect("master password")
            .as_str();
        let data_ref = guard.data.as_ref().expect("unlocked data");
        save_vault_atomic(&path, data_ref, pwd).map_err(|e| e.to_string())?;

        guard.last_active = Instant::now();
        Self::snapshot_from_guard(&guard, None)
    }

    pub fn toggle_favorite_by_id(&self, id: &str) -> Result<VaultSnapshotResponse, String> {
        if self.check_idle_and_lock() {
            return Err("Vault terkunci".to_string());
        }

        let mut guard = self.session.lock().expect("lock session");
        if guard.data.is_none() || guard.master_password.is_none() {
            return Err("Vault terkunci".to_string());
        }

        {
            let data = guard.data.as_mut().expect("unlocked data");
            let entry = data
                .entries
                .iter_mut()
                .find(|e| e.id == id)
                .ok_or_else(|| "Entri tidak ditemukan".to_string())?;
            entry.favorite = !entry.favorite;
            entry.updated_at = chrono::Utc::now().to_rfc3339();
        }

        let path = guard.vault_path.clone();
        let pwd = guard
            .master_password
            .as_ref()
            .expect("master password")
            .as_str();
        let data_ref = guard.data.as_ref().expect("unlocked data");
        save_vault_atomic(&path, data_ref, pwd).map_err(|e| e.to_string())?;

        guard.last_active = Instant::now();
        Self::snapshot_from_guard(&guard, None)
    }

    pub fn query(
        &self,
        query: &str,
        email_filter: Option<&str>,
        tag_filter: Option<&str>,
        favorites_only: bool,
    ) -> Result<VaultSnapshotResponse, String> {
        if self.check_idle_and_lock() {
            return Err("Vault terkunci".to_string());
        }

        let mut guard = self.session.lock().expect("lock session");
        let filtered = {
            let data = guard
                .data
                .as_ref()
                .ok_or_else(|| "Vault terkunci".to_string())?;
            filter_entries(&data.entries, query, email_filter, tag_filter, favorites_only)
        };
        guard.last_active = Instant::now();

        Self::snapshot_from_guard(&guard, Some(filtered))
    }

    pub fn set_auto_lock_minutes(&self, minutes: u32) -> Result<VaultStatus, String> {
        if self.check_idle_and_lock() {
            return Err("Vault terkunci".to_string());
        }

        let mut guard = self.session.lock().expect("lock session");
        if guard.data.is_none() || guard.master_password.is_none() {
            return Err("Vault terkunci".to_string());
        }

        guard.auto_lock_minutes = minutes;
        if let Some(ref mut data) = guard.data {
            data.auto_lock_minutes = minutes;
        }

        let path = guard.vault_path.clone();
        let pwd = guard
            .master_password
            .as_ref()
            .expect("master password")
            .as_str();
        let data_ref = guard.data.as_ref().expect("unlocked data");
        save_vault_atomic(&path, data_ref, pwd).map_err(|e| e.to_string())?;

        guard.last_active = Instant::now();
        Ok(Self::status_from_guard(&guard))
    }

    pub fn export_backup(&self, destination_path: &Path) -> Result<(), String> {
        let guard = self.session.lock().expect("lock session");
        export_vault_copy(&guard.vault_path, destination_path).map_err(|e| e.to_string())
    }

    pub fn restore_backup(
        &self,
        source_path: &Path,
        master_password: &str,
    ) -> Result<VaultSnapshotResponse, String> {
        let data = load_vault(source_path, master_password).map_err(|e| e.to_string())?;

        let mut guard = self.session.lock().expect("lock session");
        let active_path = guard.vault_path.clone();
        if source_path != active_path {
            save_vault_atomic(&active_path, &data, master_password).map_err(|e| e.to_string())?;
        }

        guard.auto_lock_minutes = data.auto_lock_minutes;
        guard.data = Some(data);
        guard.master_password = Some(Zeroizing::new(master_password.to_string()));
        guard.last_active = Instant::now();

        Self::snapshot_from_guard(&guard, None)
    }

    pub fn recover_backup(&self, master_password: &str) -> Result<VaultSnapshotResponse, String> {
        let mut guard = self.session.lock().expect("lock session");
        let bak_path = backup_path_for(&guard.vault_path);
        let data = load_vault(&bak_path, master_password).map_err(|e| e.to_string())?;

        let active_path = guard.vault_path.clone();
        save_vault_atomic(&active_path, &data, master_password).map_err(|e| e.to_string())?;

        guard.auto_lock_minutes = data.auto_lock_minutes;
        guard.data = Some(data);
        guard.master_password = Some(Zeroizing::new(master_password.to_string()));
        guard.last_active = Instant::now();

        Self::snapshot_from_guard(&guard, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_session_unlock_crud_query_and_manual_lock() {
        let dir = tempdir().expect("tempdir");
        let vault_path = dir.path().join("session.vault");
        let state = AppState::new(vault_path.clone());

        let initial_status = state.status();
        assert!(!initial_status.exists);
        assert!(!initial_status.unlocked);

        let snap = state
            .unlock_or_init("master-pin-999", None)
            .expect("init vault");
        assert!(snap.status.exists);
        assert!(snap.status.unlocked);
        assert!(snap.entries.is_empty());

        // Upsert new entry from chat format
        let snap = state
            .upsert_raw(
                None,
                "amazon video #streaming\nemail: test:@gmail.com\npass: test123",
                Some(true),
            )
            .expect("upsert entry");
        assert_eq!(snap.entries.len(), 1);
        assert_eq!(snap.entries[0].title, "amazon video");
        assert!(snap.entries[0].favorite);
        assert_eq!(snap.tags, vec!["streaming".to_string()]);
        assert_eq!(snap.email_relations.len(), 1);
        assert_eq!(snap.email_relations[0].email, "test@gmail.com");

        // Bulk import two more entries
        let bulk_snap = state
            .bulk_import_raw(
                "xbox #game\nemail: test@gmail.com\npass: xb123\n\nopenai api #dev\nkey: sk-secret",
            )
            .expect("bulk import");
        assert_eq!(bulk_snap.entries.len(), 3);
        assert_eq!(bulk_snap.email_relations[0].count, 2);
        assert_eq!(
            bulk_snap.tags,
            vec!["dev".to_string(), "game".to_string(), "streaming".to_string()]
        );

        // Query by email filter
        let email_query = state
            .query("", Some("test@gmail.com"), None, false)
            .expect("query by email");
        assert_eq!(email_query.entries.len(), 2);

        // Toggle favorite & delete entry
        let xbox_id = bulk_snap
            .entries
            .iter()
            .find(|e| e.title == "xbox")
            .unwrap()
            .id
            .clone();
        let fav_snap = state.toggle_favorite_by_id(&xbox_id).expect("toggle fav");
        let xbox_entry = fav_snap.entries.iter().find(|e| e.id == xbox_id).unwrap();
        assert!(xbox_entry.favorite);

        let after_del = state.delete_entry_by_id(&xbox_id).expect("delete xbox");
        assert_eq!(after_del.entries.len(), 2);

        // Manual lock clears decrypted session
        state.lock();
        assert!(!state.status().unlocked);
        assert!(state.query("", None, None, false).is_err());
    }

    #[test]
    fn test_idle_auto_lock_expiration() {
        let dir = tempdir().expect("tempdir");
        let vault_path = dir.path().join("idle.vault");
        let state = AppState::new(vault_path);

        state
            .unlock_or_init("secret123", None)
            .expect("unlock vault");
        state
            .set_auto_lock_minutes(1)
            .expect("set auto lock 1 min");

        assert!(!state.check_idle_and_lock());

        // Simulate 61 seconds of inactivity
        {
            let mut guard = state.session.lock().expect("lock");
            guard.last_active = Instant::now() - Duration::from_secs(61);
        }

        assert!(state.check_idle_and_lock());
        assert!(!state.status().unlocked);
        assert!(state.query("", None, None, false).is_err());
    }

    #[test]
    fn test_backup_export_restore_and_recover_from_bak() {
        let dir = tempdir().expect("tempdir");
        let vault_path = dir.path().join("primary.vault");
        let exported_path = dir.path().join("exported.vault");
        let state = AppState::new(vault_path.clone());

        state.unlock_or_init("pin1234", None).expect("init");
        state
            .upsert_raw(None, "github\nuser: octocat\npass: gh123", None)
            .expect("first entry");
        state
            .upsert_raw(None, "gitlab\nuser: octocat\npass: gl456", None)
            .expect("second entry creates .bak");

        state
            .export_backup(&exported_path)
            .expect("export backup");
        assert!(exported_path.exists());

        // Corrupt primary vault file and recover from .vault.bak
        fs::write(&vault_path, b"CORRUPTED").expect("corrupt primary");
        state.lock();
        assert!(state.unlock_or_init("pin1234", None).is_err());

        let recovered = state
            .recover_backup("pin1234")
            .expect("recover from .vault.bak");
        assert!(recovered.status.unlocked);
        assert_eq!(recovered.entries.len(), 1);
        assert_eq!(recovered.entries[0].title, "github");

        // Restore full 2-entry backup from exported_path
        let restored = state
            .restore_backup(&exported_path, "pin1234")
            .expect("restore exported backup");
        assert_eq!(restored.entries.len(), 2);
    }
}
