const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: false // Can be empty if just sending an attachment
  },
  attachmentUrl: {
    type: String, // Path to the uploaded file
    required: false
  },
  attachmentName: {
    type: String, // Original file name
    required: false
  },
  read: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const supportTicketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ticketId: {
    type: String,
    required: true,
    unique: true
  },
  subject: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  messages: [messageSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  reopenedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
