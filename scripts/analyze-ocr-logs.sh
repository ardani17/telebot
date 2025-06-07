#!/bin/bash

# OCR Log Analysis Script
# Analyzes OCR processing logs to identify success vs failure patterns

echo "=== ANALISIS LOG OCR ==="
echo "Tanggal: $(date)"
echo ""

LOG_FILE="/root/.pm2/logs/teleweb-bot-dev-out.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file tidak ditemukan: $LOG_FILE"
    exit 1
fi

echo "📊 RINGKASAN OCR PROCESSING:"
echo "─────────────────────────────"

# Count successful OCR
SUCCESS_COUNT=$(grep -c "OCR SUCCESS" "$LOG_FILE")
echo "✅ OCR Berhasil: $SUCCESS_COUNT"

# Count failed OCR
FAILED_COUNT=$(grep -c "OCR FAILED" "$LOG_FILE")
echo "❌ OCR Gagal: $FAILED_COUNT"

# Count total processing attempts
TOTAL_COUNT=$((SUCCESS_COUNT + FAILED_COUNT))
echo "📈 Total Percobaan: $TOTAL_COUNT"

if [ $TOTAL_COUNT -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $SUCCESS_COUNT * 100 / $TOTAL_COUNT" | bc -l)
    echo "📊 Success Rate: $SUCCESS_RATE%"
fi

echo ""
echo "🔍 ANALISIS KEGAGALAN:"
echo "─────────────────────────"

# Analyze failure reasons
echo "📏 Gambar terlalu kecil:"
grep -c "Image too small for OCR" "$LOG_FILE"

echo "📦 File terlalu kecil/rusak:"
grep -c "Image file too small, might be corrupted" "$LOG_FILE"

echo "📄 File terlalu besar:"
grep -c "Image file too large" "$LOG_FILE"

echo "🔍 Tidak ada teks terdeteksi:"
grep -c "No text detected in image" "$LOG_FILE"

echo "⚠️  Error API Google Vision:"
grep -c "Error performing OCR with Google Cloud Vision API" "$LOG_FILE"

echo ""
echo "📈 ANALISIS GAMBAR BERHASIL:"
echo "────────────────────────────"

echo "🏷️  Auto Language Detection berhasil:"
grep -c "auto language detection" "$LOG_FILE"

echo ""
echo "🔍 DETIL KEGAGALAN TERBARU (5 terakhir):"
echo "──────────────────────────────────────"

# Show recent failures with context
grep -A 2 -B 1 "OCR FAILED" "$LOG_FILE" | tail -15

echo ""
echo "✅ DETIL KEBERHASILAN TERBARU (3 terakhir):"
echo "───────────────────────────────────────"

# Show recent successes with context
grep -A 3 "OCR SUCCESS" "$LOG_FILE" | tail -12

echo ""
echo "📝 BAHASA YANG TERDETEKSI:"
echo "─────────────────────────"

# Extract detected languages from logs
grep "Bahasa terdeteksi:" "$LOG_FILE" | tail -5

echo ""
echo "🕒 PROCESSING TIME ANALYSIS:"
echo "───────────────────────────"

# Extract processing times
grep "processingTime" "$LOG_FILE" | tail -5 | sed 's/.*processingTime[^0-9]*\([0-9]*\)ms.*/\1ms/'

echo ""
echo "=== ANALISIS SELESAI ===" 