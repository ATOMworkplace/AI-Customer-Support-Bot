import React, { useState } from 'react';

function ChatInput({ onSendMessage, isLoading }) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input-form">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type your message..."
        autoComplete="off"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        ➤
      </button>
    </form>
  );
}

export default ChatInput;