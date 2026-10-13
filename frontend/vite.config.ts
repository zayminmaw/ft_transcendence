import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const aliases = Object.fromEntries(
		['app', 'hooks', 'services', 'utils', 'modules'].map((folder) => [
			`@${folder}`,
			fileURLToPath(new URL(`./src/${folder}`, import.meta.url)),
		]),
	);
	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				...aliases,
				'@global-components': fileURLToPath(
					new URL('./src/global-components', import.meta.url),
				),
			},
		},
		server: {
			port: 5173,
			strictPort: true,
			watch: {
				usePolling: env.WATCH_USE_POLLING === 'true',
			},
			proxy: {
				'/api': {
					target: env.API_PROXY_TARGET || 'http://localhost:3000',
					changeOrigin: true,
				},
			},
		},
	};
});
