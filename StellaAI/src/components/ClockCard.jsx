/* =========================================================
   CLOCK CARD
========================================================= */

import { useEffect, useState, useRef } from "react";

export default function ClockCard() {
  const [now, setNow]         = useState(new Date());
  const [session, setSession] = useState(0); // seconds since mount
  const startRef              = useRef(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      setSession(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* ---- Time parts (always 2-digit) ---- */
  const hours   = String(now.getHours() % 12 || 12).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const secs    = String(now.getSeconds()).padStart(2, "0");
  const ampm    = now.getHours() >= 12 ? "PM" : "AM";

  /* ---- Date parts ---- */
  const weekday = now.toLocaleDateString([], { weekday: "long" });
  const dateStr = now.toLocaleDateString([], { month: "short", day: "2-digit" }).toUpperCase();
  const year    = now.getFullYear();

  /* ---- Timezone ---- */
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    .replace("Asia/", "")
    .replace("_", " ")
    .toUpperCase();

  /* ---- Day progress (% of 24 h elapsed) ---- */
  const totalSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const dayPct    = ((totalSecs / 86400) * 100).toFixed(1);

  /* ---- Session format mm:ss ---- */
  const sm = String(Math.floor(session / 60)).padStart(2, "0");
  const ss = String(session % 60).padStart(2, "0");

  return (
    <section className="panel clock-card">

      {/* Eyebrow */}
      <div className="eyebrow">
        <span className="status-dot online" />
        LOCAL TIME
        <span className="clock-tz">{tz}</span>
      </div>

      {/* Main time */}
      <div className="clock-main">
        <div className="clock-hm">
          <span className="clock-h">{hours}</span>
          <span className="clock-colon">:</span>
          <span className="clock-m">{minutes}</span>
        </div>

        <div className="clock-right">
          <span className="clock-ampm">{ampm}</span>
          <span className="clock-sec">{secs}</span>
        </div>
      </div>

      {/* Day progress bar */}
      <div className="clock-progress-row">
        <span className="clock-progress-label">DAY {dayPct}%</span>
        <div className="clock-progress-track">
          <div
            className="clock-progress-fill"
            style={{ width: `${dayPct}%` }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="clock-divider" />

      {/* Bottom row: date + session */}
      <div className="clock-bottom">
        <div className="clock-date-block">
          <span className="clock-weekday">{weekday}</span>
          <span className="clock-datestr">{dateStr} · {year}</span>
        </div>
        <div className="clock-session">
          <span className="clock-session-label">SESSION</span>
          <span className="clock-session-time">{sm}:{ss}</span>
        </div>
      </div>

    </section>
  );
}
