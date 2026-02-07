# Development Guide

This guide covers local development setup for the Uncensored proxy server.

## Prerequisites

- **Node.js** 16+ (check: `node --version`)
- **pnpm** 10+ (check: `pnpm --version`)
- **Ollama** installed locally (https://ollama.com)

## Local Setup

### Option 1: Native Installation (Recommended)

**1. Install Ollama**

Download and install from https://ollama.com for Windows.

**2. Pull the AI Model**

Open a terminal and run:

```bash
ollama pull llama2-uncensored
```

This downloads the ~4GB model (first time only, takes several minutes).

**3. Clone and Setup Project**

```bash
cd c:\Users\jiupr\OneDrive\Desktop\Programming\Github\proxy-development
pnpm install
```

**4. Start Development Server**

```bash
pnpm run dev:watch
```

You should see:
```
[2026-02-07T...] Starting Uncensored Proxy
Environment: development
Ollama URL: http://localhost:11434
Listening on:
    http://localhost:3000
    http://YOUR-COMPUTER:3000
    http://127.0.0.1:3000
```

**5. Open in Browser**

- **Proxy**: http://localhost:3000
- **AI Chat**: http://localhost:3000/ai

### Option 2: Docker Compose

Docker Compose provides a containerized environment with both app and Ollama.

**1. Start Everything**

```bash
docker-compose up
```

First-time startup takes a moment while Docker builds the image.

**2. Pull the Model (First Time Only)**

In another terminal:

```bash
docker-compose exec ollama ollama pull llama2-uncensored
```

**3. Access Application**

- Browser: http://localhost:3000
- AI Chat: http://localhost:3000/ai

**4. View Logs**

```bash
docker-compose logs -f app    # Application logs
docker-compose logs -f ollama # Ollama logs
```

**5. Stop Everything**

```bash
docker-compose down
```

## Cloudflare Tunnel Setup

Expose your local development server to the internet via HTTPS with Cloudflare Tunnel.

### Quick Tunnel (Temporary URL)

No Cloudflare account required. Generates a random public URL that works while the command runs.

**1. Start Dev Server**

```bash
pnpm run dev:watch
```

**2. In Another Terminal, Start Tunnel**

```bash
pnpm run tunnel
```

Output will show something like:
```
Your Tunnel URL: https://random-words-123.trycloudflare.com
```

Anyone can access your local server at that URL while the tunnel runs. The URL changes each time you run the command.

### Named Tunnel (Persistent URL)

Requires a free Cloudflare account. Creates a persistent subdomain.

**1. Install cloudflared CLI**

```bash
winget install cloudflare.cloudflared
```

Or download from: https://github.com/cloudflare/cloudflared/releases

**2. Authenticate**

```bash
cloudflared tunnel login
```

This opens your browser to authenticate with Cloudflare.

**3. Create Tunnel**

```bash
cloudflared tunnel create uncensored-dev
```

Note the tunnel ID displayed.

**4. Create Tunnel Config**

Create `cloudflare-tunnel.yml` in project root:

```yaml
tunnel: uncensored-dev
credentials-file: C:\Users\jiupr\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: uncensored-dev.example.com
    service: http://localhost:3000
  - service: http_status:404
```

Replace:
- `<tunnel-id>` - UUID shown when creating the tunnel
- `example.com` - Your Cloudflare-managed domain

**5. Configure DNS** (Cloudflare Dashboard)

In your Cloudflare dashboard for `example.com`:
1. Go to DNS records
2. Add CNAME record:
   - Name: `uncensored-dev`
   - Target: `<tunnel-id>.cfargotunnel.com`

**6. Run Named Tunnel**

```bash
pnpm run tunnel:run
```

Now accessible at: `https://uncensored-dev.example.com`

This URL persists between runs (ideal for sharing with others during development).

## Testing

### Test Ollama Connection

Check if Ollama is running and responsive:

```bash
curl http://localhost:11434/api/tags
```

Expected response:
```json
{
  "models": [
    {
      "name": "llama2-uncensored:latest",
      "modified_at": "2026-02-07T...",
      "size": 3826519040,
      "digest": "..."
    }
  ]
}
```

### Test API Endpoints

**Health Check**

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "ollama": "connected",
  "models": 1
}
```

**Chat Endpoint**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, what is 2+2?"}
    ]
  }'
```

