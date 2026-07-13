import nodemailer from "nodemailer";

// Gmail SMTP via app password — needs exactly two env vars:
// GMAIL_USER (your gmail address) and GMAIL_APP_PASSWORD
// (myaccount.google.com -> Security -> 2-Step Verification -> App passwords)
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

export const canSendMail = Boolean(user && pass);

const transporter = canSendMail
  ? nodemailer.createTransport({ service: "gmail", auth: { user, pass } })
  : null;

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!transporter) {
    throw new Error("Mail not configured: set GMAIL_USER and GMAIL_APP_PASSWORD");
  }
  await transporter.sendMail({
    from: `"Prompt Diary" <${user}>`,
    ...opts,
  });
}

export function verificationEmailHtml(name: string, url: string): string {
  return `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#13271e">
    <h1 style="font-style:italic;font-size:22px;margin:0 0 4px">Prompt <span style="color:#1c6b4a">Diary</span></h1>
    <p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#5f6f65">
      Hi ${name}, confirm your email address to unlock publishing public prompts and joining teams.
    </p>
    <p style="margin:24px 0">
      <a href="${url}" style="font-family:system-ui,sans-serif;background:#1c6b4a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px">
        Verify email
      </a>
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:12px;color:#5f6f65">
      If the button doesn't work, paste this link into your browser:<br>
      <a href="${url}" style="color:#1c6b4a;word-break:break-all">${url}</a>
    </p>
  </div>`;
}
