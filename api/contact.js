// api/contact.js — Resend + Notion + Goat-level security

const crypto = require("crypto");

// ── Rate limiter (2 per 10 mins per IP) ──
// Uses Upstash Redis (REST) so the limit is shared across all serverless
// instances. Falls back to an in-memory Map only if Upstash isn't configured
// (best-effort — not reliable on serverless).
const RATE_LIMIT = 2;
const RATE_WINDOW_SEC = 10 * 60;
const memoryRateLimit = new Map();

async function upstash(command) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function isRateLimited(ip) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const key = `rl:contact:${ip}`;
    try {
      const count = await upstash(["INCR", key]);
      if (count === 1) await upstash(["EXPIRE", key, RATE_WINDOW_SEC]);
      return count > RATE_LIMIT;
    } catch (e) {
      console.error("Rate limit store error:", e.message);
      return true; // fail closed
    }
  }

  console.warn("Upstash not configured — using in-memory rate limit (unreliable on serverless).");
  const now = Date.now();
  const entry = memoryRateLimit.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_SEC * 1000) {
    memoryRateLimit.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ── Signed math CAPTCHA ──
// The server generates the question and returns an HMAC-signed token.
// The correct answer is never sent to the browser, so it can't be forged.
const CAPTCHA_TTL_MS = 10 * 60 * 1000;

function signCaptcha(answer, expires) {
  return crypto
    .createHmac("sha256", process.env.CAPTCHA_SECRET)
    .update(`${answer}.${expires}`)
    .digest("hex");
}

function createCaptcha() {
  const r = (n) => crypto.randomInt(n);
  const ops = ["+", "-", "×"];
  const op = ops[r(3)];
  let a, b, ans;
  if (op === "+") { a = r(20) + 1; b = r(20) + 1; ans = a + b; }
  else if (op === "-") { a = r(20) + 10; b = r(10) + 1; ans = a - b; }
  else { a = r(9) + 2; b = r(9) + 2; ans = a * b; }
  const expires = Date.now() + CAPTCHA_TTL_MS;
  return { question: `${a} ${op} ${b} = ?`, token: `${expires}.${signCaptcha(ans, expires)}` };
}

function verifyCaptcha(answer, token) {
  if (answer === undefined || answer === null || typeof token !== "string") return false;
  const [expiresStr, sig] = token.split(".");
  const expires = Number(expiresStr);
  if (!expires || !sig || Date.now() > expires) return false;
  const expected = signCaptcha(String(answer).trim(), expires);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Sanitize ──
function sanitize(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .trim();
}

// ── reCAPTCHA v3 ──
async function verifyRecaptcha(token) {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      console.error("RECAPTCHA_SECRET_KEY not set — rejecting request.");
      return false; // fail closed
    }
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: String(token) }),
    });
    const data = await res.json();
    console.log("reCAPTCHA score:", data.score);
    return data.success && data.score >= 0.5;
  } catch (e) {
    console.error("reCAPTCHA error:", e.message);
    return false;
  }
}

