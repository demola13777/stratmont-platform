const API = window.STRATMONT_CONFIG?.API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5001/api' : '/api');
let token = localStorage.getItem(window.STRATMONT_CONFIG?.TOKEN_KEY || 'stratmontToken');
let currentUser = JSON.parse(localStorage.getItem(window.STRATMONT_CONFIG?.USER_KEY || 'stratmontUser') || 'null');
let wallets = {};
let plans = [];
let selectedCoin = 'USDT';

// ─── AUTH GUARD ───
if (!token || !currentUser) {
    window.location.href = 'auth.html';
}

// ─── HELPERS ───
const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const showDepositAlert = (msg, isError = true) => {
    const el = document.getElementById('depositAlert');
    el.textContent = msg;
    el.className = `dash-alert ${isError ? 'error' : 'success'}`;
    el.style.display = 'block';
};

// ─── VIEW ROUTING ───
const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');
    const titles = { overview: 'Overview', invest: 'Invest Now', deposit: 'Make a Deposit', history: 'Transaction History', withdraw: 'Withdraw Funds' };
    document.getElementById('topbarTitle').textContent = titles[viewId] || 'Dashboard';
    closeSidebar();

    if (viewId === 'history') loadTransactions();
    if (viewId === 'deposit') loadDepositView();
};

window.switchView = switchView;

// ─── SIDEBAR ───
const closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
};

document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
});
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

// Nav items
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.dataset.view);
    });
});

// ─── LOGOUT ───
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem(window.STRATMONT_CONFIG?.TOKEN_KEY || 'stratmontToken');
    localStorage.removeItem(window.STRATMONT_CONFIG?.USER_KEY || 'stratmontUser');
    window.location.href = 'auth.html';
});

// ─── USER INFO ───
const initUserInfo = () => {
    const name = currentUser?.name || 'Investor';
    document.getElementById('userNameDisplay').textContent = name;
    document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
};

let activePlanData = null; // Store for compounding
let currentCycleStatus = 'active';
let userPlanStartDate = null;

// ─── LOAD DASHBOARD DATA ───
const loadDashboard = async () => {
    try {
        const res = await fetch(`${API}/user/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) { localStorage.clear(); window.location.href = 'auth.html'; return; }
        const data = await res.json();
        const availEl = document.getElementById('availBalance');
        availEl.classList.remove('skeleton-text-placeholder');
        availEl.textContent = fmt(data.balances?.availableBalance);
        
        const depositEl = document.getElementById('totalDeposit');
        depositEl.classList.remove('skeleton-text-placeholder');
        depositEl.textContent = fmt(data.balances?.totalDeposit);
        
        const earningsEl = document.getElementById('totalEarnings');
        earningsEl.classList.remove('skeleton-text-placeholder');
        earningsEl.textContent = fmt(data.balances?.totalEarnings);

        // Update withdrawal max text
        const maxTextEl = document.getElementById('withdrawMaxText');
        if (maxTextEl) {
            maxTextEl.classList.remove('skeleton-text-placeholder');
            maxTextEl.textContent = fmt(data.balances?.availableBalance);
        }
        document.getElementById('withdrawAmount').dataset.max = data.balances?.availableBalance || 0;

        currentCycleStatus = data.cycleStatus || 'active';
        userPlanStartDate = data.planStartDate;

        // Update active plan UI
        if (data.activePlan) {
            activePlanData = data.activePlan;
            activePlanData.userDeposit = data.balances?.totalDeposit || 0;
            
            let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div>
                        <div style="color:var(--gold); font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">CURRENT TIER</div>
                        <h2 style="font-size:1.5rem; margin-bottom:5px;">${data.activePlan.name} Plan</h2>
                        <div style="color:var(--green); font-weight:600;">+${data.activePlan.dailyReturnRate}% Daily ROI</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:5px;">Compounding on</div>
                        <div style="font-size:1.2rem; font-weight:700;">${fmt(data.balances?.totalDeposit)}</div>
                    </div>
                </div>
            `;

            if (currentCycleStatus === 'completed') {
                html += `
                    <div style="margin-top:20px; padding:15px; background:rgba(212, 175, 55, 0.1); border-left:4px solid var(--gold); border-radius:4px;">
                        <h4 style="color:var(--gold); margin-bottom:10px;">Cycle Completed</h4>
                        <p style="font-size:0.9rem; margin-bottom:15px;">Your 3-month investment cycle has ended. Compounding has stopped.</p>
                        <div style="display:flex; gap:10px;">
                            <button class="btn-gold" onclick="switchView('withdraw')">Withdraw Funds</button>
                            <button class="btn-gold" style="background:transparent; border:1px solid var(--gold); color:var(--gold);" onclick="reinvestFunds()">Reinvest Cycle</button>
                        </div>
                    </div>
                `;
            }
            
            document.getElementById('activePlanDisplay').innerHTML = html;
            
            // Handle withdrawal locking
            if (currentCycleStatus === 'completed') {
                document.getElementById('withdrawLockOverlay').style.display = 'none';
                document.getElementById('withdrawSubmitBtn').disabled = false;
            } else {
                document.getElementById('withdrawLockOverlay').style.display = 'block';
                document.getElementById('withdrawSubmitBtn').disabled = true;
            }
            
            // Start the visual engine if active
            if (currentCycleStatus === 'active') {
                startVisualCompounding();
            }

            // Render upgrade prompt
            renderUpgradePrompt();
        }

    } catch (err) {
        console.error('Dashboard load error:', err);
    }
};

