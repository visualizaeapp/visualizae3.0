
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    console.log('Listing Models...');
    try {
        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, response.statusText);
            console.error('Error Body:', errorText);
        } else {
            const data = await response.json();
            console.log('Models:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

listModels();
