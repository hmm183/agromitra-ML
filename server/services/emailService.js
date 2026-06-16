// Service for sending emails (OTP and Google password)
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // 587 uses STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendOTPEmail(toEmail, otp) {
  const mailOptions = {
    from: process.env.SMTP_SENDER || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`
  };
  await transporter.sendMail(mailOptions);
}

async function sendPasswordEmail(toEmail, password) {
  const mailOptions = {
    from: process.env.SMTP_SENDER || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Your Local Login Password',
    text: `Your temporary password is: ${password}. Please change it after logging in.`
  };
  await transporter.sendMail(mailOptions);
}

async function sendOrderConfirmationEmail(toEmail, order, success = true, frontendUrl = null) {
  const estDelivery = new Date(order.createdAt || Date.now());
  estDelivery.setDate(estDelivery.getDate() + 5);
  const formattedEstDelivery = estDelivery.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subject = success
    ? `Order Confirmed! ID: ${order.razorpayOrderId}`
    : `Order Payment Failed: ID: ${order.razorpayOrderId}`;

  // Build items rows
  let itemsHtml = '';
  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      itemsHtml += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px; text-align: left; font-size: 14px; color: #333333;">${item.name}</td>
          <td style="padding: 12px; text-align: center; font-size: 14px; color: #666666;">${item.category}</td>
          <td style="padding: 12px; text-align: center; font-size: 14px; color: #666666;">${item.qty}</td>
          <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: bold; color: #333333;">₹${(item.price * item.qty).toLocaleString()}</td>
        </tr>
      `;
    });
  }

  const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const trackingLink = `${baseUrl}/my-orders`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f9fa; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td align="center" style="background-color: ${success ? '#2e7d32' : '#c62828'}; padding: 40px 20px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">AgroMitra</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                    ${success ? 'Thank you for your order!' : 'There was an issue with your payment.'}
                  </p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #333333; font-weight: 600;">
                    ${success ? 'Order Confirmation' : 'Order Unsuccessful'}
                  </h2>
                  <p style="margin: 0 0 20px 0; font-size: 15px; color: #555555; line-height: 1.6;">
                    ${success 
                      ? `We have received your payment and your order is currently being processed. Here are your order invoice details. You can track your package directly inside your AgroMitra account.` 
                      : `We're sorry, but the payment transaction verification for your order was unsuccessful. No order has been placed. If money was deducted, it will be refunded shortly. You can try checkout again.`
                    }
                  </p>

                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 15px;">
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #64748b;"><strong>Order ID:</strong></td>
                      <td style="padding: 5px 0; font-size: 14px; color: #1e293b; text-align: right; font-family: monospace;">${order.razorpayOrderId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #64748b;"><strong>Status:</strong></td>
                      <td style="padding: 5px 0; font-size: 14px; text-align: right;">
                        <span style="background-color: ${success ? '#fef3c7' : '#fee2e2'}; color: ${success ? '#d97706' : '#dc2626'}; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                          ${success ? 'Processing (Paid)' : 'Cancelled / Failed'}
                        </span>
                      </td>
                    </tr>
                    ${success ? `
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #64748b;"><strong>Estimated Delivery:</strong></td>
                      <td style="padding: 5px 0; font-size: 14px; color: #1e293b; text-align: right; font-weight: 600;">${formattedEstDelivery}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #64748b;"><strong>Tracking Number:</strong></td>
                      <td style="padding: 5px 0; font-size: 14px; color: #1e293b; text-align: right; font-family: monospace;">TRK-${order.razorpayOrderId.substring(6)}</td>
                    </tr>
                    ` : ''}
                  </table>

                  <!-- Invoice Bill Table -->
                  <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333333; font-weight: 600; border-bottom: 2px solid #2e7d32; padding-bottom: 5px;">Invoice Summary</h3>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                      <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #475569;">Item</th>
                        <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: #475569;">Category</th>
                        <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: #475569;">Qty</th>
                        <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: #475569;">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                      <tr>
                        <td colspan="3" style="padding: 15px 12px; text-align: right; font-size: 15px; font-weight: 600; color: #333333;">Total Amount paid:</td>
                        <td style="padding: 15px 12px; text-align: right; font-size: 18px; font-weight: 700; color: #2e7d32;">₹${order.totalAmount.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Shipping Details -->
                  ${order.shippingDetails ? `
                  <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #333333; font-weight: 600;">Delivery Address</h3>
                  <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 15px; font-size: 14px; color: #475569; line-height: 1.5;">
                    <strong style="color: #1e293b; display: block; margin-bottom: 5px;">${order.shippingDetails.fullName}</strong>
                    Phone: ${order.shippingDetails.phone}<br>
                    Address: ${order.shippingDetails.address}
                  </div>
                  ` : ''}

                  <!-- Action Button -->
                  ${success ? `
                  <div align="center" style="margin-top: 35px;">
                    <a href="${trackingLink}" target="_blank" style="background-color: #2e7d32; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 15px; font-weight: 600; border-radius: 8px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      Track Your Package
                    </a>
                  </div>
                  ` : `
                  <div align="center" style="margin-top: 35px;">
                    <a href="${trackingLink.replace('/my-orders', '/shop')}" target="_blank" style="background-color: #c62828; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 15px; font-weight: 600; border-radius: 8px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      Return to Shop
                    </a>
                  </div>
                  `}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="background-color: #f1f5f9; padding: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                  This is an automated transactional email from AgroMitra. Please do not reply directly to this message.<br>
                  &copy; 2026 AgroMitra. All Rights Reserved.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.SMTP_SENDER || process.env.SMTP_USER,
    to: toEmail,
    subject: subject,
    html: htmlContent
  };
  await transporter.sendMail(mailOptions);
}

