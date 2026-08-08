import React from 'react';
import { vexo } from 'vexo-analytics';

// Initialize Vexo at the root level, outside of any component
// Recommended to wrap in production-only check
if (__DEV__ === false) {
  vexo('8facfbf4-0055-4782-9e17-c3c9728a6025');
}

export default function App() {
  // Component content here
  return (
    // existing content of App.js (not provided in repo files)
    null
  );
}
