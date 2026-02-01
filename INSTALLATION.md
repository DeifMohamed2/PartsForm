# PartsForm Installation Guide




# RUN THIS 
cd ~/elasticsearch-8.16.0 && ES_JAVA_OPTS="-Xms512m -Xmx512m" ./bin/elasticsearch -d -E xpack.security.enabled=false -E discovery.type=single-node



Complete installation guide for setting up PartsForm with FTP integrations and Elasticsearch search on a new device.

## Prerequisites

- **Node.js** v18+ (recommended v20+)
- **MongoDB** v6+ running locally or remote
- **macOS / Linux / Windows**

---

## 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url> partsform
cd partsform

# Install Node.js dependencies
npm install
```

---

## 2. MongoDB Setup

### macOS (Homebrew)
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### Verify MongoDB
```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

---

## 3. Elasticsearch Setup (Optional but Recommended)

Elasticsearch enables ultra-fast search for millions of parts. Without it, the system falls back to MongoDB for search.

### Option A: Direct Download (Recommended for macOS ARM)

```bash
# Download Elasticsearch 8.16 for your platform
cd ~

# macOS ARM (M1/M2/M3)
curl -L -O https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.16.0-darwin-aarch64.tar.gz
tar -xzf elasticsearch-8.16.0-darwin-aarch64.tar.gz

# macOS Intel
curl -L -O https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.16.0-darwin-x86_64.tar.gz
tar -xzf elasticsearch-8.16.0-darwin-x86_64.tar.gz

# Linux x86_64
curl -L -O https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.16.0-linux-x86_64.tar.gz
tar -xzf elasticsearch-8.16.0-linux-x86_64.tar.gz
```

### Start Elasticsearch

```bash
cd ~/elasticsearch-8.16.0

# Start in daemon mode (background)
ES_JAVA_OPTS="-Xms512m -Xmx512m" ./bin/elasticsearch -d \
  -p /tmp/elasticsearch.pid \
  -E xpack.security.enabled=false \
  -E discovery.type=single-node

# Wait for startup (takes ~15-20 seconds)
sleep 20
```

### Verify Elasticsearch
```bash
curl http://localhost:9200
```

You should see:
```json
{
  "name" : "your-hostname",
  "cluster_name" : "elasticsearch",
  "version" : {
    "number" : "8.16.0"
  },
  "tagline" : "You Know, for Search"
}
```

### Stop Elasticsearch
```bash
kill $(cat /tmp/elasticsearch.pid)
```

### Option B: Docker (Alternative)

```bash
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.16.0
```

---

## 4. Environment Configuration

Create a `.env` file in the project root (optional - defaults work for local development):

```bash
# .env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/partsform
ELASTICSEARCH_NODE=http://localhost:9200
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

---

## 5. Create Admin User

```bash
npm run create-admin
```

Follow the prompts to create your admin account.

---

## 6. Start the Application

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## 7. Access the Application

- **Main Site**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **Buyer Portal**: http://localhost:3000/buyer

---

## 8. Setting Up Integrations

1. Go to **Admin Panel** → **Integrations**
2. Click **Add Connection**
3. Choose connection type:
   - **FTP/SFTP**: Connect to FTP servers with CSV files
   - **REST API**: Connect to external APIs
   - **Google Sheets**: Sync from spreadsheets
4. Configure connection details
5. Click **Test Connection** to verify
6. Click **Create Connection**
7. Use **Sync Now** to import data

---

## Quick Start Commands

```bash
# Terminal 1: Start Elasticsearch
cd ~/elasticsearch-8.16.0 && ES_JAVA_OPTS="-Xms512m -Xmx512m" ./bin/elasticsearch -d -E xpack.security.enabled=false -E discovery.type=single-node

# Terminal 2: Start MongoDB (if not running as service)
mongod --dbpath /path/to/data/db

# Terminal 3: Start PartsForm
cd /path/to/partsform && npm run dev
```

---

## Startup Script (Optional)

Create a startup script `start-all.sh`:

```bash
#!/bin/bash

echo "🚀 Starting PartsForm Services..."

# Start Elasticsearch
echo "Starting Elasticsearch..."
cd ~/elasticsearch-8.16.0
ES_JAVA_OPTS="-Xms512m -Xmx512m" ./bin/elasticsearch -d \
  -p /tmp/elasticsearch.pid \
  -E xpack.security.enabled=false \
  -E discovery.type=single-node

# Wait for Elasticsearch
echo "Waiting for Elasticsearch to start..."
sleep 15

# Verify Elasticsearch
if curl -s http://localhost:9200 > /dev/null; then
  echo "✅ Elasticsearch is running"
else
  echo "⚠️ Elasticsearch failed to start (app will use MongoDB fallback)"
fi

# Start PartsForm
echo "Starting PartsForm..."
cd /path/to/partsform
npm run dev
```

Make it executable:
```bash
chmod +x start-all.sh
```

---

## Troubleshooting

### MongoDB Connection Failed
```bash
# Check if MongoDB is running
brew services list | grep mongodb  # macOS
sudo systemctl status mongodb      # Linux

# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongodb           # Linux
```

### Elasticsearch Connection Failed
```bash
# Check if Elasticsearch is running
curl http://localhost:9200

# Check logs
cat ~/elasticsearch-8.16.0/logs/elasticsearch.log | tail -50

# Restart Elasticsearch
kill $(cat /tmp/elasticsearch.pid) 2>/dev/null
cd ~/elasticsearch-8.16.0 && ES_JAVA_OPTS="-Xms512m -Xmx512m" ./bin/elasticsearch -d -E xpack.security.enabled=false -E discovery.type=single-node
```

### Port 3000 Already in Use
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Elasticsearch Memory Issues
Increase heap size for larger datasets:
```bash
ES_JAVA_OPTS="-Xms1g -Xmx1g" ./bin/elasticsearch -d ...
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      PartsForm System                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Admin     │    │   Buyer     │    │   Landing   │      │
│  │   Panel     │    │   Portal    │    │   Pages     │      │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘      │
│         │                  │                                 │
│         ▼                  ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                Express.js Server                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ Integration │  │   Search    │  │   Sync      │  │    │
│  │  │ Controller  │  │ Controller  │  │  Service    │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  MongoDB    │    │Elasticsearch│    │ FTP/API     │      │
│  │ (Primary)   │    │  (Search)   │    │ (External)  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `app.js` | Main Express application |
| `models/Integration.js` | FTP/API integration schema |
| `models/Part.js` | Parts database schema |
| `services/elasticsearchService.js` | Elasticsearch operations |
| `services/ftpService.js` | FTP connection handling |
| `services/csvParserService.js` | CSV parsing & import |
| `services/syncService.js` | Integration sync orchestration |
| `services/schedulerService.js` | Cron job scheduling |
| `controllers/searchController.js` | Search API endpoints |

---

## Support

For issues or questions, check the project repository or documentation.
