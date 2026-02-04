"use strict";

// Custom modal dialog component for confirmations and alerts
const Dialog = {
	// Show a confirmation dialog
	confirm(message, onConfirm, onCancel) {
		const backdrop = document.createElement("div");
		backdrop.className = "dialog-backdrop";

		const dialog = document.createElement("div");
		dialog.className = "dialog";

		dialog.innerHTML = `
			<div class="dialog-content">
				<p>${this.escapeHtml(message)}</p>
				<div class="dialog-buttons">
					<button class="dialog-btn dialog-btn-cancel">Cancel</button>
					<button class="dialog-btn dialog-btn-confirm">Delete</button>
				</div>
			</div>
		`;

		const cancelBtn = dialog.querySelector(".dialog-btn-cancel");
		const confirmBtn = dialog.querySelector(".dialog-btn-confirm");

		const cleanup = () => {
			backdrop.remove();
		};

		cancelBtn.addEventListener("click", () => {
			cleanup();
			if (onCancel) onCancel();
		});

		confirmBtn.addEventListener("click", () => {
			cleanup();
			if (onConfirm) onConfirm();
		});

		backdrop.addEventListener("click", (e) => {
			if (e.target === backdrop) {
				cleanup();
				if (onCancel) onCancel();
			}
		});

		backdrop.appendChild(dialog);
		document.body.appendChild(backdrop);

		confirmBtn.focus();
	},

	// Show an input dialog
	input(message, initialValue = "", onSubmit, onCancel) {
		const backdrop = document.createElement("div");
		backdrop.className = "dialog-backdrop";

		const dialog = document.createElement("div");
		dialog.className = "dialog";

		dialog.innerHTML = `
			<div class="dialog-content">
				<p>${this.escapeHtml(message)}</p>
				<input type="text" class="dialog-input" value="${this.escapeHtml(initialValue)}">
				<div class="dialog-buttons">
					<button class="dialog-btn dialog-btn-cancel">Cancel</button>
					<button class="dialog-btn dialog-btn-confirm">OK</button>
				</div>
			</div>
		`;

		const input = dialog.querySelector(".dialog-input");
		const cancelBtn = dialog.querySelector(".dialog-btn-cancel");
		const confirmBtn = dialog.querySelector(".dialog-btn-confirm");

		const cleanup = () => {
			backdrop.remove();
		};

		const handleSubmit = () => {
			const value = input.value.trim();
			cleanup();
			if (value && onSubmit) onSubmit(value);
			else if (!value && onCancel) onCancel();
		};

		cancelBtn.addEventListener("click", () => {
			cleanup();
			if (onCancel) onCancel();
		});

		confirmBtn.addEventListener("click", handleSubmit);

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				handleSubmit();
			} else if (e.key === "Escape") {
				cleanup();
				if (onCancel) onCancel();
			}
		});

		backdrop.addEventListener("click", (e) => {
			if (e.target === backdrop) {
				cleanup();
				if (onCancel) onCancel();
			}
		});

		backdrop.appendChild(dialog);
		document.body.appendChild(backdrop);

		input.select();
		input.focus();
	},

	// Escape HTML to prevent XSS
	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	},
};
