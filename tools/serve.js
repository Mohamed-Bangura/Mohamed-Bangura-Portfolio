/* Minimal static file server.
   Run standalone:  node tools/serve.js [port]
   Or require it:   const { listen } = require('./serve'); await listen(4321);
   Used by the test tools so there is one implementation of the MIME map and
   the path-traversal guard. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  /* Refuse anything that escapes the project root. */
  const full = path.resolve(ROOT, '.' + path.sep + p.replace(/^[\\/]+/, ''));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null;
  return full;
}

function createServer() {
  return http.createServer((req, res) => {
    const file = resolveFile(req.url || '/');
    if (!file) {
      const notFound = path.join(ROOT, '404.html');
      if (fs.existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': MIME['.html'] });
        return fs.createReadStream(notFound).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': MIME['.txt'] });
      return res.end('404 Not Found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
}

function listen(port = 4321) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      console.log('Serving ' + ROOT + ' at http://localhost:' + port + '/');
      resolve(server);
    });
  });
}

module.exports = { createServer, listen, resolveFile, ROOT };

if (require.main === module) {
  listen(Number(process.argv[2]) || 4321).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
