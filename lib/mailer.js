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
import { formatTicketNumber } from './utils.js';

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

/**
 * Returns { sent: boolean, reason?: string }
 * Never throws — callers can safely fire-and-forget or inspect the result.
 */
async function send({ to, subject, html }) {
  const transport = createTransport();
  if (!transport) {
    console.warn(`[mailer] SMTP not configured — skipping email to ${to}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  try {
    await transport.sendMail({
      from: `"HelpDesk" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[mailer] Sent "${subject}" → ${to}`);
    return { sent: true };
  } catch (err) {
    // Never let email failure break the main request
    console.error(`[mailer] Failed to send "${subject}" → ${to}:`, err.message);
    return { sent: false, reason: err.message };
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

/** "Open Dashboard" button — appended to every admin-facing email */
const dashboardBtn = () => {
  const url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin`;
  return `
<div style="text-align:center;margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0;">
  <a href="${url}"
    style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 28px;border-radius:8px;">
    Open Admin Dashboard →
  </a>
</div>`;
};

// ─── Template 1: Ticket Created — Client ─────────────────────────────────────

export async function sendTicketCreatedClient(ticket, clientEmail) {
  if (!clientEmail) return { sent: false, reason: 'no_email' };
  return send({
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
        <p style="margin:4px 0 0;font-family:monospace;font-size:22px;font-weight:700;color:#14532d;">#${formatTicketNumber(ticket.ticketNumber)}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#16a34a;">Save this number — quote it whenever you contact us about this issue.</p>
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
  if (!adminEmail) return { sent: false, reason: 'no_admin_email' };
  const teams = (ticket.assignedTeams || []).join(', ');
  return send({
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
          <tr><td style="color:#94a3b8;padding:4px 0;">Ticket #</td>
              <td style="font-family:monospace;font-size:13px;font-weight:700;color:#166534;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
        </table>
      </div>

      <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Description</p>
        <p style="margin:0;color:#334155;font-size:14px;">${ticket.description}</p>
      </div>
      ${dashboardBtn()}
    `),
  });
}

// ─── Template 3: Ticket Resolved — Client ────────────────────────────────────

export async function sendTicketResolvedClient(ticket) {
  if (!ticket.clientEmail) return { sent: false, reason: 'no_email' };
  return send({
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
        <p style="margin:0;font-family:monospace;font-size:14px;font-weight:700;color:#16a34a;">Ticket #${formatTicketNumber(ticket.ticketNumber)}</p>
      </div>

      <p style="color:#64748b;font-size:13px;margin:0;">
        If your issue persists, please submit a new support request.
      </p>
    `),
  });
}

// ─── Template 4: Ticket Resolved — Admin ─────────────────────────────────────

export async function sendTicketResolvedAdmin(ticket, actor) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { sent: false, reason: 'no_admin_email' };
  // Skip if the resolver is the admin themselves — they get the resolver email instead
  if (actor?.email && actor.email.toLowerCase() === adminEmail.toLowerCase()) return { sent: false, reason: 'skipped_self' };
  return send({
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
          <tr><td style="color:#94a3b8;padding:4px 0;">Ticket #</td>
              <td style="font-family:monospace;font-size:13px;font-weight:700;color:#166534;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
        </table>
      </div>
      ${dashboardBtn()}
    `),
  });
}

// ─── Template 4b: Ticket Resolved — Resolver (actor confirmation) ────────────

export async function sendTicketResolvedResolver(ticket, actor) {
  if (!actor?.email) return { sent: false, reason: 'no_email' };
  return send({
    to:      actor.email,
    subject: `[HelpDesk] You resolved ticket — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Ticket resolved by you ✅</h2>
      <p style="color:#475569;margin:0 0 20px;">
        You marked the following ticket as <strong>Resolved</strong>.
        The client has been notified.
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Subject</td>
              <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Category</td>
              <td>${pill(ticket.category, { bg: '#ede9fe', text: '#6d28d9' })}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Priority</td>
              <td>${pill(ticket.priority, priorityColor(ticket.priority))}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Client Email</td>
              <td style="color:#1e293b;">${ticket.clientEmail || 'Not provided'}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Ticket #</td>
              <td style="font-family:monospace;font-size:13px;font-weight:700;color:#166534;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
        </table>
      </div>

      <p style="color:#64748b;font-size:13px;margin:0;">
        If the client responds or reopens the ticket, you will be notified.
      </p>
      ${dashboardBtn()}
    `),
  });
}

// ─── Template 5: Change Notification — Actor ─────────────────────────────────

export async function sendChangeNotificationActor(ticket, actor, changes) {
  if (!actor?.email) return { sent: false, reason: 'no_email' };
  const changeRows = changes.map(({ label, from, to }) => `
    <tr>
      <td style="color:#94a3b8;padding:5px 0;width:110px;font-size:13px;">${label}</td>
      <td style="font-size:13px;">
        ${from ? `<span style="text-decoration:line-through;color:#ef4444;margin-right:6px;">${from}</span>` : ''}
        <span style="color:#16a34a;font-weight:600;">${to}</span>
      </td>
    </tr>`).join('');

  return send({
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
          Ticket #${formatTicketNumber(ticket.ticketNumber)}
        </p>
      </div>
      ${dashboardBtn()}
    `),
  });
}

// ─── Template 6: Request More Details — Client ────────────────────────────────

export async function sendDetailsRequestedClient(ticket, clientEmail, message, actor) {
  if (!clientEmail) return { sent: false, reason: 'no_email' };
  return send({
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
        <p style="margin:4px 0 0;font-family:monospace;font-size:13px;font-weight:700;color:#16a34a;">Ticket #${formatTicketNumber(ticket.ticketNumber)}</p>
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

// ─── Template 7: Ticket Deleted — Admin ──────────────────────────────────────

export async function sendTicketDeletedAdmin(ticket, actor) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { sent: false, reason: 'no_admin_email' };
  return send({
    to:      adminEmail,
    subject: `[HelpDesk] Ticket deleted by ${actor.name} — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Ticket deleted 🗑️</h2>
      <p style="color:#475569;margin:0 0 20px;">
        <strong>${actor.name}</strong> (${actor.team || actor.role}) permanently deleted a ticket.
      </p>

      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Subject</td>
              <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Ticket #</td>
              <td style="font-family:monospace;font-size:13px;font-weight:700;color:#dc2626;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Category</td>
              <td>${pill(ticket.category, { bg: '#ede9fe', text: '#6d28d9' })}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Priority</td>
              <td>${pill(ticket.priority, priorityColor(ticket.priority))}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Status at deletion</td>
              <td style="color:#1e293b;">${ticket.status}</td></tr>
          ${ticket.clientEmail ? `
          <tr><td style="color:#94a3b8;padding:4px 0;">Client</td>
              <td style="color:#1e293b;">${ticket.clientEmail}</td></tr>` : ''}
          <tr><td style="color:#94a3b8;padding:4px 0;">Deleted by</td>
              <td style="color:#1e293b;">${actor.name} · ${actor.team || actor.role}</td></tr>
        </table>
      </div>

      <p style="color:#ef4444;font-size:13px;font-weight:600;margin:0;">
        ⚠ This action is permanent and cannot be undone.
      </p>
      ${dashboardBtn()}
    `),
  });
}

// ─── Template 8: Ticket Changed — Admin (TeamMember changes) ─────────────────

export async function sendTicketChangedAdmin(ticket, actor, changes) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { sent: false, reason: 'no_admin_email' };
  // Skip if actor IS the admin email — no self-notification
  if (actor?.email && actor.email.toLowerCase() === adminEmail.toLowerCase()) {
    return { sent: false, reason: 'skipped_self' };
  }

  const changeRows = changes.map(({ label, from, to }) => `
    <tr>
      <td style="color:#94a3b8;padding:5px 0;width:110px;font-size:13px;">${label}</td>
      <td style="font-size:13px;">
        ${from ? `<span style="text-decoration:line-through;color:#ef4444;margin-right:6px;">${from}</span>` : ''}
        <span style="color:#16a34a;font-weight:600;">${to}</span>
      </td>
    </tr>`).join('');

  return send({
    to:      adminEmail,
    subject: `[HelpDesk] ${actor.name} updated ticket #${formatTicketNumber(ticket.ticketNumber)} — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Ticket updated by team member</h2>
      <p style="color:#475569;margin:0 0 20px;">
        <strong>${actor.name}</strong> (${actor.team || actor.role}) made changes to a ticket.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;">What changed</p>
        <table style="width:100%;border-collapse:collapse;">
          ${changeRows}
        </table>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="color:#94a3b8;padding:3px 0;width:110px;">Subject</td>
              <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
          <tr><td style="color:#94a3b8;padding:3px 0;">Ticket #</td>
              <td style="font-family:monospace;font-weight:700;color:#166534;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
          ${ticket.clientEmail ? `
          <tr><td style="color:#94a3b8;padding:3px 0;">Client</td>
              <td style="color:#1e293b;">${ticket.clientEmail}</td></tr>` : ''}
        </table>
      </div>
      ${dashboardBtn()}
    `),
  });
}

