"use strict";

// Initialize
document.addEventListener("DOMContentLoaded", () => {
	loadNavbar('../components/navbar.html');
});

// Event listener for theme switcher buttons
document.addEventListener("DOMContentLoaded", () => {
	document.querySelectorAll(".switcher button[id^='theme-']").forEach((button) => {
		button.addEventListener("click", (e) => {
			const theme = e.target.id.replace("theme-", "");
			ThemeManager.setTheme(theme);
		});
	});
});