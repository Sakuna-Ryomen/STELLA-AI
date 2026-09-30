/* =========================================================
   SYSTEM CARD — Real-Time Hardware & System Telemetry
========================================================= */

import { useEffect, useState } from "react";
import Icon from "./Icon";

export default function SystemCard({ state }) {
  const isDisconnected = state === "disconnected";

  const [stats, setStats] = useState({
    cpu: { percent: 18, model: "CPU", cores: 4 },
    ram: { totalGb: "11.8", usedGb: "6.4", percent: 54 },
    drives: {
      c: { drive: "C", totalGb: "199.9", usedGb: "97.9", percent: 49, exists: true },
      d: { drive: "D", totalGb: "265.3", usedGb: "225.1", percent: 85, exists: true },
    },
    platform: "win32 x64",
    isLive: false,
  });

  useEffect(() => {
    let mounted = true;

    async function updateStats() {
      try {
        let data = null;

        // 1. Try Electron IPC first
        if (window.electronAPI?.getSystemStats) {
          try {
            data = await window.electronAPI.getSystemStats();
          } catch {
            data = null;
          }
        }

        // 2. Fall back to Vite dev server API
        if (!data) {
          const res = await fetch("/api/system-stats");
          if (res.ok) {
            data = await res.json();
          }
        }

        if (mounted && data) {
          setStats({
            ...data,
            isLive: true,
          });
        }
      } catch (err) {
        console.warn("Unable to fetch live system stats:", err);
      }
    }

    // Initial fetch
    updateStats();

    // Poll every 2 seconds for real-time updates
    const timer = setInterval(updateStats, 2000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const getTone = (percent) => {
    if (percent >= 90) return "danger";
    if (percent >= 75) return "warn";
    return "stable";
  };

  const cpuPercent = stats.cpu?.percent ?? 18;
  const ramPercent = stats.ram?.percent ?? 54;
  const ramUsed = stats.ram?.usedGb ?? "6.4";
  const ramTotal = stats.ram?.totalGb ?? "11.8";

  const cDrive = stats.drives?.c;
  const dDrive = stats.drives?.d;

  return (
    <section className="panel system-card">
      {/* Eyebrow / Heading */}
      <div className="section-heading system-heading">
        <div className="system-title-wrap">
          <span className="system-pulse-dot" />
          <span>SYSTEM PULSE</span>
        </div>
        <div className={`system-telemetry-pill ${stats.isLive ? "is-live" : "is-standby"}`}>
          <Icon name="signal" />
          <span>{stats.isLive ? "LIVE TELEMETRY" : "STANDBY"}</span>
        </div>
      </div>

      {/* Main Metrics Container */}
      <div className="system-metrics">
        {/* CPU Metric */}
        <div className="system-metric-block">
          <div className="metric-header">
            <span className="metric-label">CPU LOAD</span>
            <span className="metric-value">
              <i className={`status-dot ${getTone(cpuPercent)}`} />
              {cpuPercent}%
            </span>
          </div>
          <div className="metric-bar-track">
            <div
              className={`metric-bar-fill ${getTone(cpuPercent)}`}
              style={{ width: `${Math.min(100, Math.max(4, cpuPercent))}%` }}
            />
          </div>
        </div>

        {/* RAM Metric */}
        <div className="system-metric-block">
          <div className="metric-header">
            <span className="metric-label">RAM USAGE</span>
            <span className="metric-value">
              <span className="metric-detail">{ramUsed} / {ramTotal} GB</span>
              <i className={`status-dot ${getTone(ramPercent)}`} />
              {ramPercent}%
            </span>
          </div>
          <div className="metric-bar-track">
            <div
              className={`metric-bar-fill ${getTone(ramPercent)}`}
              style={{ width: `${Math.min(100, Math.max(4, ramPercent))}%` }}
            />
          </div>
        </div>

        {/* Storage Section */}
        <div className="storage-section">
          {cDrive?.exists && (
            <div className="system-metric-block">
              <div className="metric-header">
                <span className="metric-label">C: DRIVE (SYS)</span>
                <span className="metric-value">
                  <span className="metric-detail">{cDrive.usedGb} / {cDrive.totalGb} GB</span>
                  <i className={`status-dot ${getTone(cDrive.percent)}`} />
                  {cDrive.percent}%
                </span>
              </div>
              <div className="metric-bar-track">
                <div
                  className={`metric-bar-fill ${getTone(cDrive.percent)}`}
                  style={{ width: `${Math.min(100, Math.max(4, cDrive.percent))}%` }}
                />
              </div>
            </div>
          )}

          {dDrive?.exists && (
            <div className="system-metric-block">
              <div className="metric-header">
                <span className="metric-label">D: DRIVE (DATA)</span>
                <span className="metric-value">
                  <span className="metric-detail">{dDrive.usedGb} / {dDrive.totalGb} GB</span>
                  <i className={`status-dot ${getTone(dDrive.percent)}`} />
                  {dDrive.percent}%
                </span>
              </div>
              <div className="metric-bar-track">
                <div
                  className={`metric-bar-fill ${getTone(dDrive.percent)}`}
                  style={{ width: `${Math.min(100, Math.max(4, dDrive.percent))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Line: Network & Stella Link */}
        <div className="system-status-pills">
          <div className="status-pill-item">
            <span className="pill-tag">NET</span>
            <strong>
              <i className="status-dot online" />
              SECURE
            </strong>
          </div>
          <div className="status-pill-item">
            <span className="pill-tag">STELLA</span>
            <strong>
              <i className={`status-dot ${isDisconnected ? "warn" : "online"}`} />
              {isDisconnected ? "OFFLINE" : "CONNECTED"}
            </strong>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="system-footer">
        <span>AGENT CORE · v0.8.4</span>
        <span className="system-core-meta">
          {stats.cpu?.model ? `${stats.cpu.model} · ` : ""}{stats.cpu?.cores ? `${stats.cpu.cores} CORES` : "ACTIVE"}
        </span>
      </div>
    </section>
  );
}
