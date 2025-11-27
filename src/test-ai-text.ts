
import { ai } from './ai/genkit';
import dotenv from 'dotenv';

dotenv.config();

console.log('API Key loaded:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + '...' : 'undefined');

async function testTextGeneration() {
    console.log('Testing Text generation...');
    try {
        const result = await ai.generate({
            model: 'googleai/gemini-1.5-flash',
            prompt: 'Hello, world!',
            config: {
                apiKey: process.env.GEMINI_API_KEY
            }
        });
        console.log('Generation successful:', result.text);
    } catch (e) {
        console.error('Generation failed:', e);
    }
}

testTextGeneration();
