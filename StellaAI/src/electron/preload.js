import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: globalThis["process"]?.platform ?? "unknown",

  minimize: () => {
    ipcRenderer.send("window-minimize");
  },

  maximize: () => {
    ipcRenderer.send("window-maximize");
  },

  close: () => {
    ipcRenderer.send("window-close");
  },

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getSystemStats: () => ipcRenderer.invoke("get-system-stats"),
  getLiveKitToken: () => ipcRenderer.invoke("get-livekit-token"),
  startPythonAgent: () => ipcRenderer.invoke("start-python-agent"),
  stopPythonAgent: () => ipcRenderer.invoke("stop-python-agent"),
});