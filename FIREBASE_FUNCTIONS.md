import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

admin.initializeApp();

/**
 * Cloud Function to send a welcome email when a new user is created in Firebase Auth.
 * Trigger: auth.user().onCreate
 */
export const sendWelcomeEmail = functions.auth.user().onCreate(async (user) => {
  const email = user.email;
  const displayName = user.displayName || 'Tutor';

  console.log(`Sending welcome email to ${email}...`);

  // Configure your SMTP transporter here
  // Recommended: Use environment variables for credentials
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"Equipe Petmaps" <contato@petmaps.com.br>',
    to: email,
    subject: 'Bem-vindo ao Petmaps 🐾',
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded-lg: 12px;">
        <h1 style="color: #10b981;">Olá!</h1>
        <p style="font-size: 16px; line-height: 1.6;">Seja muito bem-vindo ao <strong>Petmaps 🐾</strong></p>
        
        <p style="font-size: 16px; line-height: 1.6;">Agora você faz parte da maior rede colaborativa de proteção animal.</p>
        
        <p style="font-size: 16px; line-height: 1.6;">Com o Petmaps você pode:</p>
        
        <ul style="font-size: 16px; line-height: 1.6; padding-left: 20px;">
          <li>• Cadastrar seus pets</li>
          <li>• Criar Registro Nacional do Pet</li>
          <li>• Criar cartazes automáticos caso seu pet se perca</li>
          <li>• Encontrar pets perdidos na sua cidade</li>
          <li>• Ajudar outros tutores a reencontrar seus animais</li>
          <li>• Encontrar clínicas veterinárias próximas de você</li>
          <li>• Receber descontos em consultas</li>
          <li>• Acompanhar histórico veterinário</li>
          <li>• Acompanhar histórico de vacinas</li>
        </ul>
        
        <p style="font-size: 16px; line-height: 1.6;">Quanto mais pessoas participam, maior fica a rede de proteção.</p>
        
        <p style="font-size: 16px; line-height: 1.6;">Acesse agora e comece a cadastrar seus pets.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
          <p>Equipe Petmaps</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent successfully to ${email}`);
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error);
  }
});
