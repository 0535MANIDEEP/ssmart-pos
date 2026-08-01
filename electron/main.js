const { app, BrowserWindow, Menu, dialog, shell, nativeImage } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const net = require("net");

let mainWindow = null;
let backendProcess = null;
let frontendProcess = null;
const isDev = process.env.NODE_ENV === "development";
const BACKEND_PORT = 4000;
const FRONTEND_PORT = 1994;

// ─── Port checker ───────────────────────────────────────────────────────────
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const socket = new net.Socket();
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} not available after ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
      socket.connect(port, "127.0.0.1");
    };
    check();
  });
}

// ─── Kill existing processes on our ports ────────────────────────────────────
function killExistingProcesses() {
  if (process.platform === "win32") {
    try {
      exec(`for /f "tokens=5" %a in ('netstat -aon ^| findstr ":${BACKEND_PORT}" ^| findstr "LISTENING" 2^>nul') do taskkill /PID %a /F /T`, () => {});
      exec(`for /f "tokens=5" %a in ('netstat -aon ^| findstr ":${FRONTEND_PORT}" ^| findstr "LISTENING" 2^>nul') do taskkill /PID %a /F /T`, () => {});
    } catch {}
  }
}

// ─── Start Backend ──────────────────────────────────────────────────────────
function startBackend() {
  const backendPath = path.join(__dirname, "..", "backend");
  const serverFile = path.join(backendPath, "src", "server.js");

  backendProcess = spawn("node", [serverFile], {
    cwd: backendPath,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production", PORT: String(BACKEND_PORT) },
  });

  backendProcess.stdout?.on("data", (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });
  backendProcess.stderr?.on("data", (data) => {
    console.error(`[Backend] ${data.toString().trim()}`);
  });
  backendProcess.on("error", (err) => {
    console.error("Backend failed to start:", err);
  });
  backendProcess.on("exit", (code) => {
    console.log(`Backend exited with code ${code}`);
  });
}

// ─── Start Frontend ─────────────────────────────────────────────────────────
function startFrontend() {
  const frontendPath = path.join(__dirname, "..", "frontend");

  frontendProcess = spawn("npx", ["next", "start", "-p", String(FRONTEND_PORT)], {
    cwd: frontendPath,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production" },
  });

  frontendProcess.stdout?.on("data", (data) => {
    console.log(`[Frontend] ${data.toString().trim()}`);
  });
  frontendProcess.stderr?.on("data", (data) => {
    console.error(`[Frontend] ${data.toString().trim()}`);
  });
  frontendProcess.on("error", (err) => {
    console.error("Frontend failed to start:", err);
  });
  frontendProcess.on("exit", (code) => {
    console.log(`Frontend exited with code ${code}`);
  });
}

// ─── Create Window ──────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = path.join(__dirname, "..", "frontend", "public", "icons", "icon-512.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {}

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "SS Mart — Sai Sangameshwara Mart",
    icon: icon || undefined,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Custom menu
  const menuTemplate = [
    {
      label: "File",
      submenu: [
        {
          label: "New Sale",
          accelerator: "F11",
          click: () => mainWindow?.webContents.executeJavaScript("window.location.href = '/pos'"),
        },
        {
          label: "Dashboard",
          accelerator: "Ctrl+D",
          click: () => mainWindow?.webContents.executeJavaScript("window.location.href = '/dashboard'"),
        },
        { type: "separator" },
        {
          label: "Backup Database",
          click: async () => {
            try {
              const response = await fetch(`http://localhost:${BACKEND_PORT}/api/backup/run`, { method: "POST" });
              if (response.ok) {
                dialog.showMessageBox(mainWindow, { type: "info", title: "Backup", message: "Database backup created successfully." });
              }
            } catch {
              dialog.showMessageBox(mainWindow, { type: "error", title: "Backup Failed", message: "Could not create backup. Is the backend running?" });
            }
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About SS Mart",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "SS Mart POS",
              message: "SS Mart — Sai Sangameshwara Mart",
              detail: `Version ${app.getVersion()}\nOffline-first POS System\nShankarpally, Telangana 501203`,
            });
          },
        },
        {
          label: "Keyboard Shortcuts",
          accelerator: "F1",
          click: () => mainWindow?.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1' }))"),
        },
        { type: "separator" },
        {
          label: "Visit Website",
          click: () => shell.openExternal("https://github.com/0535MANIDEEP/ssmart-pos"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Show when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load the app
  mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}/login`);

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Prevent new windows
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== `http://localhost:${FRONTEND_PORT}`) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Kill existing processes
  killExistingProcesses();

  // Wait a moment for ports to free up
  await new Promise((r) => setTimeout(r, 1000));

  // Start backend
  console.log("Starting backend...");
  startBackend();

  // Wait for backend
  try {
    await waitForPort(BACKEND_PORT, 15000);
    console.log("Backend is ready.");
  } catch (err) {
    console.error(err.message);
    dialog.showErrorBox("Backend Error", "Failed to start the backend server. Please try again.");
    app.quit();
    return;
  }

  // Start frontend
  console.log("Starting frontend...");
  startFrontend();

  // Wait for frontend
  try {
    await waitForPort(FRONTEND_PORT, 30000);
    console.log("Frontend is ready.");
  } catch (err) {
    console.error(err.message);
    dialog.showErrorBox("Frontend Error", "Failed to start the frontend server. Please try again.");
    app.quit();
    return;
  }

  // Create window
  createWindow();

  // macOS: re-create window when dock icon clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Cleanup before quit
app.on("before-quit", () => {
  app.isQuitting = true;

  // Kill child processes
  if (backendProcess) {
    try { backendProcess.kill("SIGTERM"); } catch {}
  }
  if (frontendProcess) {
    try { frontendProcess.kill("SIGTERM"); } catch {}
  }

  // Kill any remaining processes on our ports
  killExistingProcesses();
});
