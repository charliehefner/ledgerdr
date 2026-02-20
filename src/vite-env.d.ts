/// <reference types="vite/client" />

// File System Access API (non-standard, Chromium-based browsers)
interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | { type: string; data?: BufferSource | Blob | string; position?: number; size?: number }): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

interface ShowSaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

interface Window {
  showSaveFilePicker?(options?: ShowSaveFilePickerOptions): Promise<FileSystemFileHandle>;
}

// jspdf-autotable module augmentation
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}
