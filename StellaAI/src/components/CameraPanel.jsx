/* =========================================================
   STELLA AI OPTICAL SENSOR / CAMERA PANEL
   Sci-Fi Neural Vision Feed with Real-Time HUD & Standby Lens
========================================================= */

import { useState, useEffect, useRef } from "react";
import Icon from "./Icon";

export default function CameraPanel({
  active,
  videoRef,
  toggleCamera,
  cameraError,
  setCameraError,
}) {
  const [isSimulated, setIsSimulated] = useState(false);
  const canvasRef = useRef(null);

  // Simulated cyber vision feed loop for testing/fallback
  useEffect(() => {
    if (!isSimulated || !active) return;
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let t = 0;
    const render = () => {
      t += 0.03;
      const w = (canvas.width = canvas.offsetWidth || 320);
      const h = (canvas.height = canvas.offsetHeight || 180);

      // Deep cyber background with gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, "#030a14");
      bgGrad.addColorStop(1, "#071728");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Perspective radar grid
      ctx.strokeStyle = "rgba(94, 231, 255, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 24;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Simulated detected subject wireframe
      const cx = w * 0.5 + Math.sin(t * 0.8) * 20;
      const cy = h * 0.45 + Math.cos(t * 0.6) * 12;

      ctx.save();
      ctx.strokeStyle = "rgba(94, 231, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(cx - 36, cy - 44, 72, 88);
      ctx.restore();

      // Corner markers on subject
      ctx.strokeStyle = "#5ee7ff";
      ctx.lineWidth = 2;
      const s = 10;
      // TL
      ctx.beginPath(); ctx.moveTo(cx - 36, cy - 44 + s); ctx.lineTo(cx - 36, cy - 44); ctx.lineTo(cx - 36 + s, cy - 44); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(cx + 36 - s, cy - 44); ctx.lineTo(cx + 36, cy - 44); ctx.lineTo(cx + 36, cy - 44 + s); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(cx - 36, cy + 44 - s); ctx.lineTo(cx - 36, cy + 44); ctx.lineTo(cx - 36 + s, cy + 44); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(cx + 36 - s, cy + 44); ctx.lineTo(cx + 36, cy + 44); ctx.lineTo(cx + 36, cy + 44 - s); ctx.stroke();

      // Subject tag
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#5ee7ff";
      ctx.fillText("OPERATOR [SIMULATED]", cx - 36, cy - 50);

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isSimulated, active]);

  const handleSimulateToggle = () => {
    if (setCameraError) setCameraError(null);
    setIsSimulated(true);
    if (!active) toggleCamera();
  };

  const handlePrimaryToggle = () => {
    if (isSimulated) {
      setIsSimulated(false);
    }
    toggleCamera();
  };

  const isLive = active;

  return (
    <section
      className={`panel camera-panel ${isLive ? "camera-active" : "camera-standby"} ${
        cameraError ? "camera-error" : ""
      }`}
    >
      {/* Sci-Fi HUD Corner Brackets */}
      <span className="cam-bracket cam-b-tl" aria-hidden="true" />
      <span className="cam-bracket cam-b-tr" aria-hidden="true" />
      <span className="cam-bracket cam-b-bl" aria-hidden="true" />
      <span className="cam-bracket cam-b-br" aria-hidden="true" />

      {/* Top Header Controls */}
      <header className="camera-header">
        <div className="cam-header-left">
          <span
            className={`cam-status-beacon ${
              cameraError ? "beacon-error" : isLive ? "beacon-live" : "beacon-idle"
            }`}
          />
          <div className="cam-title-group">
            <span className="cam-title">OPTICAL SENSOR</span>
            <span className="cam-channel-id">CAM-01</span>
          </div>
          <span className="cam-mode-pill">
            {cameraError ? "OFFLINE" : isLive ? (isSimulated ? "SIMULATED" : "LIVE 1080P") : "STANDBY"}
          </span>
        </div>

        <div className="cam-header-right">
          {cameraError ? (
            <button
              type="button"
              className="cam-cyber-btn cam-retry-btn"
              onClick={handleSimulateToggle}
              title="Switch to simulated neural feed"
            >
              SIMULATE
            </button>
          ) : (
            <button
              type="button"
              className={`cam-cyber-btn ${isLive ? "btn-active" : "btn-idle"}`}
              onClick={handlePrimaryToggle}
              title={isLive ? "Terminate visual sensor link" : "Initialize visual sensor feed"}
            >
              <span className="btn-icon-indicator" />
              {isLive ? "TERMINATE" : "ENABLE"}
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <div className="camera-viewport">
        {/* Real Hardware Video (always mounted to prevent null ref binding issues) */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`camera-video-elem ${isLive && !isSimulated ? "feed-visible" : "feed-hidden"}`}
        />

        {/* Simulated Canvas Feed Fallback */}
        {isLive && isSimulated && (
          <canvas ref={canvasRef} className="camera-canvas-simulated" />
        )}

        {/* ----------------------------------------------------
            ACTIVE HUD OVERLAY
        ---------------------------------------------------- */}
        {isLive && (
          <div className="cam-active-hud">
            {/* Real-time laser scanning bar */}
            <div className="cam-scanline-laser" />

            {/* Top HUD Telemetry */}
            <div className="hud-top-telemetry">
              <span className="hud-rec-badge">
                <span className="rec-pulse-dot" />
                REC
              </span>
              <span className="hud-stream-stat">AES-256 SECURE</span>
              <span className="hud-fps-stat">30.0 FPS</span>
            </div>

            {/* Target Reticle in Center */}
            <div className="cam-target-reticle">
              <div className="reticle-box">
                <span className="reticle-corner r-tl" />
                <span className="reticle-corner r-tr" />
                <span className="reticle-corner r-bl" />
                <span className="reticle-corner r-br" />
                <div className="reticle-crosshair" />
              </div>
              <div className="reticle-data">
                <span className="target-label">AI TARGET: OPERATOR</span>
                <span className="target-confidence">CONF: 99.4%</span>
              </div>
            </div>

            {/* Bottom HUD Telemetry Strip */}
            <div className="hud-bottom-telemetry">
              <span>FOV: 84°</span>
              <span>EXP: 1/60s</span>
              <span>ISO: AUTO</span>
              <span className="optic-bus-tag">BUS: ACTIVE</span>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            STANDBY VIEW (Offline / Waiting for activation)
        ---------------------------------------------------- */}
        {!isLive && !cameraError && (
          <div
            className="camera-standby-view"
            onClick={toggleCamera}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") toggleCamera();
            }}
            title="Click to initialize camera feed"
          >
            {/* Cybernetic Lens / Aperture Assembly */}
            <div className="standby-lens-assembly">
              <div className="lens-ring-outer">
                <div className="lens-ticks-dial" />
              </div>
              <div className="lens-ring-middle" />
              <div className="lens-aperture-core">
                <Icon name="camera" />
              </div>
              <div className="lens-pulse-glow" />
            </div>

            {/* Status Information */}
            <div className="standby-labels">
              <h4 className="standby-headline">OPTICAL FEED OFFLINE</h4>
              <p className="standby-subhead">Activate camera sensor to initiate real-time AI vision</p>
            </div>

            {/* Telemetry Chips */}
            <div className="standby-meta-strip">
              <span className="standby-tag">
                <i className="tag-dot" /> SENSOR: SONY-IMX
              </span>
              <span className="standby-tag">
                <i className="tag-dot" /> AI VISION: ARMED
              </span>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            ERROR VIEW (Permission denied or hardware missing)
        ---------------------------------------------------- */}
        {!isLive && cameraError && (
          <div className="camera-error-view">
            <div className="error-icon-box">
              <span className="error-warning-symbol">⚠</span>
            </div>
            <h4 className="error-title">SENSOR ACCESS RESTRICTED</h4>
            <p className="error-desc">
              {cameraError === "ACCESS DENIED"
                ? "Camera permission denied by browser or system."
                : "No physical video capture hardware detected."}
            </p>
            <div className="error-actions">
              <button
                type="button"
                className="cam-cyber-btn cam-retry-btn"
                onClick={toggleCamera}
              >
                RETRY SENSOR
              </button>
              <button
                type="button"
                className="cam-cyber-btn btn-sim"
                onClick={handleSimulateToggle}
              >
                TEST SIMULATED FEED
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
