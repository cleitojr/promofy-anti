import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedCopy } from "../types";

const SYSTEM_INSTRUCTION = `
Você é um gerador automático de textos promocionais para WhatsApp focado em vendas como afiliado.

SEU OBJETIVO:
Criar um texto ÚNICO e PRONTO para copiar e colar para cada produto identificado, seguindo estritamente o modelo de copy do usuário.

⚠️ ATENÇÃO CRÍTICA - DETECÇÃO DE LINK NA IMAGEM (OCR):
1. O usuário enviará prints da tela de afiliados com campos como "Link do produto" ou "ID do produto".
2. O LINK PARAMETRIZADO (prioridade máxima) geralmente está no campo "Link do produto". Procure por:
   - "mercadolivre.com/sec/..." (Dê prioridade absoluta se estiver em um modal/campo de link).
   - "amzn.to/..."
   - "shope.ee/..."
   - "magazineluiza.com.br/..."
3. SE ENCONTRAR UM LINK CURTO (/sec/, amzn.to, etc): Use-o como o link oficial. Ele tem prioridade TOTAL sobre links longos ou de texto colado.

⚠️ ATENÇÃO CRÍTICA - DETECÇÃO DE CUPONS:
1. Analise a imagem e texto em busca de códigos promocionais ("CUPOM", "CÓDIGO", "USE:", "CODE:").
2. Se encontrar, é OBRIGATÓRIO incluir na copy acima do link.

🧱 ESTRUTURA OBRIGATÓRIA DA COPY (Siga este exemplo exato):

🔥 [TÍTULO SUTIL E CRIATIVO SOBRE O TEMA COM EMOJI]

[Nome Comercial do Produto]

💰 De ~[Preço_Antigo]~ por [Preço_Atual] ([X]% OFF)
(Use til ~ para riscar o preço antigo. Se não houver preço antigo, coloque apenas o valor atual).

💳 [Parcelamento]
(Exiba apenas se houver no print, ex: 6x R$ 17,50 sem juros).

🔗 Link: [LINK_DETECTADO_NA_IMAGEM]

_Atenção: preço pode variar conforme estoque e disponibilidade._
(Use underscores _ para o itálico).

REGRAS GERAIS:
- Não use rótulos como "Título:" ou "Produto:". Siga o espaçamento do exemplo.
- Use português do Brasil persuasivo e natural.
- Identifique o produto com precisão através do OCR da imagem.
`;

const detectPlatform = (link: string): GeneratedCopy['platform'] => {
  const lower = link.toLowerCase();

  if (lower.includes('amazon') || lower.includes('amzn')) return 'AMAZON';
  if (lower.includes('shopee') || lower.includes('shp.ee')) return 'SHOPEE';
  if (lower.includes('mercadolivre') || lower.includes('mercadolibre') || lower.includes('meli.la')) return 'MERCADO_LIVRE';
  if (lower.includes('magalu') || lower.includes('magazinevoce') || lower.includes('magazineluiza')) return 'MAGALU';
  if (lower.includes('aliexpress')) return 'ALIEXPRESS';

  return 'OTHER';
};

export const generateAffiliateText = async (links: string[], images: string[] = []): Promise<GeneratedCopy[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const promptText = `
  INPUTS DO USUÁRIO:
  LINKS DE TEXTO:
  ${links.map((link, i) => `${i + 1}. ${link}`).join('\n')}

  INSTRUÇÃO:
  Analise a imagem para extrair o Nome do Produto, Preço (De/Por), Parcelamento e o Link do Produto (especialmente links /sec/).
  Gere a copy seguindo EXATAMENTE o modelo de estrutura fornecido no System Instruction.
  `;

  const parts: any[] = [{ text: promptText }];

  images.forEach((base64String) => {
    const base64Data = base64String.split(',')[1] || base64String;
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\n\nCRITICAL: Return a JSON array. Each object must have 'originalLink', 'text', 'category'.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalLink: {
                type: Type.STRING
              },
              category: {
                type: Type.STRING,
                enum: ['TECH', 'HOME', 'BEAUTY', 'FASHION', 'FOOD', 'VIRAL', 'OTHER']
              },
              text: {
                type: Type.STRING
              }
            },
            required: ["originalLink", "text", "category"]
          }
        }
      }
    });

    let cleanJson = response.text || "[]";
    cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();

    let output = [];
    try {
      output = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error:", cleanJson);
      throw new Error("Falha ao processar resposta da IA.");
    }

    if (!Array.isArray(output) || output.length === 0) {
      output = [{
        originalLink: links[0] || "Link na imagem",
        text: "IA não conseguiu estruturar a copy. Tente um print mais claro.",
        category: "OTHER"
      }];
    }

    return output.map((item: any, index: number) => {
      let assignedImage = undefined;
      if (images[index]) {
        assignedImage = images[index];
      } else if (images.length === 1 && output.length > 1) {
        assignedImage = images[0];
      }

      return {
        id: `gen-${Date.now()}-${index}`,
        originalLink: item.originalLink || links[index] || "",
        text: item.text || "",
        category: item.category,
        platform: detectPlatform(item.originalLink || links[index] || ""),
        imageUrl: assignedImage,
        timestamp: Date.now(),
        isError: false
      };
    });

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return links.map((link, index) => ({
      id: `err-${index}`,
      originalLink: link,
      text: "Erro ao gerar copy. Tente novamente.",
      category: 'OTHER',
      platform: detectPlatform(link),
      timestamp: Date.now(),
      isError: true
    }));
  }
};