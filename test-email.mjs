import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

try {
  await transport.verify();
  console.log('✅ SMTP connection verified — credentials are correct');

  await transport.sendMail({
    from:    `"HelpDesk Test" <${process.env.SMTP_USER}>`,
    to:      process.env.ADMIN_EMAIL,
    subject: 'HelpDesk — SMTP test',
    text:    'If you can read this, your SMTP setup is working correctly.',
  });
  console.log(`✅ Test email sent to ${process.env.ADMIN_EMAIL}`);
} catch (err) {
  console.error('❌ SMTP error:', err.message);
  if (err.message.includes('535') || err.message.includes('Username and Password')) {
    console.error('   → Wrong SMTP_USER or SMTP_PASS');
    console.error('   → For Gmail: use an App Password, not your regular password');
    console.error('   → Generate at: myaccount.google.com → Security → App Passwords');
  }
  if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
    console.error('   → SMTP_HOST or SMTP_PORT is wrong for this email provider');
  }
}
