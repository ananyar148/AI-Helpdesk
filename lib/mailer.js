/**
 * Mailer — Nodemailer wrapper with all email templates.
 *
 * Configure via .env:
 *   SMTP_HOST     e.g. smtp.gmail.com
 *   SMTP_PORT     e.g. 587
 *   SMTP_USER     your sending email address
 *   SMTP_PASS     your app password (Gmail: Settings → Security → App Passwords)
 *   ADMIN_EMAIL   where new-ticket notifications go
 *
 * If SMTP_USER is not set the mailer silently skips — app works without email.
 */

import nodemailer from 'nodemailer';

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host:   SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(SMTP_PORT || '587', 10),
    secure: parseInt(SMTP_PORT || '587', 10) === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function send({ to, subject, html }) {
  const transport = createTransport();
  if (!transport) {
    console.warn(`[mailer] SMTP not configured — skipping email to ${to}`);
    return;
  }
  try {
    await transport.sendMail({
      from: `"HelpDesk" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[mailer] Sent "${subject}" → ${to}`);
  } catch (err) {
    // Never let email failure break the main request
    console.error(`[mailer] Failed to send "${subject}" → ${to}:`, err.message);
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const base = (content) => `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px;">
  <div style="background:#2563eb;border-radius:12px 12px 0 0;padding:20px 24px;">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">🛟 HelpDesk</h1>
  </div>
  <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;">
    ${content}
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">
    This is an automated message from HelpDesk. Please do not reply.
  </p>
</div>`;

const pill = (text, color) =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${color.bg};color:${color.text};">${text}</span>`;

const priorityColor = (p) => ({
  High:   { bg: '#fee2e2', text: '#b91c1c' },
  Medium: { bg: '#ffedd5', text: '#c2410c' },
  Low:    { bg: '#f1f5f9', text: '#475569' },
}[p] || { bg: '#f1f5f9', text: '#475569' });

// ─── Template 1: Ticket Created — Client ─────────────────────────────────────

export async function sendTicketCreatedClient(ticket, clientEmail) {
  if (!clientEmail) return;
  await send({
    to:      clientEmail,
    subject: `[HelpDesk] Ticket received — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your ticket has been received ✓</h2>
      <p style="color:#475569;margin:0 0 20px;">
        We've logged your request and our team will be in touch shortly.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Subject</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#1e293b;">${ticket.subject}</p>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">Your Ticket ID</p>
        <p style="margin:4px 0 0;font-family:monospace;font-size:14px;color:#14532d;">${ticket.id}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#16a34a;">Save this ID — you may need it if you contact us again.</p>
      </div>

      ${ticket.draftResponse ? `
      <div style="border-left:3px solid #2563eb;padding-left:14px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#2563eb;font-weight:600;text-transform:uppercase;">Initial Response</p>
        <p style="margin:0;color:#334155;font-size:14px;">${ticket.draftResponse}</p>
      </div>` : ''}

      <p style="color:#64748b;font-size:13px;margin:0;">
        We'll send you another email when your ticket is resolved.
      </p>
    `),
  });
}

// ─── Template 2: Ticket Created — Admin ──────────────────────────────────────

export async function sendTicketCreatedAdmin(ticket, clientEmail) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const teams = (ticket.assignedTeams || []).join(', ');
  await send({
    to:      adminEmail,
    subject: `[HelpDesk] New ${ticket.priority} ticket — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">New ticket submitted</h2>
      <p style="color:#475569;margin:0 0 20px;">
        A client has submitted a support ticket. Review and assign as needed.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Subject</td>
              <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Category</td>
              <td>${pill(ticket.category, { bg: '#ede9fe', text: '#6d28d9' })}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Priority</td>
              <td>${pill(ticket.priority, priorityColor(ticket.priority))}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Teams</td>
              <td>${pill(teams, { bg: '#dbeafe', text: '#1d4ed8' })}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Client Email</td>
              <td style="color:#1e293b;">${clientEmail || 'Not provided'}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Ticket ID</td>
              <td style="font-family:monospace;font-size:12px;color:#475569;">${ticket.id}</td></tr>
        </table>
      </div>

      <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Description</p>
        <p style="margin:0;color:#334155;font-size:14px;">${ticket.description}</p>
      </div>
    `),
  });
}

// ─── Template 3: Ticket Resolved — Client ────────────────────────────────────

