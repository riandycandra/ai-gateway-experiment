# Enterprise AI Gateway & RAG Engine

A modular AI Gateway and RAG (Retrieval-Augmented Generation) engine designed to integrate multi-tenant internal applications (e.g., Legal/JDIH documents and HR/HC systems) with LLMs.

This project simulates a cost-effective, production-ready enterprise AI architecture using **Node.js (Express)**, **PostgreSQL with `pgvector`**, and **Mistral AI (Embeddings & Chat)**.

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
|   POST /v1/chat  ---> [ Conditional Router & Auth ]                     |
|                              |                                          |
|         +--------------------+--------------------+                     |
|         | (app: 'jdih')                           | (app: 'hc')         |
|         v                                         v                     |
|   [ JDIH RAG Engine ]                       [ Tool Calling Engine ]     |
|   - Embed query (mistral-embed)             - Function: get_leaves()    |
|   - Cosine search (<=>) on pgvector         - Safe Read-Only Query      |
|   - Strict legal prompt synthesis           - Structured result to LLM  |
+---------|---------------------------------------------------------------+
          |
          v
+-------------------------------------------------------------------------+
|                             Data Layer                                  |
|   +------------------------------------+   +------------------------+   |
|   | PostgreSQL 16 + pgvector (Docker)  |   | Mistral AI API (Cloud) |   |
|   | - Table: jdih_documents            |   | - mistral-embed        |   |
|   | - Table: jdih_chunks (HNSW index)  |   | - open-mistral-7b      |   |
|   +------------------------------------+   +------------------------+   |
+-------------------------------------------------------------------------+
```

---

## 🚀 Key Features

- **Multi-Tenant Routing:** Single entrypoint (`POST /v1/chat`) routing requests based on application context (`jdih` for RAG, `hc` for function calling).
- **Structure-Aware Document Chunking:** Legal regulations are parsed by `BAB` and `Pasal` headings to preserve semantic continuity rather than naive character splitting.
- **HNSW Vector Indexing:** Fast approximate nearest neighbor search powered by `pgvector` and cosine distance (`<=>`).
- **Citation & Factuality Enforcement:** Answers explicitly reference document titles, article numbers, and similarity scores to eliminate hallucination.
- **Rate-Limit Resilience:** Built-in retry mechanism with exponential backoff for external LLM API calls.

---

## 🛠 Prerequisites

Ensure you have the following installed on your system:
- **Node.js**: v20+ or v24+
- **Docker & Docker Compose** (for PostgreSQL with `pgvector`)
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
Edit `.env` and provide your Mistral API key:
```env
MISTRAL_API_KEY=your_mistral_api_key_here
PORT=3000
PG_HOST=localhost
PG_PORT=5432
PG_USER=ai_user
PG_PASSWORD=ai_password
PG_DATABASE=ai_gateway
```

### 3. Spin Up PostgreSQL + `pgvector`
Start the vector database container in background:
```bash
docker compose up -d
```

### 4. Initialize Database Schema & Vector Extension
Run the database migration script:
```bash
npm run init-db
```

### 5. Ingest Sample Legal Document
Ingest sample company regulations into `pgvector`:
```bash
npm run ingest-sample
```

### 6. Start the API Server
```bash
npm start
```
The server will run on `http://localhost:3000`.

---

## 📡 API Usage

### Endpoint: `POST /v1/chat`

#### Request:
```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "app": "jdih",
    "message": "Apa sanksinya kalau karyawan terlambat datang kerja ke kantor?"
  }'
```

#### Response Example:
```json
{
  "success": true,
  "app": "jdih",
  "data": {
    "answer": "Berdasarkan Pasal 2 ayat 2 Peraturan Disiplin dan Cuti Karyawan 2024 (No. 04/PP/HR-LEGAL/2024), sanksi yang dikenakan terhadap karyawan yang melakukan keterlambatan melebihi 15 menit tanpa persetujuan tertulis dari atasan langsung sebanyak 3 kali dalam 1 bulan adalah Surat Peringatan Pertama (SP 1).",
    "citations": [
      {
        "documentTitle": "Peraturan Disiplin dan Cuti Karyawan 2024",
        "documentNumber": "04/PP/HR-LEGAL/2024",
        "heading": "Pasal 2: Keterlambatan dan Presensi",
        "similarityScore": "0.8282",
        "snippet": "Pasal 2: Keterlambatan dan Presensi\n1. Karyawan wajib melakukan pencatatan kehadiran..."
      }
    ]
  }
}
```

---

## 📂 Project Structure

```text
ai-gateway/
├── data/                       # Document storage directory
├── src/
│   ├── scripts/
│   │   ├── initDb.js           # Database & pgvector HNSW index migration
│   │   └── ingestSample.js     # Demo document creation & ingestion runner
│   ├── services/
│   │   ├── jdihChat.js         # RAG query search & LLM synthesis service
│   │   ├── jdihIngestion.js    # Structure-aware chunking & embedding pipeline
│   │   └── mistral.js          # Mistral API client wrapper with retry handling
│   ├── db.js                   # PostgreSQL connection pool
│   └── server.js               # Express application entrypoint
├── docker-compose.yml          # pgvector service configuration
├── package.json
└── README.md
```

---

## 🗺 Production Roadmap & Scaling Considerations

1. **Decoupled Document Ingestion Worker**:
   - For high-volume processing, offload PDF parsing and OCR to an asynchronous background worker using [Unstructured.io](https://unstructured.io/) or AWS Textract/Lambda.
2. **Enterprise Cloud Migration (AWS Bedrock)**:
   - Replace Mistral embeddings/chat with Amazon Bedrock Knowledge Bases and Claude 3.5 Sonnet without altering the gateway client contract.
3. **Multi-Agent & Tool Calling (HC Use Case)**:
   - Implement Mistral / Claude Tool Calling to securely query read-only PostgreSQL replicas for employee-specific records (e.g., remaining leave balances).
4. **Guardrails & Evaluation**:
   - Integrate PII redaction and prompt injection guards (e.g., Bedrock Guardrails / NeMo Guardrails).
