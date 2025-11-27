'use server';
/**
 * @fileOverview Creates a variation of an existing image based on a text prompt.
 * It exports the `generateVariationFromPrompt` function, the `GenerateVariationInput` type, and the `GenerateVariationOutput` type.
 *
 * - GenerateVariationInput - The input type for the generateVariationFromPrompt function.
 * - GenerateVariationOutput - The return type for the generateVariationFromPrompt function.
 * - generateVariationFromPrompt - A function that takes an image and a prompt, and returns a variation of the image.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateVariationInputSchema = z.object({
  prompt: z.string().describe('The prompt to use for generating the image variation.'),
  image: z
    .string()
    .describe("The image to use as a base, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  referenceImages: z.array(z.string()).optional().describe("Optional reference images for style."),
  model: z.string().optional().describe("The specific model to use for generation."),
  apiKey: z.string().optional().describe("The API key to use for the generation.")
});
export type GenerateVariationInput = z.infer<typeof GenerateVariationInputSchema>;

const GenerateVariationOutputSchema = z.object({
  image: z
    .string()
    .describe("The enhanced image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type GenerateVariationOutput = z.infer<typeof GenerateVariationOutputSchema>;

export const generateVariationFromPrompt = ai.defineFlow(
  {
    name: 'generateVariationFlow',
    inputSchema: GenerateVariationInputSchema,
    outputSchema: GenerateVariationOutputSchema,
  },
  async input => {
    const promptParts: any[] = [];

    promptParts.push({ text: input.prompt });
    promptParts.push({ media: { url: input.image } });

    if (input.referenceImages && input.referenceImages.length > 0) {
      promptParts.push({ text: 'Use as seguintes imagens como referência de estilo e conteúdo:' });
      input.referenceImages.forEach(ref => promptParts.push({ media: { url: ref } }));
    }

    const isImageOnlyModel = input.model === 'googleai/gemini-2.5-flash-image-preview';

    const { media, text } = await ai.generate({
      model: input.model || 'googleai/gemini-2.5-flash-image-preview',
      prompt: promptParts,
      config: {
        apiKey: input.apiKey,
        responseModalities: isImageOnlyModel ? ['IMAGE'] : ['IMAGE', 'TEXT'],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
        ],
      },
    });

    // Prefer the generated media, but fallback to text if media is not available.
    const generatedImage = media?.url;
    if (!generatedImage) {
      // This logic can be improved. For now, we assume text might contain a URL or data URI.
      const textIsDataUri = text?.trim().startsWith('data:image');
      if (textIsDataUri) {
        return { image: text! };
      }
      throw new Error("A geração de IA não retornou uma imagem válida.");
    }

    return { image: generatedImage };
  }
);
