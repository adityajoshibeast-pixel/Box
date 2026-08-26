# Zoho Mail update-email setup

This project sends update notifications from a personal Zoho Mail account. A
custom domain is not required.

## 1. Confirm the SMTP server

In Zoho Mail, open **Settings → Mail Accounts**, select the sender account, and
check its **Server Configuration Details**. Personal `@zohomail.com` accounts
normally use:

```text
Server: smtp.zoho.com
Port: 465
Security: SSL
Authentication: required
```

Always use the server shown inside the account. Zoho may assign a regional
hostname such as `smtp.zoho.in` or `smtp.zoho.eu`.

## 2. Generate an App Password

If MFA/TFA is not enabled, enable it for the Zoho account first. Then:

1. Open [Zoho Accounts](https://accounts.zoho.com/).
2. Go to **Security → App Passwords**.
3. Select **Generate New Password**.
4. Name it `Resource Navigator` and copy the generated password.

The App Password is displayed only once. Use it without spaces and never put
the normal Zoho account password in this project.

## 3. Configure Vercel

In **Vercel → Project → Settings → Environment Variables**, add:

```env
ZOHO_EMAIL=your-address@zohomail.com
ZOHO_APP_PASSWORD=paste-the-generated-app-password
ZOHO_FROM=Resource Navigator <your-address@zohomail.com>
ZOHO_SMTP_HOST=smtp.zoho.com
PUBLIC_APP_URL=https://your-project.vercel.app
```

`ZOHO_EMAIL` and the address inside `ZOHO_FROM` must match the authenticated
Zoho address or one of its configured aliases. Apply the variables to
Production (and Preview if needed), then redeploy.

## 4. Test

1. Subscribe with a test recipient email on the public site.
2. Add a new link from the Admin panel.
3. Confirm that the Admin panel reports a sent notification.
4. Check the recipient inbox and the Zoho sender account's Sent folder.

If authentication fails, confirm the regional SMTP hostname, full sender email,
and App Password. Generate a new App Password if necessary.
