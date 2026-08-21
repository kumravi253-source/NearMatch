// Node server for the nearmatch.in marketing site.
//
// The site itself is plain HTML/CSS in public/ — this wrapper exists so it
// can be deployed through a Node.js hosting flow. It reproduces, in Express,
// the three rules that were previously host config (.htaccess on Apache,
// _headers/_redirects on Netlify and Cloudflare Pages, vercel.json on Vercel):
// canonical apex host, HTTPS, and a long cache lifetime on /assets/*.

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
// In the built zip the site sits at ./public. Running this file straight out
// of the repo, it is ../../website. Resolving both means the local check
// exercises the same server the host will run.
const BUNDLED_DIR = path.join(__dirname, 'public');
const PUBLIC_DIR = fs.existsSync(BUNDLED_DIR)
  ? BUNDLED_DIR
  : path.join(__dirname, '..', '..', 'website');
const CANONICAL_HOST = 'nearmatch.in';

// Hostinger terminates TLS in front of the Node process, so the scheme has to
// come from the forwarded header rather than req.protocol.
app.set('trust proxy', true);

app.use((req, res, next) => {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const proto = req.headers['x-forwarded-proto'] || req.protocol;

  // Only redirect for hosts we recognise. A request arriving on the raw
  // container hostname during a platform health check must not be bounced to
  // the public domain, or the deploy is reported as failed.
  const isKnownHost = host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`;
  if (isKnownHost && (host !== CANONICAL_HOST || proto !== 'https')) {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }
  next();
});

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (path.relative(PUBLIC_DIR, filePath).startsWith('assets' + path.sep)) {
        // 30 days — the hero video is ~15 MB and is the single biggest driver
        // of egress on this site.
        res.setHeader('Cache-Control', 'public, max-age=2592000');
      }
    },
  })
);

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`nearmatch.in site listening on port ${PORT}`);
});
