
# Multi-Recipient Telegram Alert Routing

## 1. Database Migration
Create a `telegram_recipients` table:
- `id` (uuid PK)
- `chat_id` (text, not null)
- `label` (text) — e.g. "Juan Personal", "Operations Group"
- `categories` (text[]) — e.g. `{'operations','finance','maintenance','all'}`
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

RLS: admin-only access.

Migrate existing chat ID from `notification_settings` into the new table.

## 2. Update Edge Function (`send-telegram`)
- Add a `category` parameter (optional, defaults to `'all'`)
- Query `telegram_recipients` to find all active recipients matching the category or `'all'`
- Send to each matching recipient
- Keep backward compatibility (if `chat_id` is passed directly, send to that one)

## 3. Update Settings UI (`TelegramSettings.tsx`)
- Show a list of recipients with label, chat ID, categories, and active toggle
- Add/remove recipients
- Discover chat ID still works (fills into "add" form)
- Test message per recipient
- Category checkboxes: `operations`, `finance`, `maintenance`, `equipment`, `inventory`, `hr`, `all`

## 4. Update Operation Trigger
- Pass `category: 'operations'` when invoking send-telegram for new operations (currently in the operations code)

## Categories
- `all` — receives everything
- `operations` — new field operations
- `finance` — transactions, payments, AP/AR
- `maintenance` — equipment alerts
- `inventory` — stock alerts
- `hr` — payroll, employee alerts
