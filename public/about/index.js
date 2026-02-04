"use strict";

// Handle theme switcher button clicks
document.addEventListener("DOMContentLoaded", () => {
	document.querySelectorAll(".switcher button[id^='theme-']").forEach((button) => {
		button.addEventListener("click", (e) => {
			const theme = e.target.id.replace("theme-", "");
			ThemeManager.setTheme(theme);
		});
	});
});
