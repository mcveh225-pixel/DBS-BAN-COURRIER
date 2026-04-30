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

  // API Route for sending SMS
  app.post("/api/send-sms", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    const orangeSender = process.env.ORANGE_SENDER; // Format: tel:+225XXXXXXXX
    const token = await getOrangeAccessToken();

    if (!token || !orangeSender) {
      console.log(`[SMS CONFIG MISSING] Would send to ${phone}: ${message}`);
      return res.status(500).json({ 
        error: "Orange API configuration missing", 
        simulated: true 
      });
    }

    try {
      // Ensure phone has the correct format for Orange (e.g., +225XXXXXXXX)
      const formattedRecipient = phone.startsWith('+') ? phone : `+${phone}`;
      const receiverAddress = `tel:${formattedRecipient}`;
      
      // Encode the sender address for the URL
      const encodedSender = encodeURIComponent(orangeSender);

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
        console.log(`SMS Sent successfully to ${phone}`);
        return res.json({ success: true });
      } else {
        const errorData = await response.json();
        console.error('Orange API Send Error:', errorData);
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
