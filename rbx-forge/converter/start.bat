@echo off
title RBX FORGE Converter
color 0A
echo.
echo  ====================================
echo   RBX FORGE - Converter Server
echo  ====================================
echo.

:: SET INI SESUAI CONVERTER_SECRET di Cloudflare
set CONVERTER_SECRET=ganti_secret_ini
set PORT=3000

echo [1/2] Mengecek yt-dlp...
yt-dlp --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: yt-dlp tidak ditemukan! Install dulu:
  echo   pip install yt-dlp
  pause & exit
)
echo  OK - yt-dlp tersedia

echo [2/2] Mengecek ffmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
  echo ERROR: ffmpeg tidak ditemukan! Install dulu:
  echo   winget install Gyan.FFmpeg
  pause & exit
)
echo  OK - ffmpeg tersedia

echo.
echo  Menjalankan converter server di port %PORT%...
echo  Jangan tutup jendela ini!
echo.
node converter-server.js
pause
