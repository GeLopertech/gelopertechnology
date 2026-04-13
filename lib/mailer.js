import nodemailer from "nodemailer";

export async function sendLeadEmails(lead) {
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
        <tr><td style="padding:10px 0;color:#999;border-bottom:1px solid #f5f5f5;">Project</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;color:#111;">${lead.projectType}</td></tr>
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
      <p style="font-size:12px;color:#aaa;margin:0;">GeLoper Technology · Chennai, Tamil Nadu, India<br/>gelopertech@gmail.com · +91 97911 58504</p>
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
