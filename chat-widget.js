class SupportChatWidget {
  constructor() {
    this.apiBase = window.STRATMONT_CONFIG?.API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5001/api' : '/api');
    this.token = localStorage.getItem(window.STRATMONT_CONFIG?.TOKEN_KEY || 'stratmontToken');
    this.user = JSON.parse(localStorage.getItem(window.STRATMONT_CONFIG?.USER_KEY || 'stratmontUser') || 'null');
    this.isOpen = false;
    this.currentView = 'home'; // home, list, thread
    this.activeTicketId = null;
    this.tickets = [];
    this.pollInterval = null;
    this.lastPollTime = new Date(0).toISOString();
    this.unreadCount = 0;
    this.selectedFile = null;
    
    // Audio Context for subtle notification sound
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    this.init();
  }

  init() {
    this.injectHTML();
    this.cacheDOM();
    this.bindEvents();
    
    if (this.token) {
      this.fetchTickets();
      // Start background polling for unread count
      setInterval(() => this.pollUnreadCount(), 30000); 
    }
  }

  playNotificationSound() {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5
    oscillator.frequency.exponentialRampToValueAtTime(880.00, this.audioCtx.currentTime + 0.1); // A5
    
    gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05); // low volume
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(this.audioCtx.currentTime + 0.3);
  }

  injectHTML() {
    const html = `
      <div id="stratmont-chat-widget">
        <!-- Premium Floating Support Chat Button -->
        <button id="chatTriggerBtn" class="floating-support-btn" aria-label="Open Client Support">
            <span class="support-btn-pulse"></span>
            <div class="support-btn-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>
                </svg>
            </div>
            <div class="chat-unread-badge" id="chatUnreadBadge" style="display: none;">0</div>
        </button>

        <!-- Chat Panel -->
        <div class="chat-panel" id="chatPanel">
          <!-- Header -->
          <div class="chat-header">
            <div class="chat-header-top">
              <div class="chat-header-brand">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><polygon points="6 3 18 3 22 9 12 22 2 9"></polygon></svg>
                STRATMONT
              </div>
              <button class="chat-close-btn" id="chatCloseBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div class="chat-header-content" id="chatHeaderHome">
              <div class="chat-header-greeting">
                <h2>Hi there 👋</h2>
                <p>How can we help?</p>
              </div>
            </div>
            
            <div class="chat-header-content" id="chatHeaderThread" style="display: none;">
              <button class="chat-back-btn" id="chatBackBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Back
              </button>
              <div style="font-size: 0.95rem; font-weight: 600; margin-bottom: 4px;" id="chatThreadTitle">Support Ticket</div>
              <div style="font-size: 0.75rem; color: var(--chat-text-muted);" id="chatThreadId">ID: ---</div>
            </div>
          </div>

          <!-- Views -->
          <div class="chat-views-container">
            
            <!-- Home View -->
            <div class="chat-view chat-home-view active" id="chatViewHome">
              <button class="chat-new-conversation-btn" id="chatNewBtn">
                Send us a message
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
              
              <div id="chatRecentSection" style="display: none;">
                <div class="chat-section-title">Your Conversations</div>
                <div class="chat-conversations-list" id="chatConversationsList">
                  <!-- Populated dynamically -->
                </div>
              </div>
            </div>
            
            <!-- Thread View -->
            <div class="chat-view chat-thread-view slide-right" id="chatViewThread">
              <div class="chat-messages-container" id="chatMessagesArea">
                <!-- Messages populated dynamically -->
              </div>
              
              <!-- Typing Indicator -->
              <div id="chatTypingIndicator" style="display: none; padding: 0 20px 10px;">
                <div class="chat-typing-indicator">
                  <div class="chat-typing-dot"></div>
                  <div class="chat-typing-dot"></div>
                  <div class="chat-typing-dot"></div>
                </div>
              </div>
              
              <!-- Action Banner (Resolved/Closed) -->
              <div class="chat-action-banner" id="chatActionBanner" style="display: none;">
                <div id="chatResolvedText" style="font-size: 0.85rem; color: var(--chat-text-muted); margin-bottom: 10px;">This conversation is marked as resolved.</div>
                <button class="chat-action-btn" id="chatReopenBtn">Reopen Conversation</button>
              </div>

              <!-- Input Area -->
              <div class="chat-input-area" id="chatInputArea">
                
                <!-- File Preview -->
                <div class="chat-file-preview" id="chatFilePreview">
                  <div style="display: flex; align-items: center; gap: 5px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    <span class="chat-file-name" id="chatFileName">file.pdf</span>
                  </div>
                  <button class="chat-file-remove" id="chatFileRemoveBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>

                <div class="chat-input-row">
                  <div class="chat-input-wrapper">
                    <input type="file" id="chatFileInput" style="display: none;">
                    <button class="chat-attach-btn" id="chatAttachBtn" title="Attach file">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    </button>
                    <textarea class="chat-textarea" id="chatInput" rows="1" placeholder="Type your message..."></textarea>
                  </div>
                  <button class="chat-send-btn" id="chatSendBtn" disabled>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                </div>
                <div style="display: flex; justify-content: center; margin-top: 5px;">
                  <button id="chatResolveBtn" style="background: none; border: none; color: var(--chat-text-muted); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">Mark as Resolved</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    document.body.appendChild(div.firstChild);
  }

  cacheDOM() {
    this.triggerBtn = document.getElementById('chatTriggerBtn');
    this.panel = document.getElementById('chatPanel');
    this.closeBtn = document.getElementById('chatCloseBtn');
    this.backBtn = document.getElementById('chatBackBtn');
    this.newBtn = document.getElementById('chatNewBtn');
    this.unreadBadge = document.getElementById('chatUnreadBadge');
    
    // Views
    this.viewHome = document.getElementById('chatViewHome');
    this.viewThread = document.getElementById('chatViewThread');
    
    // Header sections
    this.headerHome = document.getElementById('chatHeaderHome');
    this.headerThread = document.getElementById('chatHeaderThread');
    this.threadTitle = document.getElementById('chatThreadTitle');
    this.threadId = document.getElementById('chatThreadId');
    
    // Content areas
    this.recentSection = document.getElementById('chatRecentSection');
    this.conversationsList = document.getElementById('chatConversationsList');
    this.messagesArea = document.getElementById('chatMessagesArea');
    
    // Input
    this.inputArea = document.getElementById('chatInputArea');
    this.input = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('chatSendBtn');
    this.attachBtn = document.getElementById('chatAttachBtn');
    this.fileInput = document.getElementById('chatFileInput');
    this.filePreview = document.getElementById('chatFilePreview');
    this.fileName = document.getElementById('chatFileName');
    this.fileRemoveBtn = document.getElementById('chatFileRemoveBtn');
    
    // Actions
    this.actionBanner = document.getElementById('chatActionBanner');
    this.reopenBtn = document.getElementById('chatReopenBtn');
    this.resolveBtn = document.getElementById('chatResolveBtn');
  }

  bindEvents() {
    this.triggerBtn.addEventListener('click', () => this.togglePanel());
    this.closeBtn.addEventListener('click', () => this.togglePanel(false));
    this.backBtn.addEventListener('click', () => this.switchView('home'));
    
    this.newBtn.addEventListener('click', () => {
      this.activeTicketId = null;
      this.messagesArea.innerHTML = `
        <div class="chat-system-message">Send a message to start a new conversation.</div>
      `;
      this.threadTitle.innerText = "New Conversation";
      this.threadId.innerText = "";
      this.switchView('thread');
      this.updateInputState();
      setTimeout(() => this.input.focus(), 300);
    });
    
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = (this.input.scrollHeight) + 'px';
      this.checkInputValidity();
    });
    
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.sendBtn.disabled) this.sendMessage();
      }
    });
    
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    
    this.attachBtn.addEventListener('click', () => this.fileInput.click());
    
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.selectedFile = e.target.files[0];
        
        // Check size (5MB limit)
        if (this.selectedFile.size > 5 * 1024 * 1024) {
          alert('File size exceeds 5MB limit.');
          this.clearFile();
          return;
        }
        
        this.fileName.textContent = this.selectedFile.name;
        this.filePreview.classList.add('active');
        this.checkInputValidity();
      }
    });
    
    this.fileRemoveBtn.addEventListener('click', () => this.clearFile());
    
    this.resolveBtn.addEventListener('click', () => this.updateTicketStatus('resolved'));
    this.reopenBtn.addEventListener('click', () => this.updateTicketStatus('open'));
  }

  checkInputValidity() {
    const text = this.input.value.trim();
    if (text.length > 0 || this.selectedFile) {
      this.sendBtn.disabled = false;
    } else {
      this.sendBtn.disabled = true;
    }
  }

  clearFile() {
    this.selectedFile = null;
    this.fileInput.value = '';
    this.filePreview.classList.remove('active');
    this.checkInputValidity();
  }

  togglePanel(forceState) {
    if (!this.token) {
      window.location.href = 'auth.html';
      return;
    }
    
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    
    if (this.isOpen) {
      this.panel.classList.add('active');
      this.fetchTickets();
      this.startPolling();
      if (this.currentView === 'thread') {
        this.input.focus();
      }
    } else {
      this.panel.classList.remove('active');
      this.stopPolling();
    }
  }

  switchView(view) {
    this.currentView = view;
    
    if (view === 'home') {
      this.viewHome.classList.add('active');
      this.viewHome.classList.remove('slide-left');
      this.viewThread.classList.remove('active');
      this.viewThread.classList.add('slide-right');
      
      this.headerHome.style.display = 'block';
      this.headerThread.style.display = 'none';
      
      this.activeTicketId = null;
      this.fetchTickets(); // Refresh list
    } else if (view === 'thread') {
      this.viewHome.classList.remove('active');
      this.viewHome.classList.add('slide-left');
      this.viewThread.classList.add('active');
      this.viewThread.classList.remove('slide-right');
      
      this.headerHome.style.display = 'none';
      this.headerThread.style.display = 'block';
      
      // Update unread count immediately since opening thread marks as read
      this.recalculateUnreadCount();
    }
  }

  async fetchTickets() {
    if (!this.token) return;
    
    try {
      const res = await fetch(`${this.apiBase}/support/tickets`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        this.tickets = await res.json();
        this.renderConversationsList();
        this.recalculateUnreadCount();
      }
    } catch (err) {
      console.error('Chat widget: Error fetching tickets', err);
    }
  }

  recalculateUnreadCount() {
    this.unreadCount = 0;
    this.tickets.forEach(t => {
      t.messages.forEach(m => {
        if (m.sender === 'admin' && !m.read && t._id !== this.activeTicketId) {
          this.unreadCount++;
        }
      });
    });
    
    if (this.unreadCount > 0) {
      this.unreadBadge.style.display = 'flex';
      this.unreadBadge.innerText = this.unreadCount;
    } else {
      this.unreadBadge.style.display = 'none';
    }
  }

  async pollUnreadCount() {
    if (this.isOpen || !this.token) return; // Don't background poll if widget is open (it has its own poll)
    await this.fetchTickets();
  }

  renderConversationsList() {
    if (this.tickets.length === 0) {
      this.recentSection.style.display = 'none';
      return;
    }
    
    this.recentSection.style.display = 'block';
    this.conversationsList.innerHTML = '';
    
    this.tickets.forEach(ticket => {
      const lastMsg = ticket.messages[ticket.messages.length - 1];
      const previewText = lastMsg ? (lastMsg.content || (lastMsg.attachmentUrl ? '📎 Attachment' : '')) : 'No messages yet';
      
      // Count unreads for this specific ticket
      const ticketUnreads = ticket.messages.filter(m => m.sender === 'admin' && !m.read).length;
      
      const item = document.createElement('div');
      item.className = 'chat-conversation-item';
      item.innerHTML = `
        <div class="chat-conversation-header">
          <span class="chat-conversation-status status-${ticket.status}">${ticket.status}</span>
          <span class="chat-conversation-time">${this.formatTime(ticket.lastMessageAt)}</span>
        </div>
        <div class="chat-conversation-preview" style="${ticketUnreads > 0 ? 'font-weight: 700; color: #fff;' : ''}">
          ${ticketUnreads > 0 ? '<span style="color: #EF4444; margin-right: 5px;">●</span>' : ''}
          ${ticket.subject}
        </div>
      `;
      
      item.addEventListener('click', () => this.openThread(ticket._id));
      this.conversationsList.appendChild(item);
    });
  }

  async openThread(ticketId) {
    this.activeTicketId = ticketId;
    this.switchView('thread');
    this.messagesArea.innerHTML = '<div class="chat-system-message">Loading...</div>';
    this.updateInputState();
    
    try {
      const res = await fetch(`${this.apiBase}/support/tickets/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (res.ok) {
        const ticket = await res.json();
        this.threadTitle.innerText = ticket.subject;
        this.threadId.innerText = `ID: ${ticket.ticketId}`;
        this.lastPollTime = new Date().toISOString();
        
        this.renderMessages(ticket.messages);
        this.updateActionBanner(ticket.status);
        
        // Re-fetch tickets in background to update read status on list
        this.fetchTickets();
      }
    } catch (err) {
      this.messagesArea.innerHTML = '<div class="chat-system-message">Error loading conversation.</div>';
    }
  }

  renderMessages(messages, append = false) {
    if (!append) {
      this.messagesArea.innerHTML = '';
      if (messages.length === 0) {
        this.messagesArea.innerHTML = '<div class="chat-system-message">No messages yet.</div>';
        return;
      }
    }
    
    messages.forEach(msg => {
      const isUser = msg.sender === 'user';
      const wrapper = document.createElement('div');
      wrapper.className = `chat-message-wrapper ${isUser ? 'user' : 'admin'}`;
      
      let contentHtml = '';
      if (msg.content) {
        contentHtml += `${msg.content.replace(/\\n/g, '<br>')}`;
      }
      
      if (msg.attachmentUrl) {
        contentHtml += `
          <div class="chat-attachment">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            <a href="${msg.attachmentUrl}" target="_blank">${msg.attachmentName || 'Attachment'}</a>
          </div>
        `;
      }
      
      wrapper.innerHTML = `
        ${!isUser ? `<div class="chat-message-sender">${msg.senderName}</div>` : ''}
        <div class="chat-message-bubble">${contentHtml}</div>
        <div class="chat-message-time">${this.formatTime(msg.timestamp)} ${isUser && msg.read ? '· Read' : ''}</div>
      `;
      
      this.messagesArea.appendChild(wrapper);
    });
    
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
  }

  async sendMessage() {
    const content = this.input.value.trim();
    if (!content && !this.selectedFile) return;
    
    this.sendBtn.disabled = true;
    this.input.disabled = true;
    this.attachBtn.disabled = true;
    
    const formData = new FormData();
    if (content) formData.append('message', content);
    if (content) formData.append('content', content); // for existing tickets endpoint
    if (this.selectedFile) formData.append('attachment', this.selectedFile);
    
    try {
      let url, method;
      
      if (this.activeTicketId) {
        url = `${this.apiBase}/support/tickets/${this.activeTicketId}/messages`;
        method = 'POST';
      } else {
        url = `${this.apiBase}/support/tickets`;
        method = 'POST';
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });
      
      if (res.ok) {
        const ticket = await res.json();
        
        this.input.value = '';
        this.input.style.height = 'auto';
        this.clearFile();
        
        if (!this.activeTicketId) {
          // It was a new ticket
          this.openThread(ticket._id);
        } else {
          // Append only new messages? Easiest is re-render all for now to ensure consistency, 
          // but let's just do a manual fetch or rely on the poll interval to catch it.
          // Actually, the API returns the updated ticket.
          this.renderMessages(ticket.messages);
          this.updateActionBanner(ticket.status);
          this.lastPollTime = new Date().toISOString();
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send message.');
    } finally {
      this.input.disabled = false;
      this.attachBtn.disabled = false;
      this.checkInputValidity();
      this.input.focus();
    }
  }

  updateActionBanner(status) {
    if (status === 'resolved' || status === 'closed') {
      this.actionBanner.style.display = 'block';
      this.inputArea.style.display = 'none';
    } else {
      this.actionBanner.style.display = 'none';
      this.inputArea.style.display = 'flex';
      this.resolveBtn.style.display = (this.activeTicketId) ? 'inline-block' : 'none';
    }
  }

  updateInputState() {
    if (!this.activeTicketId) {
      this.resolveBtn.style.display = 'none';
      this.actionBanner.style.display = 'none';
      this.inputArea.style.display = 'flex';
    }
  }

  async updateTicketStatus(newStatus) {
    if (!this.activeTicketId) return;
    
    try {
      const endpoint = newStatus === 'resolved' ? 'resolve' : 'reopen';
      const res = await fetch(`${this.apiBase}/support/tickets/${this.activeTicketId}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (res.ok) {
        const ticket = await res.json();
        this.updateActionBanner(ticket.status);
      }
    } catch (err) {
      console.error(err);
    }
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    
    this.pollInterval = setInterval(async () => {
      if (this.currentView === 'thread' && this.activeTicketId) {
        await this.pollActiveThread();
      } else if (this.currentView === 'home') {
        await this.fetchTickets();
      }
    }, 3000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async pollActiveThread() {
    try {
      const pollUrl = `${this.apiBase}/support/tickets/${this.activeTicketId}/poll?since=${this.lastPollTime}`;
      const res = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.messages && data.messages.length > 0) {
          this.renderMessages(data.messages, true); // Append
          this.lastPollTime = new Date().toISOString();
          
          // Play sound if there's a new admin message
          const hasNewAdminMsg = data.messages.some(m => m.sender === 'admin');
          if (hasNewAdminMsg) {
            this.playNotificationSound();
          }
        }
        
        if (data.status) {
          this.updateActionBanner(data.status);
        }
      }
    } catch (err) {
      // Silent fail for polling
    }
  }

  formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.StratmontSupportWidget = new SupportChatWidget();
  
  // Auto-open the support chat if redirected from homepage chatbox
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'support') {
    // Small delay to let the widget finish initializing
    setTimeout(() => {
      if (window.StratmontSupportWidget) {
        window.StratmontSupportWidget.togglePanel(true);
      }
    }, 500);
    // Clean the URL so refreshing doesn't keep re-opening the chat
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
