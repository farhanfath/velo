use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    Key, XChaCha20Poly1305, XNonce,
};
use rand::rngs::OsRng;
use rand::RngCore;
use thiserror::Error;
use zeroize::Zeroizing;

pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 24;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("Master password tidak boleh kosong")]
    EmptyPassword,
    #[error("Gagal menurunkan kunci enkripsi Argon2id: {0}")]
    KeyDerivation(String),
    #[error("Gagal mengenkripsi data vault")]
    EncryptionFailed,
    #[error("Master Password salah atau file vault rusak")]
    DecryptionFailed,
}

pub fn derive_key(
    master_password: &str,
    salt: &[u8; SALT_LEN],
) -> Result<Zeroizing<[u8; 32]>, CryptoError> {
    if master_password.trim().is_empty() {
        return Err(CryptoError::EmptyPassword);
    }
    let params = Params::new(19_456, 2, 1, Some(32))
        .map_err(|e| CryptoError::KeyDerivation(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = Zeroizing::new([0u8; 32]);
    argon2
        .hash_password_into(master_password.as_bytes(), salt, key.as_mut())
        .map_err(|e| CryptoError::KeyDerivation(e.to_string()))?;

    Ok(key)
}

pub fn encrypt_payload(
    plaintext: &[u8],
    master_password: &str,
) -> Result<([u8; SALT_LEN], [u8; NONCE_LEN], Vec<u8>), CryptoError> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);

    let key_bytes = derive_key(master_password, &salt)?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(key_bytes.as_ref()));
    let nonce = XNonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    Ok((salt, nonce_bytes, ciphertext))
}

pub fn decrypt_payload(
    ciphertext: &[u8],
    master_password: &str,
    salt: &[u8; SALT_LEN],
    nonce_bytes: &[u8; NONCE_LEN],
) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
    let key_bytes = derive_key(master_password, salt)?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(key_bytes.as_ref()));
    let nonce = XNonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    Ok(Zeroizing::new(plaintext))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let secret_data = b"amazon video\nemail: test@gmail.com\npass: test123";
        let password = "super-secret-master-pin";

        let (salt, nonce, ciphertext) =
            encrypt_payload(secret_data, password).expect("encryption should succeed");
        assert_ne!(ciphertext.as_slice(), secret_data);

        let decrypted =
            decrypt_payload(&ciphertext, password, &salt, &nonce).expect("decryption should succeed");
        assert_eq!(decrypted.as_slice(), secret_data);
    }

    #[test]
    fn test_wrong_password_fails_decryption() {
        let secret_data = b"xbox\npass: test123";
        let (salt, nonce, ciphertext) =
            encrypt_payload(secret_data, "correct-password").expect("encrypt");

        let result = decrypt_payload(&ciphertext, "wrong-password", &salt, &nonce);
        assert!(matches!(result, Err(CryptoError::DecryptionFailed)));
    }

    #[test]
    fn test_tampered_ciphertext_fails_decryption() {
        let secret_data = b"xbox\npass: test123";
        let (salt, nonce, mut ciphertext) =
            encrypt_payload(secret_data, "correct-password").expect("encrypt");
        ciphertext[0] ^= 0xFF;

        let result = decrypt_payload(&ciphertext, "correct-password", &salt, &nonce);
        assert!(matches!(result, Err(CryptoError::DecryptionFailed)));
    }
}
