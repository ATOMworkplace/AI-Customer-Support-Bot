const axios = require('axios');
const { llm } = require('../config');
const scenarios = require('../data/scenarios.json');
const cosineSimilarity = require('cosine-similarity');

const PROMPTS = {
  intentClassification: `
    You are an intent classification expert for a customer support bot. 
    Analyze the user's query and the last two messages of the conversation history. 
    Classify the user's primary intent into one of these specific categories:
    - GREETING
    - FAQ_QUESTION
    - REQUEST_FOR_HUMAN
    - COMPLAINT
    - SUMMARIZE_CONVERSATION
    - CHITCHAT
    - UNKNOWN
    
    Conversation History (last 2 messages):
    {history}

    User Query:
    "{userQuery}"

    Respond with ONLY a single JSON object containing the intent. Example: {"intent": "FAQ_QUESTION"}
  `,
  sentimentAnalysis: `
    Analyze the sentiment of the following user query. Classify it as 'positive', 'neutral', or 'negative'.
    User Query: "{userQuery}"
    Respond with ONLY a single JSON object. Example: {"sentiment": "neutral"}
  `,
  contextualAnswer: `
    You are {persona}. A user asked the following query: "{userQuery}".
    The most relevant piece of information from your knowledge base is this question-answer pair:
    Q: {faq_question}
    A: {faq_answer}

    Using ONLY this information, provide a direct and helpful answer to the user's original query. 
    Adopt the tone of your persona. Do not say "Based on the information...". Just answer the question naturally.
  `,
  conversationSummary: `
    You are a helpful assistant who summarizes conversations for customer support agents.
    Review the following conversation history and provide a concise, one-sentence summary for a human agent who is about to take over the chat.
    Focus on the user's primary issue.

    Conversation History:
    {history}

    Summary:
  `,
  generalResponse: `
    You are {persona}. The user has asked a question that is not in your standard FAQ document. 
    Answer their general question or chitchat in a helpful and conversational manner, keeping your persona in mind.
    Do not mention that you are an AI or that you are looking at an FAQ document. Just answer naturally.
    If the question is inappropriate, too complex, asks for personal opinions, or is completely unrelated to your business persona, you must politely decline to answer and gently guide them back to your main function as a customer support assistant.
  `
};

const embeddingCache = {};
const SIMILARITY_THRESHOLD = 0.8;

const createEmbedding = async (text) => {
  if (!llm.apiKey || !process.env.LLM_EMBEDDING_ENDPOINT) {
    throw new Error('LLM API Key or Embedding Endpoint is not configured.');
  }
  try {
    const response = await axios.post(
      process.env.LLM_EMBEDDING_ENDPOINT,
      {
        input: text,
        model: 'text-embedding-ada-002',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llm.apiKey}`,
        },
      }
    );
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error.response ? error.response.data : error.message);
    throw new Error('Failed to create text embedding.');
  }
};

const _callLLM = async (messages, temperature = 0.1, max_tokens = 250) => {
  if (!llm.apiKey || !llm.apiEndpoint) {
    throw new Error('LLM API Key or Endpoint is not configured.');
  }
  try {
    const response = await axios.post(
      llm.apiEndpoint,
      { model: 'gpt-3.5-turbo', messages, temperature, max_tokens },
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llm.apiKey}` } }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error contacting LLM service:', error.response ? error.response.data : error.message);
    throw new Error('Failed to get response from AI model.');
  }
};

const classifyIntent = async (userQuery, conversationHistory) => {
  const recentHistory = conversationHistory.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n');
  const prompt = PROMPTS.intentClassification
    .replace('{history}', recentHistory || 'No history yet.')
    .replace('{userQuery}', userQuery);
  const messages = [{ role: 'system', content: prompt }];
  const response = await _callLLM(messages, 0.1, 50);
  try {
    const jsonResponse = JSON.parse(response);
    return jsonResponse.intent || 'UNKNOWN';
  } catch (error) {
    return 'UNKNOWN';
  }
};

const analyzeSentiment = async (userQuery) => {
  const prompt = PROMPTS.sentimentAnalysis.replace('{userQuery}', userQuery);
  const messages = [{ role: 'system', content: prompt }];
  const response = await _callLLM(messages, 0.1, 50);
  try {
    const jsonResponse = JSON.parse(response);
    return jsonResponse.sentiment || 'neutral';
  } catch (error) {
    return 'neutral';
  }
};

const findRelevantFAQ = async (userQuery, scenario) => {
  const scenarioData = scenarios[scenario];
  if (!scenarioData) throw new Error(`Scenario "${scenario}" not found.`);

  if (!embeddingCache[scenario]) {
    console.log(`Creating and caching embeddings for scenario: ${scenario}`);
    const questions = scenarioData.faqs.map(f => f.question);
    const embeddings = await Promise.all(questions.map(q => createEmbedding(q)));
    embeddingCache[scenario] = scenarioData.faqs.map((faq, index) => ({
      ...faq,
      embedding: embeddings[index]
    }));
  }

  const queryEmbedding = await createEmbedding(userQuery);
  
  let bestMatch = { score: -1, faq: null };

  for (const faq of embeddingCache[scenario]) {
    const score = cosineSimilarity(queryEmbedding, faq.embedding);
    if (score > bestMatch.score) {
      bestMatch = { score, faq };
    }
  }

  if (bestMatch.score >= SIMILARITY_THRESHOLD) {
    console.log(`Found best match with score ${bestMatch.score}: "${bestMatch.faq.question}"`);
    return bestMatch.faq.question;
  }
  
  return 'NONE';
};

const getAnswerFromContext = async (userQuery, faqEntry, scenario) => {
  const scenarioData = scenarios[scenario];
  if (!scenarioData) throw new Error(`Scenario "${scenario}" not found.`);
  const { persona } = scenarioData;
  const prompt = PROMPTS.contextualAnswer
    .replace('{persona}', persona)
    .replace('{userQuery}', userQuery)
    .replace('{faq_question}', faqEntry.question)
    .replace('{faq_answer}', faqEntry.answer);
  const messages = [{ role: 'system', content: prompt }];
  return await _callLLM(messages, 0.3, 250);
};

const getGeneralResponse = async (userQuery, conversationHistory, scenario) => {
  const scenarioData = scenarios[scenario];
  if (!scenarioData) throw new Error(`Scenario "${scenario}" not found.`);
  const { persona } = scenarioData;
  const systemPrompt = PROMPTS.generalResponse.replace('{persona}', persona);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: 'user', content: userQuery }
  ];
  return await _callLLM(messages, 0.7, 250);
};

const summarizeConversation = async (conversationHistory, context = {}) => {
  if (conversationHistory.length === 0) {
    return "User initiated a chat but did not provide details.";
  }
  const contextString = Object.keys(context).length > 0 ? `\n\nCollected Data:\n${JSON.stringify(context, null, 2)}` : '';
  const historyString = conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  const prompt = PROMPTS.conversationSummary.replace('{history}', historyString + contextString);
  const messages = [{ role: 'system', content: prompt }];
  return await _callLLM(messages, 0.5, 100);
};

module.exports = {
  classifyIntent,
  analyzeSentiment,
  findRelevantFAQ,
  getAnswerFromContext,
  getGeneralResponse,
  summarizeConversation,
};