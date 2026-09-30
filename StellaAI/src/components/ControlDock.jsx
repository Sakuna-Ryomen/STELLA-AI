/* =========================================================
   CONTROL DOCK
========================================================= */

import Icon from "./Icon";

export default function ControlDock({
  state,
  setState,
  micMuted,
  setMicMuted,
  cameraActive,
  toggleCamera,
  setSettingsOpen,
  onToggleStella,
  isLiveKitConnected,
  isConnecting,
}) {
  const isActive = isLiveKitConnected || (state !== "idle" && state !== "disconnected");

  const handleMicToggle = () => setMicMuted((prev) => !prev);
  const handleStellaToggle = () => {
    if (onToggleStella) {
      onToggleStella();
    } else {
      setState(isActive ? "idle" : "listening");
    }
  };

  return (
    <section className="controls">

      {/* ---- Mic ---- */}
      <button
        type="button"
        className={`ctrl-btn ${micMuted ? "muted" : "mic-on"}`}
        onClick={handleMicToggle}
        aria-pressed={micMuted}
        aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
        title={micMuted ? "Unmute microphone" : "Mute microphone"}
      >
        <span className="ctrl-ring">
          <Icon name="mic" />
        </span>
        <span className="ctrl-label">{micMuted ? "MUTED" : "MIC"}</span>
      </button>

      {/* ---- Camera ---- */}
      <button
        type="button"
        className={`ctrl-btn ${cameraActive ? "active-cam" : ""}`}
        onClick={toggleCamera}
        aria-pressed={cameraActive}
        aria-label={cameraActive ? "Disable camera" : "Enable camera"}
        title={cameraActive ? "Disable camera" : "Enable camera"}
      >
        <span className="ctrl-ring">
          <Icon name="camera" />
        </span>
        <span className="ctrl-label">CAMERA</span>
      </button>

      {/* ---- Start / Stop STELLA ---- */}
      <button
        type="button"
        className={`ctrl-btn ctrl-btn--primary ${
          isConnecting ? "stella-initializing" : isActive ? "stella-active" : ""
        }`}
        onClick={handleStellaToggle}
        disabled={isConnecting}
        aria-pressed={isActive}
        aria-label={isConnecting ? "Initializing Stella..." : isActive ? "Stop STELLA" : "Start STELLA"}
        title={
          isConnecting
            ? "Initializing connection to backend..."
            : isActive
            ? "Stop STELLA (Disconnect)"
            : "Start STELLA (Connect to Gemini Live)"
        }
      >
        <span className="ctrl-ring ctrl-ring--primary">
          <Icon name={isConnecting ? "spark" : isActive ? "pause" : "power"} />
        </span>
        <span className="ctrl-label ctrl-label--primary">
          {isConnecting ? "INITIALIZING..." : isActive ? "STOP STELLA" : "START STELLA"}
        </span>
      </button>

      {/* ---- Settings ---- */}
      <button
        type="button"
        className="ctrl-btn"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
        title="Settings"
      >
        <span className="ctrl-ring">
          <Icon name="settings" />
        </span>
        <span className="ctrl-label">SETTINGS</span>
      </button>

    </section>
  );
}
