"use strict";

/**
 * Custom modal dialog component for confirmations and alerts
 */

const Dialog = {
	/**
	 * Show a confirmation dialog
	 * @param {string} message - Message to display
	 * @param {function} onConfirm - Callback when user confirms
	 * @param {function} onCancel - Callback when user cancels
	 */
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

	/**
	 * Escape HTML to prevent XSS
	 */
	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	},
};
