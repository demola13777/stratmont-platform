const API_BASE = window.STRATMONT_CONFIG?.API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5001/api' : '/api');

async function parseJsonResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return await res.json();
    }
    const text = await res.text();
    if (text.trim().startsWith('<')) {
        throw new Error('Backend server is not reachable on port 5001. Please ensure the backend server is running ("node backend/server.js").');
    }
    throw new Error('Unexpected response from server: ' + text.slice(0, 100));
}

document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentMode = 'login'; // 'login' or 'register'
    let authEmail = '';
    let resendTimerInterval;

    // DOM Elements
    const alertBox = document.getElementById('alertBox');
    
    // Step Containers
    const stepCredentials = document.getElementById('step-credentials');
    const stepVerification = document.getElementById('step-verification');
    const stepSuccess = document.getElementById('step-success');

    // Credentials Form
    const credentialsForm = document.getElementById('credentialsForm');
    const nameGroup = document.getElementById('nameGroup');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const credentialsSubmit = document.getElementById('credentialsSubmit');
    
    // Header & Toggle
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const switchText = document.getElementById('switchText');
    const switchModeBtn = document.getElementById('switchMode');

    // Verification Form
    const verifyForm = document.getElementById('verifyForm');
    const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');
    const digitInputs = document.querySelectorAll('.digit-input');
    const verifySubmit = document.getElementById('verifySubmit');
    const resendCodeBtn = document.getElementById('resendCode');
    const resendTimerDisplay = document.getElementById('resendTimer');
    const changeEmailBtn = document.getElementById('changeEmail');

    // Helper: Show Alert
    const showAlert = (message, isError = true) => {
        alertBox.textContent = message;
        alertBox.className = `alert ${isError ? 'error' : 'success'}`;
        alertBox.style.display = 'block';
    };

    const hideAlert = () => {
        alertBox.style.display = 'none';
    };

    // Helper: Switch Steps
    const showStep = (stepElement) => {
        hideAlert();
        stepCredentials.classList.remove('active');
        stepVerification.classList.remove('active');
        stepSuccess.classList.remove('active');
        stepElement.classList.add('active');
    };

    // Toggle Mode (Login / Register)
    const toggleMode = () => {
        hideAlert();
        if (currentMode === 'login') {
            currentMode = 'register';
            nameGroup.style.display = 'block';
            fullNameInput.required = true;
            authTitle.textContent = 'Create Account';
            authSubtitle.textContent = 'Join Stratmont Investments';
            credentialsSubmit.textContent = 'Create Account';
            switchText.textContent = 'Already have an account?';
            switchModeBtn.textContent = 'Sign in';
            switchModeBtn.textContent = 'Sign in';
            passwordInput.autocomplete = 'new-password';
            confirmPasswordGroup.style.display = 'block';
            confirmPasswordInput.required = true;
        } else {
            currentMode = 'login';
            nameGroup.style.display = 'none';
            fullNameInput.required = false;
            authTitle.textContent = 'Welcome Back';
            authSubtitle.textContent = 'Sign in to access your portfolio';
            credentialsSubmit.textContent = 'Access Portal';
            switchText.textContent = "Don't have an account?";
            switchModeBtn.textContent = 'Register';
            switchModeBtn.textContent = 'Register';
            passwordInput.autocomplete = 'current-password';
            confirmPasswordGroup.style.display = 'none';
            confirmPasswordInput.required = false;
        }
    };

    switchModeBtn.addEventListener('click', toggleMode);

    // Password visibility toggles
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.currentTarget.closest('.password-wrapper');
            const input = wrapper.querySelector('.auth-input');
            
            if (input.type === 'password') {
                input.type = 'text';
                e.currentTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-off-icon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
            } else {
                input.type = 'password';
                e.currentTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            }
        });
    });

    // Initial check for mode in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'register' && currentMode === 'login') {
        toggleMode();
    }

    // Step 1: Submit Credentials
    credentialsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const name = fullNameInput.value.trim();

        if (!email || !password || (currentMode === 'register' && !name) || (currentMode === 'register' && !confirmPassword)) {
            return showAlert('Please fill in all required fields.');
        }

        if (currentMode === 'register' && password !== confirmPassword) {
            return showAlert('Passwords do not match.');
        }

        const originalBtnText = credentialsSubmit.textContent;
        credentialsSubmit.disabled = true;
        credentialsSubmit.textContent = currentMode === 'login' ? 'Authenticating...' : 'Creating...';

        try {
            const endpoint = currentMode === 'login' ? '/auth/login' : '/auth/register';
            const body = currentMode === 'login' ? { email, password } : { name, email, password };

            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await parseJsonResponse(res);

            if (!res.ok) throw new Error(data.message || `${currentMode === 'login' ? 'Login' : 'Registration'} failed`);

            // Success, proceed
            if (currentMode === 'login') {
                // If login is successful, they are verified. Store tokens and redirect.
                localStorage.setItem('stratmont_token', data.token);
                localStorage.setItem('stratmont_refresh', data.refreshToken);
                window.location.href = 'dashboard.html';
                return;
            } else {
                // Registration successful, proceed to verification
                authEmail = email;
                verifyEmailDisplay.textContent = authEmail;
                showStep(stepVerification);
                startResendTimer();
                
                // Focus first digit
                digitInputs[0].focus();
            }
            
        } catch (error) {
            showAlert(error.message);
        } finally {
            credentialsSubmit.disabled = false;
            credentialsSubmit.textContent = originalBtnText;
        }
    });

    // Step 2: 4-Digit Input Logic
    digitInputs.forEach((input, index) => {
        // Handle input and auto-advance
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            // Ensure only digits
            e.target.value = val.replace(/[^0-9]/g, '');
            
            if (e.target.value && index < digitInputs.length - 1) {
                digitInputs[index + 1].focus();
            }

            // Auto-submit if all filled
            const allFilled = Array.from(digitInputs).every(inp => inp.value.length === 1);
            if (allFilled) {
                verifyForm.dispatchEvent(new Event('submit'));
            }
        });

        // Handle backspace auto-back
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                digitInputs[index - 1].focus();
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 4).split('');
            
            if (digits.length > 0) {
                digits.forEach((digit, i) => {
                    if (i < digitInputs.length) {
                        digitInputs[i].value = digit;
                    }
                });
                
                // Focus the next empty input or the last one
                const nextEmptyIndex = digits.length < 4 ? digits.length : 3;
                digitInputs[nextEmptyIndex].focus();

                if (digits.length === 4) {
                    verifyForm.dispatchEvent(new Event('submit'));
                }
            }
        });
    });

    // Step 2: Verify Submit
    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const code = Array.from(digitInputs).map(inp => inp.value).join('');
        if (code.length !== 4) {
            return showAlert('Please enter the 4-digit code.');
        }

        verifySubmit.disabled = true;
        verifySubmit.textContent = 'Verifying...';

        try {
            const endpoint = currentMode === 'login' ? '/auth/verify-login' : '/auth/verify-code';
            
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, code })
            });

            const data = await parseJsonResponse(res);

            if (!res.ok) throw new Error(data.message || 'Verification failed. Please try again.');

            // Success, save tokens and proceed to Step 3
            localStorage.setItem(window.STRATMONT_CONFIG?.TOKEN_KEY || 'stratmontToken', data.token);
            if (data.refreshToken) localStorage.setItem(window.STRATMONT_CONFIG?.REFRESH_TOKEN_KEY || 'stratmontRefreshToken', data.refreshToken);
            localStorage.setItem(window.STRATMONT_CONFIG?.USER_KEY || 'stratmontUser', JSON.stringify(data.user || data));

            showStep(stepSuccess);

            // Redirect after 1.5s
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            showAlert(error.message);
            // Clear inputs on error to easily try again
            digitInputs.forEach(inp => inp.value = '');
            digitInputs[0].focus();
        } finally {
            verifySubmit.disabled = false;
            verifySubmit.textContent = 'Verify Identity';
        }
    });

    // Step 2: Resend Code
    resendCodeBtn.addEventListener('click', async () => {
        if (resendCodeBtn.disabled) return;
        hideAlert();

        try {
            resendCodeBtn.disabled = true;
            
            const res = await fetch(`${API_BASE}/auth/resend-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: authEmail, type: currentMode })
            });

            const data = await parseJsonResponse(res);
            if (!res.ok) throw new Error(data.message || 'Failed to resend code');

            showAlert('A new verification code has been sent.', false);
            startResendTimer();
        } catch (error) {
            showAlert(error.message);
            resendCodeBtn.disabled = false;
        }
    });

    // Timer Logic for Resend
    function startResendTimer() {
        resendCodeBtn.disabled = true;
        let timeLeft = 60;
        
        clearInterval(resendTimerInterval);
        resendTimerDisplay.textContent = `(${timeLeft}s)`;
        
        resendTimerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(resendTimerInterval);
                resendCodeBtn.disabled = false;
                resendTimerDisplay.textContent = '';
            } else {
                resendTimerDisplay.textContent = `(${timeLeft}s)`;
            }
        }, 1000);
    }

    // Step 2: Change Email
    changeEmailBtn.addEventListener('click', () => {
        clearInterval(resendTimerInterval);
        resendTimerDisplay.textContent = '';
        resendCodeBtn.disabled = false;
        digitInputs.forEach(inp => inp.value = '');
        showStep(stepCredentials);
    });

});
