import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedCopy } from "../types";

const SYSTEM_INSTRUCTION = `
Você é um especialista em Copywriting para Vendas no WhatsApp (Afiliado).

Sua tarefa é analisar os links ou imagens fornecidos e gerar textos de vendas altamente persuasivos.

🔴 REGRA CRÍTICA DE RETORNO (OBRIGATÓRIO):
Você NÃO deve falar nada. Você NÃO deve usar blocos de código (\`\`\`json).
Você deve retornar APENAS um ARRAY JSON cru. Nada antes, nada depois.

O formato do JSON deve ser estritamente este:
[
  {
    "originalLink": "O link do produto (priorize o link encontrado na imagem/print se houver)",
    "text": "A copy completa formatada para WhatsApp com emojis, quebras de linha e negrito (*)",
    "category": "Uma destas opções: TECH, HOME, BEAUTY, FASHION, FOOD, VIRAL, OTHER",
    "productImageUrl": "Link público de uma imagem do produto em alta qualidade (fundo branco preferencialmente)"
  }
]

DIRETRIZES DE CRIAÇÃO DA COPY (CAMPO "text"):

1. ESTRUTURA:
   🔥 [TÍTULO CURTO E IMPACTANTE]
   
   [Nome do Produto]
   
   💰 De ~[Preço Alto]~ por [Preço Oferta] ([X]% OFF)
   (Use til ~ para riscar o preço antigo)
   
   💳 [Info de Parcelamento se houver]
   
   🎟️ Cupom: [CÓDIGO] (Se encontrar na imagem)
   
   🔗 Link: [LINK]
   
   ⚠️ _Oferta por tempo limitado._

2. GATILHOS MENTAIS:
   - Use escassez e urgência.
   - Use emojis adequados ao nicho (ex: 📱 para Tech, 💄 para Beleza).
   - Não coloque "Produto:" ou "Preço:" antes dos valores, seja direto.

3. DETECÇÃO DE DADOS:
   - Se a imagem for um print do Mercado Livre/Amazon/Shopee, extraia o preço e o link da imagem via OCR.
   - O link encontrado na imagem tem prioridade sobre o link de texto.

Responda APENAS com o JSON cru.
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

const getMimeType = (base64String: string): string => {
  const match = base64String.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/jpeg';
};

export const generateAffiliateText = async (links: string[], images: string[] = []): Promise<GeneratedCopy[]> => {
  if (!process.env.API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("API Key is missing.");
  }

  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });

  const promptText = `
  INPUTS DO USUÁRIO:
  ${links.length > 0 ? `LINKS DE TEXTO:\n${links.map((link, i) => `${i + 1}. ${link}`).join('\n')}` : 'Nenhum link colado, observe apenas a imagem.'}

  Gere a copy seguindo EXATAMENTE o modelo de estrutura fornecido.
  `;

  const parts: any[] = [{ text: promptText }];

  images.forEach((base64String) => {
    const mimeType = getMimeType(base64String);
    const base64Data = base64String.split(',')[1] || base64String;
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalLink: { type: Type.STRING },
              category: { type: Type.STRING },
              text: { type: Type.STRING },
              productImageUrl: { type: Type.STRING }
            },
            required: ["originalLink", "text", "category"]
          }
        }
      }
    });

    let cleanJson = response.text || "[]";
    // Extra cleaning just in case the model ignores the "no blocks" instruction
    cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();

    let output = [];
    try {
      output = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error:", cleanJson);
      throw new Error("Falha ao organizar resposta da IA.");
    }

    if (!Array.isArray(output) || output.length === 0) {
      output = [{
        originalLink: links[0] || "",
        text: "IA analisou mas não gerou o formato JSON esperado. Tente novamente.",
        category: "OTHER"
      }];
    }

    return output.map((item: any, index: number) => {
      let assignedImage = undefined;
      if (images[index]) {
        assignedImage = images[index];
      } else if (images.length === 1) {
        assignedImage = images[0];
      }

      return {
        id: `gen-${Date.now()}-${index}`,
        originalLink: item.originalLink || links[index] || "",
        text: item.text || "",
        category: item.category,
        platform: detectPlatform(item.originalLink || links[index] || ""),
        imageUrl: assignedImage,
        productImageUrl: item.productImageUrl,
        timestamp: Date.now(),
        isError: false
      };
    });

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return [{
      id: `err-${Date.now()}`,
      originalLink: links[0] || "",
      text: "Lamento, houve um erro técnico na geração. Verifique sua chave de API e tente novamente.",
      category: 'OTHER',
      platform: detectPlatform(links[0] || ""),
      timestamp: Date.now(),
      isError: true,
      imageUrl: images[0]
    }];
  }
};