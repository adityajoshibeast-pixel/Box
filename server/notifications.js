const nodemailer = require("nodemailer");

const RESEND_ENDPOINT = "https://api.resend.com/emails/batch";
const RESEND_BATCH_SIZE = 100;
const ZOHO_BATCH_SIZE = 5;

const TYPE_LABELS = {
  link: "Link",
  pdf: "PDF",
  img: "Image",
};

const DOWNLOAD_HEADER_LABELS = {
  fileName: "File name",
  title: "Resource title",
  type: "File type",
  section: "Section",
  subsection: "Category",
  downloadedAtIndia: "Downloaded at (India)",
  downloadedAtIso: "Downloaded at (ISO)",
  sourcePage: "Source page",
  ip: "IP address",
  location: "Approx. location",
  coordinates: "Approx. coordinates",
  timezone: "Visitor timezone",
  browser: "Browser",
  operatingSystem: "Operating system",
  device: "Device",
  language: "Language",
  userAgent: "User agent",
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
    "RESOURCE NAVIGATOR",
    "",
    "A new resource is ready for you.",
    "",
    `Title: ${item.title}`,
    `Section: ${section?.title || "Resource Navigator"}`,
    `Category: ${subsection?.title || "Latest resources"}`,
    `Type: ${typeLabel}`,
    "",
    `View resource: ${itemUrl}`,
    "",
    "You are receiving this email because you subscribed to Resource Navigator updates.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return {
    from,
    replyTo: process.env.ZOHO_EMAIL || undefined,
    to: [subscriber.email],
    subject: `New ${typeLabel}: ${item.title} | Resource Navigator`,
    text,
    html: `<!doctype html>
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="color-scheme" content="light only">
          <style>@media only screen and (max-width:620px){.email-card{border-radius:0!important}.email-pad{padding-left:22px!important;padding-right:22px!important}.detail-label{width:92px!important}}</style>
        </head>
        <body style="margin:0;padding:0;background:#f3f0f7;font-family:Arial,Helvetica,sans-serif;color:#25212f;-webkit-text-size-adjust:100%">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0">A new ${safeType.toLowerCase()} is now available in Resource Navigator.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0f7">
            <tr><td align="center" style="padding:32px 12px">
              <table class="email-card" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(48,35,71,.10)">
                <tr><td class="email-pad" style="padding:24px 34px;background:#5d3fad;color:#ffffff">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                    <td width="44" valign="middle"><div style="width:40px;height:40px;line-height:40px;text-align:center;border-radius:12px;background:#ffffff;color:#5d3fad;font-size:15px;font-weight:700">RN</div></td>
                    <td valign="middle" style="padding-left:12px"><div style="font-size:17px;font-weight:700;letter-spacing:.1px">Resource Navigator</div><div style="padding-top:3px;font-size:12px;color:#e7ddff">Useful resources, delivered simply</div></td>
                  </tr></table>
                </td></tr>
                <tr><td class="email-pad" style="padding:36px 34px 18px">
                  <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eee8fb;color:#5d3fad;font-size:11px;line-height:1;font-weight:700;letter-spacing:.8px;text-transform:uppercase">New ${safeType}</div>
                  <h1 style="margin:16px 0 10px;font-size:26px;line-height:1.3;font-weight:750;color:#25212f">${title}</h1>
                  <p style="margin:0;font-size:15px;line-height:1.7;color:#625c6f">A new resource has been added and is ready for you to explore.</p>
                </td></tr>
                <tr><td class="email-pad" style="padding:10px 34px 8px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#faf9fc;border:1px solid #e9e4ef;border-radius:12px;font-size:14px;line-height:1.5">
                    <tr><td class="detail-label" width="112" style="padding:14px 10px 8px 16px;color:#7a7185">Section</td><td style="padding:14px 16px 8px 0;font-weight:600;color:#342d3e">${safeSection}</td></tr>
                    <tr><td class="detail-label" width="112" style="padding:8px 10px 8px 16px;color:#7a7185">Category</td><td style="padding:8px 16px 8px 0;font-weight:600;color:#342d3e">${safeSubsection}</td></tr>
                    <tr><td class="detail-label" width="112" style="padding:8px 10px 14px 16px;color:#7a7185">Format</td><td style="padding:8px 16px 14px 0;font-weight:600;color:#342d3e">${safeType}</td></tr>
                  </table>
                </td></tr>
                <tr><td class="email-pad" style="padding:22px 34px 38px">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:10px;background:#5d3fad">
                    <a href="${safeItemUrl}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:14px;line-height:1.2;font-weight:700">View resource &nbsp;&rarr;</a>
                  </td></tr></table>
                </td></tr>
                <tr><td class="email-pad" style="padding:20px 34px;background:#faf9fc;border-top:1px solid #eeeaf2">
                  <p style="margin:0 0 7px;font-size:12px;line-height:1.6;color:#7b7485">You received this email because you subscribed to Resource Navigator updates.</p>
                  <p style="margin:0;font-size:12px;line-height:1.6"><a href="${safeUnsubscribeUrl}" style="color:#5d3fad;text-decoration:underline">Unsubscribe from these updates</a></p>
                </td></tr>
              </table>
              <p style="margin:16px 0 0;font-size:11px;color:#91899a">&copy; ${new Date().getFullYear()} Resource Navigator</p>
            </td></tr>
          </table>
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

function getDownloadRecipients() {
  return String(
    process.env.DOWNLOAD_NOTIFICATION_EMAIL || process.env.ZOHO_EMAIL || ""
  )
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function readHeader(req, name) {
  const value = req.get?.(name) || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "").trim();
}

function decodeHeader(value) {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, "%20"));
  } catch {
    return value;
  }
}

function getClientIp(req) {
  const forwarded = readHeader(req, "x-forwarded-for").split(",")[0].trim();
  const ip =
    readHeader(req, "x-real-ip") ||
    forwarded ||
    req.ip ||
    req.socket?.remoteAddress ||
    "Unavailable";

  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function getVisitorLocation(req) {
  const city = decodeHeader(
    readHeader(req, "x-vercel-ip-city") || readHeader(req, "cf-ipcity")
  );
  const region = decodeHeader(
    readHeader(req, "x-vercel-ip-country-region") || readHeader(req, "cf-region")
  );
  const country = decodeHeader(
    readHeader(req, "x-vercel-ip-country") || readHeader(req, "cf-ipcountry")
  );
  const latitude = readHeader(req, "x-vercel-ip-latitude");
  const longitude = readHeader(req, "x-vercel-ip-longitude");
  const timezone = decodeHeader(readHeader(req, "x-vercel-ip-timezone"));

  return {
    label: [city, region, country].filter(Boolean).join(", ") || "Unavailable",
    coordinates:
      latitude && longitude ? `${latitude}, ${longitude}` : "Unavailable",
    timezone: timezone || "Unavailable",
  };
}

function getDeviceDetails(req) {
  const userAgent = readHeader(req, "user-agent") || "Unavailable";
  const mobileHint = readHeader(req, "sec-ch-ua-mobile");
  const language = readHeader(req, "accept-language").split(",")[0] || "Unavailable";
  let browser = "Other / unknown";
  let operatingSystem = "Other / unknown";
  let device = mobileHint === "?1" ? "Mobile" : "Desktop / laptop";

  if (/Edg\//i.test(userAgent)) browser = "Microsoft Edge";
  else if (/OPR\//i.test(userAgent)) browser = "Opera";
  else if (/Chrome\//i.test(userAgent)) browser = "Google Chrome";
  else if (/Firefox\//i.test(userAgent)) browser = "Mozilla Firefox";
  else if (/Safari\//i.test(userAgent)) browser = "Safari";

  if (/Windows/i.test(userAgent)) operatingSystem = "Windows";
  else if (/Android/i.test(userAgent)) operatingSystem = "Android";
  else if (/iPhone|iPad|iPod/i.test(userAgent)) operatingSystem = "iOS / iPadOS";
  else if (/Mac OS X/i.test(userAgent)) operatingSystem = "macOS";
  else if (/Linux/i.test(userAgent)) operatingSystem = "Linux";

  if (/iPad|Tablet/i.test(userAgent)) device = "Tablet";
  else if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) device = "Mobile";

  return { browser, operatingSystem, device, language, userAgent };
}

function buildDownloadEmail({ item, section, subsection, req, from, to }) {
  const now = new Date();
  const location = getVisitorLocation(req);
  const device = getDeviceDetails(req);
  const details = {
    fileName: item.original_name || item.title || "Unnamed file",
    title: item.title || "Untitled resource",
    type: TYPE_LABELS[item.type] || item.type || "File",
    section: section?.title || "Unavailable",
    subsection: subsection?.title || "Unavailable",
    downloadedAtIndia: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: "Asia/Kolkata",
    }).format(now),
    downloadedAtIso: now.toISOString(),
    sourcePage: readHeader(req, "referer") || "Direct / unavailable",
    ip: getClientIp(req),
    location: location.label,
    coordinates: location.coordinates,
    timezone: location.timezone,
    browser: device.browser,
    operatingSystem: device.operatingSystem,
    device: device.device,
    language: device.language,
    userAgent: device.userAgent,
  };
  const rows = Object.entries(DOWNLOAD_HEADER_LABELS)
    .map(
      ([key, label]) =>
        `<tr><td class="alert-label" style="width:160px;padding:11px 14px 11px 0;border-bottom:1px solid #eeeaf2;color:#716a7d;vertical-align:top">${escapeHtml(
          label
        )}</td><td style="padding:11px 0;border-bottom:1px solid #eeeaf2;color:#302838;font-weight:600;word-break:break-word">${escapeHtml(
          details[key]
        )}</td></tr>`
    )
    .join("");
  const text = [
    "RESOURCE NAVIGATOR — DOWNLOAD ALERT",
    "",
    "A file download was initiated.",
    "",
    ...Object.entries(DOWNLOAD_HEADER_LABELS).map(
      ([key, label]) => `${label}: ${details[key]}`
    ),
    "",
    "Location is approximate and depends on hosting/network headers.",
  ].join("\n");

  return {
    from,
    to,
    subject: `Download alert: ${details.fileName} | Resource Navigator`,
    text,
    html: `<!doctype html>
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="color-scheme" content="light only">
          <style>@media only screen and (max-width:680px){.alert-card{border-radius:0!important}.alert-pad{padding-left:20px!important;padding-right:20px!important}.alert-label{width:115px!important}}</style>
        </head>
        <body style="margin:0;padding:0;background:#f3f0f7;font-family:Arial,Helvetica,sans-serif;color:#25212f;-webkit-text-size-adjust:100%">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(
            details.fileName
          )} was downloaded from Resource Navigator.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0f7">
            <tr><td align="center" style="padding:32px 12px">
              <table class="alert-card" role="presentation" width="660" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:660px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(48,35,71,.10)">
                <tr><td class="alert-pad" style="padding:24px 34px;background:#25212f;color:#ffffff">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                    <td><div style="font-size:16px;font-weight:700">Resource Navigator</div><div style="padding-top:4px;font-size:12px;color:#cfc7d8">Owner notification</div></td>
                    <td align="right"><div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#5d3fad;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase">Download alert</div></td>
                  </tr></table>
                </td></tr>
                <tr><td class="alert-pad" style="padding:32px 34px 20px">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#5d3fad">New activity</p>
                  <h1 style="margin:0 0 10px;font-size:24px;line-height:1.35;color:#25212f">A file download was initiated</h1>
                  <p style="margin:0;font-size:15px;line-height:1.7;color:#625c6f"><strong style="color:#302838">${escapeHtml(
                    details.fileName
                  )}</strong> was requested from your resource library.</p>
                </td></tr>
                <tr><td class="alert-pad" style="padding:4px 34px 34px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-bottom:20px;background:#f8f5fd;border:1px solid #e5dcf4;border-radius:12px">
                    <tr>
                      <td style="padding:15px 16px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#7a7185">File</div><div style="padding-top:5px;font-size:14px;font-weight:700;color:#302838;word-break:break-word">${escapeHtml(
                        details.fileName
                      )}</div></td>
                      <td style="padding:15px 16px;border-left:1px solid #e5dcf4"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#7a7185">Location</div><div style="padding-top:5px;font-size:14px;font-weight:700;color:#302838">${escapeHtml(
                        details.location
                      )}</div></td>
                    </tr>
                  </table>
                  <h2 style="margin:0 0 8px;font-size:15px;color:#302838">Activity details</h2>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;font-size:13px;line-height:1.5">${rows}</table>
                  <div style="margin-top:20px;padding:13px 15px;border-radius:10px;background:#fff8e8;border:1px solid #f0dfb3;color:#705b28;font-size:12px;line-height:1.6"><strong>Location note:</strong> Geographic details are approximate and depend on hosting and network information.</div>
                </td></tr>
                <tr><td class="alert-pad" style="padding:18px 34px;background:#faf9fc;border-top:1px solid #eeeaf2;font-size:11px;line-height:1.6;color:#8b8294">This is an automated owner alert from Resource Navigator. No action is required.</td></tr>
              </table>
              <p style="margin:16px 0 0;font-size:11px;color:#91899a">&copy; ${now.getFullYear()} Resource Navigator</p>
            </td></tr>
          </table>
        </body>
      </html>`,
  };
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

async function sendDownloadNotification({ db, req, item }) {
  const recipients = getDownloadRecipients();
  const canUseResend = resendIsConfigured();
  const canUseZoho = zohoIsConfigured();

  if (!recipients.length || (!canUseResend && !canUseZoho)) {
    console.warn(
      "Download email skipped: add DOWNLOAD_NOTIFICATION_EMAIL and Resend or Zoho credentials."
    );
    return { sent: 0, skipped: true };
  }

  const subsection = await db.getSubsection(item.subsection_id);
  const section = subsection ? await db.getSection(subsection.section_id) : null;
  const message = buildDownloadEmail({
    item,
    section,
    subsection,
    req,
    from: canUseResend
      ? process.env.UPDATE_EMAIL_FROM
      : process.env.ZOHO_FROM || `Resource Navigator <${process.env.ZOHO_EMAIL}>`,
    to: recipients,
  });

  // Prefer Resend for owner alerts when it is configured; Zoho remains a
  // working fallback for existing deployments.
  return canUseResend ? sendWithResend([message]) : sendWithZoho([message]);
}

module.exports = { sendNewItemNotification, sendDownloadNotification };
