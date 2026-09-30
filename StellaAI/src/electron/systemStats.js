/* =========================================================
   SYSTEM STATS PROVIDER (Node / Electron)
========================================================= */

import os from "node:os";
import fs from "node:fs";

let prevCpuTimes = getCpuTimes();

function getCpuTimes() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    idle += c.times.idle;
    for (const t in c.times) {
      total += c.times[t];
    }
  }
  return { idle, total };
}

function getCpuUsagePercent() {
  const current = getCpuTimes();
  const deltaIdle = current.idle - prevCpuTimes.idle;
  const deltaTotal = current.total - prevCpuTimes.total;
  prevCpuTimes = current;

  if (deltaTotal <= 0) return 18;
  const percent = Math.round((1 - deltaIdle / deltaTotal) * 100);
  return Math.max(1, Math.min(100, percent));
}

function getDriveInfo(driveLetter) {
  try {
    const stats = fs.statfsSync(`${driveLetter}:\\`);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const totalGb = (totalBytes / (1024 ** 3)).toFixed(1);
    const usedGb = (usedBytes / (1024 ** 3)).toFixed(1);
    const freeGb = (freeBytes / (1024 ** 3)).toFixed(1);
    const percent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    return {
      drive: driveLetter,
      totalGb,
      usedGb,
      freeGb,
      percent,
      exists: true,
    };
  } catch {
    return {
      drive: driveLetter,
      exists: false,
    };
  }
}

export function getSystemStatsPayload() {
  const cpuPercent = getCpuUsagePercent();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const cDrive = getDriveInfo("C");
  const dDrive = getDriveInfo("D");

  const cpus = os.cpus() || [];
  const rawModel = cpus[0]?.model || "Multi-Core Processor";
  // Clean up CPU model string (e.g. "Intel(R) Core(TM) i5-6300U CPU @ 2.40GHz" -> "i5-6300U")
  const shortCpu = rawModel.replace(/Intel\(R\)\s*Core\(TM\)\s*/i, "").replace(/\s*CPU.*$/i, "").trim() || rawModel;

  return {
    cpu: {
      percent: cpuPercent,
      model: shortCpu,
      fullModel: rawModel,
      cores: cpus.length,
    },
    ram: {
      totalGb: (totalMem / (1024 ** 3)).toFixed(1),
      usedGb: (usedMem / (1024 ** 3)).toFixed(1),
      freeGb: (freeMem / (1024 ** 3)).toFixed(1),
      percent: memPercent,
    },
    drives: {
      c: cDrive,
      d: dDrive,
    },
    uptimeSec: Math.floor(os.uptime()),
    platform: `${os.platform()} ${os.arch()}`,
    timestamp: Date.now(),
  };
}
