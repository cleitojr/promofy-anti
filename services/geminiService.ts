import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedCopy } from "../types";

const SYSTEM_INSTRUCTION = `
Você é um gerador automático de textos promocionais para WhatsApp focado em vendas como afiliado.

SEU OBJETIVO:
Criar um texto ÚNICO e PRONTO para copiar e colar para cada produto identificado.

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
2. Se encontrar, é OBRIGATÓRIO incluir.

⚠️ ATENÇÃO CRÍTICA - BUSCA DE IMAGEM LIMPA:
1. Além de gerar o texto, utilize a ferramenta de busca para encontrar uma URL de imagem PÚBLICA e de ALTA QUALIDADE deste produto específico.
2. Priorize imagens com fundo branco ou fundo limpo, estilo e-commerce.

🎭 ESTILOS E EMOJIS (Identifique o produto e aplique):

1. Eletrônicos / Tecnologia: ⚡📱💻🔥🎧
2. Casa, limpeza, organização: 🏠🧼✨🛠️🍳
3. Beleza, saúde, autocuidado: 💄🧴💆‍♀️✨💅
4. Moda e acessórios: 👕👟👜🔥🕶️
5. Alimentos, suplementos: 🍫☕🥤😋🍎
6. Outros/Virais: 😂🤯🔥🚀

🧱 ESTRUTURA OBRIGATÓRIA DO TEXTO (Siga estritamente):

🔥 [TÍTULO CHAMATIVO E CURTO]

[Nome Comercial do Produto]
(NÃO escreva "Produto:", apenas o nome)

💰 [Valor]
REGRAS DE PREÇO (FORMATAÇÃO WHATSAPP):
- Preço normal: "R$ 99,90"
- Promoção (De/Por): "De ~R$ 150,00~ por R$ 99,90 (33% OFF)"
-> OBRIGATÓRIO: Use o til (~) no começo e fim do preço antigo para riscá-lo.
-> OBRIGATÓRIO: Calcule e exiba a porcentagem de desconto.

[SE UM CUPOM FOI DETECTADO, INSIRA AQUI:]
🎟️ Cupom: [CÓDIGO]

💳 [Parcelamento]
(Exiba APENAS se for "sem juros" ou relevante. Se não achar, omita).

🔗 Link: [LINK_DETECTADO_NA_IMAGEM_OU_TEXTO]

⚠️ _Atenção: preço pode variar conforme estoque e disponibilidade._
(OBRIGATÓRIO: Use underscore (_) para deixar esta frase em itálico).

REGRAS GERAIS:
- Remova rótulos "Produto:" e "Preço:".
- Não invente dados.
- Link: Se achou na imagem curto (/sec/), USE ELE.
- Use português do Brasil persuasivo.
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
  LINKS DE TEXTO (Opcional se houver link na imagem):
  ${links.map((link, i) => `${i + 1}. ${link}`).join('\n')}

  INSTRUÇÃO:
  Analise as imagens e os links. Se a imagem contiver um link de afiliado explícito curto (ex: mercadolivre.com/sec/...), DÊ PRIORIDADE TOTAL a ele.
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
        systemInstruction: SYSTEM_INSTRUCTION + "\n\nCRITICAL: You MUST return a JSON array of objects. Even if you only find one product, return it inside an array [{}]. If you find multiple, return all. NEVER return an empty array if an image or link is provided.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalLink: {
                type: Type.STRING,
                description: "O link final usado na oferta."
              },
              productImageUrl: {
                type: Type.STRING,
                description: "URL direta da imagem do produto (formato jpg/png) se encontrada."
              },
              category: {
                type: Type.STRING,
                enum: ['TECH', 'HOME', 'BEAUTY', 'FASHION', 'FOOD', 'VIRAL', 'OTHER']
              },
              text: {
                type: Type.STRING,
                description: "O texto promocional completo."
              }
            },
            required: ["originalLink", "text", "category"]
          }
        }
      }
    });

    let cleanJson = response.text || "[]";
    // Basic cleaning in case of markdown blocks
    cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();

    let output = [];
    try {
      output = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error:", cleanJson);
      throw new Error("Falha ao processar resposta da IA.");
    }

    if (!Array.isArray(output) || output.length === 0) {
      // Fallback result if AI returns empty or invalid structure
      output = [{
        originalLink: links[0] || "Link na imagem",
        text: "IA analisou o pedido mas não conseguiu estruturar a copy. Por favor, tente enviar um print mais claro ou cole o link do produto.",
        category: "OTHER",
        productImageUrl: undefined
      }];
    }

    return output.map((item: any, index: number) => {
      // Improved Image Mapping Logic:
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
        imageUrl: assignedImage, // The original print/screenshot
        productImageUrl: item.productImageUrl, // The new clean image from search
        timestamp: Date.now(),
        isError: false
      };
    });

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return links.map((link, index) => ({
      id: `err-${index}`,
      originalLink: link,
      text: "Erro ao gerar copy. Tente novamente ou verifique se o link é válido.",
      category: 'OTHER',
      platform: detectPlatform(link),
      timestamp: Date.now(),
      isError: true
    }));
  }
};