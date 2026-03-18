import { signUp, signIn, getUser } from "./supabase.js";

// Redirect if already logged in
// ── Commented out for local Live Server testing ──
// ── Uncomment before pushing to production ──
// getUser().then(user => {
//     if (user) window.location.href = "./dashboard/index.html";
// });

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const switchToLogin = document.getElementById('switchToLogin');
    const switchToSignup = document.getElementById('switchToSignup');
    const toast = document.getElementById('toast');

    switchToLogin.addEventListener('click', e => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        clearErrors();
    });

    switchToSignup.addEventListener('click', e => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        clearErrors();
    });

    function bindToggle(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const inp = document.getElementById(inputId);
        if (!btn || !inp) return;
        btn.addEventListener('click', () => {
            inp.type = inp.type === 'password' ? 'text' : 'password';
            btn.style.color = inp.type === 'text' ? 'var(--accent)' : 'var(--text-dimmer)';
        });
    }

    bindToggle('togglePw', 'password');
    bindToggle('toggleLoginPw', 'loginPassword');

    const pwInput = document.getElementById('password');
    const pwBar = document.getElementById('pwBar');
    const pwLabel = document.getElementById('pwLabel');

    const strengthLevels = [
        { label: 'Weak', color: '#e05555', pct: 25 },
        { label: 'Fair', color: '#e0913a', pct: 50 },
        { label: 'Good', color: '#c8d63a', pct: 75 },
        { label: 'Strong', color: '#00e5cc', pct: 100 },
    ];

    if (pwInput) {
        pwInput.addEventListener('input', () => {
            const val = pwInput.value;
            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            if (val.length === 0) {
                pwBar.style.width = '0%';
                pwBar.style.background = 'transparent';
                pwLabel.textContent = '';
                pwLabel.style.color = '';
                return;
            }

            const level = strengthLevels[score - 1] || strengthLevels[0];
            pwBar.style.width = level.pct + '%';
            pwBar.style.background = level.color;
            pwLabel.textContent = level.label;
            pwLabel.style.color = level.color;
        });
    }

    function setError(fieldId, errId, message) {
        const input = document.getElementById(fieldId);
        const err = document.getElementById(errId);
        if (input) input.classList.add('input--error');
        if (err) err.textContent = message;
    }

    function clearErrors() {
        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        document.querySelectorAll('input').forEach(el => el.classList.remove('input--error'));
    }

    function isValidEmail(val) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }

    let toastTimer;
    function showToast(message, type = 'error') {
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.className = `toast toast--${type} toast--show`;
        toastTimer = setTimeout(() => {
            toast.classList.remove('toast--show');
        }, 4000);
    }

    function setLoading(btnId, spinnerId, loading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled = loading;
        if (loading) {
            btn.classList.add('loading');
        } else {
            btn.classList.remove('loading');
        }
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async e => {
            e.preventDefault();
            clearErrors();

            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            let valid = true;

            if (!username) {
                setError('username', 'err-username', 'Username is required.');
                valid = false;
            } else if (username.length < 3) {
                setError('username', 'err-username', 'Must be at least 3 characters.');
                valid = false;
            }

            if (!email) {
                setError('email', 'err-email', 'Email is required.');
                valid = false;
            } else if (!isValidEmail(email)) {
                setError('email', 'err-email', 'Enter a valid email address.');
                valid = false;
            }

            if (!password) {
                setError('password', 'err-password', 'Password is required.');
                valid = false;
            } else if (password.length < 8) {
                setError('password', 'err-password', 'Must be at least 8 characters.');
                valid = false;
            }

            if (!valid) return;

            setLoading('submitBtn', 'btnSpinner', true);
            const { error } = await signUp(email, password, username);
            setLoading('submitBtn', 'btnSpinner', false);

            if (error) {
                showToast(error.message || 'Sign up failed. Try again.', 'error');
                return;
            }

            showToast('Account created! Check your email to confirm.', 'success');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            clearErrors();

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            let valid = true;

            if (!email) {
                setError('loginEmail', 'err-loginEmail', 'Email is required.');
                valid = false;
            } else if (!isValidEmail(email)) {
                setError('loginEmail', 'err-loginEmail', 'Enter a valid email address.');
                valid = false;
            }

            if (!password) {
                setError('loginPassword', 'err-loginPassword', 'Password is required.');
                valid = false;
            }

            if (!valid) return;

            setLoading('loginBtn', 'loginSpinner', true);
            const { error } = await signIn(email, password);
            setLoading('loginBtn', 'loginSpinner', false);

            if (error) {
                showToast(error.message || 'Invalid email or password.', 'error');
                return;
            }

            showToast('Signed in! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = "./dashboard/index.html";
            }, 1000);
        });
    }
});