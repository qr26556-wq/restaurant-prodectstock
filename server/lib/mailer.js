// Simple mailer helper. If SMTP is configured (via env vars), sends a real
// email using nodemailer. Agar SMTP configure nahi hai, to reset link
// terminal/console me print ho jata hai — taake local testing me bina
// email service ke bhi forgot-password flow chalaya ja sake.
//
// Real email bhejne ke liye .env me ye variables set karein:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// (Gmail, SendGrid, Mailgun, Resend — kisi bhi SMTP provider se free/paid
// account bana kar ye values daal sakte hain.)

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer install nahi hai — sirf console-log fallback use hoga
}

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (isSmtpConfigured() && nodemailer) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: 'ReelForge — Password reset karein',
      html: `
        <p>Aapne apna ReelForge password reset karne ki request ki thi.</p>
        <p><a href="${resetUrl}">Yahan click karke naya password set karein</a></p>
        <p>Ye link 1 ghante ke liye valid hai. Agar aapne ye request nahi ki, to is email ko ignore karein.</p>
      `,
    });
    return { sent: true, mode: 'smtp' };
  }

  // Fallback: dev/test mode — link console me print karo
  console.log('\n========== PASSWORD RESET LINK (SMTP configured nahi hai) ==========');
  console.log(`To: ${toEmail}`);
  console.log(`Link: ${resetUrl}`);
  console.log('======================================================================\n');
  return { sent: false, mode: 'console' };
}

module.exports = { sendPasswordResetEmail, isSmtpConfigured };
