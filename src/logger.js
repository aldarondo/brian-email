import fs from 'fs';
import path from 'path';

const logFile = process.env.LOG_FILE || null;
const maxBytes = parseInt(process.env.LOG_MAX_SIZE_MB || '10', 10) * 1024 * 1024;
const maxFiles = parseInt(process.env.LOG_MAX_FILES || '5', 10);

if (logFile) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

function rotate() {
  // Delete the oldest file, then shift .4→.5, .3→.4, ... .1→.2, current→.1
  for (let i = maxFiles - 1; i >= 1; i--) {
    const older = `${logFile}.${i}`;
    const newer = i === 1 ? logFile : `${logFile}.${i - 1}`;
    if (fs.existsSync(older)) fs.unlinkSync(older);
    if (fs.existsSync(newer)) fs.renameSync(newer, older);
  }
}

export function log(level, message, data = {}) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, message, ...data });
  console.error(entry);
  if (!logFile) return;

  try {
    const size = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
    if (size >= maxBytes) rotate();
    fs.appendFileSync(logFile, entry + '\n');
  } catch {
    // never let logging crash the server
  }
}
