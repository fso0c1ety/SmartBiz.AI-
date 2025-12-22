require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

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
