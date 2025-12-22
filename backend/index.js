import multer from 'multer';
import FormData from 'form-data';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

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
app.post('/image-to-image', (req, res, next) => {
  // Accept both 'image' and 'init_image' fields for compatibility
  const multiUpload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  }).single('init_image');
  multiUpload(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
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
    // For testing: send the image as a URL instead of a file
    // You must host the image somewhere public. For now, we'll simulate this by returning an error if not possible.
    // In production, you would upload the file to a storage service (S3, Cloudinary, etc.) and get a public URL.
    // We'll use a placeholder for demonstration.
    const placeholderImageUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb';
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('init_image', placeholderImageUrl); // Send as URL
    form.append('model_id', 'seedream-4.5-i2i');
    form.append('aspect-ratio', '1:1');
    form.append('key', process.env.MODELSLAB_API_KEY);
    const mlRes = await axios.post(
      'https://modelslab.com/api/v7/images/image-to-image',
      form,
      {
        headers: {
          ...form.getHeaders()
        }
      }
    );
    if (req.file) fs.unlinkSync(req.file.path);
    // Log the full response for debugging
    console.log('Modelslab response:', JSON.stringify(mlRes.data));
    const data = mlRes.data;
    let imageUrl = null;
    if (data && Array.isArray(data.init_image) && data.init_image.length > 0) {
      imageUrl = data.init_image[0];
    }
    if (imageUrl) {
      res.json({ imageUrl });
    } else {
      res.status(500).json({ error: 'No image returned from Modelslab.', modelslab: data });
    }
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to generate image-to-image.' });
  }
});

// (duplicate block removed)

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
