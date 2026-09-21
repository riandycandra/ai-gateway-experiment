# Enterprise AI Gateway, RAG & Evaluation Platform

A modular multi-tenant AI Gateway, RAG (Retrieval-Augmented Generation) engine, and Evaluation platform built with **Node.js (Express)**, **PostgreSQL with `pgvector`**, and **Mistral AI (Embeddings & Chat)**.

Includes a Supabase-inspired **Dark Theme Admin Dashboard & Playground** served directly via Vanilla ES Modules for live observability, human validation, and LLM-as-a-Judge auditing.

---

## 🏛 Architecture Overview

```
+-------------------------------------------------------------------------+
|                              End Clients                                |
|    +-----------------------------+     +---------------------------+    |
|    |    Aplikasi A (HC / HR)     |     |  Aplikasi B (Legal/JDIH)  |    |
|    +--------------+--------------+     +-------------+-------------+    |
+-------------------|----------------------------------|------------------+
                    |                                  |
                    +----------------+-----------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  AI Gateway (Node.js / Express API)                     |
|                                                                         |
|   POST /v1/chat  ---> [ 1. Guardrail Pre-Check (L1 Adversarial Defense) ]|
|                              |                                          |
|                       [ 2. Reasoning Engine & Intent Planner ]          |
|                              |                                          |
|         +--------------------+--------------------+                     |
|         | (app: 'jdih')                           | (app: 'hc')         |
|         v                                         v                     |
|   [ JDIH RAG Engine ]                       [ Tool Calling Engine ]     |
|   - Embed query (mistral-embed)             - Function: get_leaves()    |
|   - Cosine search (<=>) on pgvector         - Safe Read-Only Query      |
|   - Strict legal prompt synthesis           - Structured result to LLM  |
|                              |                                          |
|   +--------------------------+------------------------------+           |
|   | 3. Observability, Session Persistence & Audit Logging   |           |
|   |    - Saves to PostgreSQL table: chat_logs               |           |
+---|---------------------------------------------------------|-----------+
    |                                                         |
    v                                                         v
+-------------------------------------+   +-------------------------------+
|       4. Evaluation Layer           |   |    5. Web UI & Playground     |
| - Human Validation (thumbs/stars)   |   | - Supabase Dark Theme         |
| - LLM-as-a-Judge (Faithfulness 1-5) |   | - Live Runs & Audit Table     |
| - Table: audit_evaluations          |   | - Interactive Chat Playground |
+-------------------------------------+   +-------------------------------+
```

---

## 🚀 Key Features

