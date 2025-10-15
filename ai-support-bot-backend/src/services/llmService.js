const axios = require('axios');
const { llm } = require('../config');
const faqs = require('../data/faqs.json');

// --- Prompt Engineering Hub ---
// Storing all prompts here makes them easier to manage and refine.
const PROMPTS = {
  intentClassification: `
    You are an intent classification expert for a customer support bot. 
    Analyze the user's query and the last two messages of the conversation history. 
    Classify the user's primary intent into one of these specific categories:
    - GREETING (e.g., "hi", "hello", "how are you?")
    - FAQ_QUESTION (e.g., "what are your shipping options?", "how do I track my order?")
    - REQUEST_FOR_HUMAN (e.g., "I need to speak to a person", "connect me to an agent")
    - COMPLAINT (e.g., "this is unacceptable", "my order is damaged", "I'm very angry")
    - CHITCHAT (e.g., "what's the weather like?", "tell me a joke", non-support related questions)
    - UNKNOWN (if it does not fit any other category)
    
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
  answerGeneration: `
    You are a friendly and helpful customer support assistant for an online apparel and accessories store. 
    Your goal is to respond to the user based ONLY on the provided FAQs. This includes answering direct questions and responding appropriately to common greetings.
    If the user's query cannot be answered or handled using the information in the FAQs, you MUST respond with the exact string "[ESCALATE]". 
    Do not make up answers. Be concise and professional.

    --- FAQs ---
    {faqString}
    --- End of FAQs ---
  `,
  conversationSummary: `
    You are a helpful assistant who summarizes conversations for customer support agents.
    Review the following conversation history and provide a concise, one-sentence summary for a human agent who is about to take over the chat.
    Focus on the user's primary issue.

    Conversation History:
    {history}

    Summary:
  `,
};

// A private helper function to standardize calls to the LLM API.
const _callLLM = async (messages, temperature = 0.2, max_tokens = 150) => {
  if (!llm.apiKey || !llm.apiEndpoint) {
    throw new Error('LLM API Key or Endpoint is not configured.');
  }

  try {
    const response = await axios.post(
      llm.apiEndpoint,
      {
        model: 'gpt-3.5-turbo', // Or your preferred model
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llm.apiKey}`,
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error contacting LLM service:', error.response ? error.response.data : error.message);
    throw new Error('Failed to get response from AI model.');
  }
};

/**
 * Classifies the user's intent based on their query and recent history.
 * @returns {Promise<string>} The classified intent (e.g., 'FAQ_QUESTION').
 */
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
    console.error('Failed to parse intent JSON:', response);
    return 'UNKNOWN';
  }
};

/**
 * Analyzes the sentiment of the user's query.
 * @returns {Promise<string>} The classified sentiment (e.g., 'negative').
 */
const analyzeSentiment = async (userQuery) => {
  const prompt = PROMPTS.sentimentAnalysis.replace('{userQuery}', userQuery);
  const messages = [{ role: 'system', content: prompt }];
  const response = await _callLLM(messages, 0.1, 50);
  
  try {
    const jsonResponse = JSON.parse(response);
    return jsonResponse.sentiment || 'neutral';
  } catch (error) {
    console.error('Failed to parse sentiment JSON:', response);
    return 'neutral';
  }
};

/**
 * Generates a direct answer to a user's query based on FAQs.
 * @returns {Promise<string>} The AI-generated answer.
 */
const getAnswer = async (userQuery, conversationHistory) => {
  const faqString = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
  const systemPrompt = PROMPTS.answerGeneration.replace('{faqString}', faqString);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userQuery }
  ];

  return await _callLLM(messages, 0.3, 200);
};

/**
 * Summarizes a conversation for escalation to a human agent.
 * @returns {Promise<string>} A one-sentence summary.
 */
const summarizeConversation = async (conversationHistory) => {
  if (conversationHistory.length === 0) {
    return "User initiated a chat but did not provide details.";
  }
  const historyString = conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  const prompt = PROMPTS.conversationSummary.replace('{history}', historyString);
  const messages = [{ role: 'system', content: prompt }];
  return await _callLLM(messages, 0.5, 100);
};


module.exports = {
  classifyIntent,
  analyzeSentiment,
  getAnswer,
  summarizeConversation,
};