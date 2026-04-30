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

    const clientId = process.env.VITE_ORANGE_CLIENT_ID;
    const clientSecret = process.env.VITE_ORANGE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Orange API credentials missing in environment");
      return null;
    }

    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://api.orange.com/oauth/v2/token', {
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
      return null;
    } catch (error) {
      console.error('Error getting Orange token:', error);
      return null;
    }
  };

  // API Route for sending SMS
  app.post("/api/send-sms", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    const senderNumber = process.env.VITE_ORANGE_SENDER_NUMBER;
    const token = await getOrangeAccessToken();

    if (!token || !senderNumber) {
      console.log(`[SERVER SIMULATION] SMS to ${phone}: ${message}`);
      return res.json({ success: true, simulated: true });
    }

    try {
      const senderAddress = `tel:+${senderNumber}`;
      const receiverAddress = `tel:+${phone}`;

      const response = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: receiverAddress,
            senderAddress: senderAddress,
            outboundSMSTextMessage: {
              message: message
            }
          }
        })
      });

      if (response.ok) {
        return res.json({ success: true });
      } else {
        const errorData = await response.json();
        console.error('Orange API Error:', errorData);
        return res.status(response.status).json({ error: "Orange API Error", details: errorData });
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
