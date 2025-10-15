import { useState, useEffect } from 'react';
import axios from 'axios';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import './App.css';

const API_BASE_URL = 'http://localhost:8000/api/chat';

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startNewSession = async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/start`);
        setSessionId(response.data.sessionId);
        setMessages([{ sender: 'ai', text: 'Hello! How can I help you today?' }]);
      } catch (error) {
        console.error('Error starting session:', error);
        setMessages([{ sender: 'ai', text: 'Sorry, I cannot connect to the chat service.' }]);
      } finally {
        setIsLoading(false);
      }
    };
    startNewSession();
  }, []);

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