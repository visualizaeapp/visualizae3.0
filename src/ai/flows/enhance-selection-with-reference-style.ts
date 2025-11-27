'use server';
/**
 * @fileOverview Enhances a selected region of the canvas using reference images and a text prompt.
 *
 * - enhanceSelectionWithReferenceStyle - A function that enhances a selected area using reference images and a prompt.
 * - EnhanceSelectionInput - The input type for the enhanceSelectionWithReferenceStyle function.
 * - EnhanceSelectionOutput - The return type for the enhanceSelectionWithReferenceStyle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceSelectionInputSchema = z.object({
  prompt: z.string().describe('The prompt to use for enhancing the selected region.'),
  selectedImage: z
    .string()
    .describe("The selected image to enhance, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  referenceImages: z
    .array(z.string())
    .describe("The reference images to use for style transfer, as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type EnhanceSelectionInput = z.infer<typeof EnhanceSelectionInputSchema>;

const EnhanceSelectionOutputSchema = z.object({
  enhancedImage: z
    .string()
    .describe("The enhanced image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type EnhanceSelectionOutput = z.infer<typeof EnhanceSelectionOutputSchema>;

const enhanceSelectionPrompt = (input: EnhanceSelectionInput) => {
  const promptParts: any[] = [
    {text: `You are an AI image enhancer. You will take the target image and enhance it using the style of the reference images, guided by the prompt: ${input.prompt}. Return only the enhanced image in the specified output format.`},
    {text: '\nTarget Image:'},
    {media: {url: input.selectedImage}},
    {text: '\nReference Images:'},
  ];
  input.referenceImages.forEach(url => promptParts.push({media: {url}}));
  return promptParts;
};

export async function enhanceSelectionWithReferenceStyle(input: EnhanceSelectionInput): Promise<EnhanceSelectionOutput> {
  return enhanceSelectionFlow(input);
}

const enhanceSelectionFlow = ai.defineFlow(
  {
    name: 'enhanceSelectionWithReferenceStyleFlow',
    inputSchema: EnhanceSelectionInputSchema,
    outputSchema: EnhanceSelectionOutputSchema,
  },
  async (input) => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.5-flash-image-preview',
      prompt: enhanceSelectionPrompt(input as EnhanceSelectionInput),
      config: {
        responseModalities: ['IMAGE'],
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

    return {enhancedImage: media!.url!};
  }
);
