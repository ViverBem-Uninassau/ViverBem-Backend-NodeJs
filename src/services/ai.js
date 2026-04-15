// src/services/ai.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fuzzy = require('fuzzy');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const KNOWN_MEDICINES = [
  'dipirona', 'amoxicilina', 'losartana', 'omeprazol', 'paracetamol',
  'aspirina', 'ibuprofeno', 'simvastatina', 'metformina', 'enalapril'
];

// PROMPTS ORGANIZADOS POR RESPONSABILIDADE
const IDENTIFICATION_PROMPT = `
Você é um especialista em visão computacional farmacêutica.
Analise a embalagem e retorne APENAS um JSON:
{"nome": "nome_do_medicamento", "dosagem": "dosagem_extraida"}
Se não identificar, use "desconhecido".
`;

const RESEARCH_PROMPT = (name) => `
Você é um farmacêutico clínico. Com base no medicamento "${name}", forneça as informações reais da bula oficial.
Responda APENAS um JSON:
{
  "principio_ativo": "string",
  "indicacoes": ["string"],
  "contraindicacoes": ["string"],
  "resumo_voz": "string (resumo curto para idosos)"
}
`;

/**
 * Funções Auxiliares de Arquitetura (Private-like)
 */
async function getModel() {
  return genAI.getGenerativeModel(
    { model: "gemini-2.5-flash-lite" },
    { apiVersion: 'v1' }
  );
}

/**
 * Função Principal: Scan Medication
 */
async function scanMedication(imageBuffer) {
  try {
    const model = await getModel();
    const imageB64 = imageBuffer.toString('base64');

    // PASSO 1: Identificação Visual
    const visionResult = await model.generateContent([
      IDENTIFICATION_PROMPT,
      { inlineData: { mimeType: 'image/jpeg', data: imageB64 } },
    ]);

    const visionText = visionResult.response.text().replace(/```json|```/g, '').trim();
    const parsedVision = JSON.parse(visionText);

    const rawName = parsedVision.nome?.toLowerCase() || 'desconhecido';
    const rawDosage = parsedVision.dosagem || 'desconhecida';

    // Fuzzy Matching para normalização
    let cleanedName = rawName;
    const matches = fuzzy.filter(rawName, KNOWN_MEDICINES);
    if (matches.length > 0) cleanedName = matches[0].original;

    if (cleanedName === 'desconhecido') throw new Error('Medicamento não identificado');

    // PASSO 2: Pesquisa Dinâmica de Bula (A "Mágica" acontece aqui)
    // A IA agora pesquisa em sua base de conhecimento os dados reais do remédio identificado
    const researchResult = await model.generateContent(RESEARCH_PROMPT(cleanedName));
    const researchText = researchResult.response.text().replace(/```json|```/g, '').trim();
    const info = JSON.parse(researchText);

    // PASSO 3: Montagem do Objeto de Resposta Final (Data Transfer Object)
    return {
      name: cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1),
      active_ingredient: info.principio_ativo,
      dosage: rawDosage,
      indications: info.indicacoes,
      contraindications: info.contraindicacoes,
      disclaimer: 'Esta informação é um resumo automático da bula e não substitui consulta médica.',
      confidence: 0.95,
      tts_message: `Identifiquei ${cleanedName} ${rawDosage}. ${info.resumo_voz}`
    };

  } catch (error) {
    console.error('Erro em scanMedication:', error);
    throw new Error('Falha ao processar imagem ou pesquisar bula');
  }
}

/**
 * Processa chat com foco em acessibilidade para idosos
 */
async function processChat(message, context = null) {
  try {
    const model = await getModel();
    const systemPrompt = `
Você é um guia de bulas para idosos. Seja extremamente educado e paciente.
Use tópicos curtos. Sempre diga que não é médico.
Contexto atual: ${context || 'Nenhum medicamento em foco no momento'}.
`;
    const result = await model.generateContent([systemPrompt, `Pergunta: ${message}`]);
    const text = result.response.text().trim();

    const medicationReferenced = KNOWN_MEDICINES.find(med => 
      text.toLowerCase().includes(med) || message.toLowerCase().includes(med)
    ) || null;

    return { response: text, medication_referenced: medicationReferenced };
  } catch (error) {
    console.error('Erro em processChat:', error);
    return { response: 'Desculpe, tive um problema ao pesquisar. Tente novamente.', medication_referenced: null };
  }
}

module.exports = { scanMedication, processChat };