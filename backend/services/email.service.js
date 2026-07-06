const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function baseTemplate(title, bodyHtml) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
      .container { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; }
      .header { background: #185FA5; padding: 24px 32px; }
      .header h1 { color: #fff; margin: 0; font-size: 18px; font-weight: 500; }
      .body { padding: 28px 32px; }
      .body p { color: #3d3d3a; font-size: 14px; line-height: 1.6; margin: 0 0 14px; }
      .detail-box { background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0; }
      .detail-row { display: flex; justify-content: space-between; font-size: 13px; color: #5f5e5a; margin-bottom: 8px; }
      .detail-row:last-child { margin-bottom: 0; }
      .detail-label { font-weight: 500; color: #3d3d3a; }
      .btn { display: inline-block; background: #185FA5; color: #fff !important; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 4px; }
      .status-approved { color: #3B6D11; background: #EAF3DE; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
      .status-rejected { color: #791F1F; background: #FCEBEB; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
      .status-pending { color: #633806; background: #FAEEDA; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
      .footer { padding: 16px 32px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>${title}</h1></div>
      <div class="body">${bodyHtml}</div>
      <div class="footer">This is an automated notification from your company intranet. Please do not reply to this email.</div>
    </div>
  </body>
  </html>`;
}

async function send({ to, subject, html }) {
  if (!process.env.SMTP_USER) {
    console.log('[Email] SMTP not configured — skipping send to', to);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
  console.log(`[Email] Sent "${subject}" to ${to}`);
}

// ─── LEAVE NOTIFICATIONS ──────────────────────────────────────────────────────

async function notifyManagerLeaveRequest({ managerEmail, managerName, employeeName, leaveType, dateFrom, dateTo, days, reason }) {
  await send({
    to: managerEmail,
    subject: `Leave request from ${employeeName} — action required`,
    html: baseTemplate('New leave request', `
      <p>Hi ${managerName},</p>
      <p><strong>${employeeName}</strong> has submitted a leave request that requires your approval.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Leave type</span><span>${leaveType}</span></div>
        <div class="detail-row"><span class="detail-label">From</span><span>${dateFrom}</span></div>
        <div class="detail-row"><span class="detail-label">To</span><span>${dateTo}</span></div>
        <div class="detail-row"><span class="detail-label">Duration</span><span>${days} day(s)</span></div>
        ${reason ? `<div class="detail-row"><span class="detail-label">Reason</span><span>${reason}</span></div>` : ''}
      </div>
      <a href="${FRONTEND_URL}/manager/approvals" class="btn">Review request</a>
    `),
  });
}

async function notifyEmployeeLeaveStatus({ employeeEmail, employeeName, leaveType, dateFrom, dateTo, days, status, reason }) {
  const statusBadge = status === 'approved'
    ? '<span class="status-approved">Approved</span>'
    : '<span class="status-rejected">Rejected</span>';
  await send({
    to: employeeEmail,
    subject: `Your leave request has been ${status}`,
    html: baseTemplate(`Leave request ${status}`, `
      <p>Hi ${employeeName},</p>
      <p>Your leave request has been <strong>${status}</strong>. ${statusBadge}</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Leave type</span><span>${leaveType}</span></div>
        <div class="detail-row"><span class="detail-label">From</span><span>${dateFrom}</span></div>
        <div class="detail-row"><span class="detail-label">To</span><span>${dateTo}</span></div>
        <div class="detail-row"><span class="detail-label">Duration</span><span>${days} day(s)</span></div>
        ${reason ? `<div class="detail-row"><span class="detail-label">Reason</span><span>${reason}</span></div>` : ''}
      </div>
      <a href="${FRONTEND_URL}/leave" class="btn">View my leave</a>
    `),
  });
}

// ─── EXPENSE NOTIFICATIONS ────────────────────────────────────────────────────

async function notifyManagerExpense({ managerEmail, managerName, employeeName, expenseName, amount, currency, date }) {
  await send({
    to: managerEmail,
    subject: `Expense claim from ${employeeName} — action required`,
    html: baseTemplate('New expense claim', `
      <p>Hi ${managerName},</p>
      <p><strong>${employeeName}</strong> has submitted an expense claim for your approval.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Description</span><span>${expenseName}</span></div>
        <div class="detail-row"><span class="detail-label">Amount</span><span>${currency} ${amount}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span>${date}</span></div>
      </div>
      <a href="${FRONTEND_URL}/manager/approvals" class="btn">Review claim</a>
    `),
  });
}

async function notifyEmployeeExpenseStatus({ employeeEmail, employeeName, expenseName, amount, currency, status, reason }) {
  const statusBadge = status === 'approved'
    ? '<span class="status-approved">Approved</span>'
    : '<span class="status-rejected">Rejected</span>';
  await send({
    to: employeeEmail,
    subject: `Your expense claim has been ${status}`,
    html: baseTemplate(`Expense claim ${status}`, `
      <p>Hi ${employeeName},</p>
      <p>Your expense claim has been <strong>${status}</strong>. ${statusBadge}</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Description</span><span>${expenseName}</span></div>
        <div class="detail-row"><span class="detail-label">Amount</span><span>${currency} ${amount}</span></div>
        ${reason ? `<div class="detail-row"><span class="detail-label">Reason</span><span>${reason}</span></div>` : ''}
      </div>
      <a href="${FRONTEND_URL}/expenses" class="btn">View my expenses</a>
    `),
  });
}

module.exports = {
  notifyManagerLeaveRequest,
  notifyEmployeeLeaveStatus,
  notifyManagerExpense,
  notifyEmployeeExpenseStatus,
};
