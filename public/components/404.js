/**
 * 404 Error Page Component
 * Provides configurable error page with defaults
 */

function setup404Page(config = {}) {
  const defaults = {
    title: "404",
    subtitle: "Page Not Found",
    messages: [
      "The server could not route your request.",
      "Please check the URL and try again."
    ],
    buttonText: "Go Back",
    buttonHref: "/",
    containerClass: "error-page"
  };

  const options = { ...defaults, ...config };

  // Create the error page structure
  const errorPage = document.querySelector(`.${options.containerClass}`);
  if (!errorPage) return;

  const content = document.querySelector(".error-content");
  if (!content) return;

  // Update title
  const titleEl = content.querySelector(".error-title");
  if (titleEl) titleEl.textContent = options.title;

  // Update subtitle
  const subtitleEl = content.querySelector(".error-subtitle");
  if (subtitleEl) subtitleEl.textContent = options.subtitle;

  // Update messages
  const messagesContainer = content.querySelector(".error-messages");
  if (messagesContainer) {
    messagesContainer.innerHTML = options.messages
      .map(msg => `<p class="error-message">${msg}</p>`)
      .join("");
  }

  // Update button
  const buttonEl = content.querySelector(".error-button");
  if (buttonEl) {
    buttonEl.textContent = options.buttonText;
    buttonEl.href = options.buttonHref;
  }
}
