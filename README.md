# 🌍 country.7mit — Country Manager 3D

Game strategi 3D interaktif: jadilah **Presiden** dan pimpin negaramu selama 2 periode (10 tahun).

## Menjalankan
Butuh server statis (ES modules + tekstur):

```bash
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

## Fitur
- **Globe bumi realistis**: tekstur siang/malam (lampu kota), awan, atmosfer, laut berkilau, bulan, satelit, bintang, rute dagang animasi.
- **Kota/negara 3D**: pulau prosedural, 16 jenis bangunan 3 level (pabrik berasap, turbin berputar, pesawat lepas landas, kapal & crane pelabuhan, kereta cepat, mobil, dll), crane konstruksi, siang-malam, lampu & jendela menyala, cuaca (hujan), kabut polusi, pemadaman listrik, kembang api.
- **Simulasi**: 20 negara nyata, ekonomi (PDB, pajak, utang, inflasi, pengangguran), 7 sektor anggaran, energi & polusi, korupsi, kepuasan rakyat, 8 kebijakan nasional.
- **Diplomasi**: hubungan, dagang, aliansi, sanksi, bantuan, konflik perbatasan.
- **Event acak** dengan keputusan (bencana, krisis, skandal, peluang), **pemilu** tiap 5 tahun, skor & grade akhir, simpan/lanjutkan.

## Kontrol
Klik plot untuk membangun/upgrade • seret = putar • scroll = zoom • `Spasi` jeda • `1/2/3` kecepatan • `M` globe • `Esc` batal.

## Kredit
three.js (MIT). Tekstur bumi dari contoh resmi three.js (NASA Blue Marble, domain publik).
