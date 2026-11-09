use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldKind {
    Email,
    Secret,
    Url,
    Text,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Zeroize)]
pub struct EntryField {
    pub key: String,
    pub value: String,
    #[zeroize(skip)]
    pub kind: FieldKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Zeroize)]
pub struct VaultEntry {
    pub id: String,
    pub title: String,
    pub raw_text: String,
    pub fields: Vec<EntryField>,
    pub tags: Vec<String>,
    pub notes: String,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParsedEntryDraft {
    pub title: String,
    pub raw_text: String,
    pub fields: Vec<EntryField>,
    pub tags: Vec<String>,
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Zeroize)]
pub struct VaultData {
    pub version: u8,
    pub entries: Vec<VaultEntry>,
    pub auto_lock_minutes: u32,
}

impl Default for VaultData {
    fn default() -> Self {
        Self {
            version: 1,
            entries: Vec::new(),
            auto_lock_minutes: 5,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EmailRelationSummary {
    pub email: String,
    pub count: usize,
    pub entry_ids: Vec<String>,
    pub titles: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultStatus {
    pub exists: bool,
    pub backup_exists: bool,
    pub unlocked: bool,
    pub vault_path: String,
    pub auto_lock_minutes: u32,
    pub windows_hello_available: bool,
    pub windows_hello_enabled: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_data_default_and_serialization() {
        let data = VaultData::default();
        assert_eq!(data.version, 1);
        assert_eq!(data.auto_lock_minutes, 5);
        assert!(data.entries.is_empty());

        let json = serde_json::to_string(&data).expect("serialize VaultData");
        let decoded: VaultData = serde_json::from_str(&json).expect("deserialize VaultData");
        assert_eq!(decoded, data);
    }
}
