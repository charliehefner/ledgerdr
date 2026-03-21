

## Plan: Replace iframe PDF with PDF.js Canvas Rendering

### Problem

Chrome's built-in PDF viewer plugin blocks PDF rendering inside iframes within Sheet/dialog overlays — even with blob URLs. This is a Chrome plugin limitation, not a same-origin issue.

### Solution

Use `react-pdf` (a React wrapper around Mozilla's PDF.js) to render PDF pages as canvas elements. This completely bypasses Chrome's native PDF plugin and works in all contexts.

### Technical Details

1. **Add dependency**: `react-pdf` (includes `pdfjs-dist`)

2. **Replace iframe** in `HelpPanelButton.tsx` with a `<Document>` + `<Page>` component from `react-pdf`:
   - Fetch PDF as before (blob URL)
   - Render all pages in a scrollable container
   - Each page rendered as a canvas element

3. **Configure PDF.js worker** using the CDN worker URL

```tsx
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Inside component:
const [numPages, setNumPages] = useState(0);

<Document file={blobUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
  {Array.from({ length: numPages }, (_, i) => (
    <Page key={i + 1} pageNumber={i + 1} width={containerWidth} />
  ))}
</Document>
```

### Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `react-pdf` dependency |
| `src/components/layout/HelpPanelButton.tsx` | Replace iframe with react-pdf Document/Page rendering in a scrollable container |