export async function sendTicketResolvedClient(ticket) {
  if (!ticket.clientEmail) return;
  await send({
    to:      ticket.clientEmail,
    subject: `[HelpDesk] Your ticket has been resolved — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your ticket has been resolved ✅</h2>
      <p style="color:#475569;margin:0 0 20px;">
        Great news — your support request has been resolved. Here are the details.
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Resolved Ticket</p>
        <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#1e293b;">${ticket.subject}</p>
        <p style="margin:0;font-family:monospace;font-size:12px;color:#16a34a;">ID: ${ticket.id}</p>
      </div>

      ${ticket.draftResponse ? `
      <div style="border-left:3px solid #16a34a;padding-left:14px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#16a34a;font-weight:600;text-transform:uppercase;">Resolution Note</p>
        <p style="margin:0;color:#334155;font-size:14px;">${ticket.draftResponse}</p>
      </div>` : ''}

      <p style="color:#64748b;font-size:13px;margin:0;">
        If your issue persists, please submit a new support request.
      </p>
    `),
  });
}

// ─── Template 4: Ticket Resolved — Admin ─────────────────────────────────────

export async function sendTicketResolvedAdmin(ticket, actor) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  await send({
    to:      adminEmail,
    subject: `[HelpDesk] Ticket resolved by ${actor.name} — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Ticket marked as resolved</h2>
      <p style="color:#475569;margin:0 0 20px;">
        <strong>${actor.name}</strong> (${actor.team || actor.role}) resolved a ticket.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Subject</td>
              <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Resolved by</td>
              <td style="color:#1e293b;">${actor.name} · ${actor.team || actor.role}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Client Email</td>
              <td style="color:#1e293b;">${ticket.clientEmail || 'Not provided'}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Ticket ID</td>
              <td style="font-family:monospace;font-size:12px;color:#475569;">${ticket.id}</td></tr>
        </table>
      </div>
    `),
  });
}

// ─── Template 5: Change Notification — Actor ─────────────────────────────────

export async function sendChangeNotificationActor(ticket, actor, changes) {
  if (!actor?.email) return;
  const changeRows = changes.map(({ label, from, to }) => `
    <tr>
      <td style="color:#94a3b8;padding:5px 0;width:110px;font-size:13px;">${label}</td>
      <td style="font-size:13px;">
        ${from ? `<span style="text-decoration:line-through;color:#ef4444;margin-right:6px;">${from}</span>` : ''}
        <span style="color:#16a34a;font-weight:600;">${to}</span>
      </td>
    </tr>`).join('');

  await send({
    to:      actor.email,
    subject: `[HelpDesk] You updated ticket — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Ticket updated by you</h2>
      <p style="color:#475569;margin:0 0 20px;">
        Here's a confirmation of the changes you made to ticket <strong>${ticket.subject}</strong>.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          ${changeRows}
        </table>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;">
        <p style="margin:0;font-size:12px;color:#1d4ed8;">
          Ticket ID: <code>${ticket.id}</code>
        </p>
      </div>
    `),
  });
}

// ─── Template 6: Request More Details — Client ────────────────────────────────

export async function sendDetailsRequestedClient(ticket, clientEmail, message, actor) {
  if (!clientEmail) return;
  await send({
    to:      clientEmail,
    subject: `[HelpDesk] We need more information about your ticket — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">We need a little more information 🔍</h2>
      <p style="color:#475569;margin:0 0 20px;">
        <strong>${actor.name}</strong> from our ${actor.team || actor.role} team
        has reviewed your ticket and needs some additional details to help you better.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Your Ticket</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#1e293b;">${ticket.subject}</p>
        <p style="margin:4px 0 0;font-family:monospace;font-size:11px;color:#94a3b8;">ID: ${ticket.id}</p>
      </div>

      <div style="border-left:4px solid #2563eb;padding:14px 16px;background:#eff6ff;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#2563eb;font-weight:700;text-transform:uppercase;">Message from our team</p>
        <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.6;">${message}</p>
      </div>

      <p style="color:#475569;font-size:14px;margin:0 0 8px;">
        Please log in to the Client Portal to provide the requested information.
      </p>
      <p style="color:#64748b;font-size:13px;margin:0;">
        Once we have the details, we'll continue working on your request.
      </p>
    `),
  });
}
