# Architecture Overview

Comprehensive guide to the Uncensored system architecture, design decisions, and data flows.

## System Components

### Frontend (Browser)

**Static HTML/CSS/JavaScript** served from `/public`:
- `public/proxy/` - Web proxy interface for accessing blocked sites
- `public/ai/` - AI chat interface for conversations
- `public/components/` - Reusable UI components
- `public/homepage/` - Landing page

**Communication**:
- Makes HTTP/WebSocket requests to backend APIs
- Never directly connects to Ollama (only through backend)

### Backend (Node.js/Fastify)

**Server**: `src/index.js` - Main application server

**Responsibilities**:
- Serve static files (proxy UI, chat UI, etc.)
- Handle API requests
- Proxy WebSocket connections (Wisp)
- Forward chat requests to Ollama
- Health checking

**Key Routes**:
- `GET /` - Proxy interface
- `GET /ai` - Chat interface
- `POST /api/chat` - Stream chat responses
- `GET /api/health` - Check Ollama connectivity
- `WebSocket /wisp/` - Wisp proxy tunneling

### Ollama Service

**Purpose**: Run large language models locally

**Capabilities**:
- Chat API at `/api/chat`
- Model listing at `/api/tags`
- Streaming responses
- No authentication (internal use only)

**Location**:
- Development: `localhost:11434`
- Production: `uncensored-ollama.internal:11434` (Fly.io private network)

### Proxy Libraries

**Scramjet**: Web proxy implementation
- Handles HTTP/HTTPS interception
- Processes request/response headers
- Manages cookies and sessions

**Wisp.js**: WebSocket tunneling
- Enables bidirectional proxying
- Handles UDP (if enabled)
- Provides transport options

**Bare Mux**: Protocol multiplexing
- Supports multiple proxy transports
- HTTP, HTTPS, WebSocket

## Environment Architectures

### Development Environment

```
User's Browser
      ↓ HTTP/WS
localhost:3000 (Node.js/Fastify)
      ↓
localhost:11434 (Ollama)
      ↓
llama2-uncensored (Model in memory)
```

