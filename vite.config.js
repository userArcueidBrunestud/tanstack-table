import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,         // 自定义端口
    open: true,         // 自动打开浏览器
  },
  build: {
    outDir: 'dist',     // 打包输出目录
  },
});