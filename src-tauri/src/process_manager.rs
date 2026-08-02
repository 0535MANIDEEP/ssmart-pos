use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use std::net::TcpStream;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub struct ProcessManager {
    backend: Mutex<Option<Child>>,
    frontend: Mutex<Option<Child>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            backend: Mutex::new(None),
            frontend: Mutex::new(None),
        }
    }

    fn get_app_dir() -> std::path::PathBuf {
        let exe = std::env::current_exe().unwrap_or_default();
        let exe_dir = exe.parent().unwrap_or(std::path::Path::new("."));

        // Dev build: exe at src-tauri/target/release/ → go up 4 levels to project root
        let dev_backend = exe_dir.join("../../..").join("backend");
        if dev_backend.exists() {
            return exe_dir.join("../../..");
        }

        // Installed: exe at $INSTDIR/ → backend/frontend are subdirs
        let installed_backend = exe_dir.join("backend");
        if installed_backend.exists() {
            return exe_dir.to_path_buf();
        }

        exe_dir.to_path_buf()
    }

    pub fn start_services(&self) -> Result<(), String> {
        let app_dir = Self::get_app_dir();
        let backend_dir = app_dir.join("backend");
        let frontend_dir = app_dir.join("frontend");

        if !backend_dir.exists() {
            return Err(format!("Backend not found at: {}", backend_dir.display()));
        }
        if !frontend_dir.exists() {
            return Err(format!("Frontend not found at: {}", frontend_dir.display()));
        }

        // Start backend: node src/server.js
        let mut backend_cmd = Command::new("node");
        backend_cmd
            .arg("src/server.js")
            .current_dir(&backend_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        backend_cmd.creation_flags(0x08000000);

        let backend_child = backend_cmd.spawn()
            .map_err(|e| format!("Failed to start backend (is Node.js installed?): {}", e))?;
        *self.backend.lock().unwrap() = Some(backend_child);

        // Wait for backend (port 4000)
        for _ in 0..20 {
            if TcpStream::connect("127.0.0.1:4000").is_ok() {
                break;
            }
            std::thread::sleep(Duration::from_millis(500));
        }

        // Start frontend: npx next start -p 1994
        let mut frontend_cmd = Command::new("npx");
        frontend_cmd
            .arg("next")
            .arg("start")
            .arg("-p")
            .arg("1994")
            .current_dir(&frontend_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        frontend_cmd.creation_flags(0x08000000);

        let frontend_child = frontend_cmd.spawn()
            .map_err(|e| format!("Failed to start frontend: {}", e))?;
        *self.frontend.lock().unwrap() = Some(frontend_child);

        // Wait for frontend (port 1994)
        for _ in 0..20 {
            if TcpStream::connect("127.0.0.1:1994").is_ok() {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(500));
        }

        Err("Frontend started but didn't respond on port 1994".to_string())
    }

    pub fn stop_services(&self) {
        if let Some(mut child) = self.backend.lock().unwrap().take() {
            let _ = child.kill();
        }
        if let Some(mut child) = self.frontend.lock().unwrap().take() {
            let _ = child.kill();
        }
    }
}

impl Drop for ProcessManager {
    fn drop(&mut self) {
        self.stop_services();
    }
}
