
import { generateVariationFromPrompt } from './ai/flows/generate-variation-from-prompt';
import dotenv from 'dotenv';

dotenv.config();

const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testGeneration() {
    console.log('Testing AI generation...');
    try {
        const result = await generateVariationFromPrompt({
            prompt: 'A red box',
            image: dummyImage,
            apiKey: process.env.GEMINI_API_KEY
        });
        console.log('Generation successful:', result);
    } catch (e) {
        console.error('Generation failed:', e);
    }
}

testGeneration();