// ─── Template 9: Team Invite ──────────────────────────────────────────────────

export async function sendTeamInvite(newUser, inviteToken, appUrl, invitedBy) {
  if (!newUser.email) return { sent: false, reason: 'no_email' };
  const signupUrl = `${appUrl}/signup?token=${inviteToken}`;
  const teamLine  = newUser.team ? ` on the <strong>${newUser.team}</strong> team` : '';
  return send({
    to:      newUser.email,
    subject: `[HelpDesk] You've been invited to join the team`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">You're invited to HelpDesk 🎉</h2>
      <p style="color:#475569;margin:0 0 20px;">
        <strong>${invitedBy.name}</strong> has added you as a <strong>${newUser.role}</strong>${teamLine}.
        Click the button below to set your password and access your dashboard.
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#94a3b8;padding:4px 0;width:80px;">Name</td>
              <td style="color:#1e293b;font-weight:600;">${newUser.name}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Email</td>
              <td style="color:#1e293b;">${newUser.email}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Role</td>
              <td style="color:#1e293b;">${newUser.role}</td></tr>
          ${newUser.team ? `<tr><td style="color:#94a3b8;padding:4px 0;">Team</td>
              <td style="color:#1e293b;">${newUser.team}</td></tr>` : ''}
        </table>
      </div>

      <div style="text-align:center;margin-bottom:20px;">
        <a href="${signupUrl}"
          style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;">
          Set Password &amp; Sign In →
        </a>
      </div>

      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
        This link expires in 48 hours. If you didn't expect this email, you can ignore it.
      </p>
    `),
  });
}

// ─── Template 10: Ticket Assigned — Assignee notification ────────────────────

export async function sendTicketAssigned(ticket, assignee, assignedBy) {
  if (!assignee?.email) return { sent: false, reason: 'no_email' };
  const appUrl    = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const loginUrl  = `${appUrl}/login`;
  return send({
    to:      assignee.email,
    subject: `[HelpDesk] Ticket #${formatTicketNumber(ticket.ticketNumber)} assigned to you — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">A ticket has been assigned to you 📋</h2>
      <p style="color:#475569;margin:0 0 20px;">
        <strong>${assignedBy.name}</strong> has assigned the following ticket to you.
        Log in to your dashboard to view and work on it.
      </p>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Ticket #</td>
              <td style="font-family:monospace;font-size:14px;font-weight:700;color:#1d4ed8;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Subject</td>
              <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Category</td>
              <td>${pill(ticket.category, { bg: '#ede9fe', text: '#6d28d9' })}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Priority</td>
              <td>${pill(ticket.priority, priorityColor(ticket.priority))}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Status</td>
              <td style="color:#1e293b;">${ticket.status}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Assigned by</td>
              <td style="color:#1e293b;">${assignedBy.name}</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin-bottom:20px;">
        <a href="${loginUrl}"
          style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;">
          Log In to Your Dashboard →
        </a>
      </div>

      <p style="color:#64748b;font-size:13px;margin:0;text-align:center;">
        Only you can view and work on this ticket.
      </p>
    `),
  });
}

// ─── Template 11: Work Log Added — Admin ─────────────────────────────────────

export async function sendWorkLogAddedAdmin(ticket, workLog, actor) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { sent: false, reason: 'no_admin_email' };
  // Skip if the actor is the admin themselves
  if (actor?.email && actor.email.toLowerCase() === adminEmail.toLowerCase()) {
    return { sent: false, reason: 'skipped_self' };
  }
  return send({
    to:      adminEmail,
    subject: `[HelpDesk] Work log added to #${formatTicketNumber(ticket.ticketNumber)} — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">New work log added 📝</h2>
      <p style="color:#475569;margin:0 0 20px;">
        <strong>${actor.name}</strong> (${actor.team || actor.role}) added a work log entry.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Ticket #</td>
              <td style="font-family:monospace;font-weight:700;color:#166534;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Subject</td>
              <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Visibility</td>
              <td>${pill(workLog.visibility, workLog.visibility === 'Internal'
                ? { bg: '#ffedd5', text: '#c2410c' }
                : { bg: '#dbeafe', text: '#1d4ed8' })}</td></tr>
          <tr><td style="color:#94a3b8;padding:4px 0;">Added by</td>
              <td style="color:#1e293b;">${actor.name} · ${actor.team || actor.role}</td></tr>
        </table>
      </div>

      <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Note</p>
        <p style="margin:0;color:#334155;font-size:14px;white-space:pre-wrap;">${workLog.note}</p>
      </div>
      ${dashboardBtn()}
    `),
  });
}

// ─── Template 12: Ticket Resolved by TeamMember — Admin + Resolver only ──────

export async function sendTicketResolvedByTeam(ticket, resolver) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const appUrl     = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const results    = [];

  const body = base(`
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Ticket marked as Resolved 🔔</h2>
    <p style="color:#475569;margin:0 0 20px;">
      <strong>${resolver.name}</strong> (${resolver.team || resolver.role}) has marked a ticket as Resolved.
      Please review and sign off when satisfied.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Ticket #</td>
            <td style="font-family:monospace;font-weight:700;color:#166534;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0;">Subject</td>
            <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0;">Resolved by</td>
            <td style="color:#1e293b;">${resolver.name} · ${resolver.team || resolver.role}</td></tr>
        ${ticket.clientEmail ? `<tr><td style="color:#94a3b8;padding:4px 0;">Client</td>
            <td style="color:#1e293b;">${ticket.clientEmail}</td></tr>` : ''}
      </table>
    </div>
    ${dashboardBtn()}
  `);

  if (adminEmail && !(resolver.email?.toLowerCase() === adminEmail.toLowerCase())) {
    results.push(send({ to: adminEmail, subject: `[HelpDesk] Ticket resolved by ${resolver.name} — ${ticket.subject}`, html: body }));
  }
  if (resolver.email) {
    results.push(send({ to: resolver.email, subject: `[HelpDesk] You resolved ticket #${formatTicketNumber(ticket.ticketNumber)} — ${ticket.subject}`, html: body }));
  }
  await Promise.allSettled(results);
  return { sent: true };
}

// ─── Template 13: Ticket Signed Off — Client + Admin + Resolver ──────────────

export async function sendTicketSignedOff(ticket, admin, resolver) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const appUrl     = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const results    = [];

  // Client email
  if (ticket.clientEmail) {
    results.push(send({
      to:      ticket.clientEmail,
      subject: `[HelpDesk] Your ticket has been signed off — ${ticket.subject}`,
      html: base(`
        <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your ticket has been signed off ✅</h2>
        <p style="color:#475569;margin:0 0 20px;">
          Our team has reviewed and signed off your support request. The issue has been fully resolved.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Signed Off Ticket</p>
          <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b;">${ticket.subject}</p>
          <p style="margin:0;font-family:monospace;font-size:14px;font-weight:700;color:#16a34a;">Ticket #${formatTicketNumber(ticket.ticketNumber)}</p>
        </div>
        <p style="color:#64748b;font-size:13px;margin:0;">
          If your issue persists, please submit a new support request.
        </p>
      `),
    }));
  }

  // Admin + Resolver internal notification
  const internalHtml = base(`
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Ticket signed off ✅</h2>
    <p style="color:#475569;margin:0 0 20px;">
      <strong>${admin.name}</strong> (Admin) has signed off ticket #${formatTicketNumber(ticket.ticketNumber)}.
      The client has been notified.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#94a3b8;padding:4px 0;width:110px;">Ticket #</td>
            <td style="font-family:monospace;font-weight:700;color:#166534;">#${formatTicketNumber(ticket.ticketNumber)}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0;">Subject</td>
            <td style="color:#1e293b;font-weight:600;">${ticket.subject}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0;">Resolved by</td>
            <td style="color:#1e293b;">${resolver?.name || '—'}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0;">Signed off by</td>
            <td style="color:#1e293b;">${admin.name}</td></tr>
      </table>
    </div>
    ${dashboardBtn()}
  `);

  if (adminEmail) results.push(send({ to: adminEmail, subject: `[HelpDesk] Ticket signed off — ${ticket.subject}`, html: internalHtml }));
  if (resolver?.email && resolver.email.toLowerCase() !== adminEmail?.toLowerCase()) {
    results.push(send({ to: resolver.email, subject: `[HelpDesk] Your resolved ticket was signed off — ${ticket.subject}`, html: internalHtml }));
  }

  await Promise.allSettled(results);
  return { sent: true };
}

// ─── Template 14: Ticket Reopened — Client notification ──────────────────────

export async function sendTicketReopened(ticket, actor) {
  if (!ticket.clientEmail) return { sent: false, reason: 'no_client_email' };
  return send({
    to:      ticket.clientEmail,
    subject: `[HelpDesk] Your ticket has been reopened — ${ticket.subject}`,
    html: base(`
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your ticket has been reopened 🔄</h2>
      <p style="color:#475569;margin:0 0 20px;">
        Our team has reopened your support request and will continue working on it.
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Reopened Ticket</p>
        <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b;">${ticket.subject}</p>
        <p style="margin:0;font-family:monospace;font-size:14px;font-weight:700;color:#2563eb;">Ticket #${formatTicketNumber(ticket.ticketNumber)}</p>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0;">
        We will be in touch shortly with an update.
      </p>
    `),
  });
}