// ─── VISUAL COMPOUNDING ENGINE ───
let compoundingInterval = null;
const startVisualCompounding = () => {
    if (compoundingInterval) clearInterval(compoundingInterval);
    if (!activePlanData || !activePlanData.userDeposit || !userPlanStartDate) return;

    // Daily Return Rate (e.g. 8 for 8%)
    const dailyRatePercent = activePlanData.dailyReturnRate / 100;
    
    // Total profit per day in dollars
    const dailyProfit = activePlanData.userDeposit * dailyRatePercent;
    
    // Profit per millisecond
    const profitPerMs = dailyProfit / (24 * 60 * 60 * 1000);

    // Read current displayed values directly from DOM (this is the perfectly accurate base from DB)
    let currentEarnings = parseFloat(document.getElementById('totalEarnings').textContent.replace(/[^0-9.-]+/g,"")) || 0;
    let currentAvailable = parseFloat(document.getElementById('availBalance').textContent.replace(/[^0-9.-]+/g,"")) || 0;

    // Calculate elapsed time since last backend sync (Midnight UTC or planStartDate)
    const planStart = new Date(userPlanStartDate);
    const durationDays = activePlanData.durationDays || 90;
    const cycleEndTime = planStart.getTime() + (durationDays * 24 * 60 * 60 * 1000);
    const nowTime = Math.min(new Date().getTime(), cycleEndTime);
    const now = new Date(nowTime);
    
    if (new Date().getTime() >= cycleEndTime && currentCycleStatus === 'active') {
        currentCycleStatus = 'completed';
    }

    const lastMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    // The baseline is either the last midnight UTC, or the plan start date if the plan started today
    const baselineTime = Math.max(lastMidnightUTC.getTime(), planStart.getTime());
    
    let elapsedMs = now.getTime() - baselineTime;
    if (elapsedMs > 0) {
        const unsettledProfit = elapsedMs * profitPerMs;
        // Instantly add unsettled profit so a hard refresh correctly jumps back to where it should be
        currentEarnings += unsettledProfit;
        currentAvailable += unsettledProfit;
        
        document.getElementById('totalEarnings').textContent = fmt(currentEarnings);
        document.getElementById('availBalance').textContent = fmt(currentAvailable);
    }

    // Update the DOM 10 times a second
    const updateRateMs = 100;
    const profitPerTick = profitPerMs * updateRateMs;

    compoundingInterval = setInterval(() => {
        if (new Date().getTime() >= cycleEndTime) {
            clearInterval(compoundingInterval);
            return;
        }
        currentEarnings += profitPerTick;
        currentAvailable += profitPerTick;

        document.getElementById('totalEarnings').textContent = fmt(currentEarnings);
        document.getElementById('availBalance').textContent = fmt(currentAvailable);
    }, updateRateMs);
};

