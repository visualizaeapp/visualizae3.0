
import { ai } from './ai/genkit';
import dotenv from 'dotenv';

dotenv.config();

const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testModels() {
    console.log('Testing Gemini 2.5 Flash Image Preview...');
    try {
        const result = await ai.generate({
            model: 'googleai/gemini-2.5-flash-image-preview',
            prompt: [
                { text: 'A red box' },
                { media: { url: dummyImage } }
            ],
            config: {
                apiKey: process.env.GEMINI_API_KEY,
                responseModalities: ['IMAGE']
            }
        });
        console.log('Gemini 2.5 Success:', result.media?.url ? 'Image URL found' : 'No image URL');
    } catch (e) {
        console.error('Gemini 2.5 Failed:', e);
    }

    console.log('Testing Gemini 3.0 Pro Image Preview...');
    try {
        const result = await ai.generate({
            model: 'googleai/gemini-3-pro-image-preview',
            prompt: [
                { text: 'A red box' },
                { media: { url: dummyImage } }
            ],
            config: {
                apiKey: process.env.GEMINI_API_KEY,
                responseModalities: ['IMAGE']
            }
        });
        console.log('Gemini 3.0 Success:', result.media?.url ? 'Image URL found' : 'No image URL');
    } catch (e) {
        console.error('Gemini 3.0 Failed:', e);
    }
}

testModels();
