/* =========================================================
   STELLA AI CORE — Quantum Neural Sphere & 3D Saturn Orbit Rings
========================================================= */

import { useEffect, useState } from "react";

/* ---------------------------------------------------------
   Saturn Planetary Ring Component
   Features:
   - Outer Band A with dashed telemetry
   - Cassini Division gap
   - Luminous Inner Band B
   - Crepe Band C
   - Orbiting Photon Energy Nodes
   - Calibration Notches
--------------------------------------------------------- */
function SaturnRings() {
  return (
    <svg viewBox="0 0 340 340" className="saturn-svg" aria-hidden="true">
      <defs>
        {/* Ring A gradient */}
        <radialGradient id="ringAGrad" cx="50%" cy="50%" r="50%">
          <stop offset="68%" stopColor="rgba(94, 231, 255, 0.05)" />
          <stop offset="78%" stopColor="rgba(94, 231, 255, 0.28)" />
          <stop offset="86%" stopColor="rgba(30, 140, 210, 0.35)" />
          <stop offset="93%" stopColor="rgba(94, 231, 255, 0.65)" />
          <stop offset="97%" stopColor="rgba(94, 231, 255, 0.2)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* Ring B gradient (luminous inner core) */}
        <radialGradient id="ringBGrad" cx="50%" cy="50%" r="50%">
          <stop offset="56%" stopColor="transparent" />
          <stop offset="59%" stopColor="rgba(94, 231, 255, 0.22)" />
          <stop offset="67%" stopColor="rgba(94, 231, 255, 0.75)" />
          <stop offset="74%" stopColor="rgba(125, 255, 179, 0.55)" />
          <stop offset="78%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Crepe Ring C: Faint inner ring */}
      <circle cx="170" cy="170" r="98" className="saturn-band-c" />

      {/* Main Dense Ring B */}
      <circle cx="170" cy="170" r="114" className="saturn-band-b" />
      <circle cx="170" cy="170" r="114" className="saturn-band-b-track" />

      {/* Cassini Division: Distinct space between rings */}
      <circle cx="170" cy="170" r="126" className="saturn-cassini-gap" />

      {/* Main Outer Ring A */}
      <circle cx="170" cy="170" r="141" className="saturn-band-a" />
      <circle cx="170" cy="170" r="147" className="saturn-band-a-dashed" />
      <circle cx="170" cy="170" r="156" className="saturn-band-a-outer" />

      {/* Orbiting Photon Energy Beacons */}
      <g className="saturn-beacons">
        <circle cx="170" cy="14" r="3.2" className="saturn-node node-1" />
        <circle cx="170" cy="326" r="2.8" className="saturn-node node-2" />
        <circle cx="282" cy="236" r="2.2" className="saturn-node node-3" />
        <circle cx="58" cy="104" r="2.2" className="saturn-node node-4" />
      </g>

      {/* Radial calibration notches */}
      <g className="saturn-notches">
        <line x1="170" y1="18" x2="170" y2="28" className="saturn-notch" />
        <line x1="170" y1="312" x2="170" y2="322" className="saturn-notch" />
        <line x1="18" y1="170" x2="28" y2="170" className="saturn-notch" />
        <line x1="312" y1="170" x2="322" y2="170" className="saturn-notch" />
        <line x1="63" y1="63" x2="70" y2="70" className="saturn-notch minor" />
        <line x1="277" y1="63" x2="270" y2="70" className="saturn-notch minor" />
        <line x1="63" y1="277" x2="70" y2="270" className="saturn-notch minor" />
        <line x1="277" y1="277" x2="270" y2="270" className="saturn-notch minor" />
      </g>
    </svg>
  );
}

