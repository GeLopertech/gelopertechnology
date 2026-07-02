const nodemailer = require("nodemailer");

// ── Rate limiter (best-effort, ephemeral) ──
const rateLimit = new Map();
const RATE_LIMIT = 2;
const RATE_WINDOW = 5 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimit.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  rateLimit.set(ip, { count: entry.count + 1, start: entry.start });
  return false;
}

// ── Sanitize input ──
function sanitize(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .trim();
}

// ── Verify reCAPTCHA v3 ──
async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // skip if not configured
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
    { method: "POST" }
  );
  const data = await res.json();
  return data.success && data.score >= 0.5;
}

// ── Build email transporter ──
function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

// ── Email templates ──
function buildEmails(lead) {
  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  });

  const adminHtml = `
  <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">
    <div style="background:#1D9E75;padding:28px 32px;border-radius:12px 12px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:20px;">🚀 New Lead — GeLoper Technology</h2>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">${now} IST</p>
    </div>
    <div style="background:#fff;padding:28px 32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 0;color:#999;width:120px;border-bottom:1px solid #f5f5f5;">Name</td><td style="padding:10px 0;color:#111;font-weight:600;border-bottom:1px solid #f5f5f5;">${lead.name}</td></tr>
        <tr><td style="padding:10px 0;color:#999;border-bottom:1px solid #f5f5f5;">Email</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;"><a href="mailto:${lead.email}" style="color:#1D9E75;">${lead.email}</a></td></tr>
        <tr><td style="padding:10px 0;color:#999;border-bottom:1px solid #f5f5f5;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;"><a href="tel:${lead.phone}" style="color:#1D9E75;">${lead.phone}</a></td></tr>
        <tr><td style="padding:10px 0;color:#999;border-bottom:1px solid #f5f5f5;">Project</td><td style="padding:10px 0;color:#111;border-bottom:1px solid #f5f5f5;">${lead.projectType}</td></tr>
        <tr><td style="padding:10px 4px 10px 0;color:#999;vertical-align:top;">Message</td><td style="padding:10px 0;color:#111;line-height:1.6;">${lead.message.replace(/\n/g, "<br/>")}</td></tr>
      </table>
    </div>
  </div>`;

  const clientHtml = `
  <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">
    <div style="background:#1D9E75;padding:28px 32px;border-radius:12px 12px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:22px;">GeLoper Technology</h2>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Dream It, We Build It. Instantly.</p>
    </div>
    <div style="background:#fff;padding:32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px;">
      <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi ${lead.name} 👋</p>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 20px;">Thanks for reaching out! We've received your enquiry about your <strong>${lead.projectType}</strong> project and will get back to you within <strong>24 hours</strong> with a clear plan and pricing.</p>
      <div style="background:#E1F5EE;border-radius:10px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#0F6E56;line-height:1.7;">📋 <strong>Your message:</strong><br/>"${lead.message.slice(0, 160)}${lead.message.length > 160 ? "..." : ""}"</p>
      </div>
      <p style="font-size:14px;color:#555;margin:0 0 8px;">In a hurry? WhatsApp us directly:</p>
      <a href="https://wa.me/919791158504" style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">💬 WhatsApp Us</a>
      <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0 16px;"/>
      <p style="font-size:12px;color:#aaa;margin:0;">GeLoper Technology · Chennai, Tamil Nadu, India<br/>sciencedotbusiness@gmail.com · +91 97911 58504</p>
    </div>
  </div>`;

  return { adminHtml, clientHtml };
}

async function sendAdminEmail(lead) {
  const { adminHtml } = buildEmails(lead);
  await getTransporter().sendMail({
    from: `"GeLoper Technology" <${process.env.GMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL || process.env.GMAIL_USER,
    subject: `🔔 New Lead: ${lead.name} — ${lead.projectType}`,
    html: adminHtml,
  });
}

async function sendClientEmail(lead) {
  const { clientHtml } = buildEmails(lead);
  await getTransporter().sendMail({
    from: `"GeLoper Technology" <${process.env.GMAIL_USER}>`,
    to: lead.email,
    subject: `We got your message, ${lead.name}! 🚀 — GeLoper Technology`,
    html: clientHtml,
  });
}

async function logLeadToNotion(lead) {
  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  });
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        Name: { title: [{ text: { content: lead.name } }] },
        Email: { email: lead.email },
        Phone: { phone_number: lead.phone },
        "Project Type": { rich_text: [{ text: { content: lead.projectType } }] },
        Message: { rich_text: [{ text: { content: lead.message } }] },
        Status: { rich_text: [{ text: { content: "New Lead" } }] },
        "Submitted At": { rich_text: [{ text: { content: now } }] },
      },
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Notion error: ${JSON.stringify(err)}`);
  }
}

// ── Allowed origins ──
const ALLOWED_ORIGINS = [
  "https://gelopertechnology.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
];

module.exports = async function handler(req, res) {
  // ── CORS ──
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Rate limiting ──
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait 5 minutes." });
  }

  // ── Safe destructure (fix crash on empty body) ──
  const {
    name, email, phone, projectType, message,
    honeypot, recaptchaToken
  } = req.body || {};

  // ── Honeypot check ──
  if (honeypot && honeypot.trim() !== "") {
    return res.status(200).json({ success: true }); // silent reject
  }

  // ── reCAPTCHA verification ──
  if (!recaptchaToken) {
    return res.status(400).json({ error: "reCAPTCHA verification missing. Please try again." });
  }
  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    return res.status(400).json({ error: "Bot detected. Please try again." });
  }

  // ── Validate required fields ──
  if (!name || !email || !phone || !projectType || !message)
    return res.status(400).json({ error: "All fields are required." });

  // ── Email format ──
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: "Invalid email address." });

  // ── Length check ──
  if (name.length > 100 || message.length > 2000 || phone.length > 20)
    return res.status(400).json({ error: "Input too long." });

  // ── Block disposable domains ──
  const blockedDomains = [
    'example.com', 'test.com', 'fake.com', 'tempmail.com', 'mailinator.com',
    'guerrillamail.com', 'yopmail.com', 'throwaway.email', 'sharklasers.com',
    'trashmail.com', 'dispostable.com', 'maildrop.cc', '10minutemail.com',
    'temp-mail.org', 'getnada.com', 'spamgourmet.com',
  ];
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (blockedDomains.includes(emailDomain)) {
    return res.status(400).json({ error: "Please use a valid email address." });
  }

  const lead = {
    name: sanitize(name),
    email: sanitize(email),
    phone: sanitize(phone),
    projectType: sanitize(projectType),
    message: sanitize(message),
  };

  try {
    // Admin email must succeed
    await sendAdminEmail(lead);

    // Run client email + Notion in parallel and AWAIT both
    // This is critical on Vercel — without await, the function is killed
    // before these async tasks can complete their network requests
    const [clientResult, notionResult] = await Promise.allSettled([
      sendClientEmail(lead),
      logLeadToNotion(lead),
    ]);

    if (clientResult.status === "rejected") {
      console.error("Client email failed:", clientResult.reason.message);
    }
    if (notionResult.status === "rejected") {
      console.error("Notion failed:", notionResult.reason.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Admin email error:", err.message, "code:", err.code, "response:", err.response);
    // Differentiate system errors from recipient errors
    if (err.responseCode >= 500 && err.responseCode < 510) {
      return res.status(503).json({ error: "Mail server temporarily unavailable. Please try WhatsApp." });
    }
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
