import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getSystemStatsPayload } from "./systemStats.js";
import { generateLiveKitToken } from "./livekitToken.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("electron").BrowserWindow | null} */
let mainWindow = null;
let pythonAgentProcess = null;

function stopPythonAgent() {
  if (pythonAgentProcess) {
    try {
      const pid = pythonAgentProcess.pid;
      if (pid) {
        // Kill process and all child runner processes on Windows
        spawn("taskkill", ["/PID", pid.toString(), "/T", "/F"]);
      } else {
        pythonAgentProcess.kill();
      }
    } catch (e) {
      console.warn("[Stella Main] Error stopping python agent:", e);
    }
    pythonAgentProcess = null;
  }
  return { stopped: true };
}

function findPythonBackend() {
  const candidateDirs = [
    path.resolve(__dirname, "../../../STELLA BACKEND"),
    path.resolve(process.cwd(), "../STELLA BACKEND"),
    "D:\\STELLA AI\\STELLA BACKEND",
    "D:\\VSCode\\Python\\New AI Project",
  ];

  for (const dir of candidateDirs) {
    const pythonExeWindows = path.join(dir, ".venv", "Scripts", "python.exe");
    const pythonExeUnix = path.join(dir, ".venv", "bin", "python");
    const agentScript = path.join(dir, "agent.py");

    const pythonExe = fs.existsSync(pythonExeWindows)
      ? pythonExeWindows
      : fs.existsSync(pythonExeUnix)
      ? pythonExeUnix
      : null;

    if (pythonExe && fs.existsSync(agentScript)) {
      return { pythonExe, agentScript, cwd: dir };
    }
  }
  return null;
}

function startPythonAgent() {
  // Always terminate any existing or zombie process first so start is 100% fresh
  stopPythonAgent();

  const backend = findPythonBackend();

  if (!backend) {
    console.warn("[Stella Main] Python agent files not found at expected path");
    return { error: "Python agent path not found" };
  }

  pythonAgentProcess = spawn(backend.pythonExe, [backend.agentScript, "connect", "--room", "stella-room"], {
    cwd: backend.cwd,
    stdio: "pipe",
  });

  pythonAgentProcess.stdout.on("data", (data) => {
    console.log(`[Python Agent]: ${data}`);
  });

  pythonAgentProcess.stderr.on("data", (data) => {
    console.warn(`[Python Agent]: ${data}`);
  });

  pythonAgentProcess.on("exit", (code) => {
    console.log(`[Python Agent] Exited with code ${code}`);
    pythonAgentProcess = null;
  });

  return { running: true };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 640,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },

    autoHideMenuBar: true,
  });

  if (!app.isPackaged) {
    const devUrl = "http://localhost:5173";
    const tryLoad = () => {
      mainWindow?.loadURL(devUrl).catch(() => {
        setTimeout(tryLoad, 500);
      });
    };
    tryLoad();
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.on("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on("window-maximize", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-system-stats", () => getSystemStatsPayload());
ipcMain.handle("get-livekit-token", () => generateLiveKitToken());
ipcMain.handle("start-python-agent", () => startPythonAgent());
ipcMain.handle("stop-python-agent", () => stopPythonAgent());

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopPythonAgent();
  if (globalThis["process"]?.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  stopPythonAgent();
});