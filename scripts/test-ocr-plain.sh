#!/bin/bash

# Quick OCR Plain Text Test Monitor
echo "=== MONITOR OCR PLAIN TEXT ==="
echo "Waktu: $(date)"
echo ""

LOG_FILE="/root/.pm2/logs/teleweb-bot-dev-out.log"

echo "🔍 MONITORING OCR PROCESSING:"
echo "────────────────────────────"

# Monitor recent OCR activities
echo "📊 OCR berhasil diproses (10 menit terakhir):"
grep "OCR processing successful" "$LOG_FILE" | tail -5

echo ""
echo "❌ Error kirim pesan (5 menit terakhir):"
grep "can't parse entities\|Error sending OCR" "$LOG_FILE" | tail -3

echo ""
echo "✅ OCR berhasil dikirim (5 menit terakhir):"
grep "OCR result sent successfully" "$LOG_FILE" | tail -3

echo ""
echo "🎯 SUMMARY SUCCESS RATE:"
echo "─────────────────────────"

RECENT_SUCCESS=$(grep "OCR result sent successfully" "$LOG_FILE" | wc -l)
RECENT_ERRORS=$(grep "Error sending OCR\|can't parse entities" "$LOG_FILE" | wc -l)
TOTAL_ATTEMPTS=$((RECENT_SUCCESS + RECENT_ERRORS))

echo "✅ Berhasil kirim: $RECENT_SUCCESS"
echo "❌ Gagal kirim: $RECENT_ERRORS"
echo "📈 Total attempts: $TOTAL_ATTEMPTS"

if [ $TOTAL_ATTEMPTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $RECENT_SUCCESS * 100 / $TOTAL_ATTEMPTS" | bc -l)
    echo "📊 Success rate: $SUCCESS_RATE%"
fi

echo ""
echo "=== MONITORING SELESAI ===" 