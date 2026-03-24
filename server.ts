import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

let firestoreDatabaseId: string | undefined;

function initializeFirebaseAdmin() {
  if (admin.apps.length) return;

  let projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  
  // Try to read from firebase-applet-config.json
  try {
    const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
    projectId = projectId || config.projectId;
    firestoreDatabaseId = config.firestoreDatabaseId;
  } catch (e) {
    // Fallback to environment
    projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT;
  }

  if (!projectId) {
    console.error("CRITICAL: Firebase Project ID not found. Admin SDK may not function correctly.");
  }

  console.log("Initializing Firebase Admin with project ID:", projectId, "and database ID:", firestoreDatabaseId || "(default)");
  
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: projectId
  });
}

function getDbAdmin() {
  initializeFirebaseAdmin();
  if (firestoreDatabaseId) {
    return getFirestore(admin.app(), firestoreDatabaseId);
  }
  return getFirestore(admin.app());
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy route to fetch images and return as base64 to bypass CORS
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`Proxying image: ${imageUrl}`);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const base64 = buffer.toString("base64");
      
      res.json({ 
        data: `data:${contentType};base64,${base64}`,
        contentType 
      });
    } catch (error: any) {
      console.error("Error proxying image:", error);
      res.status(500).json({ error: "Failed to proxy image", message: error.message });
    }
  });

  app.post("/api/auth/welcome-email", async (req, res) => {
    const { email, displayName } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    console.log(`Sending welcome email to ${email}...`);

    // Configure transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.ethereal.email",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: '"Petmaps 🐾" <contato@petmaps.com.br>',
      to: email,
      subject: "Bem-vindo ao Petmaps! Sua jornada pet começa aqui 🐾",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .container { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo-container { display: inline-block; height: 60px; }
            .hero { background-color: #f0fdf4; border-radius: 24px; padding: 40px; text-align: center; margin-bottom: 30px; }
            .hero h1 { color: #005438; margin-top: 0; font-size: 28px; }
            .content { line-height: 1.6; font-size: 16px; }
            .features { margin: 30px 0; padding: 0; list-style: none; }
            .feature-item { margin-bottom: 15px; display: flex; align-items: flex-start; }
            .feature-icon { margin-right: 12px; font-size: 20px; }
            .cta-container { text-align: center; margin: 40px 0; }
            .cta-button { background-color: #005438; color: #ffffff !important; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 84, 56, 0.2); }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 14px; color: #6b7280; text-align: center; }
            .social-links { margin-top: 20px; }
            .social-link { margin: 0 10px; color: #005438; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <svg width="210" height="60" viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
                  <text x="0" y="92" fill="#005438" style="font: bold 105px sans-serif; letter-spacing: -0.05em;">Petmaps</text>
                </svg>
              </div>
            </div>
            
            <div class="hero">
              <h1>Olá, ${displayName || 'Pet Lover'}!</h1>
              <p>Estamos muito felizes em ter você na nossa comunidade.</p>
            </div>
 
            <div class="content">
              <p>O <strong>Petmaps</strong> nasceu para ser a maior rede de proteção e cuidado animal do Brasil. Agora, você e seus pets estão mais seguros e conectados.</p>
              
              <p><strong>Veja o que você já pode fazer:</strong></p>
              
              <div class="features">
                <div class="feature-item">
                  <span class="feature-icon">🆔</span>
                  <span><strong>Registro Nacional:</strong> Crie a identidade digital única para seus pets.</span>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">📢</span>
                  <span><strong>Privacidade e Segurança:</strong> Seus dados protegidos com as melhores tecnologias.</span>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">🏥</span>
                  <span><strong>Rede de Cuidados:</strong> Encontre clínicas e petshops com descontos exclusivos.</span>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">💉</span>
                  <span><strong>Histórico Digital:</strong> Controle vacinas e consultas em um só lugar.</span>
                </div>
              </div>
 
              <div class="cta-container">
                <a href="${process.env.APP_URL || 'https://petmaps.com.br'}" class="cta-button">Começar Agora</a>
              </div>
 
              <p>Quanto mais pessoas participam, mais forte fica nossa rede. Convide amigos e familiares para protegerem seus pets também!</p>
            </div>
 
            <div class="footer">
              <p>Com carinho,<br><strong>Equipe Petmaps</strong></p>
              <div class="social-links">
                <a href="#" class="social-link">Instagram</a>
                <a href="#" class="social-link">Facebook</a>
                <a href="#" class="social-link">WhatsApp</a>
              </div>
              <p style="margin-top: 20px; font-size: 12px;">© 2026 Petmaps. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
 
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Welcome email sent successfully to ${email}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao enviar email de boas-vindas:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });
 
  // TEMPORARY: Hidden route to reset all data (Firestore + Auth)
  // This will be removed after execution.
  app.get("/api/system/maintenance/factory-reset-confirm-all-data", async (req, res) => {
    console.log("Starting factory reset...");
    const results: any = {
      firestore: { success: false, deletedCount: 0, error: null },
      auth: { success: false, deletedCount: 0, error: null }
    };
 
    try {
      const dbAdmin = getDbAdmin();
      const collections = ['users', 'pets', 'partners', 'posters', 'medical_records', 'vaccines', 'transfer_requests'];
      
      for (const collName of collections) {
        try {
          const snapshot = await dbAdmin.collection(collName).get();
          if (snapshot.empty) {
            console.log(`Collection ${collName} is already empty.`);
            continue;
          }
          
          const batchSize = 500;
          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += batchSize) {
            const batch = dbAdmin.batch();
            const chunk = docs.slice(i, i + batchSize);
            chunk.forEach((doc) => {
              batch.delete(doc.ref);
              results.firestore.deletedCount++;
            });
            await batch.commit();
          }
          console.log(`Deleted ${snapshot.size} documents from ${collName}`);
        } catch (collError: any) {
          console.error(`Error deleting collection ${collName}:`, collError.message);
          results.firestore.error = collError.message;
        }
      }
      results.firestore.success = !results.firestore.error;
 
      // Delete Auth Users
      try {
        console.log("Listing Auth users...");
        const listUsersResult = await admin.auth().listUsers();
        const uids = listUsersResult.users.map(u => u.uid);
        if (uids.length > 0) {
          console.log(`Deleting ${uids.length} users...`);
          // deleteUsers can take up to 1000 UIDs
          await admin.auth().deleteUsers(uids);
          results.auth.deletedCount = uids.length;
          console.log(`Deleted ${uids.length} users from Auth`);
        }
        results.auth.success = true;
      } catch (authError: any) {
        console.error("Error deleting Auth users:", authError.message);
        results.auth.error = authError.message;
      }
 
      res.json({ 
        success: results.firestore.success || results.auth.success,
        message: "Operação de reset concluída.", 
        results
      });
    } catch (error: any) {
      console.error("Global reset error:", error);
      res.status(500).json({ 
        error: "Erro crítico ao realizar o reset.",
        message: error.message,
        stack: error.stack
      });
    }
  });
 
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync("./index.html", "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
