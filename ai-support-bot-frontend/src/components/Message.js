import React from 'react';

function Message({ sender, text }) {
  const messageClass = sender === 'user' ? 'user-message' : 'ai-message';

  return (
    <div className={`message ${messageClass}`}>
      {text}
    </div>
  );
}

export default Message;