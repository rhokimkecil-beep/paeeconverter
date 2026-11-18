import auth from "../_lib/auth.js";
import { createStore } from "../_lib/store.js";
import { createUsers } from "../_lib/users.js";
import { json, readJsonBody } from "../_lib/http.js";

const HOSTS = ["youtube.com","m.youtube.com","music.youtube.com","youtu.be"];
const rlKey = (id) => `pae:rl:yt:${id}`;

async function overLimit(store, userId, premium, env) {
  const LIMIT_FREE = Number(env.YT_HOURLY_FREE) || 10;
  const LIMIT_PREMIUM = Number(env.YT_HOURLY_PREMIUM) || 40;
  const key = rlKey(userId);
  const n = Number(await store.cmd(["INCR", key]));
  if (n === 1) await store.cmd(["EXPIRE", key, 3600]);
  if (n > (premium ? LIMIT_PREMIUM : LIMIT_FREE)) {
    await store.cmd(["DECR", key]).catch(() => {});
    return true;
  }
  return false;
}
async function refundLimit(store, userId) {
  try { await store.cmd(["DECR", rlKey(userId)]); } catch {}
}

export async function onRequestPost({ request, env }) {
  const store = createStore(env);
  if (!auth.sameSiteRequest(request)) return json({ message: "Request tidak valid" }, 400);
  if (!env.CONVERTER_URL) return json({ message: "CONVERTER_URL belum diatur.", code: "maintenance" }, 503);
  if (!store.configured) return json({ message: "Database belum dihubungkan." }, 503);

  const users = createUsers(env);
  let me = null;
  try { me = await users.fromRequest(request); }
  catch (e) { return json({ message: "Terjadi kesalahan di server" }, 500); }
  if (!me) return json({ message: "Login Discord dulu.", code: "login" }, 401);

  const body = await readJsonBody(request);
  const headers = { "content-type": "application/json", "x-secret": env.CONVERTER_SECRET || "" };

  if (body.warm) {
    try { await fetch(env.CONVERTER_URL + "/health", { headers, signal: AbortSignal.timeout(8000) }); } catch {}
    return json({ ok: true });
  }

  let url;
  try { url = new URL(String(body.url || "").trim()); } catch { return json({ message: "URL tidak valid" }, 400); }
  if (!["http:","https:"].includes(url.protocol) || !HOSTS.includes(url.hostname.toLowerCase().replace(/^www\./,""))) {
    return json({ message: "Hanya URL YouTube yang didukung" }, 400);
  }

  try {
    if (await overLimit(store, me.user.id, me.premium, env))
      return json({ message: "Batas konversi per jam sudah habis.", code: "limit" }, 429);
  } catch { return json({ message: "Terjadi kesalahan di server" }, 500); }

  const MAX_BYTES = Math.min(Number(env.YT_MAX_BYTES) || 15 * 1024 * 1024, 25 * 1024 * 1024);

  let upstream;
  try {
    upstream = await fetch(env.CONVERTER_URL + "/convert", {
      method: "POST", headers,
      body: JSON.stringify({ url: url.href, format: "mp3", maxBytes: MAX_BYTES }),
      signal: AbortSignal.timeout(100000),
    });
  } catch {
    await refundLimit(store, me.user.id);
    return json({ message: "Converter tidak merespons.", retryable: true }, 504);
  }

  if (upstream.status === 429) { await refundLimit(store, me.user.id); return json({ message: "Server sibuk.", retryable: true }, 429); }
  if (!upstream.ok) {
    await refundLimit(store, me.user.id);
    const d = await upstream.json().catch(() => ({}));
    const tunnelDown = !d.message && [502,503,504].includes(upstream.status);
    return json({ message: d.message || (tunnelDown ? "Converter offline. Cek tunnel.bat." : "Konversi gagal"), retryable: upstream.status >= 500 }, upstream.status);
  }

  const out = new Headers({ "content-type": "audio/mpeg", "X-Content-Type-Options": "nosniff" });
  for (const h of ["content-length","content-disposition","x-audio-title"]) {
    const v = upstream.headers.get(h); if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: 200, headers: out });
}
export async function onRequest() {
  return json({ message: "Method tidak diizinkan" }, 405, { Allow: "POST" });
}
