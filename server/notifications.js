const nodemailer = require("nodemailer");

const RESEND_ENDPOINT = "https://api.resend.com/emails/batch";
const RESEND_BATCH_SIZE = 100;
const ZOHO_BATCH_SIZE = 5;

const TYPE_LABELS = {
  link: "Link",
  pdf: "PDF",
  img: "Image",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getBaseUrl(req) {
  const configured =
    process.env.PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (configured) {
    return cleanBaseUrl(
      /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
    );
  }

  return cleanBaseUrl(`${req.protocol}://${req.get("host")}`);
}

function getItemUrl(item, baseUrl) {
  if (item.type === "link") return item.url;
  return `${baseUrl}/item/${encodeURIComponent(item.id)}`;
}

function buildEmail({ subscriber, item, section, subsection, baseUrl, from }) {
  const typeLabel = TYPE_LABELS[item.type] || "Resource";
  const itemUrl = getItemUrl(item, baseUrl);
  const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${encodeURIComponent(
    subscriber.unsubscribe_token
  )}`;
  const title = escapeHtml(item.title);
  const safeType = escapeHtml(typeLabel);
  const safeSection = escapeHtml(section?.title || "Resource Navigator");
  const safeSubsection = escapeHtml(subsection?.title || "Latest resources");
  const safeItemUrl = escapeHtml(itemUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);

  const text = [
    "Hello,",
    "",
    `The following ${typeLabel.toLowerCase()} was added to Resource Navigator:`,
    `Title: ${item.title}`,
    `Section: ${section?.title || "Resource Navigator"}`,
    `Category: ${subsection?.title || "Latest resources"}`,
    "",
    `Open resource: ${itemUrl}`,
    "",
    "You requested an email when new resources are added.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return {
    from,
    replyTo: process.env.ZOHO_EMAIL || undefined,
    to: [subscriber.email],
    subject: `Resource Navigator: ${item.title} added`,
    text,
    html: `<!doctype html>
      <html lang="en">
        <body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,sans-serif;color:#25212f">
          <div style="max-width:560px;margin:0 auto">
            <p style="margin:0 0 20px;font-size:14px;color:#625c6f">Resource Navigator</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;font-weight:700">${title}</h1>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6">A new resource has been added.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.5;margin-bottom:22px">
              <tr><td style="padding:3px 18px 3px 0;color:#716a7d">Section</td><td style="padding:3px 0">${safeSection}</td></tr>
              <tr><td style="padding:3px 18px 3px 0;color:#716a7d">Category</td><td style="padding:3px 0">${safeSubsection}</td></tr>
              <tr><td style="padding:3px 18px 3px 0;color:#716a7d">Type</td><td style="padding:3px 0">${safeType}</td></tr>
            </table>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6">
              <a href="${safeItemUrl}" style="color:#57409b;text-decoration:underline">Open this resource</a>
            </p>
            <hr style="border:0;border-top:1px solid #e8e5ec;margin:0 0 18px">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#7b7485">You requested an email when new resources are added. <a href="${safeUnsubscribeUrl}" style="color:#6b5a93">Unsubscribe</a></p>
          </div>
        </body>
      </html>`,
  };
}

function zohoIsConfigured() {
  return Boolean(process.env.ZOHO_EMAIL && process.env.ZOHO_APP_PASSWORD);
}

function resendIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.UPDATE_EMAIL_FROM);
}

async function sendWithZoho(messages) {
  const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
    port: 465,
    secure: true,
    maxConnections: 3,
    rateDelta: 1000,
    rateLimit: 5,
    auth: {
      user: process.env.ZOHO_EMAIL,
      pass: process.env.ZOHO_APP_PASSWORD.replace(/\s/g, ""),
    },
  });
  let sent = 0;

  try {
    for (let index = 0; index < messages.length; index += ZOHO_BATCH_SIZE) {
      const batch = messages.slice(index, index + ZOHO_BATCH_SIZE);
      await Promise.all(batch.map((message) => transporter.sendMail(message)));
      sent += batch.length;
    }
  } finally {
    transporter.close();
  }

  return { sent, provider: "zoho" };
}

async function sendWithResend(messages) {
  let sent = 0;

  for (let index = 0; index < messages.length; index += RESEND_BATCH_SIZE) {
    const batch = messages.slice(index, index + RESEND_BATCH_SIZE);
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend rejected the notification batch (${response.status}): ${detail}`);
    }
    sent += batch.length;
  }

  return { sent, provider: "resend" };
}

async function sendNewItemNotification({ db, req, item }) {
  if (!zohoIsConfigured() && !resendIsConfigured()) {
    console.warn(
      "Update email skipped: Zoho Mail or Resend credentials are not configured."
    );
    return { sent: 0, skipped: true };
  }

  const [subscribers, subsection] = await Promise.all([
    db.listActiveSubscribers(),
    db.getSubsection(item.subsection_id),
  ]);
  if (!subscribers.length) return { sent: 0 };

  const section = subsection ? await db.getSection(subsection.section_id) : null;
  const baseUrl = getBaseUrl(req);
  const messages = subscribers.map((subscriber) =>
    buildEmail({
      subscriber,
      item,
      section,
      subsection,
      baseUrl,
      from: zohoIsConfigured()
        ? process.env.ZOHO_FROM || `Resource Navigator <${process.env.ZOHO_EMAIL}>`
        : process.env.UPDATE_EMAIL_FROM,
    })
  );

  return zohoIsConfigured()
    ? sendWithZoho(messages)
    : sendWithResend(messages);
}

module.exports = { sendNewItemNotification };
