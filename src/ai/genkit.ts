import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Initialize Genkit and the Google AI plugin.
// The API key will be provided dynamically at request time.
export const ai = genkit({
  plugins: [googleAI()],
});
