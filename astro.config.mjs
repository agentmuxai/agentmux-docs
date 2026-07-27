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
					'shell.rs':                    'agentmux-srv/src/backend/blockcontroller/shell.rs',
					'data_paths.rs':               'agentmux-common/src/data_paths.rs',
					'runtime_mode.rs':             'agentmux-common/src/runtime_mode.rs',
					'srv_spawner.rs':              'agentmux-launcher/src/srv_spawner.rs',
					'launcher/main.rs':            'agentmux-launcher/src/main.rs',
					'shellintegration.rs':         'agentmux-srv/src/backend/shellintegration.rs',
					'bash.sh':                     'agentmux-srv/src/backend/shellintegration/bash.sh',
					'pwsh.ps1':                    'agentmux-srv/src/backend/shellintegration/pwsh.ps1',
					'websocket.rs':                'agentmux-srv/src/server/websocket.rs',
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
		'/the-forge': '/memory',
		'/trust-center': '/armory',
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
				// Re-apply sidebar scroll after full parse. Starlight's inline script sets
				// scrollTop mid-parse (before sidebar HTML is complete), so scrollHeight is
				// too small and the assignment gets clamped. DOMContentLoaded fires after
				// the full sidebar is in the DOM, giving the correct scrollHeight.
				{
					tag: 'script',
					content: `document.addEventListener('DOMContentLoaded',function(){var s=document.getElementById('starlight__sidebar'),p=document.querySelector('sl-sidebar-state-persist');if(!s)return;if(matchMedia('(min-width: 50em)').matches){try{var d=JSON.parse(sessionStorage.getItem('sl-sidebar-state')||'null');if(d&&p&&d.hash===p.dataset.hash&&typeof d.scroll==='number')s.scrollTop=d.scroll;}catch(e){}}s.classList.add('sl-scroll-ready');});`,
				},
				// Header reveal — masks the first-load header reflow caused by the
				// AgentMux browser pane briefly initializing at a narrower width
				// (<50rem) before expanding to its final desktop width (confirmed
				// live: search button jumps from left:623 at 686px to left:324 once
				// the pane settles at ~1586px). CSS hides .header by default
				// (:not(.sl-header-ready)); this script reveals it once resizing has
				// been quiet for 60ms, so the reflow always finishes off-screen
				// first. The resize listener attaches immediately (not gated on
				// DOMContentLoaded) so an early resize — before the DOM is even
				// parsed — is still tracked; a 500ms safety net guarantees the
				// header is never left hidden if resize events don't fire as
				// expected. Deliberately JS-driven rather than a fixed-duration CSS
				// animation: a `prefers-reduced-motion`-gated animation (the
				// original #81 fix, and this fix's first draft) never activates at
				// all for a `reduce` preference, silently leaving the jerk
				// unmasked — confirmed live in this exact environment
				// (`matchMedia('(prefers-reduced-motion: reduce)').matches` is
				// true here). Hiding/revealing via a class toggle isn't "motion",
				// so it works regardless of that preference; the optional fade
				// transition (custom.css) is separately gated on
				// prefers-reduced-motion so only the cosmetic smoothing — not the
				// masking itself — is skipped for reduced-motion users.
				{
					tag: 'script',
					content: `(function(){var r=0,start=Date.now();window.addEventListener('resize',function(){r=Date.now();});document.addEventListener('DOMContentLoaded',function(){var hs=document.querySelectorAll('.header');if(!hs.length)return;function ready(){hs.forEach(function(h){h.classList.add('sl-header-ready');});}function check(){var now=Date.now(),sinceResize=r===0?1e9:now-r,sinceStart=now-start;if(sinceStart>=80&&sinceResize>=60){ready();}else{setTimeout(check,20);}}check();setTimeout(ready,500);});})();`,
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
								{ label: 'Armory', slug: 'armory' },
								{ label: 'Bundle Format (ABF)', slug: 'abf' },
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
