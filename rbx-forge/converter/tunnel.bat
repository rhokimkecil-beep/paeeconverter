@echo off
title RBX FORGE Tunnel
color 0B
echo.
echo  ====================================
echo   RBX FORGE - Cloudflare Tunnel
echo  ====================================
echo.
echo  Pastikan start.bat sudah jalan dulu!
echo.
echo  Tunnel akan memberi URL seperti:
echo  https://something.trycloudflare.com
echo.
echo  COPY URL itu ke CONVERTER_URL di Cloudflare Pages!
echo.
cloudflared tunnel --url http://localhost:3000
pause
