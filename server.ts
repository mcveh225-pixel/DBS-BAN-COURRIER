import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { existsSync } from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Explicitly detect production
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = existsSync(distPath);
  const isProduction = process.env.NODE_ENV === "production" || hasDist;

  console.log(`[BOOT] Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`[BOOT] Dist exists: ${hasDist} at ${distPath}`);

  app.use(express.json());

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url} (isProd: ${isProduction})`);
    next();
  });

  // ==========================================
  // API ROUTES
  // ==========================================
  
  app.get("/ping", (req, res) => res.send("pong"));

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV,
      isProduction,
      hasDist,
      timestamp: new Date().toISOString()
    });
  });

  // Orange API Auth
  let orangeAccessToken: string | null = null;
  let tokenExpiry: number = 0;

  const getOrangeAccessToken = async () => {
    if (orangeAccessToken && Date.now() < tokenExpiry) return orangeAccessToken;

    const clientId = process.env.ORANGE_CLIENT_ID;
    const clientSecret = process.env.ORANGE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[ORANGE] Missing ID/Secret in ENV");
      return null;
    }

    try {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://api.orange.com/oauth/v3/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[ORANGE] Auth failed (${response.status}): ${errText}`);
        return null;
      }

      const data = await response.json() as any;
      orangeAccessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      return orangeAccessToken;
    } catch (e) {
      console.error("[ORANGE] Fetch error:", e);
      return null;
    }
  };

  app.get("/api/check-orange-config", async (req, res) => {
    console.log("[ORANGE] Checking config...");
    const token = await getOrangeAccessToken();
    res.json({
      senderSet: !!process.env.ORANGE_SENDER,
      tokenSuccess: !!token,
      sender: process.env.ORANGE_SENDER || 'NON_CONFIGURÉ',
      mode: process.env.NODE_ENV
    });
  });

  app.post("/api/send-sms", async (req, res) => {
    const { phone, message } = req.body;
    const token = await getOrangeAccessToken();
    const senderAddress = process.env.ORANGE_SENDER;

    if (!token || !senderAddress) {
      return res.status(500).json({ error: "Configuration Orange incomplète" });
    }

    try {
      let cleaned = phone.trim().replace(/[^\d+]/g, '');
      if (cleaned.length === 10 && !cleaned.startsWith('+')) cleaned = `+225${cleaned}`;
      else if (!cleaned.startsWith('+')) cleaned = `+${cleaned}`;
      
      const receiverHeader = `tel:${cleaned}`;
      const senderEncoded = encodeURIComponent(senderAddress);

      const response = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${senderEncoded}/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: [receiverHeader],
            senderAddress: senderAddress,
            outboundSMSTextMessage: { message }
          }
        })
      });

      if (response.ok) {
        res.json({ success: true });
      } else {
        const err = await response.json();
        console.error("[ORANGE] Send failed:", err);
        res.status(response.status).json({ error: "API Orange error", details: err });
      }
    } catch (e: any) {
      console.error("[ORANGE] Exception:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // STATIC SERVING
  // ==========================================

  if (isProduction && hasDist) {
    console.log("[SERVER] Serving production static files");
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Don't swallow API 404s
      if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: "API Route Not Found" });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log("[SERVER] Starting Vite development server");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[READY] Listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[CRITICAL] Server failed to start:", err);
});
