#!/usr/bin/env node
/**
 * Serves the app over HTTPS on the LAN so phone browsers allow the camera.
 * HTTP Next.js runs on 127.0.0.1:3000; this proxy listens on 0.0.0.0:3443.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";
import selfsigned from "selfsigned";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const certDir = path.join(root, ".certs");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");
const HTTP_PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const CERT_DOWNLOAD_PORT = Number(process.env.CERT_DOWNLOAD_PORT || 8080);
const CERT_DOWNLOAD_PATH = "/lan-cert.pem";
const mode = process.argv[2] === "dev" ? "dev" : "start";

/**
 * Serves just the CA cert over plain HTTP (no TLS, so no browser warning)
 * so phones can download + install it before they trust the HTTPS port.
 * iOS: opening this URL in Safari triggers "Install Profile" automatically
 * because of the content-type.
 */
function serveCertDownload(certPem, port) {
  const server = http.createServer((req, res) => {
    if (req.url !== CERT_DOWNLOAD_PATH) {
      res.writeHead(404);
      res.end("Not found. Use " + CERT_DOWNLOAD_PATH);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/x-x509-ca-cert",
      "Content-Disposition": "attachment; filename=magazin-dev.pem",
      "Content-Length": Buffer.byteLength(certPem),
    });
    res.end(certPem);
  });
  server.listen(port, "0.0.0.0");
  return server;
}

// VPN/tunnel adapter names (NordVPN, ExpressVPN, WireGuard, etc.) so the
// phone-facing URL doesn't end up pointing at a tunnel address that's
// unreachable from the phone's actual WiFi network.
const VPN_ADAPTER_PATTERN =
  /vpn|tun\d|tap-|nordlynx|wireguard|zerotier|tailscale|utun/i;

function getLanIps() {
  const candidates = [];
  for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      candidates.push({ name, address: iface.address });
    }
  }

  // Real network adapters (Ethernet/WiFi) first, VPN/tunnel adapters last —
  // the first entry is used as *the* URL we tell the phone to open.
  candidates.sort((a, b) => {
    const aVpn = VPN_ADAPTER_PATTERN.test(a.name) ? 1 : 0;
    const bVpn = VPN_ADAPTER_PATTERN.test(b.name) ? 1 : 0;
    return aVpn - bVpn;
  });

  const ips = new Set(["127.0.0.1", ...candidates.map((c) => c.address)]);
  return [...ips];
}

async function ensureCerts(ips) {
  fs.mkdirSync(certDir, { recursive: true });
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  const pems = await selfsigned.generate(
    [{ name: "commonName", value: "magazin-dev" }],
    {
      days: 825,
      keySize: 2048,
      extensions: [
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" },
            ...ips.map((ip) => ({ type: 7, ip })),
          ],
        },
      ],
    },
  );

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

function runNext(appUrl, lanIps) {
  const cmd = mode === "dev" ? "dev" : "start";
  const args =
    mode === "dev"
      ? [nextBin, cmd, "--webpack", "-p", String(HTTP_PORT), "-H", "127.0.0.1"]
      : [nextBin, cmd, "-p", String(HTTP_PORT), "-H", "127.0.0.1"];
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: appUrl,
      APP_URL: appUrl,
      SESSION_COOKIE_SECURE: "true",
      ALLOWED_DEV_ORIGINS: lanIps.join(","),
    },
  });

  child.on("exit", (code) => process.exit(code ?? 1));
  return child;
}

function waitForHttp() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 120_000;

    const tick = () => {
      const req = http.get(`http://127.0.0.1:${HTTP_PORT}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Next.js did not start on port ${HTTP_PORT}`));
          return;
        }
        setTimeout(tick, 500);
      });
    };

    tick();
  });
}

async function main() {
  const ips = getLanIps();
  const lanIp = ips.find((ip) => ip !== "127.0.0.1");
  const appUrl = `https://${lanIp ?? "localhost"}:${HTTPS_PORT}`;
  const certs = await ensureCerts(ips);

  const nextProc = runNext(appUrl, ips.filter((ip) => ip !== "127.0.0.1"));
  const certDownloadServer = serveCertDownload(certs.cert, CERT_DOWNLOAD_PORT);

  const shutdown = () => {
    nextProc.kill();
    certDownloadServer.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await waitForHttp();

  const proxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${HTTP_PORT}`,
    ws: true,
    xfwd: true,
  });

  proxy.on("proxyReq", (proxyReq, req) => {
    proxyReq.setHeader("X-Forwarded-Proto", "https");
    if (req.headers.host) {
      proxyReq.setHeader("X-Forwarded-Host", req.headers.host);
      const port = String(HTTPS_PORT);
      if (!req.headers.host.includes(":")) {
        proxyReq.setHeader("X-Forwarded-Port", port);
      }
    }
  });

  const server = https.createServer(certs, (req, res) => {
    if (req.url === CERT_DOWNLOAD_PATH) {
      res.writeHead(200, {
        "Content-Type": "application/x-x509-ca-cert",
        "Content-Disposition": "attachment; filename=magazin-dev.pem",
        "Content-Length": Buffer.byteLength(certs.cert),
      });
      res.end(certs.cert);
      return;
    }
    proxy.web(req, res, (err) => {
      console.error("Proxy error:", err);
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end("Bad gateway");
    });
  });

  server.on("upgrade", (req, socket, head) => {
    proxy.ws(req, socket, head, (err) => {
      if (err) {
        socket.destroy();
      }
    });
  });

  server.listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log("");
    console.log("HTTPS ready — open on your phone:");
    if (lanIp) {
      console.log(`  https://${lanIp}:${HTTPS_PORT}`);
    }
    console.log(`  https://localhost:${HTTPS_PORT}`);
    console.log("");
    console.log("First visit: tap Advanced → proceed past the certificate warning.");
    console.log("Then open Scan and tap Start camera.");
    console.log("");
    console.log(
      "iPhone install-to-Home-Screen + push notifications need the cert FULLY",
    );
    console.log("trusted (not just clicked past). One-time setup on the phone:");
    if (lanIp) {
      console.log(`  1. In Safari, open: http://${lanIp}:${CERT_DOWNLOAD_PORT}${CERT_DOWNLOAD_PATH}`);
    }
    console.log('     (plain http:// — no warning, downloads the cert)');
    console.log('  2. Tap "Allow" when asked to open Settings to view the profile.');
    console.log('  3. In Settings, tap "Profile Downloaded" near the top, then Install');
    console.log("     (enter passcode, tap Install twice more).");
    console.log(
      "  4. Settings → General → About → Certificate Trust Settings → turn on",
    );
    console.log('     full trust for "magazin-dev" (only appears after step 3).');
    console.log(
      "  5. Now open the https:// URL above again — no warning, and Add to",
    );
    console.log("     Home Screen / notifications will work like a real site.");
    console.log("");
    if (mode === "start") {
      console.log("Tip: run npm run build before start:lan if you changed the app.");
    }
    console.log("");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
