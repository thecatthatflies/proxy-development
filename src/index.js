import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

// Log environment on startup
console.log(`[${new Date().toISOString()}] Starting Uncensored Proxy`);
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Ollama URL: ${process.env.OLLAMA_URL || "http://localhost:11434"}`);

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// Configure Wisp proxy settings (see https://www.npmjs.com/package/@mercuryworkshop/wisp-js)

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	hostname_blacklist: [/example\.com/],
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
				else socket.end();
			});
	},
});

fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});

// Handle Ollama chat API requests
fastify.post("/api/chat", async (request, reply) => {
	const { messages } = request.body;

	if (!messages || !Array.isArray(messages)) {
		return reply.code(400).send({ error: "messages array is required" });
	}

	const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
	const MODEL = process.env.OLLAMA_MODEL || "llama2-uncensored";
	const REQUEST_TIMEOUT = 120000; // 2 minutes max per request

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

		const response = await fetch(`${OLLAMA_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: MODEL,
				messages: messages,
				stream: true,
			}),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			console.error(`Ollama API error: ${response.status} ${response.statusText}`);
			return reply.code(response.status).send({
				error: `Ollama error: ${response.statusText}`,
				model: MODEL,
			});
		}

		// Stream the response
		reply.type("application/x-ndjson");
		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				reply.raw.write(chunk);
			}
		} finally {
			reader.releaseLock();
		}

		reply.raw.end();
	} catch (error) {
		if (error.name === "AbortError") {
			console.error("Ollama request timeout after 2 minutes");
			return reply.code(504).send({
				error: "Request timeout - Ollama took too long to respond",
			});
		}

		console.error("Ollama API error:", error.message);
		return reply.code(503).send({
			error: "Ollama service unavailable",
			details: error.message,
			hint: `Check if Ollama is running at ${OLLAMA_URL}`,
		});
	}
});

// Health check endpoint for external Ollama
fastify.get("/api/health", async (request, reply) => {
	const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

	try {
		const response = await fetch(`${OLLAMA_URL}/api/tags`, {
			timeout: 5000,
		});

		if (!response.ok) {
			return reply.code(503).send({
				status: "unhealthy",
				ollama: "unavailable",
				message: `Ollama returned status ${response.status}`,
			});
		}

		const data = await response.json();
		return reply.send({
			status: "healthy",
			ollama: "connected",
			models: data.models?.length || 0,
		});
	} catch (error) {
		console.error("Health check failed:", error.message);
		return reply.code(503).send({
			status: "unhealthy",
			ollama: "disconnected",
			error: error.message,
		});
	}
});

fastify.setNotFoundHandler((res, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
	const address = fastify.server.address();

	// Print listening addresses (by default 0.0.0.0 listens on all interfaces)
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	fastify.close();
	process.exit(0);
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 3000;

fastify.listen({
	port: port,
	host: "0.0.0.0",
});
