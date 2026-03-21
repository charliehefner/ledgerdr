

## Plan: Fix Chrome PDF Blocking in Help Panel

### Problem

Chrome blocks PDF rendering inside `<iframe>` elements in certain contexts (particularly within Sheet/dialog overlays). This is a known Chrome behavior with embedded PDFs.

### Solution

Replace the direct `<iframe src="file.pdf">` approach with a **blob URL** strategy: fetch the PDF as a binary blob, create a local object URL, and render that in the iframe. This bypasses Chrome's PDF iframe restrictions because the browser treats blob URLs as same-origin content.

### Technical Details

In `HelpPanelButton.tsx`:

1. **Replace the HEAD check + iframe** with a single `fetch()` that downloads the full PDF
2. Create a blob URL via `URL.createObjectURL(blob)`
3. Use that blob URL as the iframe `src`
4. Clean up the blob URL on close via `URL.revokeObjectURL()`

```tsx
// Fetch PDF as blob
fetch(filePath)
  .then(res => {
    if (!res.ok) throw new Error();
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error();
    return res.blob();
  })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
  })
  .catch(() => setNotFound(true));

// Render with blob URL
<iframe src={blobUrl} ... />

// Cleanup on close
useEffect(() => {
  return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
}, [blobUrl]);
```

### Files Changed

| File | Change |
|------|--------|
| `src/components/layout/HelpPanelButton.tsx` | Switch from direct PDF URL to blob URL approach |

