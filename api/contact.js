// api/contact.js — Vercel Serverless Function
import nodemailer from "nodemailer";

const escapeHTML = (str) =>
  String(str).replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );

async function sendLeadEmails(lead) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  });

  const safeName = escapeHTML(lead.name);
  const safeEmail = escapeHTML(lead.email);
  const safePhone = escapeHTML(lead.phone);
  const safeProjectType = escapeHTML(lead.projectType);
  const safeMessage = escapeHTML(lead.message);

  const adminHtml = `
  <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">
    <div style="background:#1D9E75;padding:28px 32px;border-radius:12px 12px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:20px;">🚀 New Lead — GeLoper Technology</h2>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">${now} IST</p>
    </div>
    <div style="background:#fff;padding:28px 32px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 0;color:#999;width:120px;border-bottom:1px solid #f5f5f5;">Name</td><td style="padding:10px 0;color:#111;font-weight:600;border-bottom:1px solid #f5f5f5;">${safeName}</td></tr>
        <tr><td style="padding:10px 0;color:#999;border-bottom:1px solid #f5f5f5;">Email</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;"><a href="mailto:${safeEmail}" style="color:#1D9E75;">${safeEmail}</a></td></tr>
        <tr><td style="padding:10px 0;color:#999;border-bottom:1px solid #f5f5f5;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;"><a href="tel:${safePhone}" style="color:#1D9E75;">${safePhone}</a></td></tr>
        <tr><td style="padding:10px 0;color:#999;border-bottom:1px solid #f5f5f5;">Project</td><td style="padding:10px 0;color:#111;border-bottom:1px solid #f5f5f5;">${safeProjectType}</td></tr>
        <tr><td style="padding:10px 4px 10px 0;color:#999;vertical-align:top;">Message</td><td style="padding:10px 0;color:#111;line-height:1.6;">${safeMessage.replace(/\n/g, "<br/>")}</td></tr>
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
      <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi ${safeName} 👋</p>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 20px;">Thanks for reaching out! We've received your enquiry about your <strong>${safeProjectType}</strong> project and will get back to you within <strong>24 hours</strong> with a clear plan and pricing.</p>
      <div style="background:#E1F5EE;border-radius:10px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#0F6E56;line-height:1.7;">📋 <strong>Your message:</strong><br/>"${safeMessage.slice(0, 160)}${safeMessage.length > 160 ? "..." : ""}"</p>
      </div>
      <p style="font-size:14px;color:#555;margin:0 0 8px;">In a hurry? WhatsApp us directly:</p>
      <a href="https://wa.me/919791158504" style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">💬 WhatsApp Us</a>
      <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0 16px;"/>
      <p style="font-size:12px;color:#aaa;margin:0;">GeLoper Technology · Chennai, Tamil Nadu, India<br/>sciencedotbusiness@gmail.com · +91 97911 58504</p>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"GeLoper Technology" <${process.env.GMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL || process.env.GMAIL_USER,
    subject: `🔔 New Lead: ${lead.name} — ${lead.projectType}`,
    html: adminHtml,
  });

  await transporter.sendMail({
    from: `"GeLoper Technology" <${process.env.GMAIL_USER}>`,
    to: lead.email,
    subject: `We got your message, ${lead.name}! 🚀 — GeLoper Technology`,
    html: clientHtml,
  });
}

async function logLeadToNotion(lead) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  });

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
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
    throw new Error(`Notion error: ${JSON.stringify(err)}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, phone, projectType, message } = req.body;
  if (!name || !email || !phone || !projectType || !message)
    return res.status(400).json({ error: "All fields are required." });

  const lead = { name, email, phone, projectType, message };

  try {
    const [emailResult, notionResult] = await Promise.allSettled([
      sendLeadEmails(lead),
      logLeadToNotion(lead),
    ]);

    if (emailResult.status === "rejected") {
      console.error("Email failed:", emailResult.reason?.message);
      return res.status(500).json({ error: "Email failed: " + emailResult.reason?.message });
    }
    if (notionResult.status === "rejected") {
      console.error("Notion failed:", notionResult.reason?.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
