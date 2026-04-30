import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { existsSync } from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;

app.use(express.json());

// Logger
app.use((req, res, next) => {
  if (!isVercel) console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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
    isVercel,
    timestamp: new Date().toISOString()
  });
});

// Orange API Auth Logic
let orangeAccessToken: string | null = null;
let tokenExpiry: number = 0;

const getOrangeAccessToken = async () => {
  if (orangeAccessToken && Date.now() < tokenExpiry) return orangeAccessToken;

  const clientId = process.env.ORANGE_CLIENT_ID;
  const clientSecret = process.env.ORANGE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

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

    if (!response.ok) return null;

    const data = await response.json() as any;
    orangeAccessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    return orangeAccessToken;
  } catch (e) {
    return null;
  }
};

app.get("/api/check-orange-config", async (req, res) => {
  const token = await getOrangeAccessToken();
  res.json({
    senderSet: !!process.env.ORANGE_SENDER,
    tokenSuccess: !!token,
    sender: process.env.ORANGE_SENDER || 'NON_CONFIGURÉ'
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
      res.status(response.status).json({ error: "API Orange error", details: err });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// VITE / STATIC HANDLING (Local/AI Studio only)
// ==========================================

async function setupStatic() {
  if (isVercel) return; // Vercel handles static via vercel.json rewrites

  const buildPath = path.resolve(__dirname, 'build-prod');
  const hasBuild = existsSync(buildPath);

  if (process.env.NODE_ENV === "production" && hasBuild) {
    console.log("[SERVER] Production: serving static files");
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
      if (req.url.startsWith('/api/')) return res.status(404).json({ error: "API Not Found" });
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  } else {
    console.log("[SERVER] Dev: starting Vite middleware");
    // Dynamic import to avoid issues in prod environments that don't need it
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
}

// Start listener only if not on Vercel
if (!isVercel) {
  setupStatic().then(() => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[READY] Local server on port ${PORT}`);
    });
  });
}

// Export for Vercel
export default app;