// ── Send email via Resend ──
async function sendEmail({ to, subject, html, replyTo }) {
  const payload = {
    from: process.env.FROM_EMAIL || "GeLoper Technology <hello@gelopertechnology.in>",
    to,
    subject,
    html,
  };
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
  return res.json();
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

// ── Notion logging ──
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
        Name:           { title:        [{ text: { content: lead.name } }] },
        Email:          { email:        lead.email },
        Phone:          { phone_number: lead.phone },
        "Project Type": { rich_text:    [{ text: { content: lead.projectType } }] },
        Message:        { rich_text:    [{ text: { content: lead.message } }] },
        Status:         { rich_text:    [{ text: { content: "New Lead" } }] },
        "Submitted At": { rich_text:    [{ text: { content: now } }] },
      },
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Notion: ${JSON.stringify(err)}`);
  }
}

// ── Allowed origins ──
const ALLOWED_ORIGINS = [
  "https://gelopertechnology.in",
  "https://www.gelopertechnology.in",
  "https://gelopertechnology.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];

// ── Blocked disposable domains ──
const BLOCKED_DOMAINS = new Set([
  'example.com','test.com','fake.com','tempmail.com','mailinator.com',
  'guerrillamail.com','yopmail.com','throwaway.email','sharklasers.com',
  'trashmail.com','dispostable.com','maildrop.cc','10minutemail.com',
  'temp-mail.org','getnada.com','spamgourmet.com','grr.la','spam4.me',
]);

// ── Trusted domains for client auto-reply ──
const TRUSTED_DOMAINS = new Set([
  'gmail.com','yahoo.com','yahoo.in','outlook.com','hotmail.com',
  'icloud.com','protonmail.com','proton.me','rediffmail.com',
  'ymail.com','live.com','msn.com','me.com','mac.com',
]);

module.exports = async function handler(req, res) {
  // ── CORS ──
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.CAPTCHA_SECRET) {
    console.error("CAPTCHA_SECRET not set.");
    return res.status(500).json({ error: "Server misconfigured." });
  }

  // ── Issue a new signed math challenge ──
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(createCaptcha());
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Origin check (browsers always send Origin on cross-site/fetch POSTs) ──
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // ── Rate limiting ──
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  if (await isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait 10 minutes." });
  }

  // ── Safe destructure ──
  const {
    name, email, phone, projectType, message,
    honeypot, recaptchaToken,
    mathAnswer, mathToken
  } = req.body || {};

  // ── Honeypot ──
  if (honeypot && String(honeypot).trim() !== "") {
    console.log("Bot caught: honeypot");
    return res.status(200).json({ success: true });
  }

  // ── Math CAPTCHA (server-signed) ──
  if (!verifyCaptcha(mathAnswer, mathToken)) {
    console.log("Bot caught: math captcha");
    return res.status(400).json({ error: "Incorrect answer. Please solve the math question." });
  }

  // ── reCAPTCHA ──
  if (!recaptchaToken) {
    return res.status(400).json({ error: "reCAPTCHA missing. Please try again." });
  }
  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    console.log("Bot caught: reCAPTCHA");
    return res.status(400).json({ error: "Bot detected. Please try again." });
  }

  // ── Validate fields ──
  if (!name || !email || !phone || !projectType || !message)
    return res.status(400).json({ error: "All fields are required." });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: "Invalid email address." });

  if (name.length > 100 || message.length > 2000 || phone.length > 20)
    return res.status(400).json({ error: "Input too long." });

  // ── Block disposable domains ──
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (BLOCKED_DOMAINS.has(emailDomain)) {
    return res.status(400).json({ error: "Please use a valid email address." });
  }

  const lead = {
    name: sanitize(name),
    email: sanitize(email),
    phone: sanitize(phone),
    projectType: sanitize(projectType),
    message: sanitize(message),
  };

  const { adminHtml, clientHtml } = buildEmails(lead);

  try {
    // ── Admin email (must succeed) ──
    await sendEmail({
      to: process.env.ADMIN_EMAIL || "sciencedotbusiness@gmail.com",
      subject: `🔔 New Lead: ${lead.name} — ${lead.projectType}`,
      html: adminHtml,
      replyTo: lead.email,
    });

    // ── Client auto-reply (trusted domains only) ──
    if (TRUSTED_DOMAINS.has(emailDomain)) {
      try {
        await sendEmail({
          to: lead.email,
          subject: `We got your message, ${lead.name}! 🚀 — GeLoper Technology`,
          html: clientHtml,
          replyTo: process.env.ADMIN_EMAIL || "sciencedotbusiness@gmail.com",
        });
        console.log("✅ Client email sent to:", lead.email);
      } catch (err) {
        console.error("❌ Client email failed:", err.message);
      }
    } else {
      console.log("ℹ️ Client email skipped (not trusted domain):", emailDomain);
    }

    // ── Notion ──
    try {
      await logLeadToNotion(lead);
      console.log("✅ Notion logged");
    } catch (err) {
      console.error("❌ Notion failed:", err.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Admin email error:", err.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
