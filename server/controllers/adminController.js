const User = require('../models/User');
const Log = require('../models/Log');
const Analytics = require('../models/Analytics');
const SoilRequest = require('../models/SoilRequest');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { sendOrderDeliveredEmail } = require('../services/emailService');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error in Admin getUsers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleBanUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent self-banning
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot ban yourself.' });
    }

    user.banned = !user.banned;
    await user.save();

    await new Log({
      userId: req.user.id,
      action: `${user.banned ? 'Banned' : 'Unbanned'} user ${user.email}`
    }).save();

    res.status(200).json({ message: `User successfully ${user.banned ? 'banned' : 'unbanned'}.`, user });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSystemLogs = async (req, res) => {
  try {
    const logs = await Log.find({})
      .populate('userId', 'username email')
      .sort({ timestamp: -1 })
      .limit(100);

    const sessions = await Analytics.find({})
      .populate('userId', 'username email')
      .sort({ loginTime: -1 })
      .limit(50);

    res.status(200).json({ logs, sessions });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateSoilRequest = async (req, res) => {
  const { id } = req.params;
  const { status, nitrogen, phosphorous, potassium, ph, moisture, soilType, cropType, temperature, humidity, remarks } = req.body;

  try {
    const request = await SoilRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Soil request not found' });
    }

    if (status) request.status = status;
    
    if (status === 'Completed') {
      request.nitrogen = nitrogen !== undefined && nitrogen !== '' ? Number(nitrogen) : null;
      request.phosphorous = phosphorous !== undefined && phosphorous !== '' ? Number(phosphorous) : null;
      request.potassium = potassium !== undefined && potassium !== '' ? Number(potassium) : null;
      request.ph = ph !== undefined && ph !== '' ? Number(ph) : null;
      request.moisture = moisture !== undefined && moisture !== '' ? Number(moisture) : null;
      request.soilType = soilType || null;
      request.cropType = cropType || null;
      request.temperature = temperature !== undefined && temperature !== '' ? Number(temperature) : null;
      request.humidity = humidity !== undefined && humidity !== '' ? Number(humidity) : null;
      request.remarks = remarks || null;
      request.reportDate = new Date();

      // Find and update the original Log entry to Completed
      try {
        const originalLog = await Log.findOne({
          action: `Created a Soil Testing request (ID: ${request._id})`
        });
        if (originalLog) {
          originalLog.status = 'Completed';
          await originalLog.save();
        }
      } catch (logErr) {
        console.error('Error updating original log status:', logErr.message);
      }
    }

    await request.save();

    await new Log({
      userId: req.user.id,
      action: `Updated Soil Request status of ID: ${request._id} to ${request.status}`
    }).save();

    res.status(200).json({ message: 'Soil request updated successfully', request });
  } catch (error) {
    console.error('Error updating Soil Request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSoilRequests = async (req, res) => {
  try {
    const requests = await SoilRequest.find({})
      .populate('userId', 'username email')
      .sort({ collectionDate: -1 });
    res.status(200).json({ requests });
  } catch (error) {
    console.error('Error fetching soil requests for admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { syncOrdersFromLogs } = require('../utils/orderSync');
    await syncOrdersFromLogs();

    const orders = await Order.find({})
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ message: 'Server error fetching all orders' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    if (!['Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid order status value.' });
    }

    const order = await Order.findById(id).populate('userId', 'username email');
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const prevStatus = order.status;
    order.status = status;
    await order.save();

    await new Log({
      userId: req.user.id,
      action: `Updated order status of ID: ${order._id} to ${status} (Customer: ${order.userId?.email || 'Unknown'})`
    }).save();

    // If status changed to Delivered and customer has an email, send them a delivery notification email
    if (status === 'Delivered' && prevStatus !== 'Delivered' && order.userId && order.userId.email) {
      const frontendUrl = req.headers.origin || process.env.FRONTEND_URL;
      sendOrderDeliveredEmail(order.userId.email, order, frontendUrl).catch(err => 
        console.error('Error sending order delivered email:', err)
      );
    }

    res.status(200).json({ message: 'Order status updated successfully', order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error updating order status' });
  }
};

// --- Product Management ---

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, category, price, oldPrice, rating, image, description, inStock } = req.body;
    if (!name || !category || price === undefined) {
      return res.status(400).json({ message: 'Name, category, and price are required.' });
    }
    const product = await Product.create({
      name, category, price,
      oldPrice: oldPrice || 0,
      rating: rating || 4.5,
      image: image || '',
      description: description || '',
      inStock: inStock !== false
    });

    await new Log({
      userId: req.user.id,
      action: `Added product: ${name} (₹${price})`
    }).save();

    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, { new: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    await new Log({
      userId: req.user.id,
      action: `Updated product: ${product.name}`
    }).save();

    res.status(200).json({ message: 'Product updated successfully', product });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    await new Log({
      userId: req.user.id,
      action: `Deleted product: ${product.name}`
    }).save();

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Cloudinary Configuration
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.uploadProductImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    // Upload stream to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'agromitra' },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({ message: 'Cloudinary upload failed.', error });
        }
        res.status(200).json({ imageUrl: result.secure_url });
      }
    );
    uploadStream.end(req.file.buffer);
  } catch (error) {
    console.error('Error in uploadProductImage:', error);
    res.status(500).json({ message: 'Server error during upload.' });
  }
};

const CropListing = require('../models/CropListing');

exports.getAllCrops = async (req, res) => {
  try {
    const crops = await CropListing.find({})
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });
    res.status(200).json({ crops });
  } catch (error) {
    console.error('Error in Admin getAllCrops:', error);
    res.status(500).json({ message: 'Server error fetching crop listings.' });
  }
};

exports.approveCropListing = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Approved' or 'Rejected'
  
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be Approved or Rejected.' });
  }
  
  try {
    const crop = await CropListing.findById(id).populate('userId', 'username email');
    if (!crop) {
      return res.status(404).json({ message: 'Crop listing not found.' });
    }
    
    crop.approvalStatus = status;
    await crop.save();
    
    await new Log({
      userId: req.user.id,
      action: `Updated crop listing approval of "${crop.cropName}" to ${status} (Farmer: ${crop.farmerName})`
    }).save();
    
    // Optionally create a notification for the farmer
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        message: `Your crop listing for "${crop.cropName}" has been ${status.toLowerCase()} by the administrator.`,
        targetRole: 'All'
      });
    } catch (notifErr) {
      console.error('Failed to create notification for crop approval:', notifErr.message);
    }
    
    res.status(200).json({ message: `Crop listing ${status.toLowerCase()} successfully.`, crop });
  } catch (error) {
    console.error('Error in approveCropListing:', error);
    res.status(500).json({ message: 'Server error updating crop listing status.' });
  }
};

exports.updateCategory = async (req, res) => {
  const { name, imageUrl } = req.body;
  if (!name || !imageUrl) {
    return res.status(400).json({ message: 'Name and imageUrl are required.' });
  }
  try {
    const category = await Category.findOneAndUpdate(
      { name: name.trim() },
      { imageUrl: imageUrl.trim() },
      { upsert: true, new: true }
    );

    // Also update any crop listings under this category
    const CropListing = require('../models/CropListing');
    await CropListing.updateMany(
      { category: name.trim() },
      { categoryImageUrl: imageUrl.trim() }
    );

    res.status(200).json({ message: 'Category thumbnail updated successfully.', category });
  } catch (error) {
    console.error('Error in updateCategory:', error);
    res.status(500).json({ message: 'Server error updating category thumbnail.' });
  }
};
