

# Telegram Setup — Get Chat ID & Send Infrastructure

## What's Done
- Telegram connector is linked and `TELEGRAM_API_KEY` secret is stored.

## What We'll Build

### 1. Edge Function: `send-telegram`
A reusable function that accepts `{ chat_id, message }` and sends via the Telegram gateway. Also supports a `{ action: "getUpdates" }` mode to discover your chat ID from the message you already sent.

### 2. Settings UI: Telegram Section
A new "Telegram" tab in Settings with:
- A **"Discover Chat ID"** button that calls the edge function's getUpdates mode, finds your message, and auto-fills the chat ID field.
- A text input showing/storing the chat ID.
- A **"Send Test Message"** button to confirm it works.
- Saves the chat ID to a `notification_settings` table.

### 3. Database Migration
```sql
CREATE TABLE notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
-- Admin-only policies
```

## How You'll Get the Chat ID
1. Open Settings → Telegram tab.
2. Click "Discover Chat ID" — the system reads the message you already sent to the bot and extracts the chat ID automatically.
3. Click "Send Test Message" to verify.
4. Save. Done.

No manual lookup needed — the bot already has your message waiting.

## Technical Details

- Edge function uses the connector gateway pattern (`connector-gateway.lovable.dev/telegram/...`)
- Validates input with Zod
- Auth check via `supabase.auth.getUser()`
- Settings component added as a new tab in `Settings.tsx` (with the MessageCircle icon)

