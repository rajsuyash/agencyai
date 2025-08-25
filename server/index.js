const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const cors = require('cors'); // Import cors

console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

const app = express();
const port = 3001; // Or any other port you prefer

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// Replace with your Google Cloud Project ID
const PROJECT_ID = 'gemini-429018'; // This was found in the original App.jsx
const LOCATION = 'us-central1';
const PUBLISHER = 'google';
const MODEL = 'imagen-3.0-generate-002'; // This was found in the original App.jsx

app.post('/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Authenticate with Google Cloud
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/${PUBLISHER}/models/${MODEL}:predict`;

    const payload = {
      instances: [{ prompt: prompt }],
      parameters: { "sampleCount": 1 }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Error in /generate-image:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