async function sendOrderDeliveredEmail(toEmail, order, frontendUrl = null) {
  const subject = `Your Package Has Been Delivered! ID: ${order.razorpayOrderId}`;
  const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const reviewLink = `${baseUrl}/my-orders`;

  let itemsListHtml = '';
  if (order.items && order.items.length > 0) {
    itemsListHtml = '<ul style="padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6; margin: 10px 0 20px 0;">';
    order.items.forEach(item => {
      itemsListHtml += `<li><strong>${item.name}</strong> (Qty: ${item.qty})</li>`;
    });
    itemsListHtml += '</ul>';
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f9fa; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td align="center" style="background-color: #2e7d32; padding: 40px 20px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">AgroMitra</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                    Package Delivered Successfully!
                  </p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #333333; font-weight: 600;">
                    Your Delivery has Arrived!
                  </h2>
                  <p style="margin: 0 0 20px 0; font-size: 15px; color: #555555; line-height: 1.6;">
                    Hi <strong>${order.shippingDetails?.fullName || 'Customer'}</strong>,<br><br>
                    Great news! Your package for Order ID **${order.razorpayOrderId}** has been successfully delivered to your specified shipping address:
                  </p>
                  
                  <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 25px; font-size: 14px; color: #475569; line-height: 1.5;">
                    <strong style="color: #1e293b; display: block; margin-bottom: 5px;">Delivery Address:</strong>
                    ${order.shippingDetails?.address || 'Specified at collection'}
                  </div>

                  <h4 style="margin: 0 0 5px 0; font-size: 15px; color: #333333; font-weight: 600;">Delivered Items:</h4>
                  ${itemsListHtml}

                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">

                  <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1e293b; font-weight: 600; text-align: center;">How is your purchase?</h3>
                  <p style="margin: 0 0 25px 0; font-size: 14px; color: #64748b; line-height: 1.6; text-align: center;">
                    Your feedback helps us and the farming community make better choices. Please take a moment to rate and review the products you received.
                  </p>

                  <!-- Action Button -->
                  <div align="center">
                    <a href="${reviewLink}" target="_blank" style="background-color: #eab308; color: #1e293b; text-decoration: none; padding: 12px 30px; font-size: 15px; font-weight: 700; border-radius: 8px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      ★ Rate Your Products
                    </a>
                  </div>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="background-color: #f1f5f9; padding: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                  This is an automated transactional email from AgroMitra. Please do not reply directly to this message.<br>
                  &copy; 2026 AgroMitra. All Rights Reserved.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.SMTP_SENDER || process.env.SMTP_USER,
    to: toEmail,
    subject: subject,
    html: htmlContent
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { 
  sendOTPEmail, 
  sendPasswordEmail,
  sendOrderConfirmationEmail,
  sendOrderDeliveredEmail
};