**Characteristics**:
- Single machine (developer's computer)
- Direct TCP connections (low latency)
- Optional Cloudflare tunnel for public access
- Easy debugging (local logs)

**Environment Variables**:
```bash
OLLAMA_URL=http://localhost:11434
NODE_ENV=development
```

### Production Environment (Fly.io)

```
Internet (HTTPS)
    ↓
Fly.io Edge (Auto-scaling)
    ↓
App Machine (uncensored)
    ├─ Node.js/Fastify
    ├─ Scramjet Proxy
    └─ Wisp WebSocket
    ↓
Private Network (Fly.io internal DNS)
    ↓
Ollama Machine (uncensored-ollama)
    └─ llama2-uncensored (4GB model)
```

**Characteristics**:
- Multi-machine (separate app and Ollama)
- Private network (not internet-accessible)
- Auto-scaling app (auto-stops when idle)
- Always-on Ollama (models stay warm)
- HTTPS by default
- 1GB app + 4GB Ollama = ~$50/month

**Environment Variables** (set via secrets):
```bash
OLLAMA_URL=http://uncensored-ollama.internal:11434
NODE_ENV=production
```

## Data Flow Diagrams

### Chat Request Flow

```
1. User Types Message
   Browser
      ↓ POST /api/chat (JSON with history)

2. Backend Receives Request
   Node.js validates JSON
      ↓ Streams response

3. Forward to Ollama
   Backend sends to Ollama with:
   - model: "llama2-uncensored"
   - messages: [user message + history]
   - stream: true
      ↓

4. Ollama Inference
   Model processes tokens
   Streams back NDJSON
      ↓

5. Backend Pipes to Client
   Node.js receives chunks
   Forwards to browser immediately
      ↓

6. Browser Renders
   JavaScript parses NDJSON
   Updates chat UI in real-time
   User sees words appearing
```

### Health Check Flow

```
Browser (every 30s)
    ↓ GET /api/health

Backend
    ↓ GET /api/tags (to Ollama)

Ollama
    ↓ Returns model list

Backend
    ↓ JSON response with:
      {
        "status": "healthy",
        "ollama": "connected",
        "models": 1
      }

Browser
    ↓ Updates UI (shows connection status)
```

### Web Proxy Flow

```
Browser (through proxy UI)
    ↓ Request to proxied website

Backend (Scramjet)
    ↓ Intercept request
    ├─ Modify headers (CORS, etc.)
    ├─ Rewrite URLs if needed
    ├─ Handle cookies

    ↓ Forward to target website

Target Website
    ↓ Response

Backend (Scramjet)
    ↓ Process response
    ├─ Inject scripts if needed
    ├─ Rewrite embedded URLs

    ↓ Send to browser

Browser
    ↓ Render proxied content
```

## Key Design Decisions

### 1. Separate Ollama Machine (Production)

**Decision**: Run Ollama on its own Fly.io machine

**Why**:
- **Resource isolation**: Ollama needs 4GB+, app only needs 1GB
- **Independent scaling**: Can add GPUs to Ollama without scaling app
- **Cost efficiency**: App auto-stops, Ollama stays warm with loaded models
- **Reliability**: Model corruption won't crash the proxy

**Trade-off**: Slight network latency between app and Ollama (~5-10ms)

**Alternative Considered**: Run both in same container
- Would be simpler but waste memory (oversized container)
- Couldn't use Fly.io auto-scaling effectively

### 2. Streaming Chat Responses

**Decision**: Stream responses token-by-token from Ollama to browser

**Why**:
- **Better UX**: User sees response appearing in real-time (not waiting for full response)
- **Reduced perceived latency**: 1 second of waiting + watching typing feels better than 30 seconds of blank screen
- **Lower memory**: Don't buffer entire response (important for large responses)
- **Standard**: Matches ChatGPT behavior

**Implementation**: NDJSON (newline-delimited JSON)
- Each token is a separate JSON object
- Separated by newlines
- Browser parses line-by-line

### 3. Fly.io Internal Networking

**Decision**: Use Fly.io private DNS for Ollama communication

**Why**:
- **Security**: Ollama API not exposed to internet
- **Performance**: Direct connections within datacenter
- **Cost**: No egress fees (same region)
- **Simplicity**: No authentication needed (private network is the firewall)

**How**: `uncensored-ollama.internal` is resolved by Fly.io's internal DNS

### 4. Environment-Based Configuration

**Decision**: Different environment files for dev and production

**Why**:
- **Simplicity**: Single codebase works in both environments
- **Safety**: Different Ollama URLs for each environment
- **Flexibility**: Easy to test production config locally
- **Secrets separation**: Production secrets never in git

**Implementation**:
- `.env.development` - Committed to git, uses localhost
- `.env.production` - Template only, actual secrets via Fly.io CLI
- Node.js loads appropriate file at startup

### 5. Persistent Volumes for Models

**Decision**: Store Ollama models on Fly.io persistent volume

**Why**:
- **Faster restarts**: Models already on disk, don't need to re-download
- **Cost**: Cheaper than re-downloading 4GB models each restart
- **Reliability**: Models persist across machine crashes

**Trade-off**: Slight slower initial deployment (creates 10GB volume)

### 6. Auto-Stopping App Machine

**Decision**: App machine auto-stops when idle, Ollama stays on

**Why**:
- **Cost**: App charges $0.15/hour, saves ~$100/month with auto-stop
- **Cold start**: ~20 seconds to restart app (acceptable for infrequent use)
- **Model warmth**: Ollama stays loaded, first response is still fast (no model loading delay)

**Result**: Pay only for when app is actually being used

## File Structure

```
uncensored/
├── src/
│   └── index.js              # Main server entry point
├── public/
│   ├── proxy/                # Web proxy interface
│   ├── ai/                   # AI chat interface
│   ├── components/           # Shared UI components
│   ├── homepage/             # Landing page
│   ├── games/                # Mini-games (optional)
│   └── sw.js                 # Service worker (optional)
├── docs/
│   ├── development.md        # Local dev setup
│   ├── deployment.md         # Fly.io deployment
│   └── architecture.md       # This file
├── Dockerfile                # Container definition
├── docker-compose.yml        # Local dev container setup
├── fly.toml                  # Main app Fly.io config
├── fly-ollama.toml          # Ollama machine Fly.io config
├── package.json              # Dependencies
├── .env.example              # Environment template
├── .env.development          # Local development env
├── .env.production           # Production env template
├── cloudflare-tunnel.yml     # Cloudflare tunnel config (optional)
└── README.md                 # Quick start
```

## API Specification

### POST /api/chat

**Purpose**: Stream AI responses to user messages

**Request**:
```json
{
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "What's 2+2?"}
  ]
}
```

**Response**: Stream of NDJSON (one JSON object per line)
```
{"model":"llama2-uncensored","message":{"role":"assistant","content":"2"}}\n
{"model":"llama2-uncensored","message":{"role":"assistant","content":"+2=4"}}\n
```

**Errors**:
- 400: Invalid request (missing `messages` array)
- 503: Ollama unavailable
- 504: Request timeout (>2 minutes)

### GET /api/health

**Purpose**: Check if Ollama is connected and healthy

**Response** (if healthy):
```json
{
  "status": "healthy",
  "ollama": "connected",
  "models": 1
}
```

**Response** (if unhealthy):
```json
{
  "status": "unhealthy",
  "ollama": "disconnected",
  "error": "Connection refused"
}
```

**HTTP Status**:
- 200: Healthy
- 503: Service unavailable

## Security Considerations

### What's Protected

- **Ollama API**: Not exposed to internet (private network only)
- **Backend**: Behind Fly.io edge (HTTPS only)
- **Secrets**: Environment variables encrypted by Fly.io
- **Communication**: All network traffic encrypted

### What's Not Protected (by design)

- **Web proxy**: Intentionally allows accessing any website (design goal)
- **Chat history**: Stored in browser's localStorage (user device)
- **No authentication**: No user accounts required (public service)

### If Running Publicly

Consider adding:
- Rate limiting to prevent abuse
- Authentication for private deployments
- Request logging for auditing
- Content filtering if needed

## Performance Characteristics

### Response Times

**Cold start** (fresh model load): 1-2 minutes
- Not applicable after first load

**Response generation** (subsequent requests):
- First token: 2-5 seconds (initial processing)
- Subsequent tokens: 0.2-0.5 seconds each
- Typical full response: 10-30 seconds

**With GPU** (if enabled):
- First token: 0.5 seconds
- Subsequent tokens: 0.05 seconds each
- 10x faster overall

### Resource Usage

**Development**:
- App: 50-200MB RAM
- Ollama: 3-4GB RAM (models loaded)
- CPU: 0-100% during inference

**Production**:
- App machine: 500MB used of 1GB
- Ollama machine: 3.5GB used of 4GB
- CPU: 80% during inference, 0% idle

### Scalability

**Concurrent requests**: Ollama processes sequentially (one at a time)
- Multiple app machines can queue requests to one Ollama
- Add more Ollama machines for true concurrency

**Storage**:
- Ollama models: ~4GB per model
- Volume size: 10GB (can increase)
- No other significant storage

## Future Enhancements

### Short Term

1. **Multiple models**: Let users choose between models
2. **Conversation persistence**: Save chats to database
3. **Rate limiting**: Prevent abuse
4. **Custom prompts**: System message configuration

### Medium Term

1. **Authentication**: User accounts and API keys
2. **Caching**: Cache common questions/responses
3. **Model switching**: Easy A/B testing of models
4. **Fine-tuning**: Custom model training

### Long Term

1. **Distributed inference**: Multiple Ollama instances with load balancing
2. **Function calling**: Extended chat capabilities
3. **Vision models**: Image understanding
4. **Embeddings**: Semantic search

## Monitoring and Observability

### Available Metrics

**Fly.io Dashboard**:
- CPU usage
- Memory usage
- Network I/O
- Machine restarts

**Application Logs**:
- Request logs (all HTTP requests)
- Error logs (connection failures, timeouts)
- Startup info (environment, ports)

### Recommended Monitoring

1. Set up **Fly.io alerts** for machine restarts
2. Monitor **CPU usage** (should be 0-100%, not sustained high)
3. Check **memory usage** (Ollama should be 3-4GB)
4. Review **error logs** weekly for issues

### Debugging

**Check app logs**:
```bash
fly logs -a uncensored | grep ERROR
```

**Check Ollama logs**:
```bash
fly logs -a uncensored-ollama
```

**SSH into machine**:
```bash
fly ssh console -a uncensored
# Check environment variables
env | grep OLLAMA

# Test Ollama from app machine
curl http://uncensored-ollama.internal:11434/api/tags
```

## Summary

Uncensored is a **dual-environment application** with:
- **Simple architecture**: Web proxy + API + AI chat
- **Flexible deployment**: Works locally or on cloud
- **Cost-optimized**: Auto-scaling for production
- **Extensible**: Easy to add features (new endpoints, models, etc.)

The key insight is **separating concerns**: Proxy/API logic in app layer, AI inference in Ollama layer. This allows each to scale independently and be replaced or upgraded separately.
