use crate::crypto::{decrypt_payload, encrypt_payload, CryptoError, NONCE_LEN, SALT_LEN};
use crate::models::VaultData;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use thiserror::Error;
use zeroize::Zeroizing;

pub const MAGIC_HEADER: &[u8; 8] = b"STLVAULT";
pub const FORMAT_VERSION: u8 = 1;
const HEADER_LEN: usize = 8 + 1 + SALT_LEN + NONCE_LEN;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("File vault tidak ditemukan di {0}")]
    NotFound(String),
    #[error("Format file .vault tidak valid atau rusak")]
    InvalidFormat,
    #[error("Versi file .vault tidak didukung: {0}")]
    UnsupportedVersion(u8),
    #[error("{0}")]
    Crypto(#[from] CryptoError),
    #[error("Kesalahan I/O disk: {0}")]
    Io(#[from] std::io::Error),
    #[error("Gagal membaca struktur data vault: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub fn backup_path_for(path: &Path) -> PathBuf {
    let mut p = path.as_os_str().to_os_string();
    p.push(".bak");
    PathBuf::from(p)
}

pub fn temp_path_for(path: &Path) -> PathBuf {
    let mut p = path.as_os_str().to_os_string();
    p.push(".tmp");
    PathBuf::from(p)
}

pub fn save_vault_atomic(
    path: &Path,
    data: &VaultData,
    master_password: &str,
) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let json_bytes = Zeroizing::new(serde_json::to_vec(data)?);
    let (salt, nonce, ciphertext) = encrypt_payload(&json_bytes, master_password)?;

    let tmp_path = temp_path_for(path);
    {
        let mut file = File::create(&tmp_path)?;
        file.write_all(MAGIC_HEADER)?;
        file.write_all(&[FORMAT_VERSION])?;
        file.write_all(&salt)?;
        file.write_all(&nonce)?;
        file.write_all(&ciphertext)?;
        file.sync_all()?;
    }

    if path.exists() {
        let bak_path = backup_path_for(path);
        let _ = fs::copy(path, &bak_path);
    }

    fs::rename(&tmp_path, path)?;
    Ok(())
}

pub fn load_vault(path: &Path, master_password: &str) -> Result<VaultData, StorageError> {
    if !path.exists() {
        return Err(StorageError::NotFound(path.display().to_string()));
    }

    let mut raw = Vec::new();
    File::open(path)?.read_to_end(&mut raw)?;

    if raw.len() <= HEADER_LEN {
        return Err(StorageError::InvalidFormat);
    }
    if &raw[0..8] != MAGIC_HEADER {
        return Err(StorageError::InvalidFormat);
    }
    let version = raw[8];
    if version != FORMAT_VERSION {
        return Err(StorageError::UnsupportedVersion(version));
    }

    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&raw[9..9 + SALT_LEN]);

    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&raw[9 + SALT_LEN..HEADER_LEN]);

    let ciphertext = &raw[HEADER_LEN..];
    let plaintext = decrypt_payload(ciphertext, master_password, &salt, &nonce)?;
    let vault_data: VaultData = serde_json::from_slice(&plaintext)?;

    Ok(vault_data)
}

pub fn export_vault_copy(source: &Path, destination: &Path) -> Result<(), StorageError> {
    if !source.exists() {
        return Err(StorageError::NotFound(source.display().to_string()));
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, destination)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_atomic_save_and_backup_generation() {
        let dir = tempdir().expect("tempdir");
        let vault_path = dir.path().join("test.vault");
        let bak_path = backup_path_for(&vault_path);

        let mut data = VaultData::default();
        save_vault_atomic(&vault_path, &data, "pin1234").expect("first save");
        assert!(vault_path.exists());
        assert!(!bak_path.exists());

        data.auto_lock_minutes = 15;
        save_vault_atomic(&vault_path, &data, "pin1234").expect("second save");
        assert!(vault_path.exists());
        assert!(bak_path.exists());

        let loaded_main = load_vault(&vault_path, "pin1234").expect("load main");
        assert_eq!(loaded_main.auto_lock_minutes, 15);

        let loaded_bak = load_vault(&bak_path, "pin1234").expect("load backup");
        assert_eq!(loaded_bak.auto_lock_minutes, 5);
    }
}
