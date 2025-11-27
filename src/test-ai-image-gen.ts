
import { ai } from './ai/genkit';
import dotenv from 'dotenv';

dotenv.config();

const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testImageGen() {
    console.log('Testing Image Generation with gemini-2.5-flash-image-preview...');
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
        console.log('Generation successful:', result.media?.url ? 'Image URL found' : 'No image URL');
    } catch (e) {
        console.error('Generation failed:', e);
    }
}

testImageGen();
