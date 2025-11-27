

'use server';

import { ai } from '@/ai/genkit';
import { runDevChat } from '@/ai/flows/dev-chat-flow';
import type { Message as DevChatMessage } from '@/components/dev/dev-chat-dialog';
import { generateVariationFromPrompt } from '@/ai/flows/generate-variation-from-prompt';
import { smartBackgroundFill } from '@/ai/flows/smart-background-fill';

async function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  try {
    const base64Data = dataUrl.substring(dataUrl.indexOf(',') + 1);
    const buffer = Buffer.from(base64Data, 'base64');

    // Check for PNG
    if (buffer.length > 24 && buffer.toString('hex', 0, 8) === '89504e470d0a1a0a') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    // Check for JPEG
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let i = 2;
      while (i < buffer.length) {
        if (i + 2 > buffer.length) break;
        const marker = buffer.readUInt16BE(i);

        // SOF0 (Baseline), SOF1 (Extended Sequential), SOF2 (Progressive)
        if (marker >= 0xffc0 && marker <= 0xffc2) {
          return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
        }

        i += 2;
        if (i + 2 > buffer.length) break;
        const length = buffer.readUInt16BE(i);
        i += length;
      }
    }

    // Check for WebP
    if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const chunkHeader = buffer.toString('ascii', 12, 16);
      // VP8X (Extended)
      if (chunkHeader === 'VP8X') {
        const width = buffer.readUIntLE(24, 3) + 1;
        const height = buffer.readUIntLE(27, 3) + 1;
        return { width, height };
      }
      // VP8 (Lossy)
      if (chunkHeader === 'VP8 ') {
        // 0x9d 0x01 0x2a (frame signature)
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      // VP8L (Lossless)
      if (chunkHeader === 'VP8L') {
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];

        const width = 1 + (((b1 & 0x3F) << 8) | b0);
        const height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
        return { width, height };
      }
    }

  } catch (e) {
    console.error("Could not determine image size on the server.", e);
  }
  // Return a default or throw an error if size can't be determined
  return { width: 0, height: 0 };
}

export async function smartBackgroundFillAction(
  input: { prompt: string; width: number; height: number; }
): Promise<{ image?: string; width?: number; height?: number, error?: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A chave de API do Gemini não está configurada no servidor. Adicione-a ao arquivo .env.');
    }

    const result = await smartBackgroundFill({
      prompt: input.prompt,
      width: input.width,
      height: input.height,
    });

    if (!result.backgroundImage) {
      throw new Error('A geração de IA não retornou uma imagem.');
    }

    const { width, height } = await getImageSize(result.backgroundImage);

    return {
      image: result.backgroundImage,
      width,
      height,
    };
  } catch (e: any) {
    console.error('Falha na ação de preenchimento inteligente:', e);

    let errorMessage = 'Ocorreu um erro durante a geração da imagem.';
    if (e.message?.includes('API key not valid')) {
      errorMessage = 'A chave de API fornecida não é válida. Por favor, verifique e tente novamente.';
    } else if (e.message?.includes('429')) {
      errorMessage = 'Limite de taxa de API excedido. Por favor, aguarde um pouco e tente novamente.';
    } else if (e.message) {
      errorMessage = e.message;
    }

    return { error: errorMessage };
  }
}


