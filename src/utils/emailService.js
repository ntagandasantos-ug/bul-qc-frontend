const nodemailer = require('nodemailer');

// Configure your email sender
// Using Gmail — you need an App Password (not your normal password)
// How to get Gmail App Password:
// 1. Go to myaccount.google.com
// 2. Security → 2-Step Verification (enable it first)
// 3. Security → App passwords
// 4. Select "Mail" and "Windows Computer"
// 5. Google gives you a 16-character password
// 6. Paste that in GMAIL_APP_PASSWORD in your .env file

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,       // your gmail address
    pass: process.env.GMAIL_APP_PASSWORD, // the 16-char app password
  },
});

const sendVerificationCode = async (toEmail, code, changeType) => {
  const subject = `BUL QC App — ${changeType === 'password'
    ? 'Password Change' : 'Username Change'} Verification`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #7C3AED; padding: 20px; border-radius: 12px 12px 0 0;">
        <h2 style="color: #fff; margin: 0;">🧪 BUL QC App</h2>
        <p style="color: #DDD6FE; margin: 4px 0 0;">
          Laboratory Information Management System
        </p>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #EDE9FE;
                  border-radius: 0 0 12px 12px;">
        <h3 style="color: #1F2937;">
          ${changeType === 'password' ? 'Password' : 'Username'} Change Request
        </h3>
        <p style="color: #6B7280;">
          Someone requested a ${changeType} change on your BUL QC account.
          If this was you, use the code below. If not, ignore this email.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px;
                      color: #7C3AED; background: #F5F3FF; padding: 16px;
                      border-radius: 12px; border: 2px dashed #7C3AED;">
            ${code}
          </div>
        </div>
        <p style="color: #9CA3AF; font-size: 12px;">
          This code expires in <strong>10 minutes</strong>.
          Do not share it with anyone.
        </p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #9CA3AF; margin-top: 12px;">
        Designed by SantosInfographics © ${new Date().getFullYear()}
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from   : `"BUL QC App" <${process.env.GMAIL_USER}>`,
      to     : toEmail,
      subject,
      html,
    });
    console.log(`✅ Verification email sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    return false;
  }
};

module.exports = { sendVerificationCode };