const db = require('../database/database');
const { v4: uuidv4 } = require('uuid');
const llmService = require('./llmService');
const scenarios = require('../data/scenarios.json');

const log = (level, message, data = '') => {
  console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, data);
};

const dbRun = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) { log('error', 'DB RUN Error', { sql, err }); reject(err); }
    else resolve(this);
  });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) { log('error', 'DB GET Error', { sql, err }); reject(err); }
    else resolve(row);
  });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) { log('error', 'DB ALL Error', { sql, err }); reject(err); }
    else resolve(rows);
  });
});

const startNewSession = async (scenario) => {
  const sessionId = uuidv4();
  await dbRun('INSERT INTO sessions (sessionId, scenario) VALUES (?, ?)', [sessionId, scenario]);
  log('info', 'New session started', { sessionId, scenario });
  return sessionId;
};

const handleEscalation = async (sessionId, history, context) => {
  log('warn', 'Escalation triggered', { sessionId });
  const summary = await llmService.summarizeConversation(history, context);
  log('info', 'Conversation summary for agent:', { sessionId, summary });
  await dbRun("UPDATE sessions SET state = 'IDLE', context = '{}' WHERE sessionId = ?", [sessionId]);
  return "I've gathered the necessary details. I am now escalating your request to a human support agent. They will have a summary of our conversation and will get in touch with you shortly.";
};

const processUserMessage = async (sessionId, userMessage) => {
  try {
    const session = await dbGet('SELECT * FROM sessions WHERE sessionId = ?', [sessionId]);
    if (!session) throw new Error('Invalid session ID.');
    
    const { scenario, state } = session;
    let context = JSON.parse(session.context);

    await dbRun('INSERT INTO messages (sessionId, sender, content) VALUES (?, ?, ?)', [sessionId, 'user', userMessage]);
    
    if (state !== 'IDLE') {
      let aiResponse = '';
      switch (state) {
        case 'AWAITING_ORDER_NUMBER':
          context.orderNumber = userMessage;
          await dbRun("UPDATE sessions SET state = ?, context = ? WHERE sessionId = ?", ['AWAITING_ISSUE_DESCRIPTION', JSON.stringify(context), sessionId]);
          aiResponse = "Thank you for providing the order number. Now, please briefly describe the issue you are experiencing.";
          break;
        case 'AWAITING_ISSUE_DESCRIPTION':
          context.issueDescription = userMessage;
          const historyForEscalation = await dbAll("SELECT (CASE sender WHEN 'user' THEN 'user' WHEN 'ai' THEN 'assistant' END) as role, content FROM messages WHERE sessionId = ? ORDER BY timestamp ASC", [sessionId]);
          aiResponse = await handleEscalation(sessionId, historyForEscalation, context);
          break;
        default:
          await dbRun("UPDATE sessions SET state = 'IDLE', context = '{}' WHERE sessionId = ?", [sessionId]);
          aiResponse = "It seems we were in the middle of something, but let's start over. How can I help?";
      }
      await dbRun('INSERT INTO messages (sessionId, sender, content) VALUES (?, ?, ?)', [sessionId, 'ai', aiResponse]);
      return aiResponse;
    }

    const history = await dbAll("SELECT (CASE sender WHEN 'user' THEN 'user' WHEN 'ai' THEN 'assistant' END) as role, content FROM messages WHERE sessionId = ? ORDER BY timestamp ASC", [sessionId]);
    const intent = await llmService.classifyIntent(userMessage, history);
    const sentiment = await llmService.analyzeSentiment(userMessage);
    log('info', 'Message classified', { sessionId, scenario, intent, sentiment });

    let aiResponse = '';
    switch (intent) {
      case 'GREETING':
        aiResponse = "Hello! How can I assist you today?";
        break;

      case 'REQUEST_FOR_HUMAN':
        aiResponse = await handleEscalation(sessionId, history, context);
        break;
      
      case 'SUMMARIZE_CONVERSATION':
        log('info', 'User requested summarization.', { sessionId });
        aiResponse = await llmService.summarizeConversation(history, context);
        await dbRun('INSERT INTO messages (sessionId, sender, content) VALUES (?, ?, ?)', [sessionId, 'ai', aiResponse]);
        return aiResponse;

      case 'COMPLAINT':
        if (sentiment === 'negative') {
          log('warn', 'Negative sentiment detected in complaint, starting triage.', { sessionId });
          await dbRun("UPDATE sessions SET state = 'AWAITING_ORDER_NUMBER' WHERE sessionId = ?", [sessionId]);
          aiResponse = "I'm very sorry to hear you're having an issue. To help resolve this quickly, could you please provide your order number?";
        } else {
          const answer = await llmService.getGeneralResponse(userMessage, history, scenario);
          aiResponse = answer;
        }
        break;

      case 'FAQ_QUESTION':
        const matchedQuestion = await llmService.findRelevantFAQ(userMessage, scenario);
        if (matchedQuestion && matchedQuestion !== 'NONE') {
          log('info', 'Found relevant FAQ', { sessionId, matchedQuestion });
          const faqEntry = scenarios[scenario].faqs.find(f => f.question === matchedQuestion);
          if (faqEntry) {
            aiResponse = await llmService.getAnswerFromContext(userMessage, faqEntry, scenario);
          } else {
            log('error', 'LLM returned a question that does not exist in the FAQ list', { matchedQuestion });
            aiResponse = await llmService.getGeneralResponse(userMessage, history, scenario);
          }
        } else {
          log('info', 'No relevant FAQ found. Switching to general response.', { sessionId });
          aiResponse = await llmService.getGeneralResponse(userMessage, history, scenario);
        }
        break;
      
      case 'CHITCHAT':
      case 'UNKNOWN':
      default:
        aiResponse = await llmService.getGeneralResponse(userMessage, history, scenario);
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