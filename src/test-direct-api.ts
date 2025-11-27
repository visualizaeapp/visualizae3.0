
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

async function testDirectApi() {
    console.log('Testing Direct API...');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: 'Hello' }]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, response.statusText);
            console.error('Error Body:', errorText);
        } else {
            const data = await response.json();
            console.log('API Success:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

testDirectApi();
