import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
dotenv.config();

import cloudinary from './cloudinary.js';
import { getChatHistory, getVideoHistory, saveChatMessage, saveVideoHistory } from './models.js';

const app = express();
const port = process.env.PORT || 8080;

const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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
        model: 'gpt-4o',
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
    console.error('Image-to-text error:', err?.response?.data || err.message || err);
    res.status(500).json({ error: 'Failed to analyze image.', details: err?.response?.data || err.message || err });
  }
});

// 3. Image to image (Modelslab)
app.post('/image-to-video', upload.single('init_image'), async (req, res) => {
  // Log file info for debugging
  if (req.file) {
    console.log('Uploaded file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      size: req.file.size
    });
  }
  const { prompt, duration } = req.body;
  if (!req.file || !prompt) return res.status(400).json({ error: 'Image and prompt are required.' });
  try {
    // Upload image to Cloudinary
    const uploadResult = await cloudinary.v2.uploader.upload(req.file.path, {
      folder: 'smartbizai',
      resource_type: 'image',
    });
    if (req.file) fs.unlinkSync(req.file.path);
    const imageUrl = uploadResult.secure_url;
    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to upload image to Cloudinary.' });
    }
    // Call Modelslab image-to-video API
    const mlRes = await axios.post(
      'https://modelslab.com/api/v7/video-fusion/image-to-video',
      {
        key: 'Cp790n9sL087P3wLcxo6aJPVUifFPE7pPxVlnNO9K6QKlekEut7YMjBsCqv2',
        model_id: 'seedance-1-5-pro',
        prompt: prompt.trim(),
        aspect_ratio: '9:16',
        duration: duration || 5,
        init_image: [imageUrl],
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    // Log the full response for debugging
    console.log('Modelslab image-to-video response:', JSON.stringify(mlRes.data));
    const data = mlRes.data;
    res.json(data);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Modelslab image-to-video error:', err?.response?.data || err.message || err);
    res.status(500).json({ error: 'Failed to generate image-to-video.', details: err?.response?.data || err.message || err });
  }
});

app.post('/image-to-image', upload.single('init_image'), async (req, res) => {
  // Log file info for debugging
  if (req.file) {
    console.log('Uploaded file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      size: req.file.size
    });
  }
  const { prompt } = req.body;
  if (!req.file || !prompt) return res.status(400).json({ error: 'Image and prompt are required.' });
  try {
    // Upload image to Cloudinary
    const uploadResult = await cloudinary.v2.uploader.upload(req.file.path, {
      folder: 'smartbizai',
      resource_type: 'image',
    });
    if (req.file) fs.unlinkSync(req.file.path);
    const imageUrl = uploadResult.secure_url;
    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to upload image to Cloudinary.' });
    }
    // Send full set of fields from working example
    // Compute a valid size per Modelslab requirements (WIDTHxHEIGHT, max 1024)
    const srcW = typeof uploadResult.width === 'number' ? uploadResult.width : 1024;
    const srcH = typeof uploadResult.height === 'number' ? uploadResult.height : 1024;
    const square = Math.min(srcW, srcH, 1024);
    const apiSize = `${square}x${square}`;
    const mlRes = await axios.post(
      'https://modelslab.com/api/v7/images/image-to-image',
      {
        key: 'Cp790n9sL087P3wLcxo6aJPVUifFPE7pPxVlnNO9K6QKlekEut7YMjBsCqv2',
        model_id: 'seedream-4.0-i2i',
        prompt: `\nPlace the SAME product into a new scene.\nPreserve shape, label, and branding as closely as possible.\nProfessional product photography.\n${prompt}\n`.trim(),
        init_image: imageUrl,
        aspect_ratio: "1:1",
        size: apiSize,
        samples: '1',
        num_inference_steps: '30',
        guidance_scale: 6.5,
        strength: 0.5,
        enhance_prompt: 'yes',
        safety_checker: 'no',
        base64: 'no'
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    // Log the full response for debugging
    console.log('Modelslab response:', JSON.stringify(mlRes.data));
    const data = mlRes.data;
    let resultImageUrl = null;
    if (data) {
      if (Array.isArray(data.init_image) && data.init_image.length > 0) {
        resultImageUrl = data.init_image[0];
      } else if (typeof data.init_image === 'string') {
        resultImageUrl = data.init_image;
      } else if (data.image_url) {
        resultImageUrl = data.image_url;
      } else if (data.image) {
        resultImageUrl = data.image;
      } else if (Array.isArray(data.output) && data.output.length > 0) {
        resultImageUrl = data.output[0];
      }
    }
    if (resultImageUrl) {
      res.json({ imageUrl: resultImageUrl });
    } else {
      res.status(500).json({ error: 'No image returned from Modelslab.', modelslab: data });
    }
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Modelslab error:', err?.response?.data || err.message || err);
    res.status(500).json({ error: 'Failed to generate image-to-image.', details: err?.response?.data || err.message || err });
  }
});

// Save chat message
app.post('/chat-history', async (req, res) => {
  const { role, content, image_url } = req.body;
  try {
    const msg = await saveChatMessage({ user_id: 'default', role, content, image_url });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save chat message.' });
  }
});

// Get chat history
app.get('/chat-history', async (req, res) => {
  try {
    const history = await getChatHistory('default');
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
});

// Debug endpoint: get all chat messages (no user filter)
app.get('/debug-chat-messages', async (req, res) => {
  try {
    const { rows } = await import('./db.js').then(db => db.default.query('SELECT * FROM chat_messages ORDER BY created_at ASC'));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all chat messages.', details: err.message });
  }
});

// Save video history
app.post('/video-history', async (req, res) => {
  const { video_url, description } = req.body;
  try {
    const video = await saveVideoHistory({ user_id: 'default', video_url, description });
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save video history.' });
  }
});

// Get video history
app.get('/video-history', async (req, res) => {
  try {
    const history = await getVideoHistory('default');
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch video history.' });
  }
});

// POST /chat - expects { message: "..." }
app.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }
  try {
    // Always prepend system prompt
    const systemPrompt = { role: 'system', content: 'You are SmartBiz.AI, an expert business assistant. Always introduce yourself as SmartBiz.AI and never mention OpenAI or GPT-4.' };
    // Filter out images and system messages from user history
    const filteredMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }));
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-1106-preview',
        messages: [systemPrompt, ...filteredMessages]
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
