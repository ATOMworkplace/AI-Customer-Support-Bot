import React, { useEffect, useRef } from 'react';
import Message from './Message';

function ChatWindow({ messages, isLoading }) {
  const chatWindowRef = useRef(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="chat-window" ref={chatWindowRef}>
      {messages.map((msg, index) => (
        <Message key={index} sender={msg.sender} text={msg.text} />
      ))}
      {isLoading && (
        <div className="message ai-message typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;