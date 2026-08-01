const API = window.STRATMONT_CONFIG?.API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5001/api' : '/api');
let token = localStorage.getItem(window.STRATMONT_CONFIG?.TOKEN_KEY || 'stratmontToken');
let currentUser = JSON.parse(localStorage.getItem(window.STRATMONT_CONFIG?.USER_KEY || 'stratmontUser') || 'null');
let allTxData = [];
let currentFilter = 'all';

// ─── AUTH GUARD ───
if (!token || !currentUser) { window.location.href = 'auth.html'; }
if (currentUser?.role !== 'admin') {
    alert('Access denied. Admins only.');
    window.location.href = 'auth.html';
}

// ─── HELPERS ───
const fmt = n => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

// ─── VIEW ROUTING ───
const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');
    const titles = { overview: 'Overview', transactions: 'Transactions', users: 'Users', wallets: 'Wallet Settings', support: 'Support Center' };
    document.getElementById('topbarTitle').textContent = titles[viewId];

    if (viewId === 'transactions') loadAllTransactions();
    if (viewId === 'users') loadUsers();
    if (viewId === 'wallets') loadWallets();
    if (viewId === 'support') loadSupportTickets();
    if (viewId === 'audit') loadAuditLogs();
};

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
});

// ─── LOGOUT ───
document.getElementById('adminLogout').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'auth.html';
});

// ─── LOAD STATS ───
const loadStats = async () => {
    try {
        const res = await fetch(`${API}/admin/stats`, { headers: headers() });
        if (res.status === 401 || res.status === 403) { localStorage.clear(); window.location.href = 'auth.html'; return; }
        const data = await res.json();
        document.getElementById('statUsers').textContent = data.totalUsers;
        document.getElementById('statDeposits').textContent = fmt(data.totalApprovedDeposits);
        document.getElementById('statPending').textContent = data.pendingDeposits;
        document.getElementById('statTx').textContent = data.totalTransactions;
    } catch (err) { console.error(err); }
};

// ─── LOAD PENDING DEPOSITS (OVERVIEW) ───
const loadPendingTx = async () => {
    const el = document.getElementById('pendingTxTable');
    try {
        const res = await fetch(`${API}/admin/transactions`, { headers: headers() });
        const txs = await res.json();
        const pending = txs.filter(t => t.status === 'pending');
        if (!pending.length) { el.innerHTML = '<p class="empty-state">✓ No pending transactions. All caught up!</p>'; return; }
        el.innerHTML = renderTxTable(pending, true);
    } catch (err) { el.innerHTML = '<p class="empty-state">Error loading transactions.</p>'; }
};

// ─── LOAD ALL TRANSACTIONS ───
const loadAllTransactions = async () => {
    const el = document.getElementById('allTxTable');
    el.innerHTML = '<p class="empty-state">Loading...</p>';
    try {
        const res = await fetch(`${API}/admin/transactions`, { headers: headers() });
        allTxData = await res.json();
        renderFilteredTx();
    } catch (err) { el.innerHTML = '<p class="empty-state">Error loading transactions.</p>'; }
};

const renderFilteredTx = () => {
    const el = document.getElementById('allTxTable');
    const filtered = currentFilter === 'all' ? allTxData : allTxData.filter(t => t.status === currentFilter);
    if (!filtered.length) { el.innerHTML = `<p class="empty-state">No ${currentFilter} transactions found.</p>`; return; }
    el.innerHTML = renderTxTable(filtered, true);
};

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderFilteredTx();
    });
});

// ─── RENDER TX TABLE ───
const renderTxTable = (txs, showActions = false) => `
    <table class="data-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>User</th>
                <th>Email</th>
                <th>Coin</th>
                <th>Amount</th>
                <th>TX Hash</th>
                <th>Status</th>
                ${showActions ? '<th>Actions</th>' : ''}
            </tr>
        </thead>
        <tbody>
            ${txs.map(tx => `
                <tr>
                    <td>${fmtDate(tx.createdAt)}</td>
                    <td>${tx.user?.name || 'Unknown'}</td>
                    <td style="color:var(--muted);font-size:0.8rem;">${tx.user?.email || '—'}</td>
                    <td>${tx.coin || 'N/A'}</td>
                    <td style="font-weight:600;">${fmt(tx.amount)}</td>
                    <td style="font-size:0.75rem;color:var(--muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${tx.transactionHash || ''}">${tx.transactionHash ? tx.transactionHash.substring(0, 18) + '...' : '—'}</td>
                    <td><span class="badge ${tx.status}">${tx.status}</span></td>
                    ${showActions ? `
                    <td>
                        ${tx.status === 'pending' ? `
                            <button class="btn-approve" onclick="updateTx('${tx._id}', 'approved')">Approve</button>
                            <button class="btn-reject" onclick="updateTx('${tx._id}', 'rejected')">Reject</button>
                        ` : `<span style="color:var(--muted);font-size:0.8rem;">${tx.status === 'approved' ? '✓ Done' : '✗ Done'}</span>`}
                    </td>` : ''}
                </tr>
            `).join('')}
        </tbody>
    </table>
`;

