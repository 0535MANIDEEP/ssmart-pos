use tauri::Manager;

mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Find app directory
            let exe = std::env::current_exe().unwrap_or_default();
            let exe_dir = exe.parent().unwrap_or(std::path::Path::new("."));
            let app_dir = {
                // Dev: exe at src-tauri/target/release/ → 3 levels up = project root
                let dev = exe_dir.join("../../..").join("backend");
                if dev.exists() {
                    exe_dir.join("../../..")
                }
                // Installed: exe at $INSTDIR/ → backend/frontend are subdirs
                else if exe_dir.join("backend").exists() {
                    exe_dir.to_path_buf()
                } else {
                    exe_dir.to_path_buf()
                }
            };

            let backend_dir = app_dir.join("backend");
            let frontend_dir = app_dir.join("frontend");

            let node_path = find_node();
            let npx_path = find_npx();

            if let (Some(node), Some(npx)) = (&node_path, &npx_path) {
                let node_clone = node.clone();
                let npx_clone = npx.clone();
                let backend_clone = backend_dir.clone();
                let frontend_clone = frontend_dir.clone();
                let window_clone = window.clone();

                std::thread::spawn(move || {
                    // Start backend
                    if backend_clone.exists() {
                        let _ = std::process::Command::new(&node_clone)
                            .args(["src/server.js"])
                            .current_dir(&backend_clone)
                            .stdout(std::process::Stdio::piped())
                            .stderr(std::process::Stdio::piped())
                            .spawn();
                    }

                    // Wait for backend (port 4000)
                    for _ in 0..20 {
                        if std::net::TcpStream::connect("127.0.0.1:4000").is_ok() {
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }

                    // Start frontend
                    if frontend_clone.exists() {
                        let _ = std::process::Command::new(&npx_clone)
                            .args(["next", "start", "-p", "1994"])
                            .current_dir(&frontend_clone)
                            .stdout(std::process::Stdio::piped())
                            .stderr(std::process::Stdio::piped())
                            .spawn();
                    }

                    // Wait for frontend (port 1994), then navigate
                    for _ in 0..30 {
                        if std::net::TcpStream::connect("127.0.0.1:1994").is_ok() {
                            let _ = window_clone.navigate("http://localhost:1994/login".parse().unwrap());
                            return;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }
                });
            }

            window.show().unwrap();
            window.set_focus().unwrap();
            tray::setup_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_platform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn find_node() -> Option<String> {
    let candidates = vec![
        r"C:\nvm4w\nodejs\node.exe",
        r"C:\Program Files\nodejs\node.exe",
    ];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return Some(c.to_string());
        }
    }
    if let Ok(path_env) = std::env::var("PATH") {
        for dir in path_env.split(';') {
            let p = std::path::Path::new(dir).join("node.exe");
            if p.exists() {
                return Some(p.to_string_lossy().to_string());
            }
        }
    }
    None
}

fn find_npx() -> Option<String> {
    let candidates = vec![
        r"C:\nvm4w\nodejs\npx.cmd",
        r"C:\Program Files\nodejs\npx.cmd",
    ];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return Some(c.to_string());
        }
    }
    if let Ok(path_env) = std::env::var("PATH") {
        for dir in path_env.split(';') {
            let p = std::path::Path::new(dir).join("npx.cmd");
            if p.exists() {
                return Some(p.to_string_lossy().to_string());
            }
        }
    }
    None
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}
