// src/services/ai.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fuzzy = require('fuzzy');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// ---------------------------------------------------------------------------
// Lista expandida de medicamentos conhecidos no Brasil
// ---------------------------------------------------------------------------
const KNOWN_MEDICINES = [
  // Analgésicos e anti-inflamatórios
  'dipirona', 'paracetamol', 'ibuprofeno', 'aspirina', 'diclofenaco',
  'nimesulida', 'naproxeno', 'dorflex', 'buscopan', 'tylenol',
  // Antibióticos
  'amoxicilina', 'azitromicina', 'cefalexina', 'ciprofloxacino',
  'levofloxacino', 'metronidazol', 'sulfametoxazol',
  // Cardiovasculares
  'losartana', 'enalapril', 'captopril', 'anlodipino', 'atenolol',
  'propranolol', 'hidroclorotiazida', 'furosemida', 'carvedilol',
  'valsartana', 'espironolactona',
  // Colesterol e diabetes
  'sinvastatina', 'simvastatina', 'atorvastatina', 'rosuvastatina',
  'metformina', 'glibenclamida', 'insulina', 'gliclazida',
  // Gastrointestinais
  'omeprazol', 'pantoprazol', 'lansoprazol', 'ranitidina', 'domperidona',
  'metoclopramida', 'simeticona', 'lactulose',
  // Sistema nervoso
  'rivotril', 'clonazepam', 'diazepam', 'sertralina', 'fluoxetina',
  'amitriptilina', 'escitalopram', 'citalopram', 'venlafaxina',
  'carbamazepina', 'gabapentina', 'pregabalina', 'zolpidem',
  // Respiratórios
  'salbutamol', 'budesonida', 'loratadina', 'desloratadina',
  'cetirizina', 'dexametasona', 'prednisona',
  // Outros comuns
  'levotiroxina', 'puran', 'rivotril', 'aas', 'clopidogrel',
  'varfarina', 'enoxaparina', 'sinvastatina', 'cialis', 'sildenafila',
];

