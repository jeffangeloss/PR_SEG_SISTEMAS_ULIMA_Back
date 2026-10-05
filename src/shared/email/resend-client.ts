import { config } from "../../config/app-config.js";

type SendPasswordResetEmailInput = {
  to: string;
  otp: string;
  expiresMinutes: number;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

const buildPasswordResetHtml = (otp: string, expiresMinutes: number) => `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2933;">
  <h2 style="color: #f37021; margin-bottom: 4px;">ULima+</h2>
  <h3 style="margin-top: 0;">Restablecimiento de contraseña</h3>
  <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
  <p>Tu código de verificación es:</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: #f5f5f5; padding: 16px; border-radius: 8px;">${otp}</p>
  <p>Este código expira en <strong>${expiresMinutes} minutos</strong> y solo puede usarse una vez.</p>
  <p style="color: #6b7280; font-size: 13px;">Si no solicitaste este cambio, ignora este correo; tu contraseña seguirá siendo la misma.</p>
  <p style="color: #6b7280; font-size: 13px;">— Equipo ULima+</p>
</div>
`;

const buildPasswordResetText = (otp: string, expiresMinutes: number) => `ULima+

Restablecimiento de contraseña

Recibimos una solicitud para restablecer la contraseña de tu cuenta.

Tu código de verificación es: ${otp}

Este código expira en ${expiresMinutes} minutos y solo puede usarse una vez.

Si no solicitaste este cambio, ignora este correo; tu contraseña seguirá siendo la misma.

Equipo ULima+
`;

/**
 * Envía el correo con el OTP de restablecimiento usando la API HTTP de Resend.
 *
 * Nunca lanza errores hacia el llamador: cualquier fallo de envío se loguea
 * del lado servidor y la respuesta HTTP al cliente sigue siendo la genérica
 * (así no se filtra si la cuenta existe ni el estado del proveedor de correo).
 *
 * En desarrollo sin RESEND_API_KEY, loguea el OTP en consola con prefijo
 * [DEV ONLY] para poder probar el flujo localmente.
 */
export const sendPasswordResetEmail = async ({ to, otp, expiresMinutes }: SendPasswordResetEmailInput): Promise<void> => {
  if (!config.email.resendApiKey) {
    if (!config.server.isProduction) {
      console.log(`[DEV ONLY] OTP de restablecimiento para ${to}: ${otp} (expira en ${expiresMinutes} minutos)`);
    } else {
      console.error("Resend: RESEND_API_KEY no configurada en producción; no se envió el correo de restablecimiento.");
    }
    return;
  }

  const payload: Record<string, unknown> = {
    from: config.email.resendFrom,
    to,
    subject: "ULima+ | Código para restablecer tu contraseña",
    html: buildPasswordResetHtml(otp, expiresMinutes),
    text: buildPasswordResetText(otp, expiresMinutes),
  };
  // Reply-To a un buzón real (si está configurado): permite responder el correo,
  // lo que mejora la entregabilidad frente al patrón "solo no-reply".
  if (config.email.replyTo) {
    payload.reply_to = config.email.replyTo;
  }

  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Resend: fallo al enviar correo de restablecimiento (status ${response.status}): ${errorBody}`);
    }
  } catch (error) {
    console.error("Resend: error de red al enviar correo de restablecimiento", error);
  }
};
