import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { askJDIHQuestion } from './services/jdihChat.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-gateway' });
});

/**
 * Universal Chat Endpoint
 * Body format:
 * {
 *   "app": "jdih",
 *   "message": "Apa sanksi jika karyawan terlambat masuk kerja?",
 *   "user_id": "EMP-001" (opsional)
 * }
 */
app.post('/v1/chat', async (req, res) => {
  try {
    const { app: clientApp, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Field "message" is required.' });
    }

    // Conditional Routing
    if (clientApp === 'jdih') {
      const result = await askJDIHQuestion(message);
      return res.json({
        success: true,
        app: 'jdih',
        data: result,
      });
    }

    if (clientApp === 'hc') {
      return res.status(501).json({
        success: false,
        message: 'Aplikasi HC sedang dalam pengembangan tahap berikutnya.',
      });
    }

    return res.status(400).json({
      error: `Unknown app "${clientApp}". Supported apps: "jdih", "hc".`,
    });
  } catch (error) {
    console.error('Error handling chat request:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AI Gateway Server running on http://localhost:${PORT}`);
});
