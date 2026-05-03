# Firebase Data Map

This file is kept for continuity. The detailed inspected Realtime Database map is now in:

```text
docs/firebase-realtime-legacy-map.md
```

Key rule: Firebase Realtime Database remains active. New admin route edits write to `AdminRoutes`; legacy `Routes_Forward` and `Routes_Reverse` are read for compatibility and are not renamed or deleted.
