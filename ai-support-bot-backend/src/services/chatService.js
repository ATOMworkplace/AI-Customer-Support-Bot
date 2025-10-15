const db = require('../database/database');
const { v4: uuidv4 } = require('uuid');
const llmService = require('./llmService');

// A simple logger for better terminal output
const log = (level, message, data = '') => {
  console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, data);
};

// --- Promise-based Database Functions ---
// Modernizing DB calls to use async/await for cleaner code.
const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        log('error', 'Database RUN operation failed', { sql, error: err.message });
        reject(err);
      }
      resolve(this);
    });
  });
};

const dbGet = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        log('error', 'Database GET operation failed', { sql, error: err.message });
        reject(err);
      }
      resolve(row);
    });
  });
};

const dbAll = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        log('error', 'Database ALL operation failed', { sql, error: err.message });
        reject(err);
      }
      resolve(rows);
    });
  });
};

// --- Core Service Functions ---

const startNewSession = async () => {
  const sessionId = uuidv4();
  await dbRun('INSERT INTO sessions (sessionId) VALUES (?)', [sessionId]);
  log('info', 'New session started', { sessionId });
  return sessionId;
};

/**
 * Handles the escalation process by summarizing the chat and logging it.
 * @returns {Promise<string>} The user-facing escalation message.
 */
const handleEscalation = async (sessionId, history) => {
  log('warn', 'Escalation triggered', { sessionId });
  const summary = await llmService.summarizeConversation(history);
  log('info', 'Conversation summary for agent:', { sessionId, summary });
  // In a real application, this summary would be saved to a ticketing system (e.g., Zendesk, Jira).
  return "I'm sorry, I'm not able to resolve this issue. I am escalating your request to a human support agent. They will have a summary of our conversation and will get in touch with you shortly.";
};

const processUserMessage = async (sessionId, userMessage) => {
  try {
    const session = await dbGet('SELECT sessionId FROM sessions WHERE sessionId = ?', [sessionId]);
    if (!session) {
      throw new Error('Invalid session ID.');
    }

    await dbRun('INSERT INTO messages (sessionId, sender, content) VALUES (?, ?, ?)', [sessionId, 'user', userMessage]);

    const history = await dbAll("SELECT (CASE sender WHEN 'user' THEN 'user' WHEN 'ai' THEN 'assistant' END) as role, content FROM messages WHERE sessionId = ? ORDER BY timestamp ASC", [sessionId]);

    // --- New Intelligent Logic Flow ---
    const intent = await llmService.classifyIntent(userMessage, history);
    const sentiment = await llmService.analyzeSentiment(userMessage);
    log('info', 'Message classified', { sessionId, intent, sentiment });

    let aiResponse = '';

    // Route the conversation based on the classified intent
    switch (intent) {
      case 'GREETING':
        aiResponse = "Hello! How can I help you today?";
        break;

      case 'REQUEST_FOR_HUMAN':
        aiResponse = await handleEscalation(sessionId, history);
        break;

      case 'COMPLAINT':
      case 'negative_sentiment_escalation': // Custom case if sentiment is negative
        if (sentiment === 'negative') {
            log('warn', 'Negative sentiment detected, escalating proactively.', { sessionId });
            aiResponse = await handleEscalation(sessionId, history);
            break;
        }
        // Fallthrough for non-negative complaints
      case 'FAQ_QUESTION':
        const answer = await llmService.getAnswer(userMessage, history);
        if (answer.includes('[ESCALATE]')) {
          aiResponse = await handleEscalation(sessionId, history);
        } else {
          aiResponse = answer;
        }
        break;
      
      case 'CHITCHAT':
      case 'UNKNOWN':
      default:
        aiResponse = "I can only assist with questions about our products, shipping, and policies. How can I help you with those topics?";
        break;
    }

    await dbRun('INSERT INTO messages (sessionId, sender, content) VALUES (?, ?, ?)', [sessionId, 'ai', aiResponse]);
    return aiResponse;

  } catch (error) {
    log('error', 'Error processing user message', { sessionId, error: error.message });
    return "I'm sorry, an unexpected error occurred. Please try again in a moment.";
  }
};

module.exports = {
  startNewSession,
  processUserMessage,
};