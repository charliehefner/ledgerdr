
# Driver Fueling Portal Implementation Plan

## Overview
This plan implements a mobile-optimized fueling portal for tractor drivers with QR scanning, AI-powered meter reading extraction, offline support with automatic synchronization, and fallback mechanisms for various Android browsers.

## Key Requirements Confirmed

| Requirement | Implementation |
|-------------|----------------|
| Tank pump validation (±0.2 tolerance) | Validate initial pump reading matches last final reading within 0.2 gallons |
| QR codes sync with existing data | Generate from existing `fuel_equipment` and `fuel_tanks` tables |
| Physical input by Supervisor/Management/Admin | Existing fuel recording UI remains fully functional |
| Fallback if portal fails | Existing workflow unchanged - driver portal is additive |
| Auto-generate QR on new equipment | Post-save dialog offers immediate QR download |
| Regenerate QR codes | Settings page for all QR operations |
| New "driver" role | Limited to `/driver-portal` route only |
| Offline support | IndexedDB queue with auto-sync when online |
| Android browser fallbacks | File upload fallback for QR, native camera input for photos |

---

## Architecture Overview

```text
+-------------------+     +--------------------+     +-------------------+
|   Driver Portal   |     |  Existing Fuel UI  |     |  QR Code Manager  |
|  (Mobile/Offline) |     |  (Desktop/Manual)  |     |  (Admin/Settings) |
+-------------------+     +--------------------+     +-------------------+
         |                         |                         |
         v                         v                         v
+------------------------------------------------------------------------+
|                        fuel_transactions table                          |
|  + submitted_by (driver user ID)                                        |
|  + submission_source ('portal' | 'manual')                              |
+------------------------------------------------------------------------+
         |
         v
+-------------------+     +-------------------+
|   fuel_tanks      |     |  fuel_equipment   |
| + last_pump_end   |     | (tractors)        |
+-------------------+     +-------------------+
```

---

## Phase 1: Database Schema Changes

### 1.1 Add "driver" to app_role enum
```sql
ALTER TYPE public.app_role ADD VALUE 'driver';
```

### 1.2 Add last_pump_end_reading to fuel_tanks
Track the last pump end reading for validation:
```sql
ALTER TABLE public.fuel_tanks 
ADD COLUMN last_pump_end_reading NUMERIC DEFAULT 0;
```

### 1.3 Create trigger to update last_pump_end_reading
Automatically maintain the last pump reading:
```sql
CREATE OR REPLACE FUNCTION update_tank_last_pump_reading()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'dispense' AND NEW.pump_end_reading IS NOT NULL THEN
    UPDATE fuel_tanks 
    SET last_pump_end_reading = NEW.pump_end_reading
    WHERE id = NEW.tank_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tank_pump_reading
AFTER INSERT ON fuel_transactions
FOR EACH ROW EXECUTE FUNCTION update_tank_last_pump_reading();
```

### 1.4 Add tracking columns to fuel_transactions
```sql
ALTER TABLE public.fuel_transactions 
ADD COLUMN submitted_by UUID,
ADD COLUMN submission_source TEXT DEFAULT 'manual';
```

### 1.5 Create pending submissions table for photo cleanup
```sql
CREATE TABLE public.pending_fuel_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fuel_transaction_id UUID REFERENCES fuel_transactions(id) ON DELETE CASCADE,
    photos JSONB,
    submitted_by UUID,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '48 hours')
);
```

### 1.6 Backfill last_pump_end_reading from existing data
```sql
UPDATE fuel_tanks t
SET last_pump_end_reading = COALESCE((
  SELECT pump_end_reading 
  FROM fuel_transactions ft
  WHERE ft.tank_id = t.id 
    AND ft.transaction_type = 'dispense'
    AND ft.pump_end_reading IS NOT NULL
  ORDER BY transaction_date DESC, created_at DESC
  LIMIT 1
), 0);
```

