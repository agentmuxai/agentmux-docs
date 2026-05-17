// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
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
			head: [
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '32x32' } },
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' } },
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
								{ label: 'Memory bundles', slug: 'memory' },
								{ label: 'Identity bundles', slug: 'identity' },
								{ label: 'Subagent Watcher', slug: 'subagent-watcher' },
								{ label: 'Running multiple instances', slug: 'multi-instance' },
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
								{ label: 'Window Reality Reconciliation', slug: 'internals/wrr' },
								{ label: 'Persistence', slug: 'internals/persistence' },
								{ label: 'Modal system (modal-v2)', slug: 'internals/modal-system' },
								{ label: 'Interagent event bus', slug: 'internals/interagent-comms' },
								{ label: 'Agent pane virtualization', slug: 'internals/agent-pane-virtualization' },
								{ label: 'Data layout', slug: 'internals/data-layout' },
								{ label: 'Platform support', slug: 'internals/platform-support' },
							],
						},
						{
							label: 'Building',
							items: [
								{ label: 'Building from source', slug: 'internals/building' },
								{ label: 'Debugging', slug: 'internals/debugging' },
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
