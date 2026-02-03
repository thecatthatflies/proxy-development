"use strict";

/**
 * AI Chatbot Interface
 * Manages conversation history, message display, and user interactions
 */

class ChatBot {
	constructor() {
		this.chatMessages = document.getElementById("chat-messages");
		this.chatInput = document.getElementById("chat-input");
		this.sendBtn = document.getElementById("send-btn");
		this.clearBtn = document.getElementById("clear-btn");
		this.newChatBtn = document.getElementById("new-chat-btn");
		this.charCount = document.getElementById("char-count");
		this.conversationsList = document.getElementById("conversations-list");

		this.conversations = this.loadConversations();
		this.currentConversation = "default";
		this.isWaiting = false;

		this.thinkingWords = [
			"Accomplishing", "Actioning", "Actualizing", "Baking", "Brewing",
			"Calculating", "Cerebrating", "Churning", "Uncensoring", "Coalescing",
			"Cogitating", "Computing", "Conjuring", "Considering", "Cooking",
			"Crafting", "Creating", "Crunching", "Deliberating", "Determining",
			"Doing", "Effecting", "Finagling", "Forging", "Forming",
			"Generating", "Hatching", "Herding", "Honking", "Hustling",
			"Ideating", "Inferring", "Manifesting", "Marinating", "Moseying",
			"Mulling", "Mustering", "Musing", "Noodling", "Percolating",
			"Pondering", "Processing", "Puttering", "Reticulating", "Ruminating",
			"Schlepping", "Shucking", "Simmering", "Smooshing", "Spinning",
			"Stewing", "Synthesizing", "Thinking", "Transmuting", "Vibing",
			"Working"
		];

		this.setupEventListeners();
		this.renderConversationsList();
		this.updateCharCount();
		this.autoResizeTextarea();
	}

