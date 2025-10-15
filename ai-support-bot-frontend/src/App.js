import { useState, useEffect } from 'react';
import axios from 'axios';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import './App.css';

const API_BASE_URL = 'http://localhost:8000/api/chat';

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scenario, setScenario] = useState('');
  const [chatActive, setChatActive] = useState(false);
  const [error, setError] = useState('');

  const handleStartChat = async () => {
    if (!scenario) {
      setError('Please select a scenario to begin.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/start`, { scenario });
      setSessionId(response.data.sessionId);
      setMessages([{ sender: 'ai', text: `Hello! Welcome. How can I help you today?` }]);
      setChatActive(true);
    } catch (err) {
      console.error('Error starting session:', err);
      setError('Could not start chat session. Please ensure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (userMessage) => {
    if (!sessionId) return;

    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/message`, {
        sessionId: sessionId,
        message: userMessage,
      });
      setMessages(prev => [...prev, { sender: 'ai', text: response.data.reply }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { sender: 'ai', text: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!chatActive) {
    return (
      <div className="scenario-container">
        <div className="scenario-box">
          <h2>Select a Support Scenario</h2>
          <p>Choose a persona for the AI bot to simulate different customer support contexts.</p>
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
            <option value="">-- Choose a scenario --</option>
            <option value="luxury_watches">Luxury Watch Retailer</option>
            <option value="fast_fashion">Fast-Fashion Streetwear Brand</option>
            <option value="organic_grocery">Organic Grocery Delivery</option>
            <option value="premium_fitness">Premium Boutique Gym</option>
            <option value="luxury_travel">Exclusive Travel Agency</option>
          </select>
          <button onClick={handleStartChat} disabled={isLoading}>
            {isLoading ? 'Starting...' : 'Start Chat'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="chat-header">
        <h2>AI Support Bot</h2>
      </div>
      <ChatWindow messages={messages} isLoading={isLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}

export default App;