import multer from 'multer';
import FormData from 'form-data';
import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// 1. Generate image with Pollinations
app.post('/generate-image', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });
  try {
    // Pollinations API: https://image.pollinations.ai/prompt/{prompt}
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate image.' });
  }
});

// 2. Image to text (OpenAI Vision)
app.post('/image-to-text', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image is required.' });
  try {
    const imageData = fs.readFileSync(req.file.path, { encoding: 'base64' });
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } }
            ]
          }
        ],
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    fs.unlinkSync(req.file.path);
    const reply = openaiRes.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to analyze image.' });
  }
});

// 3. Image to image (Modelslab)
app.post('/image-to-image', upload.single('image'), async (req, res) => {
  const { prompt } = req.body;
  if (!req.file || !prompt) return res.status(400).json({ error: 'Image and prompt are required.' });
  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('image', fs.createReadStream(req.file.path));
    // You may need to add your Modelslab API key as a header if required
    const mlRes = await axios.post(
      'https://modelslab.com/api/v7/images/image-to-image',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.MODELSLAB_API_KEY}`
        }
      }
    );
    fs.unlinkSync(req.file.path);
    res.json(mlRes.data);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to generate image-to-image.' });
  }
});

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// POST /chat - expects { message: "..." }
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  try {
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const reply = openaiRes.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get response from OpenAI.' });
  }
});

app.get('/', (req, res) => {
  res.send('SmartBiz.AI backend is running!');
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