Response streams as newline-delimited JSON (NDJSON format).

### Manual Testing in Browser

1. Open http://localhost:3000/ai
2. Type a message in the chat interface
3. Watch the response stream in real-time

## Development Workflow

### File Structure

```
src/
  index.js           # Main server file
public/
  ai/               # AI chat interface
  proxy/            # Proxy UI
  components/       # Shared components
  hompage/          # Landing page
```

### Hot Reload

When running `pnpm run dev:watch`, changes to files automatically restart the server:

- Changes to `src/index.js` → Server restarts
- Changes to `public/` files → Served immediately (refresh browser)

### Environment Variables

Development uses `.env.development`:

```bash
NODE_ENV=development
PORT=3000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2-uncensored
```

Modify these to test different configurations.

### Common Development Tasks

**Add a new API endpoint:**

Edit `src/index.js` and add:

```javascript
fastify.get('/api/myendpoint', async (request, reply) => {
  return { message: 'Hello from my endpoint' };
});
```

Restart server (auto with `dev:watch`) and test:

```bash
curl http://localhost:3000/api/myendpoint
```

**Change Ollama model:**

1. Pull a different model: `ollama pull neural-chat`
2. Update `.env.development`: `OLLAMA_MODEL=neural-chat`
3. Restart server: Stop and run `pnpm run dev:watch` again

**Run linter:**

```bash
pnpm run lint
pnpm run lint:fix  # Auto-fix issues
```

**Format code:**

```bash
pnpm run format
```

## Troubleshooting

### Ollama not responding

**Problem**: `ECONNREFUSED 127.0.0.1:11434`

**Solutions**:
1. Check Ollama is running (Windows taskbar or run `ollama serve`)
2. Verify Ollama URL in `.env.development` matches your setup
3. Test Ollama directly: `curl http://localhost:11434/api/tags`

### Port 3000 already in use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:
1. Change PORT in `.env.development` to 3001 or 3002
2. Find process using port 3000:
   ```bash
   netstat -ano | findstr :3000
   ```
3. Kill the process (replace PID):
   ```bash
   taskkill /PID <PID> /F
   ```

### Model not found

**Problem**: `Error: model 'llama2-uncensored' not found`

**Solutions**:
1. List available models: `ollama list`
2. Pull the model: `ollama pull llama2-uncensored`
3. Wait for download to complete (may take several minutes)

### Docker Compose issues

**Problem**: Container exits immediately

**Solutions**:
1. Check logs: `docker-compose logs app`
2. Ensure Ollama is running on host (not in container)
3. Verify OLLAMA_URL is correct in docker-compose.yml

**Problem**: Out of disk space

**Solutions**:
1. Clean up Docker: `docker system prune -a`
2. Models take space: Ensure you have 10GB+ free
3. Remove models: `docker-compose exec ollama ollama rm llama2`

### Tunnel issues

**Problem**: `cloudflared` command not found

**Solutions**:
1. Install cloudflared: `winget install cloudflare.cloudflared`
2. Restart terminal to update PATH
3. Verify installation: `cloudflared --version`

**Problem**: Tunnel URL not working

**Solutions**:
1. Ensure `pnpm run dev:watch` is running
2. For named tunnels, verify DNS is configured
3. Check tunnel status: `cloudflared tunnel list`
4. Recreate tunnel if needed: `cloudflared tunnel delete uncensored-dev` then recreate

## Performance Tips

- **Limit concurrent requests**: Ollama processes one request at a time by default
- **Use smaller models** for faster responses: `neural-chat:7b` instead of `llama2:13b`
- **Enable GPU**: If you have NVIDIA GPU, Ollama can use it automatically
- **Increase Ollama memory**: Edit Ollama settings if responses are slow

## Next Steps

- Read [Architecture Guide](architecture.md) to understand system design
- Read [Deployment Guide](deployment.md) for production setup on Fly.io
- Check [API Endpoints](../README.md#api-endpoints) for available routes