### 1.7 Create storage bucket for temporary fuel photos
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-photos', 'fuel-photos', false);
```

---

## Phase 2: Driver Role and Permissions

### 2.1 Update permissions.ts
Add "driver" to the UserRole type and create dedicated portal section:

- Driver role can ONLY access `/driver-portal`
- Cannot see sidebar navigation (dedicated minimal UI)
- Default route: `/driver-portal`

### 2.2 RLS Policies for Drivers
Drivers can:
- SELECT from `fuel_equipment` (tractors only) - to get current hour meter
- SELECT from `fuel_tanks` (agriculture only) - to get last pump reading
- INSERT into `fuel_transactions` (dispense type only)
- INSERT into `pending_fuel_submissions`

---

## Phase 3: QR Code System

### 3.1 QR Code Content Structure
Minimal data in QR - fetch real-time info from database:

**Tractors:**
```json
{"t":"tractor","id":"uuid-here"}
```

**Tanks:**
```json
{"t":"tank","id":"uuid-here"}
```

### 3.2 New Settings Tab: QR Codes
Add a "QR Codes" tab in Settings page (admin only):

Features:
- View all tractors and tanks with QR code previews
- Individual QR code download (PNG)
- Batch print (PDF with multiple QR codes per page, labels included)
- Filter by type (tractors/tanks)
- Regenerate button for each item (same QR, reprint)

### 3.3 Auto-Generate QR on New Equipment
After successfully adding a tractor or tank:
- Show success dialog with option to download QR code immediately
- Update `TractorsView.tsx` mutation success handler
- Update `FuelTanksView.tsx` mutation success handler

### 3.4 Libraries Required
- `qrcode.react` - React component for QR code rendering
- `jsPDF` (already installed) - PDF generation for batch printing

---

## Phase 4: Driver Portal UI

### 4.1 New Route and Page
- Route: `/driver-portal`
- Component: `src/pages/DriverPortal.tsx`
- Minimal layout (no sidebar, mobile-optimized)

### 4.2 Workflow Steps

**Step 1: Scan/Select Tractor**
- Primary: Camera QR scan using `html5-qrcode`
- Fallback: File upload to scan QR from photo
- Fallback: Manual dropdown selection (searchable)
- Display: Tractor name and current hour meter

**Step 2: Capture/Enter Hour Meter**
- Primary: Photo capture with AI extraction
- Fallback: Manual numeric input
- Validation: Reject if value < current hour meter
- Show previous reading for reference

**Step 3: Scan/Select Tank**
- Same pattern as tractor (QR/file/manual)
- Display: Tank name and expected pump start reading

**Step 4: Capture/Enter Pump Start**
- Photo or manual input
- Validation: Must be within ±0.2 of tank's `last_pump_end_reading`
- Clear error message if validation fails

**Step 5: Capture/Enter Pump End**
- Photo or manual input
- Calculate gallons dispensed

**Step 6: Review and Submit**
- Summary of all data
- Photos displayed (if captured)
- Submit button (queues locally if offline)

### 4.3 Mobile Optimization
- Large touch targets (minimum 44px)
- High-contrast colors for outdoor visibility
- Progress indicator showing current step
- Back button to correct previous entries
- Simple Spanish UI

---

## Phase 5: Android Browser Fallback Mechanisms

### 5.1 Camera/QR Scanning Fallbacks

**Detection on portal load:**
```typescript
const capabilities = {
  hasMediaDevices: !!navigator.mediaDevices,
  hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
  isSecureContext: window.isSecureContext
};
```

**Fallback Strategy:**
1. **Preferred**: Live camera QR scanning via `html5-qrcode`
2. **If camera denied/unavailable**: File input for QR image upload
3. **Final fallback**: Manual ID entry via searchable dropdown

### 5.2 Photo Capture Fallbacks

**Primary approach:**
```html
<input type="file" accept="image/*" capture="environment" />
```
This triggers the native camera app on Android, which works in all browsers.

**If native camera not available:**
- Allow gallery selection as alternative
- Manual numeric entry always available

### 5.3 Compatibility Check Component
On portal load, show brief capability check:
- Green checkmark if full camera support
- Yellow warning if using fallback mode
- Clear instructions for the user

---

## Phase 6: AI Image Analysis

### 6.1 Edge Function: analyze-meter-image
Uses Lovable AI (google/gemini-2.5-flash) for meter reading extraction.

**Request:**
```json
{
  "image": "base64-data",
  "meterType": "hour_meter" | "fuel_pump",
  "previousValue": 1234.5,
  "equipmentName": "John Deere 6215R"
}
```

**Response:**
```json
{
  "extractedValue": 1245.7,
  "confidence": "high" | "medium" | "low",
  "validationResult": "valid" | "below_previous" | "unrealistic_jump"
}
```

### 6.2 Validation Logic
- Hour meter: Must be ≥ previous value
- Pump reading: Reasonable range check (not >1000 gallons from previous)
- Low confidence triggers manual confirmation prompt

---

## Phase 7: Offline Support

### 7.1 Local Storage (IndexedDB)
Using `idb` library for type-safe IndexedDB access:

```typescript
interface PendingSubmission {
  id: string;
  tractorId: string;
  tractorName: string;
  tankId: string;
  tankName: string;
  hourMeterReading: number;
  pumpStartReading: number;
  pumpEndReading: number;
  gallons: number;
  photos: {
    hourMeter?: string;    // compressed base64
    pumpStart?: string;
    pumpEnd?: string;
  };
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'failed';
  retryCount: number;
}
```

### 7.2 Auto-Sync Mechanism
- Monitor `navigator.onLine` for connectivity changes
- On reconnection, process pending queue automatically
- Show sync status indicator in portal UI
- Retry failed syncs with exponential backoff (max 3 retries)
- After successful sync, photo uploaded to temp storage

### 7.3 Offline UI Indicators
- Banner showing "Offline Mode - Data will sync when connected"
- Badge showing number of pending submissions
- Last successful sync timestamp

---

## Phase 8: Photo Retention and Cleanup

### 8.1 Temporary Storage
- Photos uploaded to `fuel-photos` bucket after successful sync
- Path format: `temp/{transaction_id}/{photo_type}.jpg`

### 8.2 Scheduled Cleanup Function
Edge function `cleanup-fuel-photos` runs daily:
- Query `pending_fuel_submissions` where `expires_at < now()`
- Delete associated photos from storage
- Delete the pending submission record

---

## New Files Summary

### Pages
| File | Purpose |
|------|---------|
| `src/pages/DriverPortal.tsx` | Main driver fueling workflow |

### Components
| File | Purpose |
|------|---------|
| `src/components/driver/QRScanner.tsx` | Camera/file QR scanner with fallbacks |
| `src/components/driver/MeterPhotoCapture.tsx` | Photo capture with native camera fallback |
| `src/components/driver/FuelingWizard.tsx` | Step-by-step wizard UI |
| `src/components/driver/OfflineIndicator.tsx` | Connection status display |
| `src/components/driver/ManualEntryFallback.tsx` | Searchable dropdown for manual selection |
| `src/components/qr/QRCodeCard.tsx` | Individual QR code display with download |
| `src/components/qr/QRCodeBatchPrint.tsx` | PDF batch generation |
| `src/components/settings/QRCodeManager.tsx` | Settings tab for QR management |

### Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useOfflineQueue.ts` | IndexedDB queue management |
| `src/hooks/useOnlineStatus.ts` | Network connectivity monitoring |
| `src/hooks/useCameraCapabilities.ts` | Detect camera/QR support |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/analyze-meter-image/index.ts` | AI image analysis |
| `supabase/functions/sync-fuel-submission/index.ts` | Process offline submissions |
| `supabase/functions/cleanup-fuel-photos/index.ts` | Scheduled photo cleanup |

### Libraries to Add
| Package | Purpose |
|---------|---------|
| `qrcode.react` | QR code rendering |
| `html5-qrcode` | QR code scanning from camera |
| `idb` | IndexedDB wrapper for offline storage |

---

## Existing Form Validation Updates

### Add ±0.2 pump reading validation to existing forms

Update `AgricultureFuelView.tsx` and `IndustryFuelView.tsx`:
- Fetch tank's `last_pump_end_reading` when tank is selected
- Validate pump start reading is within ±0.2 gallons
- Show clear error if validation fails

---

## Implementation Order

1. Database schema changes (driver role, last_pump_end_reading, triggers)
2. Permission system updates (add driver role)
3. QR code generation components and Settings tab
4. Auto-generate QR on new equipment dialogs
5. Driver portal basic UI and routing
6. QR scanning with file upload fallback
7. Photo capture with native camera input
8. AI meter extraction edge function
9. Pump reading validation (±0.2) in existing forms
10. Offline queue with IndexedDB
11. Auto-sync mechanism
12. Photo cleanup scheduled function

---

## Technical Details

### QR Scanning with Fallbacks
```typescript
// Try camera first, fall back to file input
const QRScanner = ({ onScan, onManualSelect }) => {
  const [mode, setMode] = useState<'camera' | 'file' | 'manual'>('camera');
  
  // Check capabilities on mount
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode('file');
    }
  }, []);
  
  // Render appropriate input based on mode
};
```

### Native Camera Fallback
```html
<!-- Works on ALL Android browsers -->
<input 
  type="file" 
  accept="image/*" 
  capture="environment"
  onChange={handlePhotoCapture}
/>
```

### Offline Queue Hook
```typescript
export function useOfflineQueue() {
  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Sync when coming online
  useEffect(() => {
    if (isOnline && pending.length > 0) {
      syncPendingSubmissions();
    }
  }, [isOnline]);
  
  return { pending, addSubmission, isOnline };
}
```

---

## Security Considerations

1. **Driver RLS**: INSERT-only for fuel transactions
2. **Hour Meter Validation**: Server-side rejection if < previous
3. **Pump Reading Validation**: Server-side ±0.2 tolerance check
4. **Photo Access**: Temporary signed URLs, 48-hour expiry
5. **QR Security**: UUIDs only, real data fetched from authenticated DB queries
