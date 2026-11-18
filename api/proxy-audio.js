import { createStore } from "../_lib/store.js";
import { createUsers } from "../_lib/users.js";
import auth from "../_lib/auth.js";
import { json, readJsonBody } from "../_lib/http.js";

const API = "https://apis.roblox.com/assets/v1";

export async function onRequestPost({ request, env }) {
  const store = createStore(env);

  if (!auth.sameSiteRequest(request))
    return json({ error: "Request tidak valid" }, 400);

  let me = null;
  try {
    me = store.configured ? await createUsers(env).fromRequest(request) : null;
  } catch (e) {
    console.error("session error:", e && e.message);
    return json({ error: "Terjadi kesalahan di server" }, 500);
  }
  if (!me) return json({ error: "Login Discord dulu.", code: "login" }, 401);

  const body = await readJsonBody(request);
  const id = String(body.id || "").trim();
  const apiKey = String(body.apiKey || "").trim();

  if (!/^\d{1,20}$/.test(id)) return json({ error: "Asset ID tidak valid" }, 400);
  if (!apiKey) return json({ error: "API key wajib diisi" }, 400);

  const serverCookie = String(env.ROBLOX_COOKIE || "").trim();
  if (!serverCookie) {
    return json({ error: "Server belum dikonfigurasi. Set ROBLOX_COOKIE di Environment Variables." }, 503);
  }

  try {
    const contentRes = await fetch(`${API}/assets/${id}/content`, {
      headers: {
        "x-api-key": apiKey,
        "Cookie": `.ROBLOSECURITY=${serverCookie}`,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });

    if (!contentRes.ok) {
      const fallback = await fetch(
        `https://assetdelivery.roblox.com/v1/asset/?id=${id}`,
        {
          headers: {
            "Cookie": `.ROBLOSECURITY=${serverCookie}`,
            "User-Agent": "Roblox/WinInet",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(30000),
        }
      );
      if (!fallback.ok) {
        return json({
          error: `Gagal download audio (status ${fallback.status}). Pastikan ID valid.`,
        }, 502);
      }

      const buf = await fallback.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(buf.byteLength),
          "Cache-Control": "no-store",
        },
      });
    }

    const buf = await contentRes.arrayBuffer();
    const ct = contentRes.headers.get("content-type") || "audio/mpeg";
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct.includes("audio") ? ct : "audio/mpeg",
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("proxy-audio error:", e && e.message);
    return json({ error: "Error saat download: " + (e && e.message) }, 500);
  }
}

export async function onRequest() {
  return json({ error: "Method tidak diizinkan" }, 405, { Allow: "POST" });
}