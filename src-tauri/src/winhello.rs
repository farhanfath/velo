use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use zeroize::Zeroizing;

pub const WINHELLO_MAGIC: &[u8; 8] = b"VELOWH01";

pub trait ConsentVerifier: Send + Sync {
    fn is_available(&self) -> bool;
    fn verify(&self, message: &str) -> Result<(), String>;
}

pub struct SystemConsentVerifier {
    available_cache: OnceLock<bool>,
}

impl SystemConsentVerifier {
    pub fn new() -> Self {
        Self {
            available_cache: OnceLock::new(),
        }
    }
}

impl Default for SystemConsentVerifier {
    fn default() -> Self {
        Self::new()
    }
}

impl ConsentVerifier for SystemConsentVerifier {
    fn is_available(&self) -> bool {
        *self
            .available_cache
            .get_or_init(check_windows_hello_available_os)
    }

    fn verify(&self, message: &str) -> Result<(), String> {
        request_windows_hello_verification_os(message)
    }
}

pub fn winhello_path_for(vault_path: &Path) -> PathBuf {
    let mut p = vault_path.as_os_str().to_os_string();
    p.push(".winhello");
    PathBuf::from(p)
}

fn winhello_temp_path_for(vault_path: &Path) -> PathBuf {
    let mut p = vault_path.as_os_str().to_os_string();
    p.push(".winhello.tmp");
    PathBuf::from(p)
}

pub fn has_winhello_blob(vault_path: &Path) -> bool {
    winhello_path_for(vault_path).exists()
}

