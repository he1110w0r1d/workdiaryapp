import React from 'react';

const AIAssistant = () => {
  // 使用正确的Dify聊天机器人URL（包含端口号11333）
  const difyUrl = 'http://192.168.1.168:11333/chatbot/qzCIz0zlJscVJk1G';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '16px' }}>
        <iframe
          src={difyUrl}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '700px',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          title="AI Assistant"
          frameBorder="0"
          allow="microphone"
        />
      </div>
    </div>
  );
};

export default AIAssistant;