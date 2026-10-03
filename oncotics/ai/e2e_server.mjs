// Static server for the Workbench end-to-end tests. Sends the same isolation headers as the
// production .htaccess (COOP same-origin; COEP credentialless on /imaging, /assets/ort, /assets/ohif)
// so the 3D models run multi-threaded as they do on oncotics.com.
// Usage: node e2e_server.mjs <root dir> <port>
import http from 'http';
import fs from 'fs';
import path from 'path';
const [root, port] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const base = path.resolve(root);
  let p = path.resolve(base, '.' + decodeURIComponent(u.pathname));
  if (p !== base && !p.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  const h = { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin' };
  if (/^\/(imaging|assets\/ohif|assets\/ort)(\/|$)/.test(u.pathname)) h['Cross-Origin-Embedder-Policy'] = 'credentialless';
  res.writeHead(200, h); fs.createReadStream(p).pipe(res);
}).listen(Number(port), '127.0.0.1');
