import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://nearmatch.in/app/ rather than a subdomain. That is a
// constraint, not a preference: the create-razorpay-order Edge Function pins
// Access-Control-Allow-Origin to exactly https://nearmatch.in, so anything on
// app.nearmatch.in could never call checkout. Sharing the origin with the
// marketing site keeps that working and leaves website/ untouched at the
// document root.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    // No production sourcemap: it is 2.5 MB against a ~450 kB bundle, and
    // this site is deployed to shared hosting whose bandwidth allowance has
    // already been exhausted once by a large asset.
    sourcemap: false,
  },
});
