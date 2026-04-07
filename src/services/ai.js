// src/services/ai.js
// Serviço de IA — terreno preparado para integração com OpenAI
// TODO: substituir os placeholders pelas chamadas reais à API da OpenAI

/**
 * Identifica um medicamento a partir dos bytes de uma imagem.
 * @param {Buffer} imageBuffer - Buffer da imagem enviada pelo usuário
 * @returns {{ name, active_ingredient, dosage, indications, contraindications, disclaimer }}
 */
async function scanMedication(imageBuffer) {
  // TODO: Integrar com OpenAI Vision (gpt-4o ou gpt-4o-mini)
  // Exemplo de chamada futura:
  //   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  //   const b64 = imageBuffer.toString('base64');
  //   const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', ... });

  return {
    name: 'Medicamento identificado',
    active_ingredient: 'Princípio ativo do medicamento',
    dosage: 'Dosagem conforme embalagem',
    indications: ['Indicação 1', 'Indicação 2'],
    contraindications: ['Contraindicação 1'],
    disclaimer: 'Esta informação não substitui orientação médica. Consulte um profissional de saúde.',
  };
}

/**
 * Processa uma pergunta do usuário e retorna a resposta da IA em texto.
 * @param {string} message - Texto capturado pelo reconhecimento de voz
 * @param {string|null} context - Contexto opcional (ex: nome do medicamento em foco)
 * @returns {{ response: string, medication_referenced: string|null }}
 */
async function processChat(message, context = null) {
  // TODO: Integrar com OpenAI Chat (gpt-4o ou gpt-4o-mini)
  // Exemplo de chamada futura:
  //   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  //   const systemPrompt = context
  //     ? `Você é um assistente de saúde. O usuário está perguntando sobre ${context}.`
  //     : 'Você é um assistente de saúde para idosos.';
  //   const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', ... });

  const contextInfo = context ? ` sobre ${context}` : '';
  return {
    response: `Recebi sua pergunta${contextInfo}: "${message}". A integração com a IA será ativada em breve.`,
    medication_referenced: context || null,
  };
}

module.exports = { scanMedication, processChat };
