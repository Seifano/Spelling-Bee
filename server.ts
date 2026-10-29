import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TournamentRoomManager } from './src/server/roomManager.ts';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Extract words using Gemini 3.8 Flash
app.post('/api/ai/extract-words', async (req: Request, res: Response) => {
  try {
    const { text, images, grade } = req.body;

    if (!text && (!images || !images.length)) {
      return res.status(400).json({ error: 'Please provide text content or image(s) to extract words from.' });
    }

    const contents: any[] = [];

    if (images && Array.isArray(images)) {
      for (const img of images) {
        if (img.data && img.mimeType) {
          contents.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data,
            },
          });
        }
      }
    }

    const systemPrompt = `You are an expert spelling bee competition master and lexicographer.
Your job is to extract or compile every spelling word from the provided input (document text, table, or scanned worksheet/photo).
Target Grade: ${grade || 'any'}.

Rules:
1. Extract ALL valid spelling words. Skip page numbers, table headers, school names, student names, and administrative text.
2. Clean each word: remove leading numbers, bullets, punctuations. Keep spelling standard (lowercase unless proper noun).
3. For each word, provide:
   - "word": clean spelling word
   - "level": "Easy", "Medium", or "Hard" based on grade appropriateness and orthographic complexity
   - "def": clear, age-appropriate student dictionary definition (under 18 words)
   - "sentence": natural example sentence illustrating meaning without giving away the spelling (under 18 words)
   - "partOfSpeech": noun, verb, adjective, adverb, etc.
   - "origin": etymology / language of origin (e.g. Latin, French, Greek, Old English, Arabic, Spanish, etc.)
   - "phonetic": simple phonetic pronunciation guide (e.g. "KAHM-pleks" or IPA)
4. Do not include duplicate words.`;

    const userPromptText = text
      ? `Extract and format the spelling words from the following text:\n\n${text.slice(0, 50000)}`
      : 'Extract all spelling words visible in the attached image(s).';

    contents.push({ text: userPromptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              level: { type: Type.STRING },
              def: { type: Type.STRING },
              sentence: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              origin: { type: Type.STRING },
              phonetic: { type: Type.STRING },
            },
            required: ['word', 'level', 'def', 'sentence'],
          },
        },
      },
    });

    const jsonStr = (response.text ?? '[]').trim();
    let words = [];
    try {
      words = JSON.parse(jsonStr);
    } catch {
      words = [];
    }

    res.json({ success: true, count: words.length, words });
  } catch (error: any) {
    console.error('Error in /api/ai/extract-words:', error);
    res.status(500).json({
      error: error?.message || 'Failed to extract words using Gemini API.',
    });
  }
});

// Enrich a single word with definitions, sentences, and etymology
app.post('/api/ai/enrich-word', async (req: Request, res: Response) => {
  try {
    const { word, grade } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Missing word parameter.' });
    }

    const cleanWord = word.trim().toLowerCase();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Provide complete spelling bee information for the word "${cleanWord}" for Grade ${grade || 'any'}.`,
      config: {
        systemInstruction: 'You are an official spelling bee adjudicator. Return accurate dictionary information for student competition.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            level: { type: Type.STRING },
            def: { type: Type.STRING },
            sentence: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            origin: { type: Type.STRING },
            phonetic: { type: Type.STRING },
          },
          required: ['word', 'level', 'def', 'sentence', 'partOfSpeech', 'origin'],
        },
      },
    });

    const jsonStr = (response.text ?? '{}').trim();
    const data = JSON.parse(jsonStr);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/ai/enrich-word:', error);
    res.status(500).json({
      error: error?.message || 'Failed to enrich word.',
    });
  }
});

// Initialize Tournament Room Manager
const roomManager = new TournamentRoomManager();

// Create HTTP Server
const server = http.createServer(app);

// Attach WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw: string) => {
    try {
      const msg = JSON.parse(raw.toString());
      switch (msg.type) {
        case 'host:create_room':
          roomManager.createRoom(ws, msg.options || {});
          break;
        case 'student:join_room':
          roomManager.joinRoom(ws, msg.roomId, {
            name: msg.name,
            classSec: msg.classSec,
            cameraActive: msg.cameraActive,
          });
          break;
        case 'student:accept_rules':
          roomManager.handleRulesAccepted(ws);
          break;
        case 'student:camera_status':
          roomManager.handleCameraStatus(ws, !!msg.cameraActive, msg.faceCentered !== false);
          break;
        case 'student:tab_switch':
          roomManager.handleTabSwitch(ws);
          break;
        case 'host:start_game':
          roomManager.handleStartTournament(ws);
          break;
        case 'student:submit_answer':
          roomManager.handleStudentAnswer(ws, {
            spelled: msg.spelled,
            method: msg.method,
            timeSpent: msg.timeSpent,
          });
          break;
        case 'host:next_word':
          roomManager.handleNextWord(ws);
          break;
        case 'host:dismiss_warning':
          roomManager.handleDismissWarning(ws, msg.studentId);
          break;
        case 'host:disqualify_student':
          roomManager.handleDisqualify(ws, {
            studentId: msg.studentId,
            reason: msg.reason,
          });
          break;
        case 'host:end_game':
          roomManager.handleEndGame(ws);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    roomManager.handleDisconnect(ws);
  });
});

// Vite middleware or static serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`SpellBee Arena running at http://0.0.0.0:${port}`);
});
