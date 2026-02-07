# Deployment Guide (Fly.io)

Complete guide for deploying Uncensored to Fly.io with a separate Ollama machine.

## Architecture Overview

The production setup uses two separate Fly.io machines:

1. **Main App Machine** (`uncensored`): Node.js server with proxy and API
   - 1GB RAM, auto-scaling enabled
   - Handles web requests and proxies chat to Ollama

2. **Ollama Machine** (`uncensored-ollama`): AI model inference server
   - 4GB RAM, always-on (doesn't auto-stop)
   - Runs llama2-uncensored model
   - Communicates via Fly.io internal network

Benefits of this architecture:
- **Independent scaling**: Scale app and Ollama separately
- **Secure**: Ollama not exposed to internet (internal network only)
- **Cost-effective**: App auto-stops when idle, Ollama stays warm
- **Reliable**: Each service isolated

## Prerequisites

- **Fly.io account** (free): https://fly.io
- **Fly CLI installed**: https://fly.io/docs/getting-started/install-flyctl/
- **Logged in**: Run `fly auth login`

## Step 1: Create Fly.io Apps

### Create Ollama App

```bash
fly apps create uncensored-ollama
```

This registers the app with Fly.io. Creates no machine yet.

### Create Main App

```bash
fly apps create uncensored
```

(If you already created this, skip.)

## Step 2: Create Persistent Volume for Ollama Models

Ollama models are large (~4GB). We'll store them on a persistent volume so they persist across machine restarts.

```bash
fly volumes create ollama_models \
  --region iad \
  --size 10 \
  --app uncensored-ollama
```

This creates a 10GB volume named `ollama_models` in the `iad` (US East) region.

## Step 3: Deploy Ollama Machine

```bash
fly deploy \
  --config fly-ollama.toml \
  --app uncensored-ollama \
  --image ollama/ollama:latest
```

This:
- Reads config from `fly-ollama.toml`
- Creates a machine using the official Ollama Docker image
- Mounts the volume at `/root/.ollama` (where models are stored)
- Exposes port 11434 internally

**Expected output:**
```
==> Verifying app config
--> Verified app config
==> Building image
...
==> Creating release
Release v1 created...
```

### Verify Ollama Machine Started

```bash
fly status -a uncensored-ollama
```

Should show:
```
App Name     = uncensored-ollama
Status       = running
Machines
ID       VERSION REGION STATE   CHECKS LAST UPDATED
<id>     1       iad    started        <time>
```

## Step 4: SSH into Ollama Machine and Pull Model

Pull the AI model into the persistent volume:

```bash
fly ssh console -a uncensored-ollama
```

You're now in the Ollama container. Run:

```bash
ollama pull llama2-uncensored
ollama list
```

Wait for the model to download (several minutes, ~4GB).

Output from `ollama list`:
```
NAME                     ID              SIZE    MODIFIED
llama2-uncensored:latest xxxxxxxx...    3.8 GB  <time>
```

Exit the SSH session:

```bash
exit
```

## Step 5: Deploy Main Application

### Set Production Secrets

Secrets are environment variables that are:
- Encrypted at rest
- Not visible in logs or git history
- Injected at runtime

Set the Ollama connection details:

```bash
fly secrets set \
  OLLAMA_URL=http://uncensored-ollama.internal:11434 \
  OLLAMA_MODEL=llama2-uncensored \
  -a uncensored
```

Key details:
- `uncensored-ollama.internal` is the Fly.io internal DNS name (not accessible from internet)
- Port 11434 is Ollama's default
- These values only exist in production, not in git

### Verify Secrets Are Set

```bash
fly secrets list -a uncensored
```

Shows:
```
NAME           DIGEST
OLLAMA_URL     sha256:...
OLLAMA_MODEL   sha256:...
```

### Deploy App

```bash
fly deploy -a uncensored
```

This:
- Reads config from `fly.toml`
- Builds Docker image from Dockerfile
- Starts machine in `iad` region
- Injects secrets as environment variables

**Expected output:**
```
==> Verifying app config
==> Building image
...
Release v1 created...
==> Monitoring deployment
```

### Verify App Machine Started

```bash
fly status -a uncensored
```

Should show machine in `running` state.

## Step 6: Test the Deployment

### Test Health Endpoint

```bash
curl https://uncensored.fly.dev/api/health
```

Expected response (if Ollama is running):
```json
{
  "status": "healthy",
  "ollama": "connected",
  "models": 1
}
```

If you get an error, Ollama machine may still be booting (takes ~20 seconds).

### Test Chat Endpoint

```bash
curl -X POST https://uncensored.fly.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

Response streams back with AI response.

### Access Web Interface

Open https://uncensored.fly.dev in browser:
- **Proxy**: Home page with proxy interface
- **AI Chat**: https://uncensored.fly.dev/ai for chat UI

## Monitoring and Logs

### View Application Logs

```bash
fly logs -a uncensored
```

Shows real-time logs from the app machine.

### View Ollama Logs

```bash
fly logs -a uncensored-ollama
```

Shows Ollama startup and model loading.

### View Machine Status

```bash
fly status -a uncensored
fly status -a uncensored-ollama
```

### SSH into App Machine

```bash
fly ssh console -a uncensored
```

Check environment variables:
```bash
env | grep OLLAMA
```

Should show:
```
OLLAMA_MODEL=llama2-uncensored
OLLAMA_URL=http://uncensored-ollama.internal:11434
```

## Scaling

### Scale App Memory

If the app needs more memory (for proxy buffers):

```bash
fly scale memory 2048 -a uncensored
```

This sets memory to 2GB. Options: 256, 512, 1024, 2048, 4096, etc.

### Scale Ollama Memory

If you want to support multiple concurrent requests:

```bash
fly scale memory 8192 -a uncensored-ollama
```

Increases to 8GB.

### Add GPUs to Ollama (Expensive)

For 10x faster inference (but costs more):

```bash
fly machines update <machine-id> \
  --vm-gpu-kind a40 \
  -a uncensored-ollama
```

Get machine ID from `fly status -a uncensored-ollama`.

GPU options: `a40`, `l40s`, `a100-40gb`, `a100-80gb` (most expensive).

### Auto-Scaling (App Only)

The app auto-scales: `auto_stop_machines = 'stop'` in fly.toml means:
- Machine stops after idle period (saves cost)
- Machine auto-starts on next request
- Ollama machine stays always-on (model stays loaded)

To change auto-scaling:

```bash
# Disable auto-stop (machine always running)
fly config set app auto_stop_machines=false -a uncensored

# Set min machines
fly config set app min_machines_running=1 -a uncensored
```

## Updating the Application

### Deploy New Code

Make changes locally, commit to git, then:

```bash
fly deploy -a uncensored
```

Creates new release and restarts app with new code.

### Update Ollama Model

To use a different model on Ollama machine:

```bash
# SSH in and pull new model
fly ssh console -a uncensored-ollama
ollama pull neural-chat
exit

# Update the secret
fly secrets set OLLAMA_MODEL=neural-chat -a uncensored

# Restart app so it picks up new env var
fly machines restart <machine-id> -a uncensored
```

## Troubleshooting

### App can't connect to Ollama

**Problem**: Health check returns `{"status": "unhealthy", "ollama": "disconnected"}`

**Solutions**:
1. Check Ollama machine is running: `fly status -a uncensored-ollama`
2. SSH into app and test DNS: `fly ssh console -a uncensored` then `nslookup uncensored-ollama.internal`
3. Check logs: `fly logs -a uncensored-ollama` for startup errors
4. Restart Ollama: `fly machines restart <id> -a uncensored-ollama`

### Out of Memory Errors

**Problem**: Ollama machine crashes with OOM

**Solutions**:
1. Scale up memory: `fly scale memory 8192 -a uncensored-ollama`
2. Use smaller model: `ollama pull neural-chat:7b` (smaller than llama2)
3. Reduce concurrent connections

### High Latency

**Problem**: Chat responses take 30+ seconds

**Solutions**:
1. Add GPU to Ollama machine (10x faster)
2. Use smaller model
3. Check if machine is under load: `fly status -a uncensored-ollama`

### App repeatedly restarts

**Problem**: Machine keeps restarting

**Solutions**:
1. Check logs: `fly logs -a uncensored`
2. SSH and check disk space: `fly ssh console -a uncensored` then `df -h`
3. Check memory usage: `free -h`
4. Redeploy: `fly deploy -a uncensored`

## Cost Optimization

**App Machine Cost** (~$2-5/month):
- 1GB RAM shared CPU (cheapest tier)
- Auto-stops when idle (saves ~80% cost)
- Only charged when running

**Ollama Machine Cost** (~$30-50/month):
- 4GB RAM shared CPU (can't auto-stop, models need to be warm)
- Use smaller models to reduce memory
- Only upgrade if you need more throughput

**Total Monthly**: ~$35-60 (much cheaper than AWS/GCP)

**Ways to Reduce Cost**:
1. Reduce Ollama memory to 2GB (supports fewer concurrent requests)
2. Auto-scale app to 0 when not in use
3. Move Ollama to smaller region (if available)
4. Use smallest working model (`neural-chat:7b`)

## Rollback

To revert to a previous deployment:

```bash
# List recent releases
fly releases -a uncensored

# Rollback to specific release
fly releases rollback <version> -a uncensored

# Or just rollback to previous
fly releases rollback -a uncensored
```

## Custom Domain

To use your own domain instead of `uncensored.fly.dev`:

```bash
# Add certificate
fly certs add yourdomain.com -a uncensored

# In your domain registrar, create CNAME:
# yourdomain.com CNAME uncensored.fly.dev
```

## Next Steps

- Monitor app at `fly dashboard` (https://fly.io/dashboard)
- Set up alerts in Fly.io dashboard
- Read [Development Guide](development.md) for local development
- Check [Architecture Guide](architecture.md) for system design details
