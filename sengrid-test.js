const sgMail = require('@sendgrid/mail');
require('dotenv').config(); // make sure .env is loaded

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendTestEmail() {
  try {
    const msg = {
      to: 'shebnem.xasan.29@gmail.com', // your real email address to receive the test
      from: 'snacksmartapp@gmail.com', // must be a verified sender in SendGrid
      templateId: process.env.SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        name: 'Test User',
        verify_link: 'https://example.com/verify?token=testtoken123'
      },
    };

    await sgMail.send(msg);
    console.log('✅ Test email sent successfully!');
  } catch (error) {
    console.error('❌ SendGrid test failed:', error.response?.body || error.message);
  }
}

sendTestEmail();
