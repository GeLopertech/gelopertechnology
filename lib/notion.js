const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function logLeadToNotion(lead) {
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
        Name:            { title:      [{ text: { content: lead.name } }] },
        Email:           { email:      lead.email },
        Phone:           { phone_number: lead.phone },
        "Project Type":  { rich_text:  [{ text: { content: lead.projectType } }] },
        Message:         { rich_text:  [{ text: { content: lead.message } }] },
        Status:          { rich_text:  [{ text: { content: "New Lead" } }] },
        "Submitted At":  { rich_text:  [{ text: { content: now } }] },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Notion error: ${JSON.stringify(err)}`);
  }
  return response.json();
}
