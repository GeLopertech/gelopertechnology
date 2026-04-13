import { sendLeadEmails } from "../../lib/mailer";
import { logLeadToNotion } from "../../lib/notion";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, phone, projectType, message } = req.body;
  if (!name || !email || !phone || !projectType || !message)
    return res.status(400).json({ error: "All fields are required." });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: "Invalid email address." });

  const lead = { name, email, phone, projectType, message };

  try {
    const [emailResult, notionResult] = await Promise.allSettled([
      sendLeadEmails(lead),
      logLeadToNotion(lead),
    ]);

    if (emailResult.status === "rejected") {
      console.error("❌ Email error:", emailResult.reason?.message);
      return res.status(500).json({ error: "Email failed: " + emailResult.reason?.message });
    }
    if (notionResult.status === "rejected") {
      console.error("❌ Notion error:", notionResult.reason?.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Unexpected:", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
