// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkGithubSourceLinks from './plugins/remark-github-source-links.mjs';
import rehypeGithubSourceTable from './plugins/rehype-github-source-table.mjs';

export default defineConfig({
	markdown: {
		remarkPlugins: [
			[remarkGithubSourceLinks, {
				baseUrl: 'https://github.com/agentmuxai/agentmux/blob/main/',
				// Short-name aliases used across docs (defined in internals/env-vars.md preamble)
				aliases: {
					// Rust / shell (env-vars page)
					'shell.rs':                    'crates/srv/src/backend/blockcontroller/shell/lifecycle.rs',
					'data_paths.rs':               'crates/common/src/data_paths.rs',
					'runtime_mode.rs':             'crates/common/src/runtime_mode.rs',
					'srv_spawner.rs':              'crates/launcher/src/srv_spawner.rs',
					'launcher/main.rs':            'crates/launcher/src/main.rs',
					'shellintegration.rs':         'crates/srv/src/backend/shellintegration.rs',
					'bash.sh':                     'crates/srv/src/backend/shellintegration/bash.sh',
					'pwsh.ps1':                    'crates/srv/src/backend/shellintegration/pwsh.ps1',
					'websocket.rs':                'crates/srv/src/server/websocket.rs',
					// Layout model (state-model page)
					'layoutModel.ts':              'frontend/layout/lib/layoutModel.ts',
					'layoutTree.ts':               'frontend/layout/lib/layoutTree.ts',
					'layoutFocus.ts':              'frontend/layout/lib/layoutFocus.ts',
					'layoutPersistence.ts':        'frontend/layout/lib/layoutPersistence.ts',
					'layoutAtom.ts':               'frontend/layout/lib/layoutAtom.ts',
					'layoutNodeModels.ts':         'frontend/layout/lib/layoutNodeModels.ts',
					// Agent-pane-state store (state-model page §3)
					'types.ts':                    'frontend/app/store/agent-pane-state/types.ts',
					'reducer.ts':                  'frontend/app/store/agent-pane-state/reducer.ts',
					'browser-pane-state-store.ts': 'frontend/app/store/browser-pane-state-store.ts',
					'editor-pane-state-store.ts':  'frontend/app/store/editor-pane-state-store.ts',
					// Block rendering (state-model page §4–5)
					'autotitle.ts':                'frontend/app/block/autotitle.ts',
					'blockframe.tsx':              'frontend/app/block/blockframe.tsx',
					'blocktypes.ts':               'frontend/app/block/blocktypes.ts',
					'block.scss':                  'frontend/app/block/block.scss',
					'tabbar.tsx':                  'frontend/app/tab/tabbar.tsx',
					// Global store / type defs
					'global.ts':                   'frontend/app/store/global.ts',
					'wos.ts':                      'frontend/app/store/wos.ts',
					'gotypes.d.ts':                'frontend/types/gotypes.d.ts',
				},
				// Remap path prefixes: specs/ in docs → docs/specs/ in repo
				pathMap: {
					'specs/': 'docs/specs/',
				},
			}],
		],
		rehypePlugins: [
			// Must run after remarkGithubSourceLinks so it can detect the <a> tags
			rehypeGithubSourceTable,
		],
	},
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
		'/the-forge': '/bundles',
		'/knowledge': '/memory',
		'/trust-center': '/connectors',
		'/armory': '/connectors',
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
				Footer: './src/components/Footer.astro',
			},
			head: [
				{ tag: 'meta', attrs: { name: 'color-scheme', content: 'dark light' } },
				{ tag: 'style', content: ':root{background:#0a0a0f}@media(prefers-color-scheme:light){:root{background:#f1f5f9}}' },
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '32x32' } },
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' } },
				// Don't paint a page until its content has been parsed (#sl-content-end, in
				// Footer.astro). On a network load Chromium otherwise paints the header with
				// an empty content area for a frame, which reads as a flash on every first
				// visit to a page. Standard render-blocking (`rel=expect`); browsers without
				// it ignore the link, and it unblocks anyway when parsing ends.
				{ tag: 'link', attrs: { rel: 'expect', href: '#sl-content-end', blocking: 'render' } },
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
								{ label: 'Widget gallery', slug: 'widget-gallery' },
								{ label: 'Your own widgets', slug: 'widgets' },
								{ label: 'Build a widget', slug: 'build-a-widget' },
								{ label: 'Widget API reference', slug: 'widget-api' },
								{ label: 'Browser pane', slug: 'browser-pane' },
								{ label: 'Connectors', slug: 'connectors' },
								{ label: 'Memory', slug: 'memory' },
								{ label: 'Bundles', slug: 'bundles' },
								{ label: 'Bundle Format (ABF)', slug: 'abf' },
								{ label: 'Identity & Accounts', slug: 'identity' },
								{ label: 'Subagent Watcher', slug: 'subagent-watcher' },
								{ label: 'Running multiple instances', slug: 'multi-instance' },
								{ label: 'LAN discovery', slug: 'lan-discovery' },
								{ label: 'Warden widget', slug: 'warden' },
								{ label: 'Tower', slug: 'tower' },
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
						{ label: 'Widget security', slug: 'security/widgets' },
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
								{ label: 'Provider CLI integration', slug: 'internals/provider-cli-integration' },
								{ label: 'Conversation overhead', slug: 'internals/conversation-overhead' },
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
