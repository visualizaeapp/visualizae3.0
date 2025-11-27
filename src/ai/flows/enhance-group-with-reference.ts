'use server';
/**
 * @fileOverview Enhances a group of images using another group as a style reference. It exports the
 * `enhanceGroupWithReference` function, the `EnhanceGroupInput` type, and the `EnhanceGroupOutput` type.
 *
 * - EnhanceGroupInput - The input type for the enhanceGroupWithReference function.
 * - EnhanceGroupOutput - The return type for the enhanceGroupWithReference function.
 * - enhanceGroupWithReference - A function that takes a prompt, target images, and reference images, and returns enhanced images.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceGroupInputSchema = z.object({
  prompt: z.string().describe('The prompt to use for enhancing the images.'),
  targetImages: z
    .array(z.string())
    .describe("The images to enhance, as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  referenceImages: z
    .array(z.string())
    .describe("The reference images to use for style transfer, as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type EnhanceGroupInput = z.infer<typeof EnhanceGroupInputSchema>;

const EnhanceGroupOutputSchema = z.object({
  enhancedImages: z
    .array(z.string())
    .describe("The enhanced images, as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type EnhanceGroupOutput = z.infer<typeof EnhanceGroupOutputSchema>;

const enhanceGroupPrompt = (input: EnhanceGroupInput) => {
  const promptParts: any[] = [
    {text: `You are an AI image enhancer. You will take a series of target images and enhance them using the style of a series of reference images, and the prompt ${input.prompt}. Return only the enhanced images in the specified output format.`},
    {text: '\nTarget Images:'},
  ];
  input.targetImages.forEach(url => promptParts.push({media: {url}}));
  promptParts.push({text: '\nReference Images:'});
  input.referenceImages.forEach(url => promptParts.push({media: {url}}));
  return promptParts;
};

export async function enhanceGroupWithReference(input: EnhanceGroupInput): Promise<EnhanceGroupOutput> {
  const {output} = await ai.generate({
    model: 'googleai/gemini-2.5-flash-image-preview',
    prompt: enhanceGroupPrompt(input as EnhanceGroupInput),
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

  return output!;
}
