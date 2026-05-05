// No-op. Previous PWA build shipped a registerSW.js that registered /sw.js.
// We keep this file present (as a no-op) so any cached precache referencing
// it does not 404, while the actual /sw.js is now a self-unregistering
// kill-switch worker.