// ---------------------------------------------------------------------------
// PROMPTS ORGANIZADOS POR RESPONSABILIDADE
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// System prompt refinado para o chat de voz
// ---------------------------------------------------------------------------
const CHAT_SYSTEM_PROMPT = (context) => `
Você é a **Bia**, assistente virtual do aplicativo ViverBem — um app de saúde feito especialmente para pessoas idosas.

═══════════════════════════════════════════════
  IDENTIDADE E TOM DE VOZ
═══════════════════════════════════════════════
• Você é carinhosa, paciente e acolhedora — como uma neta atenciosa que trabalha na área da saúde.
• Trate o usuário sempre com respeito: use "o(a) senhor(a)" de forma natural, sem ser artificial.
• Seja BREVE e DIRETA nas respostas — o usuário vai OUVIR sua resposta em voz alta (TTS).
• Frases curtas e simples. Evite parágrafos longos, jargões médicos complexos ou listas extensas.
• Use no máximo 3 a 4 frases na maioria das respostas.

═══════════════════════════════════════════════
  REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. Você NÃO é médica, NÃO é farmacêutica e NÃO substitui nenhum profissional de saúde.
2. NUNCA recomende iniciar, parar ou alterar dosagem de medicamentos por conta própria.
3. Sempre que a pergunta envolver diagnóstico, tratamento ou mudança de medicação, oriente a procurar o médico ou farmacêutico.
4. Se não souber a resposta com certeza, diga honestamente que não sabe e sugira consultar um profissional.
5. Responda SOMENTE sobre saúde, medicamentos e bem-estar. Se a pergunta não for sobre esses temas, diga gentilmente que só pode ajudar com assuntos de saúde.
6. NUNCA invente informações sobre medicamentos. Use apenas conhecimento factual de bulas oficiais.

═══════════════════════════════════════════════
  FORMATO DA RESPOSTA
═══════════════════════════════════════════════
• Sua resposta será lida em voz alta para o(a) idoso(a). Então:
  - NÃO use markdown, asteriscos, bullets, emojis ou formatação especial.
  - NÃO use listas numeradas longas.
  - Escreva como se estivesse falando pessoalmente com a pessoa.
  - Use pontuação clara para pausas naturais na fala.
• Comece a resposta de forma direta, sem cumprimentos repetitivos (evite "Olá!" em toda resposta).
• Termine com algo reconfortante quando apropriado, como "Se tiver mais dúvidas, estou aqui."

═══════════════════════════════════════════════
  IDENTIFICAÇÃO DE MEDICAMENTO
═══════════════════════════════════════════════
Se a pergunta do usuário mencionar OU se a sua resposta abordar algum medicamento específico (qualquer um, mesmo que não seja comum),
você DEVE incluir no INÍCIO da resposta um bloco especial com o nome do medicamento:

[MEDICATION]nome_do_medicamento[/MEDICATION]

Regras:
• Sempre use o nome em minúsculo (ex: "efedrina", "losartana", "paracetamol").
• O bloco deve conter APENAS o nome do medicamento, sem dosagem ou texto extra.
• Se MAIS DE UM medicamento for discutido, use o medicamento PRINCIPAL da pergunta do usuário.
• Se a conversa NÃO for sobre nenhum medicamento específico, NÃO inclua esse bloco.
• O bloco DEVE estar em uma ÚNICA linha, antes do texto da resposta.

═══════════════════════════════════════════════
  CRIAÇÃO DE ALARMES / LEMBRETES
═══════════════════════════════════════════════
Se o(a) senhor(a) pedir para criar um lembrete, alarme ou aviso de medicamento, você DEVE:
1. Extrair da frase: nome do medicamento, horário, frequência (em horas) e dias.
2. Colocar ANTES da sua resposta um bloco especial com os dados, neste formato EXATO:

[ALARM_DATA]{"medication":"nome","time":"HH:MM","frequency":"Xh","days":"todos"}[/ALARM_DATA]

Regras do bloco [ALARM_DATA]:
• "medication": nome do medicamento em minúsculo (ex: "losartana").
• "time": horário no formato 24h (ex: "08:00", "14:30"). Se o usuário disser "8 da manhã" = "08:00". Se disser "2 da tarde" = "14:00".
• "frequency": intervalo entre doses. Se não for mencionado, use "24h". Exemplos: "8h", "12h", "24h".
• "days": pode ser "todos", "semana" (seg-sex), "fds" (sábado e domingo). Se não for mencionado, use "todos".
• O bloco DEVE estar em uma ÚNICA linha, sem quebras.
• Se o usuário NÃO mencionar horário, PERGUNTE antes de gerar o bloco. Não invente horário.
• Se o usuário NÃO mencionar o medicamento, PERGUNTE antes de gerar o bloco.
• Após o bloco, escreva uma confirmação carinhosa como: "Prontinho! Criei um lembrete de losartana para às 8 da manhã, todos os dias."

Exemplos de frases que ativam a criação de alarme:
- "Me lembre de tomar losartana às 8 da manhã"
- "Cria um alarme de dipirona pra 14 horas"
- "Quero um lembrete para tomar meu remédio às 7"
- "Avisa pra eu tomar paracetamol de 8 em 8 horas começando às 6"

Se o usuário NÃO está pedindo para criar um alarme, NÃO inclua o bloco [ALARM_DATA].

═══════════════════════════════════════════════
  CONTEXTO DA CONVERSA
═══════════════════════════════════════════════
${context
    ? `O(A) senhor(a) está consultando sobre: ${context}. Use esse contexto para dar respostas mais relevantes.`
    : 'Nenhum medicamento específico em foco no momento. Responda de forma geral.'}
`;

// ---------------------------------------------------------------------------
// Funções auxiliares
// ---------------------------------------------------------------------------

async function getModel() {
  return genAI.getGenerativeModel(
    { model: "gemini-2.5-flash-lite" },
    { apiVersion: 'v1' }
  );
}

/**
 * Remove acentos e converte para minúsculo para comparação.
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Detecta se algum medicamento conhecido foi mencionado na mensagem ou resposta.
 * Usa normalização (sem acentos) e fuzzy matching para maior robustez.
 */
