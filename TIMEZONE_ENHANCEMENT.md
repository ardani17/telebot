# Indonesia Multiple Timezone Enhancement

## Current State: ✅ Server Timezone Independent

Kode saat ini **SUDAH** timezone independent - akan bekerja konsisten di server manapun (US, German, Singapore, etc.)

## Enhancement: Multiple Indonesia Timezone Support

### Current Implementation (WIB Only):
```typescript
// Hardcode WIB (UTC+7)
const utcDate = new Date(Date.UTC(year, month, day, hours - 7, minutes));
```

### Enhanced Implementation (WIB/WITA/WIT Support):
```typescript
private customDateParser(dateString: string, timezone: 'WIB' | 'WITA' | 'WIT' = 'WIB'): Date | null {
  const parts = dateString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!parts) return null;

  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1;
  const day = parseInt(parts[3], 10);
  const hours = parseInt(parts[4], 10);
  const minutes = parseInt(parts[5], 10);

  // Support multiple Indonesia timezones
  const timezoneOffsets = {
    'WIB': 7,  // Jakarta, Sumatra, Java
    'WITA': 8, // Makassar, Bali, Lombok
    'WIT': 9   // Jayapura, Papua
  };

  const offset = timezoneOffsets[timezone];
  const utcDate = new Date(Date.UTC(year, month, day, hours - offset, minutes));
  
  return utcDate;
}
```

### Usage Enhancement:
```typescript
// Extended command: /set_time 2024-06-28 14:00 WITA
// Default: /set_time 2024-06-28 14:00 (assume WIB)

async handleSetTime(ctx: GeotagsContext, timeString?: string) {
  // Parse: "2024-06-28 14:00 WITA" or "2024-06-28 14:00"
  const parts = timeString.match(/^(.+?)(?:\s+(WIB|WITA|WIT))?$/);
  const dateTimeStr = parts[1];
  const timezone = (parts[2] as 'WIB' | 'WITA' | 'WIT') || 'WIB';
  
  const parsedDate = this.customDateParser(dateTimeStr, timezone);
  // ...
}
```

## Testing Multiple Timezones:

| Input | Timezone | Expected Output |
|-------|----------|-----------------|
| `/set_time 2024-06-28 14:00` | WIB (default) | `02:00 PM` |
| `/set_time 2024-06-28 14:00 WIB` | WIB | `02:00 PM` |
| `/set_time 2024-06-28 14:00 WITA` | WITA | `02:00 PM WITA` |
| `/set_time 2024-06-28 14:00 WIT` | WIT | `02:00 PM WIT` |

## Implementation Priority:

**LOW PRIORITY** - Most users use WIB (Jakarta time). Current implementation sudah sufficient untuk 90% use cases. 