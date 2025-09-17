import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#1976d2', textAlign: 'center' }}>
        🚀 Email Assist 测试页面
      </h1>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <p>如果你能看到这个页面，说明React应用已经正常启动！</p>
        <button 
          style={{
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => alert('按钮点击成功！')}
        >
          测试按钮
        </button>
      </div>
    </div>
  );
};

export default App;