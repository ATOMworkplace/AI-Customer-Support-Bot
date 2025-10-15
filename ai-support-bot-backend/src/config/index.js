const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  llm: {
    apiKey: process.env.LLM_API_KEY,
    apiEndpoint: process.env.LLM_API_ENDPOINT,
  },
  databasePath: './chat_sessions.db'
};