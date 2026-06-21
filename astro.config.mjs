// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	markdown: {},
	redirects: {
		'/architecture-overview': '/internals/architecture',
		'/reducer-stack': '/internals/reducer-stack',
		'/wrr': '/internals/wrr',
		'/persistence': '/internals/persistence',
		'/platform-support': '/internals/platform-support',
		'/building': '/internals/building',
		'/debugging': '/internals/debugging',
		'/contributing': '/internals/contributing',
		'/agent-app-api': '/internals/agent-app-api',
		'/interpane-comms': '/internals/interagent-comms',
		'/internals/interpane-comms': '/internals/interagent-comms',
		'/the-forge': '/memory',
	},
	integrations: [
		starlight({
			title: 'AgentMux Docs',
			logo: {
				src: './src/assets/logo.svg',
				alt: 'AgentMux',
			},
			components: {
				SiteTitle: './src/components/SiteTitle.astro',
			},
			head: [
				{ tag: 'meta', attrs: { name: 'color-scheme', content: 'dark light' } },
				{ tag: 'style', content: ':root{background:#0a0a0f}@media(prefers-color-scheme:light){:root{background:#f1f5f9}}' },
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '32x32' } },
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' } },
				// Re-apply sidebar scroll after full parse. Starlight's inline script sets
				// scrollTop mid-parse (before sidebar HTML is complete), so scrollHeight is
				// too small and the assignment gets clamped. DOMContentLoaded fires after
				// the full sidebar is in the DOM, giving the correct scrollHeight.
				{
					tag: 'script',
					content: `document.addEventListener('DOMContentLoaded',function(){var s=document.getElementById('starlight__sidebar'),p=document.querySelector('sl-sidebar-state-persist');if(!s)return;if(matchMedia('(min-width: 50em)').matches){try{var d=JSON.parse(sessionStorage.getItem('sl-sidebar-state')||'null');if(d&&p&&d.hash===p.dataset.hash&&typeof d.scroll==='number')s.scrollTop=d.scroll;}catch(e){}}s.classList.add('sl-scroll-ready');});`,
				},
			],
			customCss: ['./src/styles/custom.css'],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/agentmuxai/agentmux' },
				{ icon: 'discord', label: 'Discord', href: 'https://discord.com/invite/96erama9Ar' },
			],
			sidebar: [
				{
					label: 'User Guide',
					collapsed: false,
					items: [
						{ label: 'Overview', slug: 'user-guide' },
						{
							label: 'Getting Started',
							items: [
								{ label: 'Introduction', slug: 'getting-started' },
								{ label: 'Installation', slug: 'installation' },
								{ label: 'Quickstart', slug: 'quickstart' },
								{ label: 'First Agent Setup', slug: 'first-agent' },
							],
						},
						{
							label: 'Features',
							items: [
								{ label: 'Pane Types', slug: 'pane-types' },
								{ label: 'Browser pane', slug: 'browser-pane' },
								{ label: 'Trust Center', slug: 'trust-center' },
								{ label: 'Memory bundles', slug: 'memory' },
								{ label: 'Identity bundles', slug: 'identity' },
								{ label: 'Subagent Watcher', slug: 'subagent-watcher' },
								{ label: 'Running multiple instances', slug: 'multi-instance' },
								{ label: 'LAN discovery', slug: 'lan-discovery' },
								{ label: 'Warden widget', slug: 'warden' },
								{ label: 'Window appearance', slug: 'window-appearance' },
							],
						},
						{
							label: 'Configuration',
							items: [
								{ label: 'Settings reference', slug: 'settings' },
								{ label: 'Configuration guide', slug: 'config' },
								{ label: 'Main menu & command palette', slug: 'main-menu' },
								{ label: 'Keybindings', slug: 'keybindings' },
								{ label: 'Auth flows', slug: 'auth' },
								{ label: 'System Metrics', slug: 'system-metrics' },
							],
						},
						{
							label: 'Help',
							items: [
								{ label: 'Report Issues', slug: 'report-issues' },
							],
						},
					],
				},
				{
					label: 'Security & posture',
					collapsed: false,
					items: [
						{ label: 'Trust model', slug: 'security/trust-model' },
						{ label: 'Data sovereignty', slug: 'security/data-sovereignty' },
						{ label: 'Identity & credential storage', slug: 'security/identity-credential-storage' },
						{ label: 'Network exposure', slug: 'security/network-exposure' },
						{ label: 'Reactive event bus', slug: 'security/reactive-event-bus' },
						{ label: 'Update model', slug: 'security/update-model' },
					],
				},
				{
					label: 'Internals',
					collapsed: false,
					items: [
						{ label: 'Overview', slug: 'internals' },
						{
							label: 'Architecture',
							items: [
								{ label: 'Architecture overview', slug: 'internals/architecture' },
								{ label: 'The reducer stack', slug: 'internals/reducer-stack' },
								{ label: 'Frontend state model', slug: 'internals/state-model' },
								{ label: 'IPC catalog', slug: 'internals/ipc-catalog' },
								{ label: 'Environment variable contract', slug: 'internals/env-vars' },
								{ label: 'Window Reality Reconciliation', slug: 'internals/wrr' },
								{ label: 'Persistence', slug: 'internals/persistence' },
								{ label: 'Modal system', slug: 'internals/modal-system' },
								{ label: 'Error catalog', slug: 'internals/error-catalog' },
								{ label: 'Clipboard & export', slug: 'internals/clipboard' },
								{ label: 'Zoom system', slug: 'internals/zoom' },
								{ label: 'Interagent event bus', slug: 'internals/interagent-comms' },
								{ label: 'Agent pane virtualization', slug: 'internals/agent-pane-virtualization' },
								{ label: 'LAN discovery', slug: 'internals/lan-discovery' },
								{ label: 'Warden architecture', slug: 'internals/warden' },
								{ label: 'Data layout', slug: 'internals/data-layout' },
								{ label: 'Platform support', slug: 'internals/platform-support' },
							],
						},
						{
							label: 'Building',
							items: [
								{ label: 'Building from source', slug: 'internals/building' },
								{ label: 'Debugging', slug: 'internals/debugging' },
								{ label: 'Terminal latency benchmark', slug: 'internals/terminal-latency-benchmark' },
								{ label: 'Contributing', slug: 'internals/contributing' },
							],
						},
						{
							label: 'API reference',
							items: [
								{ label: 'Agent App API', slug: 'internals/agent-app-api' },
								// Generated reference indexes — produced by
								// `npm run build:typedoc` (writes into
								// src/content/docs/api/typescript/) and
								// `npm run build:rust-docs` (writes into
								// public/api/rust/). Both opt-in via
								// `npm run build:full`; default `build` skips
								// them so the docs site iterates without the
								// Rust toolchain or a long typedoc pass.
								{
									label: 'TypeScript API',
									link: '/api/typescript/',
									badge: { text: 'typedoc', variant: 'note' },
								},
								{
									label: 'Rust Crates',
									link: '/api/rust/',
									badge: { text: 'rustdoc', variant: 'note' },
								},
							],
						},
					],
				},
				{ label: 'Glossary', slug: 'glossary' },
			],
		}),
	],
});
