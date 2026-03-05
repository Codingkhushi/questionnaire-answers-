const axios = require('axios');
require('dotenv').config();

async function embedText(text, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(
        'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
        { inputs: text },
        { headers: { 
            Authorization: `Bearer ${process.env.HF_TOKEN}`,
            'Content-Type': 'application/json'
          } 
        }
      );
       let data = response.data;
      // Flatten nested array if needed [[0.1, 0.2...]] -> [0.1, 0.2...]
      if (Array.isArray(data[0])) data = data[0];
      if (Array.isArray(response.data)) return response.data;
      throw new Error(response.data.error || 'Bad response');
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

module.exports = { embedText };