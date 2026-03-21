

## Plan: Switch Help System to PDF and Insert Spanish Operations Chapter

### What Changes

1. **Modify `HelpPanelButton.tsx`** — Switch from markdown rendering to PDF display via `<iframe>`. The component will:
   - Change file path from `.md` to `.pdf`
   - Replace `ReactMarkdown` with an `<iframe>` using the browser's built-in PDF viewer
   - Use a `HEAD` request to check file existence (for "coming soon" fallback)
   - Update download link to point to PDF
   - Remove `react-markdown` import

2. **Remove `react-markdown` dependency** from `package.json`

3. **Copy uploaded PDF** — Place `cap5_operaciones.pdf` at `public/help/es/14-operations.pdf`

4. **Keep English markdown** — Convert existing `public/help/en/14-operations.md` to remain as-is for now (or delete it since there's no English PDF yet; the "coming soon" fallback will show)

5. **Delete old Spanish markdown** — Remove `public/help/es/14-operations.md`

### Technical Details

The iframe approach in `HelpPanelButton.tsx`:

```tsx
// Existence check via HEAD request
fetch(filePath, { method: 'HEAD' })
  .then(res => { if (!res.ok) throw new Error(); setExists(true); })
  .catch(() => setNotFound(true))

// Render
<iframe src={filePath} className="w-full h-[calc(100vh-8rem)] border-0 rounded" />
```

The panel width (`sm:max-w-lg md:max-w-xl`) will be widened to `sm:max-w-xl md:max-w-2xl` for better PDF readability.

### Files Changed

| File | Change |
|------|--------|
| `src/components/layout/HelpPanelButton.tsx` | Switch from markdown to PDF iframe |
| `package.json` | Remove `react-markdown` |
| `public/help/es/14-operations.pdf` | New — uploaded PDF |
| `public/help/es/14-operations.md` | Delete |
| `public/help/en/14-operations.md` | Delete (will show "coming soon" until English PDF provided) |

