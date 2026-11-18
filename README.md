# RBX FORGE

## Struktur Deploy ke Cloudflare Pages

```
rbx-forge/
├── index.html          ← upload ini ke root
├── _lib/               ← upload folder ini
│   ├── auth.js
│   ├── guild.js
│   ├── http.js
│   ├── store.js
│   └── users.js
├── api/                ← upload folder ini
│   ├── auth.js
│   ├── discord-callback.js
│   ├── discord-login.js
│   ├── file.js
│   ├── image.js
│   ├── me.js
│   ├── products.js
│   ├── proxy-audio.js
│   ├── stats.js
│   ├── status.js
│   ├── tiktok-download.js
│   ├── upload.js
│   ├── users.js
│   ├── youtube-download.js
│   └── youtube-title.js
└── converter/          ← taruh di PC kamu (BUKAN di-upload ke Cloudflare)
    ├── server.js
    ├── start.bat
    └── tunnel.bat
```

## Env Vars Wajib di Cloudflare Pages

```
ADMIN_PASSWORD=password_kamu
SESSION_SECRET=random_32_char
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
DISCORD_CLIENT_ID=123...
DISCORD_CLIENT_SECRET=abc...
```

## Jalankan Converter (untuk YouTube/TikTok)

1. Install: `pip install yt-dlp` + ffmpeg
2. Edit `converter/start.bat` → isi CONVERTER_SECRET
3. Jalankan `start.bat` lalu `tunnel.bat`
4. Copy URL tunnel → isi `CONVERTER_URL` di Cloudflare

Baca SETUP_GUIDE.md untuk instruksi lengkap.
