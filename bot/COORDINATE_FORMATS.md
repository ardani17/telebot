# Supported Coordinate Formats in OCR Handler

## Format Koordinat yang Didukung

OCR handler sekarang mendukung berbagai format koordinat untuk ekstraksi otomatis dari teks:

### 1. Format Decimal Standard
```
-7.251583, 112.7334
-7.251583,112.7334
-7.251583 112.7334
```

### 2. Format Lat/Long Explicit
```
Lat: -7.251583, Lon: 112.7334
Latitude -7.251583 Longitude 112.733387
Lat/Long: 7.260978°S, 112.721873°E
```

### 3. Format Direction dengan Spasi
```
7.16075264S 112.65048935E
7,258150S 112,745900E
```

### 4. Format Signed dengan Direction (BARU)
```
-7,1607S+112,5317E
-7.1607S+112.5317E
```

### 5. Format DMS (Degree-Minute-Second)
```
7°15'5" S 112°44'0" E
7° 15' 5" S 112° 44' 0" E
7°15'5.23" S 112°44'0.45" E
```

## Contoh OCR Text yang Didukung

### Format Baru (Update)
```
ng Gresik
mart Samir Plapan
Warkop
Omah Be
Google
EA 01
13/02/25 11.25
-7,1607S+112,5317E
Samirplapan
Kecamatan Duduksampeyan
Kabupaten Gresik
Jawa Timur
```

**Hasil Ekstraksi:**
- Decimal: `-7.1607,112.5317`
- DMS: `7°9'38" S 112°31'54" E`

## Prioritas Pemrosesan

1. **Lat/Long Explicit** (paling akurat)
2. **Decimal Direction** (termasuk format baru)
3. **Decimal Standard**
4. **DMS Format**

## Validasi Koordinat

- Latitude: -90° hingga 90°
- Longitude: -180° hingga 180°
- Validasi realisme geografis
- Filter untuk menghindari false positive (suhu, dsb)

## Fitur Khusus

- **Auto-format conversion**: Koma → titik untuk parsing
- **Direction handling**: S/W = negatif, N/E = positif
- **Sign preservation**: Format dengan tanda +/- dipertahankan
- **Comprehensive logging**: Untuk debugging dan monitoring 