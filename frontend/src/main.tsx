import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// 创建根节点
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// 渲染应用
root.render(
  /*
  不能开启严格模式，否则会导致react-beautiful-dnd无法正常工作
  */
  //<React.StrictMode>
    <App />
  //</React.StrictMode>
); 