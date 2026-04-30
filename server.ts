import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
      let cleanedRecipient = phone.trim().replace(/\s/g, '');
      // Si c'est un numéro local à 10 chiffres, on ajoute le préfixe +225
      if (cleanedRecipient.length === 10 && !cleanedRecipient.startsWith('+')) {
        cleanedRecipient = `+225${cleanedRecipient}`;
      } else if (!cleanedRecipient.startsWith('+')) {
        cleanedRecipient = `+${cleanedRecipient}`;
      }
      
      const receiverAddress = `tel:${cleanedRecipient}`;
      const encodedSender = encodeURIComponent(orangeSender);

      console.log(`[ORANGE] Tentative d'envoi de ${orangeSender} vers ${receiverAddress}`);

      const response = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodedSender}/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: receiverAddress,
            senderAddress: orangeSender,
            outboundSMSTextMessage: {
              message: message
            }
          }
        })
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