- **Multi-Tenant Gateway:** Unified endpoint (`POST /v1/chat`) with intelligent routing for legal regulations (`jdih`), corporate HR (`hc`), and fast-path greetings (`0ms` latency).
- **L1 Guardrails & Adversarial Defense:** Blocks prompt injections, jailbreaks, and system prompt leaks before hitting the LLM.
- **Structure-Aware Document Chunking:** Preserves `BAB` and `Pasal` headings in legal PDFs to prevent context fragmentation.
- **HNSW Vector Indexing:** Fast cosine distance (`<=>`) queries on 1024-dimensional vectors stored in `pgvector`.
- **Full Observability & Logging:** Tracks latency, model parameters, user sessions, and retrieved citations in PostgreSQL.
- **LLM-as-a-Judge Evaluation:** Automatic grading of AI answers on **Faithfulness** (anti-hallucination) and **Relevance** with a 1-5 score.
- **Human-in-the-Loop Feedback:** Star ratings and auditor review notes integrated directly into the dashboard.
- **Interactive Web Dashboard & Playground:** Modular Vanilla ES Modules interface accessible at `http://localhost:3000`.

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v20+ or v24+
- **Docker & Docker Compose** (for PostgreSQL + `pgvector`)
- **Mistral AI API Key**: Get a free API key at [console.mistral.ai](https://console.mistral.ai)

---

## ⚙️ Quick Start

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd ai-gateway
npm install
```

### 2. Configure Environment Variables
Copy the example configuration:
```bash
cp .env.example .env
```
Edit `.env` with your settings:
```env
MISTRAL_API_KEY=your_mistral_api_key_here
PORT=3000
PG_HOST=localhost
PG_PORT=5432
PG_USER=ai_user
PG_PASSWORD=ai_password
PG_DATABASE=ai_gateway
```

### 3. Spin Up PostgreSQL + `pgvector` Container
```bash
docker compose up -d
```

### 4. Initialize Database Schema & Vector Extension
Creates `jdih_documents`, `jdih_chunks`, `chat_logs`, and `audit_evaluations` tables:
```bash
npm run init-db
```

### 5. Ingest Sample Legal Document
Ingests sample company regulations into `pgvector` with HNSW indexing:
```bash
npm run ingest-sample
```

### 6. Start the Server
```bash
npm start
```
The server and dashboard will run on **`http://localhost:3000`**.

---

## 🖥 Web Dashboard & Playground

Open your browser to:
👉 **`http://localhost:3000`**

1. Click **Sign in** on the login screen.
2. **Overview**: Real-time stats on total queries, average latency, success rates, and blocked injections.
3. **Runs & Audit**: Inspect every query transaction, inspect full retrieved citations, rate responses with 1-5 stars, or click **Evaluate** to trigger LLM-as-a-Judge.
4. **Jobs**: Overview of registered knowledge tenants (`jdih` RAG and `hc` Tool Calling).
5. **Playground**: Test questions interactively with live citation inspection in the right-hand panel.

---

## 📡 API Reference Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/v1/chat` | `POST` | Core chat gateway with reasoning, guardrails, and logging |
| `/v1/chat/logs` | `GET` | Fetches recent chat transactions joined with audit evaluations |
| `/v1/chat/history/:sessionId` | `GET` | Retrieves multi-turn chat history for a session |
| `/v1/analytics/stats` | `GET` | Aggregates gateway performance metrics (latency, success rate) |
| `/v1/audit/feedback` | `POST` | Submits human auditor ratings (`thumbs_up`, `thumbs_down`, stars) |
| `/v1/eval/judge` | `POST` | Triggers LLM-as-a-Judge faithfulness evaluation on a chat log |
| `/health` | `GET` | Health check endpoint |

### Example cURL Request:
```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "app": "jdih",
    "message": "Kalau mau nikah dapet jatah libur berapa hari?"
  }'
```

---

## 📂 Project Structure

```text
ai-gateway/
├── data/                       # Ingested document storage
├── public/                     # Modular Vanilla ES Modules Frontend
│   ├── css/
│   │   ├── tokens.css          # Supabase-style dark theme & design tokens
│   │   ├── layout.css          # Shell grid, topbar & expandable sidebar
│   │   └── components.css      # Tables, badges, modals, stars & buttons
│   ├── js/
│   │   ├── app.js              # Tab router & app controller
│   │   ├── api.js              # REST API client
│   │   ├── components/
│   │   │   └── modal.js        # Reusable modal & toast dialogs
│   │   └── pages/
│   │       ├── overview.js     # Analytics & throughput metrics
│   │       ├── runs.js         # Live audit table & rating buttons
│   │       ├── jobs.js         # Knowledge tenant definitions
│   │       └── playground.js   # Interactive chat tester & citation viewer
│   └── index.html              # Clean single-page application shell (<130 lines)
├── src/
│   ├── db.js                   # PostgreSQL connection pool
│   ├── server.js               # Express API gateway & static server
│   ├── scripts/
│   │   ├── initDb.js           # Database migration (pgvector, logs, audit tables)
│   │   └── ingestSample.js     # Demo document creation & ingestion runner
│   └── services/
│       ├── chatLogService.js   # Session persistence & human feedback handler
│       ├── evaluatorService.js # LLM-as-a-Judge faithfulness scoring
│       ├── jdihChat.js         # Vector search & RAG synthesis
│       ├── jdihIngestion.js    # Structure-aware chunking & embedding pipeline
│       ├── mistral.js          # Mistral API wrapper with rate-limit retry
│       └── reasoningEngine.js  # Intent classification & L1 security guardrails
├── docker-compose.yml          # PostgreSQL 16 + pgvector container
├── package.json
└── README.md
```

---

## 🗺 Production Scaling Roadmap

1. **Decoupled Document Ingestion**:
   - Offload heavy PDF/OCR parsing to an asynchronous background worker using **Unstructured.io** or AWS Textract.
2. **AWS Bedrock Integration**:
   - Replace Mistral embeddings/chat with **Amazon Bedrock Knowledge Bases** and **Claude 3.5 Sonnet** while keeping the exact same gateway API contracts.
3. **HC Tool Calling**:
   - Implement Mistral / Claude Function Calling against read-only PostgreSQL replicas for employee-specific records.
4. **Enhanced Semantic Routing**:
   - Upgrade L1 Regex Guardrails to an embedding-based Semantic Router or Small Language Model (SLM) for intent classification.
