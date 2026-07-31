/* ==========================================================================
   STRATMONT INVESTMENTS - GLOBAL THEME MANAGER
   Single source of truth for theme persistence across all pages.
   Include this script in <head> of every page for instant theme application.
   ========================================================================== */

(function() {
    // Apply theme immediately to prevent flash of wrong theme
    const savedTheme = localStorage.getItem('stratmont_theme') || localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stratmont_theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Attach event listeners on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Re-apply in case DOM wasn't ready during initial IIFE
    const savedTheme = localStorage.getItem('stratmont_theme') || localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    // Attach click handlers to all theme toggle buttons
    const toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTheme();
        });
    });
});

// Expose globally for manual use
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