export default function Core({ state = "idle", onToggle, micMuted = false }) {
  const [voiceVol, setVoiceVol] = useState(0);

  // Real-time microphone audio reactivity when in listening mode
  useEffect(() => {
    if (state !== "listening" || micMuted) {
      setVoiceVol(0);
      return;
    }

    let audioCtx = null;
    let analyser = null;
    let source = null;
    let stream = null;
    let animId = null;
    let isCancelled = false;

    async function initAudio() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const sample = () => {
          if (isCancelled) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const norm = Math.min(1, Math.max(0, (avg - 10) / 70));
          setVoiceVol(norm);
          animId = requestAnimationFrame(sample);
        };
        sample();
      } catch {
        // Procedural CSS fallback handles audio responsiveness
      }
    }

    initAudio();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (source) source.disconnect();
      if (audioCtx) audioCtx.close().catch(() => {});
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [state, micMuted]);

  const coreLabel =
    state === "idle"
      ? "STANDBY"
      : state === "listening"
      ? "LISTENING"
      : state === "thinking"
      ? "PROCESSING"
      : state === "speaking"
      ? "TRANSMITTING"
      : state.toUpperCase();

  const subLabel =
    state === "listening"
      ? "VOICE FREQUENCY ACTIVE"
      : state === "thinking"
      ? "NEURAL SYNTHESIS"
      : state === "speaking"
      ? "AUDIO EMISSION"
      : state === "muted"
      ? "CORE ISOLATED"
      : "STELLA CORE / 01";

  const handleKeyDown = (e) => {
    if ((e.key === "Enter" || e.key === " ") && onToggle) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className={`core-stage core-${state} ${voiceVol > 0.15 ? "voice-active" : ""}`}
      style={{
        "--voice-intensity": voiceVol,
      }}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title="Click to toggle STELLA Core listening mode"
    >
      {/* Soundwave Ripple Emitter */}
      <div className="core-ripples" aria-hidden="true">
        <span className="ripple-wave ripple-1" />
        <span className="ripple-wave ripple-2" />
        <span className="ripple-wave ripple-3" />
      </div>

      {/* Outer Precision HUD Reticle Ring with Degree Ticks */}
      <div className="core-hud-ring" aria-hidden="true">
        <svg viewBox="0 0 320 320" className="hud-svg">
          <circle cx="160" cy="160" r="148" className="hud-track" />
          <circle cx="160" cy="160" r="140" className="hud-dashed" />
          <line x1="160" y1="6" x2="160" y2="18" className="hud-tick major" />
          <line x1="160" y1="302" x2="160" y2="314" className="hud-tick major" />
          <line x1="6" y1="160" x2="18" y2="160" className="hud-tick major" />
          <line x1="302" y1="160" x2="314" y2="160" className="hud-tick major" />
          <line x1="51" y1="51" x2="60" y2="60" className="hud-tick" />
          <line x1="269" y1="51" x2="260" y2="60" className="hud-tick" />
          <line x1="51" y1="269" x2="60" y2="260" className="hud-tick" />
          <line x1="269" y1="269" x2="260" y2="260" className="hud-tick" />
        </svg>
      </div>

      {/* 3D Saturn Ring System — BACK LAYER (Passes behind the sphere) */}
      <div className="saturn-ring-container saturn-layer-back" aria-hidden="true">
        <div className="saturn-rotator">
          <SaturnRings />
        </div>
      </div>

      {/* Quantum Sphere & Core Reactor (Z-index: 3) */}
      <div className="core-sphere-wrapper">
        {/* Volumetric Aura Glow */}
        <div className="core-aura" />

        {/* 3D Glassmorphic Quantum Sphere */}
        <div className="core-sphere">
          {/* Specular Highlight Sheen Dome */}
          <div className="sphere-sheen" />

          {/* Internal Plasma Energy Wave */}
          <div className="core-plasma" />

          {/* Core Nucleus & Monogram */}
          <div className="core-inner">
            <div className="core-reticle" />
            <span className="core-monogram">S</span>
          </div>

          {/* Equatorial Meridian Light Bar */}
          <div className="core-meridian" />
        </div>
      </div>

      {/* 3D Saturn Ring System — FRONT LAYER (Passes in front of the sphere) */}
      <div className="saturn-ring-container saturn-layer-front" aria-hidden="true">
        <div className="saturn-rotator">
          <SaturnRings />
        </div>
      </div>

      {/* Status & Telemetry Label */}
      <div className="core-label">
        <div className="core-status-badge">
          <span className="core-status-pulse" />
          <strong>{coreLabel}</strong>
        </div>
        <small>{subLabel}</small>
      </div>
    </div>
  );
}
