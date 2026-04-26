import { defineConfig, loadEnv } from 'vite';
import { dataPlugin } from './plugins/vite-plugin-data';

export default defineConfig(({ mode }) => {
  // Load .env / .env.local into process.env so the data plugin can read them
  // in configResolved. Shell-exported vars take precedence over .env files.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['RESULTS_CSV', 'PARAMS_CSV', 'EVENTS_CSV']) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }

  return {
    base: './',
    plugins: [dataPlugin()],
    build: {
      outDir: 'dist',
      assetsInlineLimit: 0,
      sourcemap: mode === 'development',
      emptyOutDir: true,
    },
  };
});
