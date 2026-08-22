import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "out");
const port = Number(process.env.PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".whl": "application/octet-stream",
  ".zip": "application/zip",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".py": "text/x-python; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (reqPath.endsWith("/")) reqPath += "index.html";
  let filePath = path.join(root, reqPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const fallback = path.join(root, reqPath + ".html");
      fs.readFile(fallback, (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`static server serving ${root} on http://localhost:${port}`);
});
