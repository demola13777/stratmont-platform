/**
 * Stratmont Investments — Client Configuration
 * Environment-aware settings for API, assets, and feature flags.
 */
(function () {
    'use strict';

    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0' ||
                    window.location.hostname === '' ||
                    window.location.protocol === 'file:' ||
                    (window.location.port && window.location.port !== '5001' && window.location.port !== '80' && window.location.port !== '443');

    window.STRATMONT_CONFIG = {
        // API base URL — local dev hits Express directly on port 5001 (avoids macOS AirPlay port 5000 collision), production uses relative path
        API_BASE: isLocal ? 'http://localhost:5001/api' : '/api',

        // Platform metadata
        PLATFORM_NAME: 'Stratmont Capital',
        SUPPORT_EMAIL: 'support@stratmont.com',

        // Investment model
        CYCLE_DURATION_DAYS: 90,
        CYCLE_DURATION_LABEL: '3 Months',
        PLANS: {
            starter: { name: 'Starter', dailyRate: 1.67, totalReturn: 150, minDeposit: 1000, maxDeposit: 9999 },
            professional: { name: 'Professional', dailyRate: 2.22, totalReturn: 200, minDeposit: 10000, maxDeposit: 49999 },
            institutional: { name: 'Institutional', dailyRate: 3.33, totalReturn: 300, minDeposit: 50000, maxDeposit: 150000 }
        },

        // Token storage keys
        TOKEN_KEY: 'stratmontToken',
        REFRESH_TOKEN_KEY: 'stratmontRefreshToken',
        USER_KEY: 'stratmontUser',

        // Theme
        THEME_KEY: 'stratmontTheme',
        DEFAULT_THEME: 'dark',

        // Feature flags
        FEATURES: {
            darkMode: true,
            chatWidget: true,
            emailVerification: true
        }
    };

    // Convenience helper for API calls with auth
    window.STRATMONT_API = {
        /**
         * Make an authenticated API request
         * @param {string} endpoint - API endpoint (e.g., '/user/dashboard')
         * @param {object} options - Fetch options
         * @returns {Promise<Response>}
         */
        async fetch(endpoint, options = {}) {
            const token = localStorage.getItem(window.STRATMONT_CONFIG.TOKEN_KEY);
            const url = `${window.STRATMONT_CONFIG.API_BASE}${endpoint}`;

            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(url, { ...options, headers });

            // If token expired, try refresh
            if (response.status === 401 && token) {
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    headers['Authorization'] = `Bearer ${localStorage.getItem(window.STRATMONT_CONFIG.TOKEN_KEY)}`;
                    return fetch(url, { ...options, headers });
                } else {
                    // Refresh failed — clear and redirect to login
                    this.clearAuth();
                    window.location.href = '/auth.html';
                }
            }

            return response;
        },

        /**
         * Attempt to refresh the JWT using the refresh token
         * @returns {Promise<boolean>}
         */
        async refreshToken() {
            const refreshToken = localStorage.getItem(window.STRATMONT_CONFIG.REFRESH_TOKEN_KEY);
            if (!refreshToken) return false;

            try {
                const res = await fetch(`${window.STRATMONT_CONFIG.API_BASE}/auth/refresh-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (!res.ok) return false;

                const data = await res.json();
                localStorage.setItem(window.STRATMONT_CONFIG.TOKEN_KEY, data.token);
                localStorage.setItem(window.STRATMONT_CONFIG.REFRESH_TOKEN_KEY, data.refreshToken);
                return true;
            } catch {
                return false;
            }
        },

        /**
         * Clear all auth data
         */
        clearAuth() {
            localStorage.removeItem(window.STRATMONT_CONFIG.TOKEN_KEY);
            localStorage.removeItem(window.STRATMONT_CONFIG.REFRESH_TOKEN_KEY);
            localStorage.removeItem(window.STRATMONT_CONFIG.USER_KEY);
        }
    };
})();
