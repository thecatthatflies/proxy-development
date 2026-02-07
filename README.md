# Uncensored

An innovative proxy server with integrated AI chat capabilities, built with Node.js and Ollama.

## Quick Start

### Development (Local + Optional Cloudflare Tunnel)

**Prerequisites:**
- Node.js 16+, pnpm 10+
- Ollama installed locally (https://ollama.com)

**Setup:**
```bash
# 1. Install Ollama and pull the model
ollama pull llama2-uncensored

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm run dev:watch

# 4. Open browser
open http://localhost:3000

# 5. (Optional) Expose via Cloudflare tunnel
pnpm run tunnel
```

**Using Docker Compose (Alternative):**
```bash
docker-compose up
docker-compose exec ollama ollama pull llama2-uncensored
# Then open http://localhost:3000
```

### Production (Fly.io)

See [docs/deployment.md](docs/deployment.md) for complete deployment guide.

**Quick summary:**
```bash
# Deploy Ollama machine
fly deploy --config fly-ollama.toml --app uncensored-ollama --image ollama/ollama:latest

# Deploy main app
fly secrets set OLLAMA_URL=http://uncensored-ollama.internal:11434 -a uncensored
fly deploy -a uncensored
```

## Features

- **Web Proxy**: Full-featured proxy with Scramjet
- **AI Chat**: Real-time streaming chat with Ollama
- **Wisp Support**: WebSocket tunneling for enhanced proxy capabilities
- **Bare Mux**: Multiple proxy transports
- **Auto-Scaling**: Deployment on Fly.io with auto-stop when idle

## Environments

| Environment | Location | Ollama | Details |
|-------------|----------|--------|---------|
| **Development** | Local | Local (http://localhost:11434) | Hot reload, optional Cloudflare tunnel |
| **Production** | Fly.io | Separate Fly.io machine | Internal networking, auto-scaling |

## Documentation

- **[Development Guide](docs/development.md)** - Local setup, Cloudflare tunnel, Docker Compose, testing
- **[Deployment Guide](docs/deployment.md)** - Fly.io deployment, scaling, monitoring
- **[Architecture](docs/architecture.md)** - System design and decision rationale

## API Endpoints

- `POST /api/chat` - Stream chat responses with Ollama
- `GET /api/health` - Check Ollama connection status
- `/` - Web proxy interface
- `/ai` - AI chat interface

## Environment Configuration

Copy `.env.example` to `.env.development` (local) or use `.env.production` for Fly.io:

```bash
NODE_ENV=development
PORT=3000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2-uncensored
```

## Development Scripts

```bash
pnpm run dev          # Start server (no auto-reload)
pnpm run dev:watch    # Start with auto-reload (nodemon)
pnpm run tunnel       # Expose via Cloudflare tunnel (random URL)
pnpm run tunnel:run   # Run named Cloudflare tunnel
pnpm run lint         # Run ESLint
pnpm run format       # Format with Prettier
```

## License

GNU AFFERO