// ─── RENDER UPGRADE PROMPT ───
const renderUpgradePrompt = () => {
    const container = document.getElementById('upgradePromptContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    if (!activePlanData || currentCycleStatus === 'completed') return;
    
    // Find next plan
    const currentIndex = plans.findIndex(p => p._id === activePlanData._id);
    if (currentIndex === -1 || currentIndex === plans.length - 1) return; // Top tier or error
    
    const nextPlan = plans[currentIndex + 1];
    const currentDeposit = activePlanData.userDeposit || 0;
    const diff = Math.max(0, nextPlan.minDeposit - currentDeposit);
    
    container.innerHTML = `
        <div style="margin-top: 20px; padding: 20px; background: linear-gradient(145deg, rgba(212, 175, 55, 0.05) 0%, rgba(212, 175, 55, 0.15) 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h4 style="color:var(--gold); margin-bottom:5px; font-size:1.1rem;">💎 Upgrade to ${nextPlan.name}</h4>
                <p style="color:var(--text-muted); font-size:0.9rem;">Deposit exactly <strong>${fmt(diff)}</strong> more to boost your daily ROI to <strong>${nextPlan.dailyReturnRate}%</strong>.</p>
            </div>
            <button class="btn-gold" style="padding: 10px 20px; font-size: 0.9rem;" onclick="selectPlan('${nextPlan._id}', '${nextPlan.name}')">Upgrade Now</button>
        </div>
    `;
};

// ─── LOAD PLANS ───
const loadPlans = async () => {
    try {
        const res = await fetch(`${API}/plans`);
        plans = await res.json();

        const grid = document.getElementById('plansGrid');
        const selectEl = document.getElementById('depositPlanSelect');
        grid.innerHTML = '';
        selectEl.innerHTML = '<option value="">-- Choose a Plan --</option>';

        plans.forEach((plan, i) => {
            const isFeatured = plan.name.toLowerCase() === 'professional';
            const card = document.createElement('div');
            card.className = `plan-card${isFeatured ? ' featured' : ''}`;
            card.innerHTML = `
                ${isFeatured ? '<span class="plan-badge">Most Popular</span>' : ''}
                <div class="plan-name">${plan.name} Plan</div>
                <div class="plan-roi">${plan.dailyReturnRate}% <small>/ day</small></div>
                <div class="plan-range">${fmt(plan.minDeposit)} — ${fmt(plan.maxDeposit)}</div>
                <ul class="plan-features">
                    ${plan.features.map(f => `<li>${f}</li>`).join('')}
                </ul>
                <button class="plan-select-btn" onclick="selectPlan('${plan._id}', '${plan.name}')">Select Plan</button>
            `;
            grid.appendChild(card);

            const opt = document.createElement('option');
            opt.value = plan._id;
            opt.textContent = `${plan.name} (${fmt(plan.minDeposit)} – ${fmt(plan.maxDeposit)})`;
            selectEl.appendChild(opt);
        });

    } catch (err) {
        console.error('Plans load error:', err);
        document.getElementById('plansGrid').innerHTML = '<p class="empty-state">Could not load plans.</p>';
    }
};

// ─── SELECT A PLAN → go to deposit ───
window.selectPlan = (planId, planName) => {
    switchView('deposit');
    const selectEl = document.getElementById('depositPlanSelect');
    selectEl.value = planId;
};

// ─── LOAD WALLETS & QR ───
const loadDepositView = async () => {
    try {
        const res = await fetch(`${API}/settings/wallets`);
        wallets = await res.json();
        updateWalletDisplay(selectedCoin);
    } catch (err) {
        document.getElementById('walletAddressDisplay').textContent = 'Could not load wallet. Please refresh.';
    }
};

const updateWalletDisplay = (coin) => {
    const data = wallets[coin];
    if (!data) return;
    const addr = data.address;
    document.getElementById('walletAddressDisplay').textContent = addr;
    document.getElementById('selectedCoinLabel').textContent = `${coin} (${data.network})`;
    // Generate QR via free API
    document.getElementById('qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(addr)}&bgcolor=ffffff&color=000000`;
};

// ─── COIN SWITCHER ───
document.querySelectorAll('.coin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.coin-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCoin = btn.dataset.coin;
        updateWalletDisplay(selectedCoin);
    });
});

// ─── COPY WALLET ───
document.getElementById('copyWalletBtn').addEventListener('click', () => {
    const addr = document.getElementById('walletAddressDisplay').textContent;
    navigator.clipboard.writeText(addr).then(() => {
        const btn = document.getElementById('copyWalletBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
});

// ─── DEPOSIT FORM ───
document.getElementById('depositForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('depositAlert').style.display = 'none';

    const planId = document.getElementById('depositPlanSelect').value;
    const amount = document.getElementById('depositAmount').value;
    const txHash = document.getElementById('depositTxHash').value;
    const submitBtn = document.getElementById('depositSubmitBtn');

    if (!planId) { showDepositAlert('Please select an investment plan.'); return; }
    if (!amount || parseFloat(amount) < 1000) { showDepositAlert('Minimum deposit is $1,000.'); return; }

    const walletAddress = wallets[selectedCoin]?.address;
    if (!walletAddress) { showDepositAlert('Wallet address not loaded. Please refresh.'); return; }

    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API}/transactions/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount: parseFloat(amount), planId, walletAddressUsed: walletAddress, transactionHash: txHash, coin: selectedCoin })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Submission failed.');
        showDepositAlert(data.message, false);
        document.getElementById('depositForm').reset();
        loadDashboard();
    } catch (err) {
        showDepositAlert(err.message);
    } finally {
        submitBtn.textContent = 'Submit Deposit for Approval';
        submitBtn.disabled = false;
    }
});