function detectMedication(userMessage, aiResponse) {
  const combinedNormalized = normalizeText(`${userMessage} ${aiResponse}`);

  // 1. Busca exata (normalizada) — mais confiável
  const exactMatch = KNOWN_MEDICINES.find((med) =>
    combinedNormalized.includes(normalizeText(med))
  );
  if (exactMatch) return exactMatch;

  // 2. Fuzzy matching como fallback para erros de transcrição de voz
  const words = combinedNormalized.split(/\s+/).filter((w) => w.length > 3);
  for (const word of words) {
    const matches = fuzzy.filter(word, KNOWN_MEDICINES.map(normalizeText));
    if (matches.length > 0 && matches[0].score > 3) {
      return KNOWN_MEDICINES[matches[0].index];
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Função Principal: Scan Medication
// ---------------------------------------------------------------------------
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

    // PASSO 2: Pesquisa Dinâmica de Bula
    const researchResult = await model.generateContent(RESEARCH_PROMPT(cleanedName));
    const researchText = researchResult.response.text().replace(/```json|```/g, '').trim();
    const info = JSON.parse(researchText);

    // PASSO 3: Montagem do Objeto de Resposta Final
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

// ---------------------------------------------------------------------------
// Processa chat com foco em acessibilidade para idosos
// ---------------------------------------------------------------------------
async function processChat(message, context = null) {
  try {
    const model = await getModel();

    const result = await model.generateContent([
      CHAT_SYSTEM_PROMPT(context),
      `Pergunta do(a) senhor(a): ${message}`,
    ]);

    let text = result.response.text().trim();

    // -----------------------------------------------------------------
    // Extrai bloco [MEDICATION]...[/MEDICATION] — a IA informa qual
    // medicamento está sendo discutido
    // -----------------------------------------------------------------
    let medicationReferenced = null;
    const medMatch = text.match(/\[MEDICATION\](.*?)\[\/MEDICATION\]/s);

    if (medMatch) {
      medicationReferenced = medMatch[1].trim().toLowerCase() || null;
      // Remove o bloco do texto que será lido em voz alta
      text = text.replace(/\[MEDICATION\].*?\[\/MEDICATION\]/s, '').trim();
    }

    // -----------------------------------------------------------------
    // Extrai bloco [ALARM_DATA]...[/ALARM_DATA] se a IA detectou pedido
    // de criação de alarme
    // -----------------------------------------------------------------
    let alarmData = null;
    const alarmMatch = text.match(/\[ALARM_DATA\](.*?)\[\/ALARM_DATA\]/s);

    if (alarmMatch) {
      try {
        alarmData = JSON.parse(alarmMatch[1].trim());
      } catch (parseErr) {
        console.error('Erro ao parsear ALARM_DATA da IA:', parseErr.message);
      }
      // Remove o bloco do texto que será lido em voz alta
      text = text.replace(/\[ALARM_DATA\].*?\[\/ALARM_DATA\]/s, '').trim();
    }

    // Remove qualquer formatação markdown que a IA possa ter incluído
    text = text
      .replace(/\*\*/g, '')        // negrito
      .replace(/\*/g, '')          // itálico
      .replace(/^[-•]\s*/gm, '')   // bullets
      .replace(/^#{1,6}\s*/gm, '') // headers
      .replace(/`/g, '')           // code
      .trim();

    // Fallback: se a IA não incluiu a tag [MEDICATION], tenta detectar via lista
    if (!medicationReferenced) {
      medicationReferenced = detectMedication(message, text);
    }

    console.log(`Chat — medicamento detectado: ${medicationReferenced || '(nenhum)'}`);

    return {
      response: text,
      medication_referenced: medicationReferenced,
      alarm_data: alarmData,
    };
  } catch (error) {
    console.error('Erro em processChat:', error);
    return {
      response: 'Desculpe, tive um probleminha agora. Pode repetir a pergunta, por favor?',
      medication_referenced: null,
      alarm_data: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Pesquisa bula de um medicamento pelo nome (reutiliza RESEARCH_PROMPT)
// ---------------------------------------------------------------------------
async function researchMedication(medicationName) {
  const model = await getModel();
  const researchResult = await model.generateContent(RESEARCH_PROMPT(medicationName));
  const researchText = researchResult.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(researchText);
}

module.exports = { scanMedication, processChat, researchMedication };