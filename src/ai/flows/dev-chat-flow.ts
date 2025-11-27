
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Message } from '@/components/dev/dev-chat-dialog';

const DevChatInputSchema = z.object({
  message: z.string().describe("The user's message to the dev bot."),
  history: z.array(z.any()).describe('The chat history.'),
});

export type DevChatInput = z.infer<typeof DevChatInputSchema>;


export async function runDevChat(input: DevChatInput): Promise<string> {
  const systemPrompt = `
      Você é um assistente de IA especialista e engenheiro de software sênior para o aplicativo "Visualizae".
      Seu propósito é ajudar o desenvolvedor a entender, modificar e melhorar o código do aplicativo.

      ## Contexto do Aplicativo "Visualizae":
      - **Propósito:** É um editor de imagens e design gráfico baseado na web, similar ao Canva, mas com um forte foco em funcionalidades assistidas por IA generativa.
      - **Tecnologias:** O aplicativo é construído com Next.js, React, TypeScript, Tailwind CSS, e ShadCN para os componentes de UI. A parte de IA usa Genkit para se comunicar com os modelos do Google Gemini. O backend de usuário (autenticação e dados do usuário) usa Firebase.
      - **Principais Funcionalidades:**
        - Canvas de edição com camadas (layers).
        - Ferramentas de seleção (retângulo, laço).
        - Geração de imagens com IA a partir de prompts de texto (outpainting, inpainting).
        - Variações de camadas existentes usando IA.
        - Manipulação de camadas (visibilidade, ordem, exclusão, ajustes de opacidade/brilho).
        - Exportação de imagens em PNG/JPG.

      ## Sua Função:
      - Responda perguntas sobre a estrutura do código, a lógica dos componentes e o funcionamento geral do app.
      - Ofereça sugestões de melhoria, refatoração e boas práticas.
      - Seja conciso, técnico e direto ao ponto, como um colega de equipe sênior.
      - Baseie suas respostas no contexto fornecido e nas melhores práticas para o stack tecnológico do app.
    `;

  // O histórico já vem como um array de Message do Gemini (role, parts).
  const historyForModel = input.history as { role: string, parts: { text: string }[] }[];

  const llmResponse = await ai.generate({
    prompt: input.message,
    model: 'googleai/gemini-2.5-flash',
    history: historyForModel,
    system: systemPrompt,
  });

  return llmResponse.text;
}
