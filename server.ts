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

  app.use(express.json());
  
  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] MODE: ${process.env.NODE_ENV} | ${req.method} ${req.url}`);
    next();
  });

  // Orange API Auth Cache
  let orangeAccessToken: string | null = null;
  let tokenExpiry: number = 0;

  const getOrangeAccessToken = async () => {
    if (orangeAccessToken && Date.now() < tokenExpiry) {
      return orangeAccessToken;
    }

    const clientId = process.env.ORANGE_CLIENT_ID;
    const clientSecret = process.env.ORANGE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Orange API credentials missing in environment (ORANGE_CLIENT_ID or ORANGE_CLIENT_SECRET)");
      return null;
    }

    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://api.orange.com/oauth/v3/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      const data = await response.json() as any;
      if (data.access_token) {
        orangeAccessToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
        return orangeAccessToken;
      }
      console.error('Orange API Token Error:', data);
      return null;
    } catch (error) {
      console.error('Error getting Orange token:', error);
      return null;
    }
  };

  // Health check route
  app.get("/server-health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV || "unknown", 
      time: new Date().toISOString() 
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "unknown" });
  });

  // Route to verify configuration without sending SMS
  app.get("/api/check-orange-config", async (req, res) => {
    const orangeSender = process.env.ORANGE_SENDER; 
    const clientId = process.env.ORANGE_CLIENT_ID;
    const clientSecret = process.env.ORANGE_CLIENT_SECRET;
    const token = await getOrangeAccessToken();
    
    res.json({
      senderSet: !!orangeSender,
      tokenSuccess: !!token,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      sender: orangeSender || 'NON CONFIGURÉ'
    });
  });

  // API Route for sending SMS
  app.post("/api/send-sms", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    const orangeSenderRaw = process.env.ORANGE_SENDER; 
    const clientId = process.env.ORANGE_CLIENT_ID;
    const clientSecret = process.env.ORANGE_CLIENT_SECRET;
    const token = await getOrangeAccessToken();

    // Debug logging (partial info for security)
    console.log(`[SMS AUTH CHECK] ClientID: ${clientId ? clientId.substring(0, 4) + '...' : 'MISSING'}, Sender: ${orangeSenderRaw ? 'Set' : 'MISSING'}, Token: ${token ? 'Success' : 'FAILED'}`);

    if (!token || !orangeSenderRaw) {
      return res.status(500).json({ 
        error: "Orange API configuration incomplete", 
        details: { 
          senderSet: !!orangeSenderRaw, 
          tokenSuccess: !!token,
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        }
      });
    }

    try {
      // Nettoyage et formatage du Sender (tel:+225XXXXXXXX)
      let orangeSender = orangeSenderRaw.trim();
      if (!orangeSender.startsWith('tel:')) {
        let phoneOnly = orangeSender.replace(/^tel:/, '').replace(/\s/g, '');
        if (!phoneOnly.startsWith('+')) {
          phoneOnly = `+${phoneOnly}`;
        }
        orangeSender = `tel:${phoneOnly}`;
      }

      // Nettoyage et formatage du Destinataire (tel:+225XXXXXXXX)
      let cleanedRecipient = phone.trim().replace(/[^\d+]/g, ''); // Garde seulement chiffres et +
      
      // Si c'est un numéro local CI à 10 chiffres (ex: 07...)
      if (cleanedRecipient.length === 10 && !cleanedRecipient.startsWith('+')) {
        cleanedRecipient = `+225${cleanedRecipient}`;
      } else if (!cleanedRecipient.startsWith('+') && cleanedRecipient.length > 0) {
        cleanedRecipient = `+${cleanedRecipient}`;
      }
      
      const receiverAddress = `tel:${cleanedRecipient}`;
      const encodedSender = encodeURIComponent(orangeSender);

      console.log(`[ORANGE] Tentative d'envoi de ${orangeSender} vers ${receiverAddress}`);

      const body = {
        outboundSMSMessageRequest: {
          address: [receiverAddress], // L'API Orange attend un tableau ici
          senderAddress: orangeSender,
          outboundSMSTextMessage: {
            message: message
          }
        }
      };

      const response = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodedSender}/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        console.log(`[ORANGE] SMS Envoyé avec succès à ${cleanedRecipient}`);
        return res.json({ success: true, recipient: cleanedRecipient });
      } else {
        const errorData = await response.json();
        console.error('[ORANGE] Erreur API lors de l\'envoi:', JSON.stringify(errorData));
        return res.status(response.status).json({ 
          error: "Orange API Error", 
          details: errorData,
          attemptedRecipient: cleanedRecipient 
        });
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Improved production detection
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = existsSync(distPath);
  const isProduction = process.env.NODE_ENV === "production" || (hasDist && process.env.NODE_ENV !== "development");

  if (!isProduction) {
    console.log("[SERVER] Mode: DÉVELOPPEMENT (Vite Middleware)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[SERVER] Mode: PRODUCTION (Servir dist/)");
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Serveur opérationnel sur http://0.0.0.0:${PORT} (Production: ${isProduction})`);
  });
}

startServer();
