/* ==========================================================================
   STRATMONT INVESTMENTS - GLOBAL THEME MANAGER
   Single source of truth for theme persistence across all pages.
   Include this script in <head> of every page for instant theme application.
   ========================================================================== */

(function() {
    // Apply theme immediately to prevent flash of wrong theme
    const savedTheme = localStorage.getItem(window.STRATMONT_CONFIG?.THEME_KEY || 'stratmontTheme') || localStorage.getItem('stratmont_theme') || localStorage.getItem('theme');
    
    // Default to system preference if no saved theme
    if (!savedTheme) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', savedTheme);
        // Also update meta color-scheme tag
        const meta = document.querySelector('meta[name="color-scheme"]');
        if (meta) meta.content = savedTheme;
    }
})();

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(window.STRATMONT_CONFIG?.THEME_KEY || 'stratmontTheme', theme);
    localStorage.removeItem('stratmont_theme');
    localStorage.removeItem('theme');
    
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = theme;
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Attach event listeners on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Attach click handlers to all theme toggle buttons
    const toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTheme();
        });
    });

    // Listen to system changes if no explicit user preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem(window.STRATMONT_CONFIG?.THEME_KEY || 'stratmontTheme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
});

// Expose globally for manual use
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
