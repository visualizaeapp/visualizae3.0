
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
        } else {
            const data = await response.json();
            if (data.models) {
                data.models.forEach((m: any) => console.log(m.name));
            } else {
                console.log('No models found in response');
            }
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

listModels();