	setupEventListeners() {
		this.sendBtn.addEventListener("click", () => this.sendMessage());
		this.clearBtn.addEventListener("click", () => this.clearConversation());
		this.newChatBtn.addEventListener("click", () => this.createNewConversation());
		this.chatInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.sendMessage();
			}
		});
		this.chatInput.addEventListener("input", () => {
			this.updateCharCount();
			this.autoResizeTextarea();
		});

		// Delegate conversation item clicks
		this.conversationsList.addEventListener("click", (e) => {
			const deleteBtn = e.target.closest(".delete-conversation");
			if (deleteBtn) {
				const item = deleteBtn.closest(".conversation-item");
				this.deleteConversation(item.dataset.id);
				return;
			}

			const item = e.target.closest(".conversation-item");
			if (item) {
				this.switchConversation(item.dataset.id);
			}
		});
	}

	sendMessage() {
		const text = this.chatInput.value.trim();
		if (!text || this.isWaiting) return;

		// Add user message
		this.addMessage(text, "user");
		this.conversations[this.currentConversation].messages.push({
			role: "user",
			content: text,
			timestamp: new Date().toISOString(),
		});

		// Update conversation title if it's the first message
		if (this.conversations[this.currentConversation].messages.length === 1) {
			const title = text.substring(0, 30) + (text.length > 30 ? "..." : "");
			this.conversations[this.currentConversation].title = title;
			this.renderConversationsList();
		}

		// Clear input
		this.chatInput.value = "";
		this.chatInput.style.height = "auto";
		this.updateCharCount();

		// Simulate typing indicator and response
		this.showTypingIndicator();
		this.isWaiting = true;

		// Simulate API call with delay
		setTimeout(() => {
			const response = "I'm a placeholder response. Connect me to a real API to make me functional!";
			this.removeTypingIndicator();
			this.addMessage(response, "assistant");
			this.conversations[this.currentConversation].messages.push({
				role: "assistant",
				content: response,
				timestamp: new Date().toISOString(),
			});
			this.isWaiting = false;
			this.saveConversations();
		}, 800);

		this.saveConversations();
	}

	addMessage(text, role) {
		const message = document.createElement("div");
		message.className = `message ${role}`;
		message.innerHTML = `
            <div class="message-content">
                <p>${this.escapeHtml(text)}</p>
                <div class="message-time">${this.formatTime(new Date())}</div>
            </div>
        `;
		this.chatMessages.appendChild(message);
		this.scrollToBottom();
	}

	showTypingIndicator() {
		const randomWord = this.thinkingWords[Math.floor(Math.random() * this.thinkingWords.length)];
		const indicator = document.createElement("div");
		indicator.className = "message assistant";
		indicator.id = "typing-indicator";
		indicator.innerHTML = `
            <div class="message-content">
                <p class="typing-indicator-text">${randomWord}...</p>
            </div>
        `;
		this.chatMessages.appendChild(indicator);
		this.scrollToBottom();
	}

	removeTypingIndicator() {
		const indicator = document.getElementById("typing-indicator");
		if (indicator) indicator.remove();
	}

	clearConversation() {
		if (this.conversations[this.currentConversation].messages.length === 0) return;
		if (!confirm("Clear all messages in this conversation?")) return;

		this.conversations[this.currentConversation].messages = [];
		this.chatMessages.innerHTML = `
            <div class="message system-message">
                <div class="message-content">
                    <p>Conversation cleared. How can I help you?</p>
                </div>
            </div>
        `;
		this.saveConversations();
	}

	createNewConversation() {
		const id = `conv-${Date.now()}`;
		const title = `Conversation ${Object.keys(this.conversations).length}`;
		this.conversations[id] = {
			title,
			messages: [],
			created: new Date().toISOString(),
		};
		this.saveConversations();
		this.switchConversation(id);
		this.renderConversationsList();
	}

	switchConversation(id) {
		this.currentConversation = id;
		this.renderConversationsList();
		this.loadConversationMessages();
	}

	deleteConversation(id) {
		Dialog.confirm(
			"Delete this conversation?",
			() => {
				delete this.conversations[id];

				// If all conversations are deleted, clear current
				if (Object.keys(this.conversations).length === 0) {
					this.currentConversation = null;
				} else if (id === this.currentConversation) {
					// If deleted conversation was active, switch to first available
					this.currentConversation = Object.keys(this.conversations)[0];
				}

				this.saveConversations();
				this.renderConversationsList();
				this.loadConversationMessages();
			}
		);
	}

	loadConversationMessages() {
		this.chatMessages.innerHTML = "";

		if (!this.currentConversation || !this.conversations[this.currentConversation]) {
			this.chatMessages.innerHTML = `
                <div class="message system-message">
                    <div class="message-content">
                        <p>No conversations. Click "NEW" to start a new conversation.</p>
                    </div>
                </div>
            `;
			return;
		}

		const messages = this.conversations[this.currentConversation].messages;

		if (messages.length === 0) {
			this.chatMessages.innerHTML = `
                <div class="message system-message">
                    <div class="message-content">
                        <p>Welcome to Newton AI. How can I help you today?</p>
                    </div>
                </div>
            `;
		} else {
			messages.forEach((msg) => {
				this.addMessage(msg.content, msg.role);
			});
		}
		this.scrollToBottom();
	}

	renderConversationsList() {
		this.conversationsList.innerHTML = "";
		Object.entries(this.conversations).forEach(([id, conv]) => {
			const item = document.createElement("div");
			item.className = `conversation-item ${id === this.currentConversation ? "active" : ""}`;
			item.dataset.id = id;
			item.innerHTML = `
                <div class="conversation-title">${this.escapeHtml(conv.title)}</div>
                <button class="delete-conversation" title="Delete">×</button>
            `;
			this.conversationsList.appendChild(item);
		});
	}

	updateCharCount() {
		this.charCount.textContent = Math.min(this.chatInput.value.length, 2000);
		this.sendBtn.disabled = this.chatInput.value.trim().length === 0;
	}

	autoResizeTextarea() {
		this.chatInput.style.height = "auto";
		const height = Math.min(this.chatInput.scrollHeight, 150);
		this.chatInput.style.height = `${height}px`;
	}

	scrollToBottom() {
		setTimeout(() => {
			this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
		}, 0);
	}

	saveConversations() {
		localStorage.setItem("chatbot-conversations", JSON.stringify(this.conversations));
	}

	loadConversations() {
		const saved = localStorage.getItem("chatbot-conversations");
		if (saved) {
			return JSON.parse(saved);
		}
		return {
			default: {
				title: "New Conversation",
				messages: [],
				created: new Date().toISOString(),
			},
		};
	}

	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	formatTime(date) {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}
}

// Initialize chatbot when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
	new ChatBot();

	// Render Lucide icons
	if (typeof lucide !== "undefined") {
		lucide.createIcons();
	}
});
