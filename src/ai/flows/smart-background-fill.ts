'use server';

/**
 * @fileOverview Generates an AI image to fill the background of a canvas based on a text prompt. It exports the
 * `smartBackgroundFill` function, the `SmartBackgroundFillInput` type, and the `SmartBackgroundFillOutput` type.
 *
 * - SmartBackgroundFillInput - The input type for the smartBackgroundFill function.
 * - SmartBackgroundFillOutput - The return type for the smartBackgroundFill function.
 * - smartBackgroundFill - A function that takes a prompt and returns an AI-generated image for the background.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SmartBackgroundFillInputSchema = z.object({
  prompt: z.string().describe('The prompt to use for generating the background image.'),
  width: z.number().describe('The width of the background.'),
  height: z.number().describe('The height of the background.'),
});
export type SmartBackgroundFillInput = z.infer<typeof SmartBackgroundFillInputSchema>;

const SmartBackgroundFillOutputSchema = z.object({
  backgroundImage: z
    .string()
    .describe("The AI-generated background image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type SmartBackgroundFillOutput = z.infer<typeof SmartBackgroundFillOutputSchema>;

export const smartBackgroundFill = ai.defineFlow(
  {
    name: 'smartBackgroundFillFlow',
    inputSchema: SmartBackgroundFillInputSchema,
    outputSchema: SmartBackgroundFillOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-image-preview',
      prompt: `Generate a background image based on the following prompt: ${input.prompt}. The image should be ${input.width} pixels wide and ${input.height} pixels tall.`,
    });

    if (!media?.url) {
      throw new Error('AI image generation failed to return an image.');
    }

    return { backgroundImage: media.url };
  }
);

export type SmartBackgroundFillType = typeof smartBackgroundFill;
