const API_BASE = window.STRATMONT_CONFIG?.API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5001/api' : '/api');

document.addEventListener('DOMContentLoaded', () => {
    
    // Smart Navbar Scroll Effect
    const navbar = document.getElementById('navbar') || document.querySelector('.navbar');
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        if (!navbar) return;
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 20) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        if (currentScrollY > 120 && currentScrollY > lastScrollY) {
            navbar.classList.add('nav-hidden');
        } else {
            navbar.classList.remove('nav-hidden');
        }
        
        lastScrollY = currentScrollY;
    }, { passive: true });

    // Smart Mobile Menu Toggle & Window Resize Reset
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const navActions = document.querySelector('.nav-actions');

    if (mobileBtn && navLinks) {
        mobileBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            if (navActions) navActions.classList.toggle('active');
            mobileBtn.classList.toggle('active');
        });

        // Ensure dropdown resets cleanly when resizing back to desktop (> 768px)
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                navLinks.classList.remove('active');
                if (navActions) navActions.classList.remove('active');
                mobileBtn.classList.remove('active');
                navLinks.removeAttribute('style');
                if (navActions) navActions.removeAttribute('style');
            }
        });
    }

    // Number Counter Animation
    const counters = document.querySelectorAll('.counter');
    const speed = 200; // lower is faster

    const animateCounters = () => {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const count = +counter.innerText;
            const inc = target / speed;

            if (count < target) {
                // Determine if it should be an integer or float based on target
                if (target % 1 !== 0) {
                    counter.innerText = (count + inc).toFixed(1);
                } else {
                    counter.innerText = Math.ceil(count + inc);
                }
                setTimeout(() => animateCounters(), 10);
            } else {
                counter.innerText = target;
            }
        });
    };

    // Intersection Observer for Counters (Trigger when in view)
    const observerOptions = {
        threshold: 0.5
    };

    const counterObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const trustSection = document.querySelector('.trust-indicators');
    if(trustSection) {
        counterObserver.observe(trustSection);
    }

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all others
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });

            // Toggle current
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Setup Mockup Chart using Chart.js
    const ctx = document.getElementById('mockupChart');
    if (ctx) {
        // Create gradient
        let gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(212, 175, 55, 0.5)'); // Gold fade
        gradient.addColorStop(1, 'rgba(212, 175, 55, 0.0)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [120000, 131000, 145000, 162000, 185000, 215000, 255000],
                    borderColor: '#d4af37',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#d4af37',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#141928',
                        titleColor: '#fff',
                        bodyColor: '#d4af37',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            callback: function(value) {
                                return '$' + value / 1000 + 'k';
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            }
        });
    }

    // Mockup Sidebar Interaction
    const navItems = document.querySelectorAll('.mockup-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(n => n.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Live Price Feed Logic
    const updateCryptoPrices = async () => {
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]');
            const data = await response.json();
            
            const btcData = data.find(d => d.symbol === 'BTCUSDT');
            const ethData = data.find(d => d.symbol === 'ETHUSDT');

            const tickerItems = document.querySelectorAll('.ticker-item');
            
            tickerItems.forEach(item => {
                const asset = item.querySelector('.asset').innerText;
                const priceEl = item.querySelector('.price');
                const changeEl = item.querySelector('.change');

                if (asset === 'BTC/USD' && btcData) {
                    const price = parseFloat(btcData.lastPrice);
                    const change = parseFloat(btcData.priceChangePercent);
                    priceEl.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
                    changeEl.innerText = (change > 0 ? '+' : '') + change.toFixed(2) + '%';
                    changeEl.className = 'change ' + (change >= 0 ? 'positive' : 'negative');
                }
                else if (asset === 'ETH/USD' && ethData) {
                    const price = parseFloat(ethData.lastPrice);
                    const change = parseFloat(ethData.priceChangePercent);
                    priceEl.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
                    changeEl.innerText = (change > 0 ? '+' : '') + change.toFixed(2) + '%';
                    changeEl.className = 'change ' + (change >= 0 ? 'positive' : 'negative');
                }
            });
        } catch (error) {
            console.error('Failed to fetch crypto prices:', error);
        }
    };

    // Simulate traditional asset fluctuations
    const traditionalAssets = {
        'STRAT-REIT': { base: 142.50, vol: 0.002 },
        'GLOBAL O&G': { base: 84.20, vol: 0.005 },
        'STRAT-YIELD': { base: 105.10, vol: 0.001 }
    };

    const updateTraditionalPrices = () => {
        const tickerItems = document.querySelectorAll('.ticker-item');
        
        tickerItems.forEach(item => {
            const asset = item.querySelector('.asset').innerText;
            if (traditionalAssets[asset]) {
                const data = traditionalAssets[asset];
                // Random walk
                const changePercent = (Math.random() * data.vol * 2) - data.vol;
                data.base = data.base * (1 + changePercent);
                
                const priceEl = item.querySelector('.price');
                const changeEl = item.querySelector('.change');
                
                priceEl.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.base);
                
                // Parse existing change to add to it or just show current instant change?
                // Let's just show a simulated daily change based on a random walk from 0
                if (!data.dailyChange) data.dailyChange = Math.random() * 2 - 0.5; // Starts between -0.5 and +1.5
                data.dailyChange += (changePercent * 100);
                
                changeEl.innerText = (data.dailyChange > 0 ? '+' : '') + data.dailyChange.toFixed(2) + '%';
                changeEl.className = 'change ' + (data.dailyChange >= 0 ? 'positive' : 'negative');
            }
        });
    };

    // Initial calls and intervals
    updateCryptoPrices();
    setInterval(updateCryptoPrices, 10000); // Every 10 seconds for crypto
    setInterval(updateTraditionalPrices, 3000); // Every 3 seconds for simulated assets

    // ----------------------------------------------------------------------
    // Advanced UI/UX Enhancements
    // ----------------------------------------------------------------------

    // 1. Ambient Mouse Glow
    const hero = document.querySelector('.hero');
    const glow = document.querySelector('.cursor-glow');
    if (hero && glow) {
        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            glow.style.left = `${x}px`;
            glow.style.top = `${y}px`;
        });
    }

    // 2. Scroll Reveal Animations
    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.02, rootMargin: "0px 0px -20px 0px" });

    reveals.forEach(reveal => revealObserver.observe(reveal));

    // 3. Integrated Activity Feed
    const feedList = document.getElementById('activityFeedList');
    const names = [
        "James", "Sarah", "Michael", "Elena", "David", "Sophia", "Wei", "Liam", "Olivia",
        "Alexander", "Isabella", "Ethan", "Mia", "Benjamin", "Charlotte", "Daniel", "Amelia",
        "Matthew", "Harper", "Lucas", "Evelyn", "Jackson", "Abigail", "Sebastian", "Emily",
        "Jack", "Elizabeth", "Aiden", "Mila", "Owen", "Ella", "Samuel", "Avery", "John",
        "Sofia", "Joseph", "Camila", "Luke", "Aria", "Henry", "Scarlett", "Isaac", "Victoria",
        "Gabriel", "Madison", "Anthony", "Luna", "Dylan", "Grace", "Leo", "Chloe", "Lincoln",
        "Penelope", "Jaxon", "Layla", "Asher", "Riley", "Christopher", "Zoey", "Josiah", "Nora",
        "Andrew", "Lily", "Thomas", "Eleanor", "Joshua", "Hannah", "Ezra", "Lillian", "Hudson",
        "Addison", "Charles", "Aubrey", "Caleb", "Ellie", "Isaiah", "Stella", "Ryan", "Natalie",
        "Nathan", "Zoe", "Adrian", "Leah", "Christian", "Hazel", "Maverick", "Violet", "Colton",
        "Aurora", "Elias", "Savannah", "Aaron", "Audrey", "Eli", "Brooklyn", "Landon", "Bella"
    ];
    const locations = ["UK", "Canada", "USA", "Singapore", "Switzerland", "UAE", "Australia", "Germany"];
    const actions = ["deposited", "withdrew dividend of", "invested", "compounded"];
    
    function createFeedItem() {
        if (!feedList) return;
        const name = names[Math.floor(Math.random() * names.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(Math.floor(Math.random() * 49000) + 1000);
        
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `
            <div>
                <span class="feed-user">${name} (${location})</span>
                <span class="feed-action">${action}</span>
            </div>
            <div>
                <span class="feed-amount">${amount}</span>
                <div class="feed-time">Just now</div>
            </div>
        `;
        
        feedList.prepend(item);
        
        // Keep list bounded
        if (feedList.children.length > 3) {
            feedList.lastElementChild.remove();
        }
    }

    if (feedList) {
        createFeedItem();
        createFeedItem();
        setInterval(createFeedItem, Math.random() * 5000 + 4000); // Random interval 4-9s
    }

    // 4. Interactive ROI Calculator
    const roiSlider = document.getElementById('roiSlider');
    const calcDepositVal = document.getElementById('calcDepositVal');
    const calcDailyVal = document.getElementById('calcDailyVal');
    const calcMonthlyVal = document.getElementById('calcMonthlyVal');
    const calcTotalVal = document.getElementById('calcTotalVal');
    const calcTierBadge = document.getElementById('calcTierBadge');

    function updateCalculator() {
        if (!roiSlider) return;
        const deposit = parseInt(roiSlider.value);
        let dailyRate = 0.0167; // 1.67% daily for Starter
        let tierName = "Starter Tier";

        if (deposit >= 10000 && deposit < 50000) {
            dailyRate = 0.0222; // 2.22% daily for Professional
            tierName = "Professional Tier";
        } else if (deposit >= 50000) {
            dailyRate = 0.0333; // 3.33% daily for Institutional
            tierName = "Institutional Tier";
        }

        const dailyReturn = deposit * dailyRate;
        const quarterlyReturn = dailyReturn * 90; // 90 days
        const totalIncPrincipal = deposit + quarterlyReturn; // Actually total is the quarterly return since principal is included
        
        calcDepositVal.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(deposit);
        calcDailyVal.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(dailyReturn);
        calcMonthlyVal.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(quarterlyReturn);
        calcTotalVal.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(quarterlyReturn);
        calcTierBadge.innerText = tierName;
    }

    if (roiSlider) {
        roiSlider.addEventListener('input', updateCalculator);
        updateCalculator(); // init
    }

    // Dynamic Navbar Active Link Indicator
    const currentPagePath = window.location.pathname.split('/').pop() || 'index.html';
    const navAnchors = document.querySelectorAll('.nav-links a');
    navAnchors.forEach(link => {
        const linkPath = link.getAttribute('href')?.split('#')[0];
        if (linkPath && (linkPath === currentPagePath || (currentPagePath === '' && linkPath === 'index.html'))) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });

});
