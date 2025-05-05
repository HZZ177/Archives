/// <reference types="vite/client" />

// CSS模块声明
declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// 图片文件声明
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
} 