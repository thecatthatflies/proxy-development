"use strict";

// ChatBot class manages conversation history, message display, and user interactions
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
		this.isWaiting = false;

		// Ensure there's always a default conversation
		if (!this.conversations.default) {
			this.conversations.default = {
				title: "New Conversation",
				messages: [],
				created: new Date().toISOString(),
			};
		}

		// Set current conversation - prefer default, otherwise first available
		this.currentConversation = "default";
		if (Object.keys(this.conversations).length === 0) {
			// Ensure default conversation exists
			this.conversations.default = {
				title: "New Conversation",
				messages: [],
				created: new Date().toISOString(),
			};
		}

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
		if (!text || this.isWaiting || !this.currentConversation) return;

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

		// Show typing indicator and get response
		this.showTypingIndicator();
		this.isWaiting = true;

		this.getOllamaResponse();
		this.saveConversations();
	}

	async getOllamaResponse() {
		try {
			// Get conversation messages for context
			const conversationMessages = this.conversations[this.currentConversation].messages.map(msg => ({
				role: msg.role,
				content: msg.content
			}));

			const response = await fetch("/api/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messages: conversationMessages,
				}),
			});

			if (!response.ok) {
				this.removeTypingIndicator();
				this.addMessage(`Error: Failed to get response (${response.status})`, "assistant");
				this.isWaiting = false;
				return;
			}

			this.removeTypingIndicator();

			// Create a message element for streaming response
			const messageEl = document.createElement("div");
			messageEl.className = "message assistant";
			const contentEl = document.createElement("div");
			contentEl.className = "message-content";
			const textEl = document.createElement("p");
			textEl.style.margin = "0";
			contentEl.appendChild(textEl);
			messageEl.appendChild(contentEl);
			this.chatMessages.appendChild(messageEl);

			// Stream the response
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullResponse = "";
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				buffer += chunk;

				// Process complete JSON lines
				const lines = buffer.split("\n");
				buffer = lines[lines.length - 1]; // Keep incomplete line in buffer

				for (let i = 0; i < lines.length - 1; i++) {
					if (lines[i].trim()) {
						try {
							const json = JSON.parse(lines[i]);
							if (json.message?.content) {
								const content = json.message.content;
								fullResponse += content;
								textEl.textContent = fullResponse;
								this.scrollToBottom();
							}
						} catch (e) {
							// Skip JSON parse errors
						}
					}
				}
			}

			// Add time to message
			const timeEl = document.createElement("div");
			timeEl.className = "message-time";
			timeEl.textContent = this.formatTime(new Date());
			contentEl.appendChild(timeEl);

			// Save the complete response to conversation
			this.conversations[this.currentConversation].messages.push({
				role: "assistant",
				content: fullResponse,
				timestamp: new Date().toISOString(),
			});

			this.isWaiting = false;
			this.saveConversations();
		} catch (error) {
			console.error("Error:", error);
			this.removeTypingIndicator();
			this.addMessage(`Error: ${error.message}`, "assistant");
			this.isWaiting = false;
		}
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

				// If all conversations are deleted, create a new default one
				if (Object.keys(this.conversations).length === 0) {
					this.conversations.default = {
						title: "New Conversation",
						messages: [],
						created: new Date().toISOString(),
					};
					this.currentConversation = "default";
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
                        <p>Welcome to Uncensored AI. How can I help you today?</p>
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
		const conversations = Object.entries(this.conversations).reverse();
		conversations.forEach(([id, conv]) => {
			const item = document.createElement("div");
			item.className = `conversation-item ${id === this.currentConversation ? "active" : ""}`;
			item.dataset.id = id;
			item.innerHTML = `
                <div class="conversation-title" title="${this.escapeHtml(conv.title)}">${this.escapeHtml(conv.title)}</div>
                <div class="conversation-actions">
                    <button class="rename-conversation" title="Rename">✎</button>
                    <button class="delete-conversation" title="Delete">×</button>
                </div>
            `;
			this.conversationsList.appendChild(item);
		});

		// Add event listeners for rename buttons
		this.conversationsList.querySelectorAll(".rename-conversation").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const item = btn.closest(".conversation-item");
				this.renameConversation(item.dataset.id);
			});
		});
	}

	renameConversation(id) {
		const currentTitle = this.conversations[id].title;
		Dialog.input(
			"Rename conversation:",
			currentTitle,
			(newTitle) => {
				this.conversations[id].title = newTitle;
				this.saveConversations();
				this.renderConversationsList();
			}
		);
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
	loadNavbar("../components/navbar.html");
	lucide.createIcons();
});
