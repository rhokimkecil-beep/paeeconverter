/**
 * RBX FORGE — Converter Server (jalankan di PC/VPS lokal)
 * Butuh: yt-dlp, ffmpeg, Node.js 18+
 *
 * Install:
 *   pip install yt-dlp
 *   Windows: winget install Gyan.FFmpeg
 *   Ubuntu:  sudo apt install ffmpeg
 *
 * Jalankan:
 *   set CONVERTER_SECRET=rahasia_bersama && node converter-server.js
 */

const http   = require("http");
const { execFile } = require("child_process");
const fs     = require("fs");
const os     = require("os");
const path   = require("path");
const crypto = require("crypto");

const SECRET = process.env.CONVERTER_SECRET || "ganti_secret_ini";
const PORT   = Number(process.env.PORT) || 3000;

// ─── helpers ───────────────────────────────────────
function readBody(req) {
  return new Promise((res, rej) => {
    let d = "";
    req.on("data", c => { d += c; if (d.length > 1024) rej(new Error("body terlalu besar")); });
    req.on("end", () => { try { res(JSON.parse(d)); } catch { rej(new Error("invalid json")); } });
    req.on("error", rej);
  });
}
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}
function cleanup(...files) {
  for (const f of files) try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
}

// ─── server ────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // Health check — tidak butuh secret
  if (url.pathname === "/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, uptime: process.uptime() });
  }

  // Semua endpoint lain butuh secret
  if (req.headers["x-secret"] !== SECRET) {
    return sendJson(res, 401, { message: "Unauthorized" });
  }

  // ── /convert ──────────────────────────────────────
  if (url.pathname === "/convert" && req.method === "POST") {
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJson(res, 400, { message: e.message }); }

    const videoUrl  = String(body.url      || "").trim();
    const fmt       = body.format === "ogg" ? "ogg" : "mp3";
    const maxBytes  = Math.min(Number(body.maxBytes) || 15_000_000, 25_000_000);

    if (!videoUrl) return sendJson(res, 400, { message: "url wajib diisi" });

    const tmpId   = crypto.randomBytes(8).toString("hex");
    const tmpBase = path.join(os.tmpdir(), tmpId);
    const outTpl  = tmpBase + ".%(ext)s";

    const args = [
      "--no-playlist",
      "-x", "--audio-format", fmt,
      "--audio-quality", "0",
      "--no-warnings", "--no-progress",
      "--print", "%(title)s",
      "-o", outTpl,
      videoUrl,
    ];

    console.log(`[convert] ${new Date().toISOString()} url=${videoUrl.slice(0,80)}`);

    execFile("yt-dlp", args, { timeout: 120_000, maxBuffer: 5_000_000 }, (err, stdout, stderr) => {
      const finalPath = `${tmpBase}.${fmt}`;
      const title = (stdout || "").split("\n")[0].trim().slice(0, 120) || "audio";

      if (err || !fs.existsSync(finalPath)) {
        cleanup(finalPath);
        console.error("[convert] error:", err?.message, stderr?.slice(0, 200));
        const msg =
          stderr?.includes("Private video")           ? "Video privat" :
          stderr?.includes("not available")            ? "Video tidak tersedia" :
          stderr?.includes("Sign in to confirm")       ? "Video butuh login YouTube" :
          stderr?.includes("No video formats found")   ? "Format video tidak ditemukan" :
          `Konversi gagal: ${err?.message || "unknown"}`;
        return sendJson(res, 422, { message: msg });
      }

      const stat = fs.statSync(finalPath);
      if (stat.size > maxBytes) {
        cleanup(finalPath);
        return sendJson(res, 413, { message: `File terlalu besar (${Math.round(stat.size/1_048_576)}MB)` });
      }

      res.writeHead(200, {
        "content-type":        "audio/mpeg",
        "content-length":      String(stat.size),
        "x-audio-title":       encodeURIComponent(title),
        "cache-control":       "no-store",
      });
      const stream = fs.createReadStream(finalPath);
      stream.pipe(res);
      stream.on("close", () => cleanup(finalPath));
      stream.on("error", () => cleanup(finalPath));
    });
    return;
  }

  // ── /roblox-upload (opsional, untuk bypass IP Cloudflare) ──
  if (url.pathname === "/roblox-upload" && req.method === "POST") {
    // Terima multipart, teruskan ke Roblox Open Cloud
    // Cloudflare kadang diblokir Roblox — lewat sini bisa bypass
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", async () => {
      try {
        const buf = Buffer.concat(chunks);
        const ct  = req.headers["content-type"] || "";
        const r = await fetch("https://apis.roblox.com/assets/v1/assets", {
          method: "POST",
          headers: { "content-type": ct, ...Object.fromEntries(
            Object.entries(req.headers).filter(([k]) => k.startsWith("x-api") || k === "x-api-key")
          )},
          body: buf,
        });
        const j = await r.json().catch(() => ({}));
        res.writeHead(r.status, { "content-type": "application/json" });
        res.end(JSON.stringify(j));
      } catch (e) {
        sendJson(res, 502, { message: e.message });
      }
    });
    return;
  }

  sendJson(res, 404, { message: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("╔══════════════════════════════════╗");
  console.log("║   RBX FORGE Converter Server     ║");
  console.log(`║   Port: ${PORT}                       ║`);
  console.log(`║   Secret: ${SECRET.slice(0,8)}...           ║`);
  console.log("╚══════════════════════════════════╝");
  console.log("Jalankan tunnel: cloudflared tunnel --url http://localhost:" + PORT);
});

server.on("error", e => console.error("Server error:", e.message));
