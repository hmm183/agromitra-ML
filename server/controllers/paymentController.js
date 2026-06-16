const Razorpay = require('razorpay');
const crypto = require('crypto');
const Log = require('../models/Log');
const Order = require('../models/Order');
const { sendOrderConfirmationEmail } = require('../services/emailService');

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

exports.createOrder = async (req, res) => {
  const { amount, currency, purpose } = req.body;
  if (!amount) {
    return res.status(400).json({ message: 'Amount is required' });
  }
  const amountInPaise = Math.round(amount * 100);

  try {
    if (!razorpay) {
      // Mock order creation for development mode when keys are not configured
      const mockOrderId = 'order_mock_' + crypto.randomBytes(8).toString('hex');
      return res.status(200).json({
        id: mockOrderId,
        amount: amountInPaise,
        currency: currency || 'INR',
        mock: true,
        key: 'rzp_test_mockkey'
      });
    }

    const options = {
      amount: amountInPaise,
      currency: currency || 'INR',
      receipt: 'rcpt_' + Date.now()
    };
    const order = await razorpay.orders.create(options);
    
    // Log order creation
    await new Log({
      userId: req.user.id,
      action: `Created payment order for ${purpose || 'general'} (Amount: ${amount})`
    }).save();

    res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ message: 'Error creating payment order' });
  }
};

exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, mock, items, amount, shippingDetails } = req.body;
  const frontendUrl = req.headers.origin || process.env.FRONTEND_URL;

  try {
    const finalItems = (items && items.length > 0) ? items : [
      { id: 999, name: 'Agricultural Supplies Package', category: 'General', price: amount || 0, qty: 1 }
    ];
    const finalShippingDetails = (shippingDetails && shippingDetails.fullName) ? shippingDetails : {
      fullName: req.user.username || 'Farmer Customer',
      phone: 'N/A',
      address: 'Specified at collection'
    };

    if (mock || !razorpay) {
      const orderDoc = await new Order({
        userId: req.user.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: 'mock_pay_' + crypto.randomBytes(4).toString('hex'),
        items: finalItems,
        totalAmount: amount || 0,
        shippingDetails: finalShippingDetails,
        status: 'Processing'
      }).save();

      // Log successful mock payment
      await new Log({
        userId: req.user.id,
        action: `Completed mock payment of order: ${razorpay_order_id}`
      }).save();

      // Send order confirmation email asynchronously
      sendOrderConfirmationEmail(req.user.email, orderDoc, true, frontendUrl).catch(err => console.error('Error sending order confirmation email:', err));

      return res.status(200).json({ status: 'success', message: 'Payment verified successfully (Mock)' });
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature === razorpay_signature) {
      const orderDoc = await new Order({
        userId: req.user.id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        items: finalItems,
        totalAmount: amount || 0,
        shippingDetails: finalShippingDetails,
        status: 'Processing'
      }).save();

      // Log verification
      await new Log({
        userId: req.user.id,
        action: `Completed payment of order: ${razorpay_order_id} (Payment ID: ${razorpay_payment_id})`
      }).save();

      // Send order confirmation email asynchronously
      sendOrderConfirmationEmail(req.user.email, orderDoc, true, frontendUrl).catch(err => console.error('Error sending order confirmation email:', err));

      res.status(200).json({ status: 'success', message: 'Payment verified successfully' });
    } else {
      // Send failed payment email
      const failedOrder = {
        razorpayOrderId: razorpay_order_id,
        totalAmount: amount || 0,
        items: finalItems,
        shippingDetails: finalShippingDetails,
        status: 'Cancelled',
        createdAt: new Date()
      };
      sendOrderConfirmationEmail(req.user.email, failedOrder, false, frontendUrl).catch(err => console.error('Error sending payment failure email:', err));

      res.status(400).json({ status: 'failure', message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    if (razorpay_order_id) {
      const failedOrder = {
        razorpayOrderId: razorpay_order_id,
        totalAmount: amount || 0,
        items: items || [],
        shippingDetails: shippingDetails || {},
        status: 'Cancelled',
        createdAt: new Date()
      };
      sendOrderConfirmationEmail(req.user.email, failedOrder, false, frontendUrl).catch(err => console.error('Error sending payment failure email:', err));
    }
    res.status(500).json({ message: 'Error verifying payment' });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const { syncOrdersFromLogs } = require('../utils/orderSync');
    await syncOrdersFromLogs();

    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    console.error('Error in getMyOrders:', error);
    res.status(500).json({ message: 'Server error fetching user orders' });
  }
};
