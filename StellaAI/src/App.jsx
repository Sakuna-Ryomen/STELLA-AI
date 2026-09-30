import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";

import ChatPanel     from "./components/ChatPanel";
import Core          from "./components/Core";
import SystemCard    from "./components/SystemCard";
import ClockCard     from "./components/ClockCard";
import ContextCard   from "./components/ContextCard";
import ControlDock   from "./components/ControlDock";
import CameraPanel   from "./components/CameraPanel";
import SettingsModal from "./components/SettingsModal";
import Icon          from "./components/Icon";
import { useLiveKitStella } from "./hooks/useLiveKitStella";

/* =========================================================
   CONSTANTS
========================================================= */

const STATES = ["idle", "listening", "thinking", "speaking", "muted"];

const createInitialMessages = () => {
  const now = Date.now();
  const formatTime = (d) =>
    new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const t1 = now - 2 * 60000;
  const t2 = now - 1 * 60000;
  return [
    {
      id: "init-1",
      role: "stella",
      text: "Good evening. STELLA neural link is active and monitoring.",
      time: formatTime(t1),
      timestamp: t1,
    },
    {
      id: "init-2",
      role: "user",
      text: "How is the system looking?",
      time: formatTime(t2),
      timestamp: t2,
    },
    {
      id: "init-3",
      role: "stella",
      text: "All core systems are nominal. Click 'START STELLA' below to connect live with Gemini assistant.",
      time: formatTime(now),
      timestamp: now,
    },
  ];
};

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {
  const [state, setState] = useState(STATES[0]);
  const [messages, setMessages] = useState(createInitialMessages);

  const [micMuted, setMicMuted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  /* -------------------------------------------------------
     LiveKit Realtime Voice Integration
  ------------------------------------------------------- */
  const handleLiveKitMessage = useCallback((msg) => {
    const timestamp = msg.timestamp || Date.now();
    const messageWithTs = {
      ...msg,
      timestamp,
      time: msg.time || new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => {
      // Find if this segment or message ID already exists (for live speech streaming updates)
      const idx = prev.findIndex(
        (m) =>
          (msg.segmentId && m.segmentId && m.segmentId === msg.segmentId) ||
          (msg.id && m.id === msg.id)
      );

      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = {
          ...next[idx],
          text: msg.text,
          final: msg.final ?? next[idx].final,
          time: messageWithTs.time,
        };
      } else {
        next = [...prev, messageWithTs];
      }

      // STRICT CHRONOLOGICAL ORDER: user speech is ALWAYS placed before AI response
      return next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    });
  }, []);

  const handleLiveKitStateChange = useCallback((newState) => {
    setState(newState);
  }, []);

  const liveKit = useLiveKitStella({
    onMessage: handleLiveKitMessage,
    onStateChange: handleLiveKitStateChange,
    isMicMuted: micMuted,
  });

  // Sync mic mute state to LiveKit audio track
  useEffect(() => {
    liveKit.setMuted(micMuted);
  }, [micMuted, liveKit]);

  const handleToggleStella = () => {
    if (liveKit.isConnected || liveKit.isConnecting) {
      liveKit.disconnect();
    } else {
      liveKit.connect();
    }
  };

  /* -------------------------------------------------------
     Camera stop helper
  ------------------------------------------------------- */

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraError(null);
  };

  /* -------------------------------------------------------
     Camera toggle
  ------------------------------------------------------- */

  const toggleCamera = async () => {
    if (cameraActive) {
      stopCamera();
      return;
    }

    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (error) {
      console.warn("Unable to access camera hardware:", error);
      const isDenied = error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
      setCameraError(isDenied ? "ACCESS DENIED" : "SENSOR OFFLINE");
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  /* -------------------------------------------------------
     Cleanup on unmount
  ------------------------------------------------------- */

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="app-shell">

      {/* Ambient glows */}
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* ===================================================
          TOP BAR
      =================================================== */}

      <header className="topbar">

        <div className="brand">
          <span className="brand-mark">S</span>
          <span>
            <strong>STELLA</strong>
            <small>INTELLIGENCE SYSTEM</small>
          </span>
        </div>

        <div className="topbar-status">
          <span
            className={`status-dot ${
              liveKit.isConnecting
                ? "warn animate-pulse"
                : liveKit.isConnected
                ? "online"
                : state === "disconnected"
                ? "warn"
                : "stable"
            }`}
          />
          {liveKit.isConnecting
            ? "INITIALIZING..."
            : liveKit.isConnected
            ? "SYSTEM OPERATIONAL"
            : state === "disconnected"
            ? "DISCONNECTED"
            : "SYSTEM STANDBY"}
        </div>

      </header>

      {/* ===================================================
          DASHBOARD
      =================================================== */}

      <div className="dashboard-grid">

        {/* Chat */}
        <ChatPanel
          messages={messages}
          setMessages={setMessages}
          state={state}
          setState={setState}
          sendTextMessage={liveKit.sendTextMessage}
          isLiveKitConnected={liveKit.isConnected}
        />

        {/* Stella Core */}
        <section className="panel core-panel">

          <div className="core-heading">
            <div>
              <div className="eyebrow">
                {liveKit.isConnecting
                  ? "INITIALIZING..."
                  : liveKit.isConnected
                  ? "LIVE VOICE ACTIVE"
                  : "PRIMARY INTERFACE"}
              </div>
              <h1>STELLA <span>CORE</span></h1>
            </div>

            <button
              type="button"
              className="round-button"
              onClick={() => {
                const order = ["idle", "listening", "thinking", "speaking"];
                const currentIndex = order.indexOf(state);
                const nextIndex = (currentIndex + 1) % order.length;
                setState(order[nextIndex]);
              }}
              aria-label="Cycle Core state"
              title="Cycle Core state (Standby / Listening / Thinking / Speaking)"
            >
              <Icon name="spark" />
            </button>
          </div>

          <Core
            state={state}
            micMuted={micMuted}
            onToggle={handleToggleStella}
          />

          <div className="core-footer">
            <div className="core-footer-item">
              <span className={`core-footer-dot ${liveKit.isConnected ? "online" : "stable"}`} />
              <span className="core-footer-label">LINK</span>
              <b className="core-footer-val">{liveKit.isConnected ? "LIVEKIT" : "LOCAL"}</b>
            </div>
            <div className="core-footer-divider" />
            <div className="core-footer-item">
              <span className="core-footer-dot shield" />
              <span className="core-footer-label">MODEL</span>
              <b className="core-footer-val">GEMINI 3.1</b>
            </div>
            <div className="core-footer-divider" />
            <div className="core-footer-item">
              <span className="core-footer-dot secure" />
              <span className="core-footer-label">VOICE</span>
              <b className="core-footer-val">SULAFAT</b>
            </div>
          </div>

        </section>

        {/* Info column */}
        <aside className="info-column">
          <ClockCard />
          <SystemCard state={liveKit.isConnected ? "connected" : state} />
        </aside>

        {/* Environment */}
        <ContextCard />

        {/* Controls */}
        <section className="panel control-panel">
          <ControlDock
            state={state}
            setState={setState}
            micMuted={micMuted}
            setMicMuted={setMicMuted}
            cameraActive={cameraActive}
            toggleCamera={toggleCamera}
            setSettingsOpen={setSettingsOpen}
            onToggleStella={handleToggleStella}
            isLiveKitConnected={liveKit.isConnected}
            isConnecting={liveKit.isConnecting}
          />

          <div className="control-hint">
            {liveKit.isConnecting
              ? "Initializing connection to backend & Gemini Live..."
              : liveKit.isConnected
              ? (liveKit.agentPresent
                  ? (micMuted ? "Microphone muted (Click MIC to unmute)" : "Stella is listening. Say 'Hi' or ask a question!")
                  : "Connected to room. Waiting for Stella agent to join...")
              : "Click 'START STELLA' or press ⌘ SPACE to connect"}
            <span>⌘ SPACE</span>
          </div>
        </section>

        {/* Camera */}
        <CameraPanel
          active={cameraActive}
          videoRef={videoRef}
          toggleCamera={toggleCamera}
          cameraError={cameraError}
          setCameraError={setCameraError}
        />

      </div>

      {/* ===================================================
          SETTINGS
      =================================================== */}

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}

    </main>
  );
}