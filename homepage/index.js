const THEME_KEY = "newton-theme";

const App = {
    init() {
        this.loadTheme();
        this.updateThemeSwitcher();
    },

    loadTheme() {
        const theme = localStorage.getItem(THEME_KEY) || "midnight";
        this.setTheme(theme);
    },

    setTheme(theme) {
        localStorage.setItem(THEME_KEY, theme);
        document.documentElement.setAttribute("data-theme", theme);
        this.updateThemeSwitcher();
    },

    updateThemeSwitcher() {
        const theme = localStorage.getItem(THEME_KEY) || "midnight";
        document.querySelectorAll(".switcher span").forEach((span) => {
            span.classList.remove("active");
        });

        // document.getElementById("theme-" + theme) ?.classList.add("active");
        // frick prettier making "?." into "? ." i wanted to use optional chaining but whatever
        const themeElement = document.getElementById("theme-" + theme);
        if (themeElement) {
            themeElement.classList.add("active");
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    App.init();
});