export async function generateVariationAction(
  input: {
    prompt: string;
    imageToEdit: string;
    referenceImages?: string[];
    isProMode?: boolean;
  }
): Promise<{ image?: string; width?: number; height?: number, error?: string }> {

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A chave de API do Gemini não está configurada no servidor. Adicione-a ao arquivo .env.');
    }

    const model = input.isProMode
      ? 'googleai/gemini-3-pro-image-preview' // Modo Pro
      : 'googleai/gemini-2.5-flash-image-preview'; // Modo Nano

    const result = await generateVariationFromPrompt({
      prompt: input.prompt,
      image: input.imageToEdit,
      referenceImages: input.referenceImages,
      model,
    });

    if (!result.image) {
      throw new Error('A geração de IA não retornou uma imagem.');
    }

    const { width, height } = await getImageSize(result.image);

    return {
      image: result.image,
      width,
      height,
    };

  } catch (e: any) {
    console.error('Falha na ação de geração de imagem:', e);

    let errorMessage = 'Ocorreu um erro durante a geração da imagem.';
    if (e.message?.includes('API key not valid')) {
      errorMessage = 'A chave de API fornecida não é válida. Por favor, verifique e tente novamente.';
    } else if (e.message?.includes('429')) {
      errorMessage = 'Limite de taxa de API excedido. Por favor, aguarde um pouco e tente novamente.';
    } else if (e.message) {
      errorMessage = e.message;
    }

    return { error: errorMessage };
  }
}

export async function describeImageAction(
  input: { imageToDescribe: string }
): Promise<{ description?: string, error?: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A chave de API do Gemini não está configurada no servidor. Adicione-a ao arquivo .env.');
    }

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: [
        { text: 'Descreva esta imagem de forma concisa para ser usada em um prompt de IA. Concentre-se nos elementos principais. Responda apenas com a descrição.' },
        { media: { url: input.imageToDescribe } }
      ],
      config: {
        apiKey: apiKey,
      },
    });

    return { description: result.text };

  } catch (e: any) {
    console.error('Falha na ação de descrição de imagem:', e);
    let errorMessage = 'Ocorreu um erro ao descrever a imagem.';
    if (e.message?.includes('404')) {
      errorMessage = 'O modelo de IA para descrição não foi encontrado (404). O nome pode estar incorreto ou o modelo indisponível.';
    } else if (e.message) {
      errorMessage = e.message;
    }
    return { error: errorMessage };
  }
}


export async function enhanceGroupWithReferenceAction(
  input: {
    prompt: string;
    targetImages: string[];
    referenceImages: string[];
  }
): Promise<{ enhancedImages?: string[], error?: string }> {

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A chave de API do Gemini não está configurada no servidor. Adicione-a ao arquivo .env.');
    }

    const promptParts: any[] = [
      { text: `You are an AI image enhancer. You will take a series of target images and enhance them using the style of a series of reference images, and the prompt ${input.prompt}. Return only the enhanced images in the specified output format.` },
      { text: '\nTarget Images:' },
    ];
    input.targetImages.forEach(url => promptParts.push({ media: { url } }));
    promptParts.push({ text: '\nReference Images:' });
    input.referenceImages.forEach(url => promptParts.push({ media: { url } }));

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash-image-preview',
      prompt: promptParts,
      config: {
        apiKey: apiKey,
        responseModalities: ['IMAGE'],
      },
    });

    const enhancedImages = result.output?.message?.content
      .filter((part: any) => part.media)
      .map((part: any) => part.media.url);

    return {
      enhancedImages: enhancedImages,
    };

  } catch (e: any) {
    console.error('Falha na ação de aprimoramento de grupo:', e);

    let errorMessage = 'Ocorreu um erro durante o aprimoramento.';
    if (e.message?.includes('already registered')) {
      errorMessage = 'Ocorreu um erro de configuração do servidor. Por favor, tente novamente.';
    } else if (e.message) {
      errorMessage = e.message;
    }

    return { error: errorMessage };
  }
}

export async function devChatAction(
  input: { message: string; history: DevChatMessage[] }
): Promise<{ reply?: string, error?: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A chave de API do Gemini não está configurada no servidor.');
    }

    // Format the history for the model
    const modelHistory = input.history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const result = await runDevChat({ message: input.message, history: modelHistory });

    return { reply: result };

  } catch (e: any) {
    console.error('Falha na ação de chat com dev:', e);
    return { error: e.message || 'Ocorreu um erro desconhecido no chat.' };
  }
}
