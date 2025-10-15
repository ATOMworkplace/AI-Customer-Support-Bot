const chatService = require('../../services/chatService');

const startChat = async (req, res) => {
  try {
    const { scenario } = req.body;
    if (!scenario) {
      return res.status(400).json({ error: 'Scenario is required.' });
    }
    const sessionId = await chatService.startNewSession(scenario);
    res.status(201).json({ sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const postMessage = async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required.' });
  }

  try {
    const reply = await chatService.processUserMessage(sessionId, message);
    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  startChat,
  postMessage,
};