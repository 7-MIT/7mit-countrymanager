# country.7mit — Dunia Bersama (cm/)

Desain mengikuti sistem desain **design.7mit** (marun, Lora + Inter, bingkai ganda, tekstur diagonal).

Simulasi pengelolaan negara multipemain. Semua angka dan peristiwa adalah **data permainan**.

- **Login:** Google, lewat Supabase Auth proyek server.7mit. Wajib login sebelum bermain.
- **Backend:** Edge Function `cm-api` (`supabase/functions/cm-api`) + tabel `cm_*` (`supabase/migrations`). RLS aktif tanpa policy, jadi klien tidak bisa menulis langsung. Semua aksi lewat fungsi: cek hak akses, validasi nilai, dan optimistic locking (`ver`).
- **Real-time:** trigger DB → Supabase Realtime (topik privat `cm-world`) + polling `sync` tiap 5 detik.
- **Pergantian tahun:** tombol “Majukan 1 tahun” memulai voting; semua pemain online harus setuju (satu penolakan membatalkan, batas 60 dtk, sendirian = langsung maju). Hanya admin UN yang dapat memaksa.
- **3D:** globe 3D (`web/globe.js`) dan halaman “Negara 3D” (`web/country3d.js`): bentuk & luas dari batas negara asli (proyeksi luas-sama), permukaan relief 3D atau peta biasa, tile OSM/Mapbox (jalan, label) dimuat saat di-zoom.
- **Frontend:** statis di `web/` (Leaflet + OpenStreetMap, Mapbox opsional lewat admin, ikon Lucide, bendera emoji).

## Menjalankan frontend
```bash
cd cm/web && python3 -m http.server 8080
```
Tambahkan URL situs (mis. `http://localhost:8080/`) ke **Authentication → URL Configuration → Redirect URLs** di Supabase agar login Google kembali ke aplikasi.

## Menjadikan akun admin UN
Admin ditentukan tabel `cm_admins` (kosong secara bawaan). Tambahkan email owner:
```sql
insert into public.cm_admins (email) values ('email-owner@contoh.com');
```

## Catatan
- Klaim presiden terikat sesi tab (ID acak di memori), lepas otomatis saat tab ditutup/dimuat ulang (+ TTL 45 dtk tanpa heartbeat).
- Dataset ±245 negara/teritori dihasilkan `tools/gen-data.mjs` (nilai awal simulasi, dunia mulai 1980).
- Mesin simulasi murni: `supabase/functions/cm-api/engine.ts`. Salinan di repo ini sedikit berbeda secara kosmetik dari yang ter-deploy; versi ter-deploy adalah acuan.