// ─── APPROVE / REJECT ───
window.updateTx = async (id, status) => {
    try {
        const res = await fetch(`${API}/admin/transactions/${id}`, {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        // Refresh
        loadStats();
        loadPendingTx();
        if (document.getElementById('view-transactions').classList.contains('active')) loadAllTransactions();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

// ─── LOAD USERS ───
const loadUsers = async () => {
    const el = document.getElementById('usersTable');
    el.innerHTML = '<p class="empty-state">Loading...</p>';
    try {
        const res = await fetch(`${API}/admin/users`, { headers: headers() });
        const users = await res.json();
        if (!users.length) { el.innerHTML = '<p class="empty-state">No users found.</p>'; return; }
        el.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Balance</th>
                        <th>Total Deposited</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td style="font-weight:500;">${u.name}</td>
                            <td style="color:var(--muted);font-size:0.85rem;">${u.email}</td>
                            <td><span class="badge ${u.role === 'admin' ? 'approved' : (u.status === 'suspended' || u.status === 'banned' ? 'rejected' : 'pending')}">${u.role === 'admin' ? 'admin' : u.status}</span></td>
                            <td>${fmt(u.balances?.availableBalance)}</td>
                            <td>${fmt(u.balances?.totalDeposit)}</td>
                            <td style="color:var(--muted);font-size:0.8rem;">${fmtDate(u.createdAt)}</td>
                            <td>
                                <button class="btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="openBalanceModal('${u._id}', '${u.name}', ${u.balances?.availableBalance || 0}, ${u.balances?.totalDeposit || 0}, ${u.balances?.totalEarnings || 0})">Balance</button>
                                <button class="btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin-left: 0.5rem;" onclick="openStatusModal('${u._id}', '${u.name}', '${u.status || 'active'}')">Status</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) { el.innerHTML = '<p class="empty-state">Error loading users.</p>'; }
};

// ─── USER ACTIONS (MODALS) ───
window.openModal = (id) => document.getElementById(id).classList.add('active');
window.closeModal = (id) => document.getElementById(id).classList.remove('active');

window.openBalanceModal = (id, name, avail, dep, earn) => {
    document.getElementById('balanceUserId').value = id;
    document.getElementById('balanceModalUser').textContent = `Editing balances for ${name}`;
    document.getElementById('modAvail').value = avail;
    document.getElementById('modDeposit').value = dep;
    document.getElementById('modEarnings').value = earn;
    document.getElementById('balanceAlert').style.display = 'none';
    openModal('balanceModal');
};

document.getElementById('balanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('balanceUserId').value;
    const avail = document.getElementById('modAvail').value;
    const dep = document.getElementById('modDeposit').value;
    const earn = document.getElementById('modEarnings').value;
    const alertEl = document.getElementById('balanceAlert');

    try {
        const res = await fetch(`${API}/admin/users/${id}/balance`, {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify({ availableBalance: avail, totalDeposit: dep, totalEarnings: earn })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        alertEl.textContent = '✓ Balances updated successfully.';
        alertEl.className = 'dash-alert success';
        alertEl.style.display = 'block';
        setTimeout(() => { closeModal('balanceModal'); loadUsers(); }, 1500);
    } catch (err) {
        alertEl.textContent = '✗ ' + err.message;
        alertEl.className = 'dash-alert error';
        alertEl.style.display = 'block';
    }
});

window.openStatusModal = (id, name, currentStatus) => {
    document.getElementById('statusUserId').value = id;
    document.getElementById('statusModalUser').textContent = `Changing status for ${name}`;
    document.getElementById('modStatus').value = currentStatus;
    document.getElementById('statusAlert').style.display = 'none';
    openModal('statusModal');
};

document.getElementById('statusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('statusUserId').value;
    const status = document.getElementById('modStatus').value;
    const alertEl = document.getElementById('statusAlert');

    try {
        const res = await fetch(`${API}/admin/users/${id}/status`, {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        alertEl.textContent = '✓ Status updated successfully.';
        alertEl.className = 'dash-alert success';
        alertEl.style.display = 'block';
        setTimeout(() => { closeModal('statusModal'); loadUsers(); }, 1500);
    } catch (err) {
        alertEl.textContent = '✗ ' + err.message;
        alertEl.className = 'dash-alert error';
        alertEl.style.display = 'block';
    }
});

// ─── LOAD WALLETS ───
const loadWallets = async () => {
    try {
        const res = await fetch(`${API}/admin/settings/wallets`, { headers: headers() });
        const wallets = await res.json();
        if (wallets.BTC) document.getElementById('walletBTC').value = wallets.BTC.address || '';
        if (wallets.ETH) document.getElementById('walletETH').value = wallets.ETH.address || '';
        if (wallets.USDT) document.getElementById('walletUSDT').value = wallets.USDT.address || '';
    } catch (err) { console.error('Error loading wallets:', err); }
};

// ─── SAVE WALLETS ───
document.getElementById('saveWalletsBtn').addEventListener('click', async () => {
    const alertEl = document.getElementById('walletAlert');
    alertEl.style.display = 'none';

    const BTC = document.getElementById('walletBTC').value.trim();
    const ETH = document.getElementById('walletETH').value.trim();
    const USDT = document.getElementById('walletUSDT').value.trim();

    const btn = document.getElementById('saveWalletsBtn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/admin/settings/wallets`, {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify({
                BTC: { address: BTC },
                ETH: { address: ETH },
                USDT: { address: USDT }
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        alertEl.textContent = '✓ ' + data.message;
        alertEl.className = 'admin-alert success';
        alertEl.style.display = 'block';
    } catch (err) {
        alertEl.textContent = '✗ ' + err.message;
        alertEl.className = 'admin-alert error';
        alertEl.style.display = 'block';
    } finally {
        btn.textContent = 'Save Wallet Addresses';
        btn.disabled = false;
    }
});

// ─── AUDIT LOGS ───
let currentAuditPage = 1;
window.loadAuditLogs = async (page = 1) => {
    currentAuditPage = page;
    const el = document.getElementById('view-audit');
    if (!el) return;
    el.innerHTML = '<p class="empty-state">Loading audit logs...</p>';
    try {
        const res = await fetch(`${API}/admin/audit-logs?page=${page}&limit=20`, { headers: headers() });
        const data = await res.json();
        const logs = data.logs || (Array.isArray(data) ? data : []);
        const totalPages = data.totalPages || 1;
        
        if (!logs.length) { el.innerHTML = '<p class="empty-state">No audit logs found.</p>'; return; }
        
        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Admin Name</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Target User</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td>${fmtDate(log.createdAt)}</td>
                            <td>${log.adminName || 'Unknown'}</td>
                            <td><span class="badge" style="background:var(--gold);color:#000;">${log.action}</span></td>
                            <td>${log.details || '—'}</td>
                            <td>${log.targetUser || '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display:flex; justify-content:center; gap:10px; margin-top:20px;">
                <button class="btn-gold" onclick="loadAuditLogs(${page - 1})" ${page <= 1 ? 'disabled' : ''}>Prev</button>
                <span style="color:var(--text-muted); align-self:center;">Page ${page} of ${totalPages}</span>
                <button class="btn-gold" onclick="loadAuditLogs(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next</button>
            </div>
        `;
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = '<p class="empty-state">Error loading audit logs.</p>';
    }
};

// ─── THEME TOGGLE ───
const setupThemeToggle = () => {
    let btn = document.getElementById('themeToggleBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'themeToggleBtn';
        btn.className = 'theme-toggle-icon';
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.fontSize = '1.2rem';
        btn.style.cursor = 'pointer';
        btn.style.marginLeft = 'auto';
        btn.style.marginRight = '15px';
        const topbar = document.querySelector('.topbar') || document.body;
        if (topbar) {
            // Insert before the user profile / logout section if possible
            const logoutBtn = document.getElementById('adminLogout');
            if (logoutBtn && logoutBtn.parentNode === topbar) {
                topbar.insertBefore(btn, logoutBtn);
            } else {
                topbar.appendChild(btn);
            }
        }
    }
    btn.addEventListener('click', () => {
        if (window.toggleTheme) window.toggleTheme();
    });
};

// ─── INIT ───
loadStats();
loadPendingTx();
setupThemeToggle();

// ─── SUPPORT CENTER ───
let supportTickets = [];
let activeTicketId = null;
let supportPollInterval = null;

const loadSupportTickets = async () => {
    try {
        const res = await fetch(`${API}/support/admin/tickets`, { headers: headers() });
        if (res.ok) {
            supportTickets = await res.json();
            renderSupportStats();
            renderSupportList();
            startSupportPolling();
        }
    } catch (err) { console.error('Failed to load support tickets', err); }
};

const renderSupportStats = () => {
    let open = 0, pending = 0, resolved = 0, unread = 0;
    supportTickets.forEach(t => {
        if (t.status === 'open') open++;
        if (t.status === 'pending') pending++;
        if (t.status === 'resolved') resolved++;
        
        t.messages.forEach(m => {
            if (m.sender === 'user' && !m.read) unread++;
        });
    });
    
    document.getElementById('statOpenTck').textContent = open;
    document.getElementById('statPendingTck').textContent = pending;
    document.getElementById('statResolvedTck').textContent = resolved;
    document.getElementById('statUnreadTck').textContent = unread;
};

const renderSupportList = () => {
    const listEl = document.getElementById('supportList');
    const filter = document.getElementById('supportStatusFilter').value;
    const search = document.getElementById('supportSearch').value.toLowerCase();
    
    let filtered = supportTickets;
    
    if (filter !== 'all') {
        filtered = filtered.filter(t => t.status === filter);
    }
    
    if (search) {
        filtered = filtered.filter(t => 
            t.subject.toLowerCase().includes(search) ||
            t.ticketId.toLowerCase().includes(search) ||
            t.user.name.toLowerCase().includes(search) ||
            t.user.email.toLowerCase().includes(search)
        );
    }
    
    if (!filtered.length) {
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">No tickets found.</div>';
        return;
    }
    
    listEl.innerHTML = filtered.map(t => {
        const unreadCount = t.messages.filter(m => m.sender === 'user' && !m.read).length;
        const activeClass = t._id === activeTicketId ? 'active' : '';
        return `
            <div class="support-item ${activeClass}" onclick="openSupportTicket('${t._id}')">
                <div class="support-item-head">
                    <span class="support-badge s-${t.status}">${t.status}</span>
                    <span class="support-item-time">${fmtDate(t.createdAt)}</span>
                </div>
                <div class="support-item-title">
                    ${unreadCount > 0 ? '<span style="color:var(--red);">●</span> ' : ''}${t.subject}
                </div>
                <div style="font-size: 0.75rem; color: var(--muted);">${t.user.name}</div>
            </div>
        `;
    }).join('');
};

document.getElementById('supportStatusFilter').addEventListener('change', renderSupportList);
document.getElementById('supportSearch').addEventListener('input', renderSupportList);

window.openSupportTicket = async (ticketId) => {
    activeTicketId = ticketId;
    renderSupportList(); // Update active class
    
    const detailEl = document.getElementById('supportDetail');
    detailEl.innerHTML = '<div class="support-empty-state">Loading...</div>';
    
    try {
        const res = await fetch(`${API}/support/tickets/${ticketId}`, { headers: headers() });
        if (res.ok) {
            const ticket = await res.json();
            
            // Mark as read locally and refresh stats
            const tIdx = supportTickets.findIndex(t => t._id === ticketId);
            if (tIdx > -1) {
                supportTickets[tIdx] = ticket;
                renderSupportStats();
                renderSupportList();
            }
            
            detailEl.innerHTML = `
                <div class="support-detail-head">
                    <div class="support-user-info" style="display:flex; align-items:center;">
                        <button class="support-back-btn" onclick="closeSupportTicket()">⬅ Back</button>
                        <div>
                            <h3>${ticket.subject} <span style="font-size:0.8rem; color:var(--muted); font-weight:normal;">#${ticket.ticketId}</span></h3>
                            <p>${ticket.user.name} (${ticket.user.email})</p>
                        </div>
                    </div>
                    <div class="support-actions">
                        <select id="ticketStatusChange" onchange="changeTicketStatus('${ticket._id}', this.value)">
                            <option value="open" ${ticket.status==='open'?'selected':''}>Open</option>
                            <option value="pending" ${ticket.status==='pending'?'selected':''}>Pending</option>
                            <option value="resolved" ${ticket.status==='resolved'?'selected':''}>Resolved</option>
                            <option value="closed" ${ticket.status==='closed'?'selected':''}>Closed</option>
                        </select>
                    </div>
                </div>
                <div class="support-msgs" id="supportMsgs">
                    ${ticket.messages.map(m => `
                        <div class="s-msg ${m.sender === 'admin' ? 'admin' : 'user'}">
                            <div class="s-msg-name">${m.senderName}</div>
                            <div class="s-msg-bubble">
                                ${m.content ? m.content.replace(/\\n/g, '<br>') : ''}
                                ${m.attachmentUrl ? `
                                    <div class="s-attachment">
                                        📎 <a href="${m.attachmentUrl}" target="_blank">${m.attachmentName || 'Attachment'}</a>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="s-msg-time">${new Date(m.timestamp).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="support-reply">
                    <input type="file" id="supportReplyFile" style="display:none;" onchange="document.getElementById('supportReplyFileName').textContent = this.files[0] ? this.files[0].name : '';">
                    <button onclick="document.getElementById('supportReplyFile').click()" style="background:transparent; color:var(--muted); padding:0 10px;" title="Attach file">📎</button>
                    <span id="supportReplyFileName" style="font-size: 0.75rem; color: var(--gold); max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></span>
                    <textarea id="supportReplyMsg" placeholder="Type your reply..." onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendSupportReply('${ticket._id}'); }"></textarea>
                    <button onclick="sendSupportReply('${ticket._id}')">Send</button>
                </div>
            `;
            
            const msgsDiv = document.getElementById('supportMsgs');
            msgsDiv.scrollTop = msgsDiv.scrollHeight;
            
            // For mobile view, slide to detail and hide stats
            const layout = document.getElementById('supportLayout');
            if (layout) layout.classList.add('show-detail');
            
            if (window.innerWidth <= 768) {
                const stats = document.getElementById('supportStats');
                if (stats) stats.style.display = 'none';
            }
        }
    } catch (err) {
        detailEl.innerHTML = '<div class="support-empty-state">Error loading ticket</div>';
    }
};

window.changeTicketStatus = async (ticketId, status) => {
    try {
        const res = await fetch(`${API}/support/admin/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            loadSupportTickets(); // Reload list to update stats and list
        }
    } catch (err) { alert('Failed to change status'); }
};

window.sendSupportReply = async (ticketId) => {
    const msgEl = document.getElementById('supportReplyMsg');
    const fileEl = document.getElementById('supportReplyFile');
    const content = msgEl.value.trim();
    const file = fileEl.files[0];
    
    if (!content && !file) return;
    
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (file) formData.append('attachment', file);
    
    try {
        const res = await fetch(`${API}/support/admin/tickets/${ticketId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (res.ok) {
            msgEl.value = '';
            fileEl.value = '';
            document.getElementById('supportReplyFileName').textContent = '';
            openSupportTicket(ticketId); // Refresh ticket view
            loadSupportTickets(); // Refresh stats
        } else {
            alert('Failed to send reply');
        }
    } catch (err) {
        alert('Error sending reply');
    }
};

const startSupportPolling = () => {
    if (supportPollInterval) clearInterval(supportPollInterval);
    supportPollInterval = setInterval(() => {
        // Only poll if support view is active
        if (document.getElementById('view-support').classList.contains('active')) {
            // Re-fetch all tickets in background to update list and stats
            fetch(`${API}/support/admin/tickets`, { headers: headers() })
                .then(res => res.json())
                .then(data => {
                    supportTickets = data;
                    renderSupportStats();
                    renderSupportList();
                    // If a ticket is open, update its messages if there are new ones
                    if (activeTicketId) {
                        const activeT = supportTickets.find(t => t._id === activeTicketId);
                        if (activeT) {
                            // Simple re-render of messages if count changed
                            const msgsDiv = document.getElementById('supportMsgs');
                            if (msgsDiv) {
                                const currentMsgs = msgsDiv.querySelectorAll('.s-msg').length;
                                if (currentMsgs !== activeT.messages.length) {
                                    openSupportTicket(activeTicketId);
                                }
                            }
                        }
                    }
                })
                .catch(err => {});
        }
    }, 10000); // 10s poll for admin
};

// ─── MOBILE RESPONSIVENESS LOGIC ───
window.closeSupportTicket = () => {
    const layout = document.getElementById('supportLayout');
    if (layout) layout.classList.remove('show-detail');
    
    const stats = document.getElementById('supportStats');
    if (stats) stats.style.display = 'grid';
};

const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (hamburger && sidebar && sidebarOverlay) {
    hamburger.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
    
    const sidebarClose = document.getElementById('sidebarClose');
    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Also close sidebar when a nav item is clicked on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });
}