// ─── REINVEST FUNDS ───
window.reinvestFunds = async () => {
    if (!confirm('Are you sure you want to reinvest your entire available balance to start a new 3-month cycle?')) return;
    try {
        const res = await fetch(`${API}/transactions/reinvest`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Reinvestment failed.');
        alert(data.message);
        loadDashboard();
        loadRecentTx();
    } catch (err) {
        alert(err.message);
    }
};

// ─── WITHDRAW FORM ───
document.getElementById('withdrawMaxBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const max = document.getElementById('withdrawAmount').dataset.max;
    document.getElementById('withdrawAmount').value = max;
});

const showWithdrawAlert = (msg, isError = true) => {
    const el = document.getElementById('withdrawAlert');
    el.textContent = msg;
    el.className = `dash-alert ${isError ? 'error' : 'success'}`;
    el.style.display = 'block';
};

document.getElementById('withdrawForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('withdrawAlert').style.display = 'none';

    const amount = document.getElementById('withdrawAmount').value;
    const coin = document.getElementById('withdrawCoinSelect').value;
    const walletAddress = document.getElementById('withdrawWalletAddress').value;
    const submitBtn = document.getElementById('withdrawSubmitBtn');

    if (!amount || parseFloat(amount) <= 0) { showWithdrawAlert('Enter a valid amount.'); return; }
    if (!walletAddress) { showWithdrawAlert('Enter your wallet address.'); return; }

    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API}/transactions/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount: parseFloat(amount), coin, walletAddress })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Withdrawal submission failed.');
        showWithdrawAlert(data.message, false);
        document.getElementById('withdrawForm').reset();
        loadDashboard();
        loadRecentTx();
    } catch (err) {
        showWithdrawAlert(err.message);
    } finally {
        submitBtn.textContent = 'Submit Withdrawal Request';
        submitBtn.disabled = false;
    }
});

// ─── LOAD TRANSACTIONS ───
const loadTransactions = async () => {
    const wrapper = document.getElementById('txTableWrapper');
    wrapper.innerHTML = '<p class="empty-state">Loading...</p>';
    try {
        const res = await fetch(`${API}/transactions/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const txs = await res.json();
        if (!txs.length) { wrapper.innerHTML = '<p class="empty-state">No transactions yet.</p>'; return; }

        const table = `
            <table class="tx-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Coin</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${txs.map(tx => `
                        <tr>
                            <td>${new Date(tx.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</td>
                            <td style="text-transform:capitalize;">${tx.type.replace('_', ' ')}</td>
                            <td>${tx.coin || 'N/A'}</td>
                            <td>${fmt(tx.amount)}</td>
                            <td><span class="status-badge ${tx.status}">${tx.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        wrapper.innerHTML = table;
    } catch (err) {
        wrapper.innerHTML = '<p class="empty-state">Could not load transactions.</p>';
    }
};

// ─── ALSO LOAD RECENT TXS ON OVERVIEW ───
const loadRecentTx = async () => {
    const el = document.getElementById('recentTxList');
    try {
        const res = await fetch(`${API}/transactions/my`, { headers: { 'Authorization': `Bearer ${token}` } });
        const txs = await res.json();
        if (!txs.length) { el.innerHTML = '<p class="empty-state">No transactions yet.</p>'; return; }
        el.innerHTML = txs.slice(0, 5).map(tx => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid var(--border);">
                <div>
                    <div style="font-size:.875rem;text-transform:capitalize;">${tx.type.replace('_', ' ')} · ${tx.coin || ''}</div>
                    <div style="font-size:.75rem;color:var(--text-muted);">${new Date(tx.createdAt).toLocaleDateString()}</div>
                </div>
                <div style="display:flex;align-items:center;gap:.75rem;">
                    <span style="font-weight:600;">${fmt(tx.amount)}</span>
                    <span class="status-badge ${tx.status}">${tx.status}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {}
};

// ─── INIT ───
initUserInfo();
(async () => {
    await loadPlans();
    await loadDashboard();
    loadRecentTx();
})();
