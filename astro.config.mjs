// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'AgentMux Docs',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/agentmuxai/agentmux' },
				{ icon: 'discord', label: 'Discord', href: 'https://discord.com/invite/96erama9Ar' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started' },
						{ label: 'Installation', slug: 'installation' },
						{ label: 'First Agent Setup', slug: 'first-agent' },
						{ label: 'Quickstart', slug: 'quickstart' },
					],
				},
				{
					label: 'Features',
					items: [
						{ label: 'Pane Types', slug: 'pane-types' },
						{ label: 'The Forge', slug: 'the-forge' },
						{ label: 'Interpane Comms', slug: 'interpane-comms' },
						{ label: 'Subagent Watcher', slug: 'subagent-watcher' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Configuration', slug: 'config' },
						{ label: 'Keybindings', slug: 'keybindings' },
						{ label: 'Settings', slug: 'settings' },
						{ label: 'Agent App API', slug: 'agent-app-api' },
						{ label: 'System Metrics', slug: 'system-metrics' },
					],
				},
				{
					label: 'Development',
					items: [
						{ label: 'Building', slug: 'building' },
						{ label: 'Contributing', slug: 'contributing' },
					],
				},
			],
		}),
	],
});