fn entropy_for_vault(vault_path: &Path) -> String {
    format!(
        "VELO_WINHELLO_V1:{}",
        vault_path.display().to_string().to_lowercase()
    )
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct CRYPTOAPI_BLOB {
    cbData: u32,
    pbData: *mut u8,
}

#[cfg(target_os = "windows")]
const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

#[cfg(target_os = "windows")]
#[link(name = "crypt32")]
extern "system" {
    fn CryptProtectData(
        pDataIn: *const CRYPTOAPI_BLOB,
        szDataDescr: *const u16,
        pOptionalEntropy: *const CRYPTOAPI_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut CRYPTOAPI_BLOB,
    ) -> i32;

    fn CryptUnprotectData(
        pDataIn: *const CRYPTOAPI_BLOB,
        ppszDataDescr: *mut *mut u16,
        pOptionalEntropy: *const CRYPTOAPI_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut CRYPTOAPI_BLOB,
    ) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn GetForegroundWindow() -> isize;
}

#[cfg(target_os = "windows")]
pub fn dpapi_protect(plaintext: &[u8], entropy: &[u8]) -> Result<Vec<u8>, String> {
    let mut data_in = CRYPTOAPI_BLOB {
        cbData: plaintext.len() as u32,
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut entropy_blob = CRYPTOAPI_BLOB {
        cbData: entropy.len() as u32,
        pbData: entropy.as_ptr() as *mut u8,
    };
    let mut data_out = CRYPTOAPI_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let ok = unsafe {
        CryptProtectData(
            &mut data_in,
            std::ptr::null(),
            if entropy.is_empty() {
                std::ptr::null()
            } else {
                &mut entropy_blob
            },
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut data_out,
        )
    };

    if ok == 0 || data_out.pbData.is_null() {
        return Err("Gagal mengenkripsi secret Windows Hello melalui Windows DPAPI".to_string());
    }

    let encrypted =
        unsafe { std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize).to_vec() };

    unsafe {
        LocalFree(data_out.pbData as *mut std::ffi::c_void);
    }

    Ok(encrypted)
}

#[cfg(target_os = "windows")]
pub fn dpapi_unprotect(ciphertext: &[u8], entropy: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    if ciphertext.is_empty() {
        return Err("Data Windows Hello kosong atau tidak valid".to_string());
    }

    let mut data_in = CRYPTOAPI_BLOB {
        cbData: ciphertext.len() as u32,
        pbData: ciphertext.as_ptr() as *mut u8,
    };
    let mut entropy_blob = CRYPTOAPI_BLOB {
        cbData: entropy.len() as u32,
        pbData: entropy.as_ptr() as *mut u8,
    };
    let mut data_out = CRYPTOAPI_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let ok = unsafe {
        CryptUnprotectData(
            &mut data_in,
            std::ptr::null_mut(),
            if entropy.is_empty() {
                std::ptr::null()
            } else {
                &mut entropy_blob
            },
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut data_out,
        )
    };

    if ok == 0 || data_out.pbData.is_null() {
        return Err(
            "Gagal mendekripsi kredensial Windows Hello (DPAPI menolak akses atau data rusak)"
                .to_string(),
        );
    }

    let len = data_out.cbData as usize;
    let decrypted = Zeroizing::new(unsafe {
        std::slice::from_raw_parts(data_out.pbData, len).to_vec()
    });

    unsafe {
        std::ptr::write_bytes(data_out.pbData, 0, len);
        LocalFree(data_out.pbData as *mut std::ffi::c_void);
    }

    Ok(decrypted)
}

#[cfg(not(target_os = "windows"))]
pub fn dpapi_protect(_plaintext: &[u8], _entropy: &[u8]) -> Result<Vec<u8>, String> {
    Err("Windows DPAPI hanya tersedia di sistem operasi Windows".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn dpapi_unprotect(_ciphertext: &[u8], _entropy: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    Err("Windows DPAPI hanya tersedia di sistem operasi Windows".to_string())
}

pub fn save_winhello_secret(vault_path: &Path, master_password: &str) -> Result<(), String> {
    if master_password.trim().is_empty() {
        return Err("Master Password tidak boleh kosong".to_string());
    }

    if let Some(parent) = vault_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Gagal menyiapkan direktori Windows Hello: {e}"))?;
    }

    let entropy = entropy_for_vault(vault_path);
    let ciphertext = dpapi_protect(master_password.as_bytes(), entropy.as_bytes())?;

    let tmp_path = winhello_temp_path_for(vault_path);
    let target_path = winhello_path_for(vault_path);

    {
        let mut file = File::create(&tmp_path)
            .map_err(|e| format!("Gagal membuat file sementara Windows Hello: {e}"))?;
        file.write_all(WINHELLO_MAGIC)
            .map_err(|e| format!("Gagal menulis header Windows Hello: {e}"))?;
        file.write_all(&ciphertext)
            .map_err(|e| format!("Gagal menulis payload Windows Hello: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("Gagal menyinkronkan file Windows Hello: {e}"))?;
    }

    fs::rename(&tmp_path, &target_path)
        .map_err(|e| format!("Gagal menyimpan file Windows Hello: {e}"))?;

    Ok(())
}

pub fn load_winhello_secret(vault_path: &Path) -> Result<Zeroizing<String>, String> {
    let path = winhello_path_for(vault_path);
    if !path.exists() {
        return Err("Windows Hello belum diaktifkan untuk vault ini".to_string());
    }

    let mut raw = Vec::new();
    File::open(&path)
        .and_then(|mut f| f.read_to_end(&mut raw))
        .map_err(|e| format!("Gagal membaca file kredensial Windows Hello: {e}"))?;

    if raw.len() <= WINHELLO_MAGIC.len() || &raw[0..8] != WINHELLO_MAGIC {
        return Err("Format file kredensial Windows Hello tidak valid atau rusak".to_string());
    }

    let entropy = entropy_for_vault(vault_path);
    let decrypted_bytes = dpapi_unprotect(&raw[8..], entropy.as_bytes())?;

    let pwd = String::from_utf8(decrypted_bytes.to_vec())
        .map_err(|_| "Data kredensial Windows Hello tidak valid (bukan UTF-8)".to_string())?;

    Ok(Zeroizing::new(pwd))
}

pub fn remove_winhello_secret(vault_path: &Path) -> Result<(), String> {
    let path = winhello_path_for(vault_path);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Gagal menghapus file kredensial Windows Hello: {e}"))?;
    }
    let tmp_path = winhello_temp_path_for(vault_path);
    if tmp_path.exists() {
        let _ = fs::remove_file(&tmp_path);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn check_windows_hello_available_os() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let script = "\
Add-Type -AssemblyName System.Runtime.WindowsRuntime; \
$null = [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]; \
$null = [Windows.Security.Credentials.UI.UserConsentVerifierAvailability, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]; \
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]; \
$asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerifierAvailability]); \
$task = $asTask.Invoke($null, @([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync())); \
$task.Wait(); \
Write-Output $task.Result.ToString()";

    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let status_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
            status_str.lines().last().unwrap_or("").trim() == "Available"
        }
        _ => false,
    }
}

#[cfg(not(target_os = "windows"))]
pub fn check_windows_hello_available_os() -> bool {
    false
}

#[cfg(target_os = "windows")]
pub fn request_windows_hello_verification_os(message: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let hwnd = unsafe { GetForegroundWindow() };
    let safe_msg = message.replace('\'', "''");
    let script = format!(
        "\
Add-Type -AssemblyName System.Runtime.WindowsRuntime; \
$null = [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]; \
$null = [Windows.Security.Credentials.UI.UserConsentVerificationResult, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]; \
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]; \
$asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult]); \
$op = $null; \
if ({hwnd} -ne 0) {{ \
    try {{ \
        $code = 'using System; using System.Runtime.InteropServices; public static class VeloWinHelloInterop {{ [DllImport(\"combase.dll\", PreserveSig = true)] private static extern int RoGetActivationFactory([MarshalAs(UnmanagedType.HString)] string classId, ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object factory); [ComImport, Guid(\"39E050C3-4E74-441A-8DC0-B81104DF949C\"), InterfaceType(ComInterfaceType.InterfaceIsIInspectable)] private interface IUserConsentVerifierInterop {{ [PreserveSig] int RequestVerificationForWindowAsync(IntPtr appWindow, [MarshalAs(UnmanagedType.HString)] string message, ref Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object asyncOperation); }} public static object RequestForWindow(long hwnd, string msg, Guid asyncIid) {{ Guid factoryIid = new Guid(\"39E050C3-4E74-441A-8DC0-B81104DF949C\"); object factory; if (RoGetActivationFactory(\"Windows.Security.Credentials.UI.UserConsentVerifier\", ref factoryIid, out factory) == 0 && factory != null) {{ object op; int hr = ((IUserConsentVerifierInterop)factory).RequestVerificationForWindowAsync(new IntPtr(hwnd), msg, ref asyncIid, out op); if (hr == 0) return op; }} return null; }} }}'; \
        Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue; \
        $asyncIid = [Windows.Security.Credentials.UI.UserConsentVerifier].GetMethod('RequestVerificationAsync').ReturnType.GUID; \
        $op = [VeloWinHelloInterop]::RequestForWindow({hwnd}, '{safe_msg}', $asyncIid); \
    }} catch {{ $op = $null; }} \
}}; \
if ($null -eq $op) {{ \
    $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('{safe_msg}'); \
}}; \
$task = $asTask.Invoke($null, @($op)); \
$task.Wait(); \
Write-Output $task.Result.ToString()"
    );

    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Gagal memanggil dialog Windows Hello: {e}"))?;

    if !output.status.success() {
        return Err("Gagal memverifikasi identitas melalui Windows Hello.".to_string());
    }

    let raw_out = String::from_utf8_lossy(&output.stdout);
    let result = raw_out.lines().last().unwrap_or("").trim();
    match result {
        "Verified" => Ok(()),
        "Canceled" => Err("Verifikasi Windows Hello dibatalkan.".to_string()),
        "DeviceNotPresent" | "NotConfiguredForUser" => {
            Err("Windows Hello belum dikonfigurasi di perangkat Windows ini.".to_string())
        }
        "RetriesExhausted" => {
            Err("Batas percobaan Windows Hello habis. Gunakan Master Password.".to_string())
        }
        "DisabledByPolicy" => {
            Err("Windows Hello dinonaktifkan oleh kebijakan perangkat.".to_string())
        }
        "DeviceBusy" => Err("Sensor Windows Hello sedang sibuk. Silakan coba lagi.".to_string()),
        other => Err(format!(
            "Verifikasi Windows Hello tidak berhasil ({other}). Silakan gunakan Master Password."
        )),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn request_windows_hello_verification_os(_message: &str) -> Result<(), String> {
    Err("Windows Hello hanya didukung di Windows".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    #[cfg(target_os = "windows")]
    fn test_dpapi_protect_unprotect_roundtrip_and_entropy_isolation() {
        let secret = b"super-secret-master-password-999";
        let entropy_a = b"VELO_WINHELLO_V1:c:\\vault_a.vault";
        let entropy_b = b"VELO_WINHELLO_V1:c:\\vault_b.vault";

        let encrypted = dpapi_protect(secret, entropy_a).expect("dpapi protect");
        assert_ne!(encrypted, secret);

        let decrypted = dpapi_unprotect(&encrypted, entropy_a).expect("dpapi unprotect");
        assert_eq!(decrypted.as_slice(), secret);

        // Wrong entropy must fail to unprotect
        let wrong_entropy_res = dpapi_unprotect(&encrypted, entropy_b);
        assert!(wrong_entropy_res.is_err());
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_winhello_file_save_load_corrupt_and_remove() {
        let dir = tempdir().expect("tempdir");
        let vault_path = dir.path().join("personal.vault");

        assert!(!has_winhello_blob(&vault_path));

        save_winhello_secret(&vault_path, "my-master-pin-2026").expect("save winhello secret");
        assert!(has_winhello_blob(&vault_path));

        let loaded = load_winhello_secret(&vault_path).expect("load winhello secret");
        assert_eq!(loaded.as_str(), "my-master-pin-2026");

        // Corrupt magic header
        let wh_path = winhello_path_for(&vault_path);
        fs::write(&wh_path, b"BADMAGIC123456").expect("write corrupt header");
        assert!(load_winhello_secret(&vault_path).is_err());

        // Remove file
        remove_winhello_secret(&vault_path).expect("remove winhello secret");
        assert!(!has_winhello_blob(&vault_path));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_check_windows_hello_available_os_detects_winrt_availability() {
        let available = check_windows_hello_available_os();
        assert!(available, "Expected Windows Hello (Fingerprint/PIN) to be detected as Available via WinRT AsTask");
    }
}
