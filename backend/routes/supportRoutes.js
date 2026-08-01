const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SupportTicket = require('../models/SupportTicket');
const { protect } = require('../middleware/authMiddleware');

// Ensure uploads directory exists
// Use /tmp in Vercel production to avoid read-only filesystem crashes
const isVercel = process.env.NODE_ENV === 'production';
const uploadDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, '../uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  console.warn('⚠️ Could not create uploads directory:', error.message);
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Only images and PDFs are allowed.');
      err.status = 400;
      cb(err);
    }
  }
});

// Admin check middleware
const adminCheck = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

// ==========================================
// USER ROUTES
// ==========================================

// Create a new ticket
router.post('/tickets', protect, upload.single('attachment'), async (req, res) => {
  try {
    const { message } = req.body;
    
    // Generate a ticket ID
    const count = await SupportTicket.countDocuments();
    const ticketId = `STM-${(count + 1).toString().padStart(5, '0')}`;
    
    // First message subject (truncate)
    const subject = message ? (message.length > 50 ? message.substring(0, 50) + '...' : message) : 'Attachment Only';
    
    const newMessage = {
      sender: 'user',
      senderName: req.user.name,
      content: message || '',
    };

    if (req.file) {
      newMessage.attachmentUrl = req.file.path || `/uploads/${req.file.filename}`;
      newMessage.attachmentName = req.file.originalname;
    }

    const ticket = new SupportTicket({
      user: req.user._id,
      ticketId,
      subject,
      messages: [newMessage]
    });

    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all tickets for current user
router.get('/tickets', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id }).sort({ lastMessageAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single ticket
router.get('/tickets/:id', protect, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('user', 'name email');
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (ticket.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Mark messages as read
    let modified = false;
    if (req.user.role === 'user') {
      ticket.messages.forEach(msg => {
        if (msg.sender === 'admin' && !msg.read) {
          msg.read = true;
          modified = true;
        }
      });
    } else if (req.user.role === 'admin') {
      ticket.messages.forEach(msg => {
        if (msg.sender === 'user' && !msg.read) {
          msg.read = true;
          modified = true;
        }
      });
    }
    if (modified) await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Poll for new messages (User or Admin)
router.get('/tickets/:id/poll', protect, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (ticket.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Find messages newer than 'since'
    const newMessages = ticket.messages.filter(msg => new Date(msg.timestamp) > since);
    
    // Also, if requested by user, mark admin messages as read
    let modified = false;
    if (req.user.role === 'user') {
      ticket.messages.forEach(msg => {
        if (msg.sender === 'admin' && !msg.read) {
          msg.read = true;
          modified = true;
        }
      });
    } else if (req.user.role === 'admin') {
      ticket.messages.forEach(msg => {
        if (msg.sender === 'user' && !msg.read) {
          msg.read = true;
          modified = true;
        }
      });
    }
    
    if (modified) await ticket.save();
    
    res.json({
      messages: newMessages,
      status: ticket.status
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message on a ticket
router.post('/tickets/:id/messages', protect, upload.single('attachment'), async (req, res) => {
  try {
    const { content } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (ticket.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    if (ticket.status === 'closed') {
      return res.status(400).json({ message: 'Cannot reply to a closed ticket. Please reopen it first.' });
    }
    
    const newMessage = {
      sender: 'user',
      senderName: req.user.name,
      content: content || ''
    };

    if (req.file) {
      newMessage.attachmentUrl = req.file.path || `/uploads/${req.file.filename}`;
      newMessage.attachmentName = req.file.originalname;
    }
    
    ticket.messages.push(newMessage);
    ticket.lastMessageAt = Date.now();
    
    // If ticket was resolved, sending a message automatically reopens it or keeps it open
    if (ticket.status === 'resolved') {
      ticket.status = 'open';
      ticket.reopenedAt = Date.now();
    }
    
    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark ticket as resolved
router.put('/tickets/:id/resolve', protect, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (ticket.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    ticket.status = 'resolved';
    ticket.resolvedAt = Date.now();
    await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reopen a resolved ticket
router.put('/tickets/:id/reopen', protect, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (ticket.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    ticket.status = 'open';
    ticket.reopenedAt = Date.now();
    await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

// Get all tickets with filters
router.get('/admin/tickets', protect, adminCheck, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Fetch tickets with user data
    let tickets = await SupportTicket.find(query)
      .populate('user', 'name email')
      .sort({ lastMessageAt: -1 });
      
    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      tickets = tickets.filter(t => {
        return (t.ticketId.toLowerCase().includes(searchLower) ||
               (t.user && t.user.name && t.user.name.toLowerCase().includes(searchLower)) ||
               (t.user && t.user.email && t.user.email.toLowerCase().includes(searchLower)));
      });
    }
    
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ticket stats
router.get('/admin/tickets/stats', protect, adminCheck, async (req, res) => {
  try {
    const openCount = await SupportTicket.countDocuments({ status: 'open' });
    const pendingCount = await SupportTicket.countDocuments({ status: 'pending' });
    const resolvedCount = await SupportTicket.countDocuments({ status: 'resolved' });
    
    // Count unread messages (where sender is user and read is false)
    const tickets = await SupportTicket.find({ 'messages.sender': 'user', 'messages.read': false });
    let unreadCount = 0;
    tickets.forEach(ticket => {
      ticket.messages.forEach(msg => {
        if (msg.sender === 'user' && !msg.read) unreadCount++;
      });
    });
    
    res.json({
      open: openCount,
      pending: pendingCount,
      resolved: resolvedCount,
      unread: unreadCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin reply to ticket
router.post('/admin/tickets/:id/messages', protect, adminCheck, upload.single('attachment'), async (req, res) => {
  try {
    const { content } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    const newMessage = {
      sender: 'admin',
      senderName: 'Stratmont Support', // Or req.user.name if we want personal names
      content: content || ''
    };

    if (req.file) {
      newMessage.attachmentUrl = req.file.path || `/uploads/${req.file.filename}`;
      newMessage.attachmentName = req.file.originalname;
    }
    
    ticket.messages.push(newMessage);
    ticket.lastMessageAt = Date.now();
    ticket.status = 'pending'; // Change status to pending (awaiting user)
    
    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin change ticket status
router.put('/admin/tickets/:id/status', protect, adminCheck, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid ticket status.' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    ticket.status = status;
    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = Date.now();
    }
    
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin change ticket priority
router.put('/admin/tickets/:id/priority', protect, adminCheck, async (req, res) => {
  try {
    const { priority } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    ticket.priority = priority;
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin delete ticket
router.delete('/admin/tickets/:id', protect, adminCheck, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Also delete associated attachments if possible (optional but good practice)
    ticket.messages.forEach(msg => {
      if (msg.attachmentUrl) {
        const filePath = path.join(__dirname, '..', msg.attachmentUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    await SupportTicket.deleteOne({ _id: req.params.id });
    res.json({ message: 'Ticket removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
