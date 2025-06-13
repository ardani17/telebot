# Test Timezone Fix untuk Geotags Set Time

## 🐛 Bug yang Diperbaiki:

**Input**: `/set_time 2024-06-28 14:00` (14:00 = 2 PM dalam 24-hour format)  
**Bug Output**: `2024-06-28(Jum) 09:00 PM`  
**Expected Output**: `2024-06-28(Jum) 02:00 PM`

## 🔧 Root Cause:

1. **Double Timezone Conversion**: User input di-parse sebagai local server time, kemudian di-convert lagi ke Asia/Jakarta
2. **Server Timezone Issue**: Jika server running di UTC, maka:
   - Input `14:00` → parsed sebagai `14:00 UTC`
   - Formatted dengan Jakarta timezone → `21:00 WIB` → `09:00 PM`

## ✅ Solusi yang Diterapkan:

### 1. Fix Parser untuk Handle Indonesia Timezone
```typescript
// BEFORE: Parse sebagai local server time
const date = new Date(year, month, day, hours, minutes);

// AFTER: Parse sebagai Indonesia time (WIB = UTC+7)
const utcDate = new Date(Date.UTC(year, month, day, hours - 7, minutes));
```

### 2. Enhanced Logging untuk Debug
- Log input parsing
- Log UTC conversion
- Log final formatting

### 3. Better User Feedback
- Konfirmasi waktu dengan timezone yang jelas
- Format preview yang akurat

## 🧪 Test Cases:

### Test Case 1: Morning Time
```
Input: /set_time 2024-06-28 09:00
Expected Confirmation: "⏱️ Waktu manual diatur ke: Jumat, 28 Juni 2024 09.00 WIB"
Expected Geotag: "2024-06-28(Jum) 09:00 AM"
```

### Test Case 2: Afternoon Time (Original Bug)
```
Input: /set_time 2024-06-28 14:00
Expected Confirmation: "⏱️ Waktu manual diatur ke: Jumat, 28 Juni 2024 14.00 WIB"
Expected Geotag: "2024-06-28(Jum) 02:00 PM"
```

### Test Case 3: Evening Time
```
Input: /set_time 2024-06-28 21:30
Expected Confirmation: "⏱️ Waktu manual diatur ke: Jumat, 28 Juni 2024 21.30 WIB"
Expected Geotag: "2024-06-28(Jum) 09:30 PM"
```

### Test Case 4: Midnight
```
Input: /set_time 2024-06-28 00:00
Expected Confirmation: "⏱️ Waktu manual diatur ke: Jumat, 28 Juni 2024 00.00 WIB"
Expected Geotag: "2024-06-28(Jum) 12:00 AM"
```

## 📋 Testing Steps:

1. **Build & Deploy**:
   ```bash
   cd /home/teleweb/bot
   npm run build
   cd ..
   pm2 restart teleweb-bot
   ```

2. **Test via Telegram**:
   - Enter geotags mode: `/geotags`
   - Set custom time: `/set_time 2024-06-28 14:00`
   - Send a photo
   - Send location
   - Check geotag output

3. **Check Logs**:
   ```bash
   pm2 logs teleweb-bot --lines 50 | grep "Custom time set\|Formatted timestamp"
   ```

## 🔍 Expected Log Output:

```
info: Custom time set {
  "telegramId": "731289973",
  "input": "2024-06-28 14:00",
  "parsedUTC": "2024-06-28T07:00:00.000Z",
  "previewWIB": "Jumat, 28 Juni 2024 14.00"
}

info: Formatted timestamp result {
  "finalTimeStr": "02:00 PM",
  "finalDateTimeString": "2024-06-28(Jum) 02:00 PM"
}
```

## ✅ Success Criteria:

- [x] Parser creates correct UTC date with -7 hours offset
- [x] Confirmation message shows correct Indonesia time
- [x] Geotag displays correct 12-hour format
- [x] No more timezone shift bug
- [x] Logging provides clear debugging info 