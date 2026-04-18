import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: false,
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  server: {
    host: true,
    port: 11999,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:11888',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('echarts')) return 'vendor-echarts';
          if (/node_modules[\\/](vue|vue-router|pinia)[\\/]/.test(id)) return 'vendor-vue';
          if (
            /node_modules[\\/](element-plus|@floating-ui|async-validator|dayjs|lodash-es)[\\/]/.test(id)
          ) {
            if (
              /element-plus[\\/]es[\\/]components[\\/](date-picker|time-picker|time-select|calendar|table|input-number|slider|tree-select)/.test(
                id,
              )
            ) {
              return 'vendor-ui-heavy';
            }
            return 'vendor-ui';
          }
          // Keep other deps in Rollup default split behavior.
          return;
        },
      },
    },
  },
});
