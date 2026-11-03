---
title: IPC catalog
description: Every inter-process channel in AgentMux — transport, direction, authentication, and the bearer-token leak surface.
---

**Checked against:** 0.60.10  
**Host command list checked:** 2026-11-01  
**Security sweep:** 2026-06-12 (the findings in section 16 date from it)  

This document catalogs every inter-process channel in AgentMux, their wire contracts, authentication models, and security properties observed in the Sweep 2026-06-12. It is intended as both a developer reference and a security audit anchor point.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Channel Summary Table](#2-channel-summary-table)
3. [Channel A: Renderer → Host Local IPC (HTTP)](#3-channel-a-renderer--host-local-ipc-http)
4. [Channel B: Host → Renderer Event Push (CEF JS Bridge)](#4-channel-b-host--renderer-event-push-cef-js-bridge)
5. [Channel C: Host ↔ Launcher Named Pipe](#5-channel-c-host--launcher-named-pipe)
6. [Channel D: Host → Srv Named Pipe (Read-only Bridge)](#6-channel-d-host--srv-named-pipe-read-only-bridge)
7. [Channel E: Renderer ↔ Srv WebSocket (RPC)](#7-channel-e-renderer--srv-websocket-rpc)
8. [Channel F: Renderer → Srv HTTP Service](#8-channel-f-renderer--srv-http-service)
9. [Channel G: Browser DOM API (HTTP over IPC)](#9-channel-g-browser-dom-api-http-over-ipc)
10. [Channel H: OSC 16162 — Terminal Shell Integration Escape Sequences](#10-channel-h-osc-16162--terminal-shell-integration-escape-sequences)
11. [Channel I: Chromium Remote Debug Port (CDP)](#11-channel-i-chromium-remote-debug-port-cdp)
12. [IPC Token and Auth Key — Lifecycle and Leak Surface](#12-ipc-token-and-auth-key--lifecycle-and-leak-surface)
13. [Launcher ↔ Srv Named Pipe (Reducer Bus)](#13-launcher--srv-named-pipe-reducer-bus)
14. [Command/Event Domain Mixing in crates/common/src/ipc.rs](#14-commandevent-domain-mixing-in-cratescommonsrcipcrs)
15. [Environment Variable Contract](#15-environment-variable-contract)
16. [Security Findings Cross-Reference](#16-security-findings-cross-reference)

---

## 1. Architecture Overview

<img src="/diagrams/ipc-catalog.svg" alt="IPC architecture: launcher (top-left, purple) connects bidirectionally to cef (top-right) via Ch C named pipe, and to srv (bottom-left) via Ch 13. CEF connects to renderer via Ch D (read-only) and Ch A/B (bidirectional dashed). Srv connects to renderer via Ch E/F WebSocket." style="max-width:100%" />

**Process hierarchy** (production):

```
agentmux-launcher.exe  (owns Win32 Job Object J0)
  └── agentmux-cef.exe     (CEF host, IPC client)
        └── [CEF subprocesses: renderer, GPU, plugin]
  └── agentmux-srv.exe     (backend sidecar, HTTP/WS server)
```

---

## 2. Channel Summary Table

| ID | Name | Transport | Direction | Auth | Purpose |
|----|------|-----------|-----------|------|---------|
| A | Local IPC HTTP | `HTTP POST 127.0.0.1:<rnd>` | renderer→host | Bearer `ipc_token` | All host command dispatch |
| B | CEF JS event push | `frame.execute_javascript()` | host→renderer | none (same process trust) | Push typed events to frontend |
| C | Launcher named pipe / Unix socket | Named pipe (Win) / Unix socket | host↔launcher | none (OS pipe ownership) | Window state mirror, saga dispatch, WRR |
| D | Srv named pipe bridge | Named pipe (Win) / Unix socket | host←srv (read-only) | none (OS pipe ownership) | Forward srv reducer events to renderer |
| E | Srv WebSocket RPC | `WS ws://127.0.0.1:<rnd>/ws` | renderer↔srv | `?authkey=` query param (WS-only) | RPC commands, event bus subscription |
| F | Srv HTTP service | `HTTP POST 127.0.0.1:<rnd>/agentmux/service` | renderer→srv | `X-AuthKey` header | Object CRUD, tab/block/workspace ops |
| G | Browser DOM API | `HTTP POST 127.0.0.1:<rnd>/agentmux/browser/*` | renderer→host | Bearer `ipc_token` | CSS query, JS eval, screenshot, click, key in browser panes |
| H | OSC 16162 | Terminal escape sequence (PTY output) | shell→renderer | none (data in PTY stream) | Inject env keys into block metadata; configure poller |
| I | Chromium remote debug | HTTP/WS 127.0.0.1:9222 (prod) / 9223 (dev), or a free port. Off in release builds unless `AGENTMUX_CDP_PORT` turns it on | any local process→renderer | none | External CDP tooling and test harnesses. Not used by the Browser DOM API |
| 13 | Launcher↔Srv named pipe | Named pipe (Win) / Unix socket | launcher↔srv | none (OS pipe ownership) | Srv reducer Command/Event bus |

---

## 3. Channel A: Renderer → Host Local IPC (HTTP)

**Source:** `crates/cef/src/ipc.rs`

### Transport

Axum HTTP server bound to `127.0.0.1:0` (random ephemeral port). Port is written to `<data_dir>/ipc-port-<hash>` file as `<port>:<token>` after CEF init. File is owner-readable only on Unix (0600); no Windows DACL restriction on the port file itself (only on `authkey.dev`).

Routes:
- `POST /ipc` — main command handler (`ipc.rs`)
- `GET /health` — unauthenticated health check (`ipc.rs`)
- `POST /agentmux/browser/*` — Browser DOM API (see Channel G)

### Authentication

`Authorization: Bearer <ipc_token>` header required on `POST /ipc` (`ipc.rs`).  
`ipc_token` is a random UUID generated once per host process.

**Gap:** `CorsLayer::permissive()` is applied (`ipc.rs`), accepting any Origin header. Any web page that guesses or reads the port can make unauthenticated cross-origin preflight-exempt requests (OPTIONS is ignored by the auth check) and then authenticated ones if it has obtained the token.

### Wire Format

JSON body: `{"cmd": "<command_name>", "args": <JSON>}`  
Response: `{"success": bool, "data": <JSON>|null, "error": string|null}` always HTTP 200 (even for errors; frontend checks `success` field). (`ipc.rs`)

### Command Catalog

Every command the host handles is dispatched through `route_command` (`crates/cef/src/ipc.rs`). The catalog below is generated from it, not written by hand: `node scripts/gen-ipc-catalog.mjs --code <agentmux checkout> --page src/content/docs/internals/ipc-catalog.md --write` rewrites it, and the PR check fails when a pin bump leaves it different from the code.

<!-- ipc-catalog:begin (generated by scripts/gen-ipc-catalog.mjs from route_command; do not edit by hand) -->

This catalog is generated from the `match cmd` of `route_command` and from `is_stub_command`: 168 commands the host handles, and 11 names it accepts and ignores. The note is the comment directly above the command's arm in the code. **First call** is the first function the arm calls, leaving out library calls, tracing and precondition checks. It is where to start reading, not always the call that does the work: an arm that sets something up first (`browser_pane_create`) shows the setup call. Argument and return shapes are not listed: they are in the code the arm calls.

**Runs** says where the arm works: `inline` on the IPC request task, `async` when the arm awaits, `blocking` when it hops to a blocking thread (`spawn_blocking`). **Args** says whether the arm passes the request's arguments on.

#### Tier 1: Bootstrap (must work for frontend to load)

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `get_platform` | `commands::platform::get_platform` | inline | — |  |
| `get_window_system` | `commands::platform::get_window_system` | inline | — |  |
| `get_window_button_layout` | `commands::desktop_settings::get_window_button_layout` | inline | — |  |
| `get_auth_key` | in the arm | inline | — |  |
| `get_is_dev` | `commands::platform::get_is_dev` | inline | — |  |
| `get_zoom_factor` | `commands::window::get_zoom_factor` | inline | — |  |
| `get_about_modal_details` | `commands::platform::get_about_modal_details` | inline | — |  |
| `get_host_info` | `commands::platform::get_host_info` | inline | — |  |
| `get_backend_endpoints` | `commands::backend::get_backend_endpoints` | inline | — |  |
| `get_mux_init_opts` | `commands::backend::get_mux_init_opts` | inline | — |  |
| `set_window_init_status` | `commands::backend::set_window_init_status` | inline | yes |  |
| `report_first_paint` | `commands::backend::report_first_paint` | inline | yes |  |
| `fe_log` | `commands::backend::fe_log` | inline | yes |  |
| `fe_log_structured` | `commands::backend::fe_log_structured` | inline | yes |  |
| `fe_log_batch` | `commands::backend::fe_log_batch` | inline | yes |  |

#### Tier 2: Core functionality

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `get_backend_info` | `commands::backend::get_backend_info` | inline | — |  |
| `get_health_signals` | `health_signals::snapshot` | inline | — |  |
| `restart_backend` | `commands::backend::restart_backend` | async | — |  |
| `close_window` | `commands::window::close_window` | inline | yes |  |
| `quit_app` | `commands::window::quit_app` | inline | — | Issue #2977 Workstream 1 — the tray's "Quit AgentMux". Explicit, user-initiated shutdown that bypasses the background-service gate (see `quit_app`'s doc for why the ordinary last-window path and `Event::HostShouldQuit` both cannot serve here). |
| `open_panel` | `commands::window::open_panel` | inline | — | Issue #2977 WS3 — the tray panel: a small top-level window, pool-first. |
| `set_taskbar_attention` | `commands::taskbar_attention::set_taskbar_attention` | inline | yes | Settings UI → launcher auto-start verbs (SPEC_OS_NOTIFICATIONS_SYSTEM _2026_09_24 §4.1). Kept separate from background mode on purpose — tray spec §7.4. Taskbar badge + flash for "agents need you" (SPEC_OS_NOTIFICATIONS _SYSTEM_2026_09_24 Phase 4). |
| `autostart_status` | `commands::autostart::autostart_status` | async | — |  |
| `background_audit_take` | `background_audit::background_audit_take` | inline | — | Issue #2977 WS4 — hand the frontend whatever the background service did while no window was open, so it can tell the user. |
| `incidents_list` | `commands::incidents::incidents_list` | inline | — | What went wrong and what AgentMux did about it (SPEC_RECOVERY_NOTICES_AND_TOASTS §4.2). |
| `incident_acknowledge` | `commands::incidents::incident_acknowledge` | inline | yes |  |
| `minimize_window` | `commands::window::minimize_window` | inline | yes |  |
| `maximize_window` | `commands::window::maximize_window` | inline | yes |  |
| `toggle_floating_maximize` | `commands::window::toggle_floating_maximize` | inline | yes |  |
| `set_floating_always_on_top` | `commands::window::set_floating_always_on_top` | inline | yes |  |
| `set_zoom_factor` | `commands::window::set_zoom_factor` | inline | yes |  |
| `is_main_window` | `commands::window::is_main_window` | inline | yes |  |
| `get_window_label` | `commands::window::get_window_label` | inline | yes |  |
| `open_new_window` | `commands::window::open_new_window` | inline | yes |  |
| `open_restored_window` | `commands::window::open_restored_window` | inline | yes |  |
| `open_subwindow` | `commands::window::open_subwindow` | inline | yes |  |
| `recycle_begin` | `commands::recycle::recycle_begin` | async | yes | A window recycling its renderer (commands/recycle.rs): the old page begins it, the new one takes its cover picture while it boots. |
| `recycle_cancel` | `commands::recycle::recycle_cancel` | inline | yes |  |
| `recycle_declined` | `commands::recycle_governor::recycle_declined` | inline | yes |  |
| `take_reload_snapshot` | `commands::recycle::take_reload_snapshot` | inline | yes |  |
| `capture_window_viewport` | `browser_api::routes::capture_window_viewport` | async | yes |  |
| `open_floating_pane_window` | `commands::floating_pane::open_floating_pane_window` | blocking | yes |  |
| `get_pane_debug_state` | `commands::floating_pane::get_pane_debug_state` | inline | — |  |
| `debug:hang_ui` | `ui_tasks::post_hang_ui_thread` | inline | — |  |
| `get_instance_number` | `commands::window::get_instance_number` | inline | yes |  |
| `register_backend_window` | `commands::window::register_backend_window` | inline | yes |  |
| `get_env` | `commands::platform::get_env` | inline | yes |  |
| `open_external` | `commands::platform::open_external` | inline | yes |  |
| `reveal_in_file_explorer` | `commands::platform::reveal_in_file_explorer` | inline | yes |  |
| `show_open_file_dialog` | `commands::platform::show_open_file_dialog` | async | yes |  |
| `show_open_bundle_dialog` | `commands::platform::show_open_bundle_dialog` | async | yes |  |
| `show_save_layout_dialog` | `commands::platform::show_save_layout_dialog` | async | yes |  |
| `show_open_layout_dialog` | `commands::platform::show_open_layout_dialog` | async | yes |  |
| `set_window_transparency` | `commands::window::set_window_transparency` | inline | yes |  |
| `set_window_opacity` | `commands::window::set_window_opacity` | inline | yes |  |
| `get_window_opacity` | `commands::window::get_window_opacity` | async | yes |  |
| `start_window_drag` | `commands::window::start_window_drag` | inline | yes |  |
| `get_window_rect` | `commands::window::get_window_rect` | inline | yes |  |
| `set_window_rect` | `commands::window::set_window_rect` | inline | yes |  |
| `get_window_position` | `commands::window::get_window_position` | blocking | yes |  |
| `is_window_maximized` | `commands::window::is_window_maximized` | blocking | yes |  |
| `resolve_window_at_cursor` | `commands::window::resolve_window_at_cursor` | blocking | yes |  |
| `update_floating_redock_hover` | `commands::window::update_floating_redock_hover` | blocking | yes |  |
| `clear_floating_redock_hover` | `commands::window::clear_floating_redock_hover` | inline | yes |  |
| `set_floating_redock_target` | `commands::window::set_floating_redock_target` | inline | yes |  |
| `get_floating_redock_target` | `commands::window::get_floating_redock_target` | inline | yes |  |
| `move_window_by` | `commands::window::move_window_by` | inline | yes |  |
| `set_window_position` | `commands::window::set_window_position` | inline | yes |  |
| `toggle_devtools` | `commands::window::toggle_devtools` | inline | yes |  |
| `inspect_element_at` | `commands::window::inspect_element_at` | inline | yes |  |
| `begin_gpu_trace` | `commands::window::begin_gpu_trace` | inline | yes | Dev-only memory-infra GPU tracing (#2218 diagnostics) — see docs/specs/SPEC_GPU_MEMORY_TRACING_SCAFFOLDING_2026_07_24.md. |
| `end_gpu_trace` | `commands::window::end_gpu_trace` | inline | yes |  |
| `show_context_menu` | in the arm | inline | — |  |

#### Cross-window drag

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `start_cross_drag` | `commands::drag::start_cross_drag` | inline | yes |  |
| `update_cross_drag` | `commands::drag::update_cross_drag` | inline | yes |  |
| `complete_cross_drag` | `commands::drag::complete_cross_drag` | inline | yes |  |
| `cancel_cross_drag` | `commands::drag::cancel_cross_drag` | inline | yes |  |
| `claim_cross_drag_target` | `commands::drag::claim_cross_drag_target` | inline | yes |  |
| `get_cursor_point` | `commands::drag::get_cursor_point` | inline | — |  |
| `get_mouse_button_state` | `commands::drag::get_mouse_button_state` | inline | — |  |
| `set_drag_cursor` | `commands::drag::set_drag_cursor` | inline | — |  |
| `restore_drag_cursor` | `commands::drag::restore_drag_cursor` | inline | — |  |
| `release_drag_capture` | `commands::drag::release_drag_capture` | inline | — |  |
| `set_js_drag_active` | `commands::drag::set_js_drag_active` | inline | yes |  |
| `open_window_at_position` | `commands::drag::open_window_at_position` | inline | yes |  |
| `tear_off_pool_promote` | `commands::drag::tear_off_pool_promote` | blocking | yes |  |
| `pool_window_ready` | `commands::drag::pool_window_ready` | inline | yes |  |
| `start_tab_drag_tracking` | `commands::drag::start_tab_drag_tracking` | blocking | yes |  |
| `stop_tab_drag_tracking` | `commands::drag::stop_tab_drag_tracking` | blocking | — |  |
| `pane_pool_window_ready` | `commands::drag::pane_pool_window_ready` | inline | yes |  |
| `tear_off_sc_move_handshake` | `commands::drag::tear_off_sc_move_handshake` | blocking | yes |  |
| `list_windows` | `commands::window::list_windows` | inline | — |  |
| `list_window_instances` | `commands::window::list_window_instances` | inline | — |  |
| `get_double_click_time` | `commands::window::get_double_click_time` | inline | — |  |
| `focus_window` | `commands::window::focus_window` | blocking | yes |  |
| `close_window_by_label` | `commands::window::close_window_by_label` | inline | yes |  |

#### Clipboard (CEF can't use navigator.clipboard without permission policy)

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `vault_reveal` | `commands::vault::reveal` | async | yes |  |
| `vault_copy` | `commands::vault::copy` | async | yes |  |
| `vault_export` | `commands::vault_files::export` | async | yes |  |
| `vault_import` | `commands::vault_files::import` | async | yes |  |
| `vault_import_delete` | `commands::vault_files::delete_picked` | async | yes |  |
| `read_clipboard` | `commands::clipboard::read_clipboard` | inline | — |  |
| `write_clipboard` | `commands::clipboard::write_clipboard` | inline | yes |  |
| `read_clipboard_attachments` | `commands::clipboard::read_clipboard_attachments` | inline | — |  |

#### Tier 3: Provider/CLI management

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `set_provider_auth` | `commands::providers::set_provider_auth` | async | yes |  |
| `run_cli_login` | `commands::cli_login::run_cli_login` | async | yes |  |
| `cancel_cli_login` | `commands::cli_login::cancel_cli_login` | inline | — |  |
| `get_cli_login_status` | `commands::cli_login::get_cli_login_status` | inline | — |  |
| `open_login_terminal` | `commands::cli_login::open_login_terminal` | inline | yes |  |
| `ensure_settings_file` | `commands::platform::ensure_settings_file` | inline | — |  |
| `open_in_editor` | `commands::platform::open_in_editor` | inline | yes |  |
| `open_in_file_manager` | `commands::platform::open_in_file_manager` | inline | yes |  |
| `copy_file_to_dir` | `commands::providers::copy_file_to_dir` | blocking | yes | spawn_blocking: a folder or a large file copies for seconds. |
| `consume_drag_paths` | `drag_stash::take` | inline | yes | Paths of the OS file drag that entered the caller's window. The renderer passes its own `?windowLabel=`; see drag_stash.rs. |
| `peek_drag_paths` | `drag_stash::peek` | inline | yes |  |

#### Command palette

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `run_command` | `commands::palette::run_command` | inline | yes |  |

#### MuxAPI (frontend-driven)

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `open_agent` | `commands::palette::open_agent` | inline | yes |  |

#### Browser panes (native CefBrowserView)

| Command | First call | Runs | Args | Note |
|---------|------------|------|------|------|
| `browser_pane_create` | `browser_pane::identity::set_for_block` | inline | yes |  |
| `browser_pane_navigate` | `state.browser_panes.navigate` | inline | yes |  |
| `browser_pane_autocomplete` | `state.browser_panes.autocomplete` | async | yes |  |
| `browser_pane_resize` | `state.browser_panes.resize` | inline | yes |  |
| `browser_pane_discard` | `browser_panes::discard::DiscardOp::parse` | async | yes |  |
| `browser_panes_set_rects` | `browser_panes::bounds::parse_set_rects_args` | async | yes |  |
| `browser_pane_hibernation_check` | `browser_api::hibernation::Handlers::from_arg` | async | yes |  |
| `browser_pane_set_frozen` | `browser_api::hibernation::set_frozen` | async | yes |  |
| `browser_pane_memory` | `browser_api::hibernation::pane_memory` | async | yes |  |
| `memory_pressure_level` | `memory_pressure::current_level` | inline | — |  |
| `browser_pane_close` | `browser_pane::auth::cancel_for_block` | inline | yes |  |
| `browser_pane_go_back` | `state.browser_panes.go_back` | inline | yes |  |
| `browser_pane_go_forward` | `state.browser_panes.go_forward` | inline | yes |  |
| `browser_pane_reload` | `state.browser_panes.reload` | inline | yes |  |
| `browser_pane_stop` | `state.browser_panes.stop` | inline | yes |  |
| `browser_download_cancel` | `client::downloads::cancel_download` | inline | yes |  |
| `browser_pane_print` | `state.browser_panes.print` | inline | yes |  |
| `browser_pane_view_source` | `state.browser_panes.view_source` | inline | yes |  |
| `browser_pane_inspect_element` | `state.browser_panes.inspect_element` | inline | yes |  |
| `browser_pane_copy` | `state.browser_panes.copy` | inline | yes |  |
| `browser_pane_cut` | `state.browser_panes.cut` | inline | yes |  |
| `browser_pane_paste` | `state.browser_panes.paste` | inline | yes |  |
| `browser_attention_resolve` | `client::backend_browser_attention` | blocking | yes |  |
| `browser_bypass_set` | `client::backend_browser_bypass` | blocking | yes |  |
| `browser_pause_set` | `client::backend_browser_pause` | blocking | yes |  |
| `widget_approval_decide` | `client::backend_widget_approval` | blocking | yes |  |
| `vault_op` | `client::backend_vault` | blocking | yes |  |
| `google_op` | `client::backend_google` | blocking | yes |  |
| `app_update_action` | `client::backend_app_update` | blocking | yes |  |
| `store_update_install` | `commands::store_update::install_update` | blocking | — |  |
| `upgrade_request_decide` | `client::backend_upgrade_request` | blocking | yes |  |
| `desktop_request_decide` | `client::backend_desktop_request` | blocking | yes |  |
| `desktop_stop` | `client::backend_desktop_stop` | blocking | yes |  |
| `operator_attest` | `client::backend_operator_attest` | blocking | yes |  |
| `browser_pane_focus` | `state.browser_panes.focus` | inline | yes |  |
| `browser_popup_show`, `browser_popup_close` | `ui_tasks::post_show_popup` | inline | yes | Show and Close on an opener's popup-windows strip (SPEC_BROWSER_PANE_NATIVE_POPUPS_AGENT_DRIVEN_2026_10_08.md §7). Only a live popup window's label does anything. |
| `browser_pane_auth_submit` | `browser_pane::auth::take` | inline | yes |  |
| `browser_pane_auth_cancel` | `browser_pane::auth::take` | inline | yes |  |
| `browser_pane_auth_save` | `credential_broker::save_credential` | async | yes |  |
| `memory_adoption_request` | `memory_adoption::request` | inline | yes |  |
| `memory_release_request` | `memory_adoption::request_release` | inline | yes |  |
| `ssh_approval_decide` | `ssh_approval::decide` | inline | yes |  |
| `memory_adoption_decide` | `memory_adoption::decide` | async | yes |  |
| `credential_approval_decide` | `credential_broker::approval::take` | async | yes |  |
| `browser_panes_set_overlay_clip` | in the arm | inline | yes |  |
| `pane_media_revoke` | `browser_panes::media_prompt::cancel_pane_any_thread` | inline | yes |  |
| `pane_media_permission_respond` | `browser_panes::media_prompt::RespondTask::new` | inline | yes |  |
| `main_window_focus` | in the arm | inline | yes |  |
| `input_select` | `input_owner::registry::apply_selection` | inline | yes | The frontend's one selection request: the app (no `block_id`) or a pane of `window_label` takes the keyboard. `epoch` (one per page load) and `seq` order them, so one that arrives after a newer one is dropped. SPEC_BROWSER_PANE_INPUT_OWNER_2026_10_15.md §3.6. |
| `input_owner_state` | `input_owner::registry::report` | inline | yes | Whether `window_label` is active and where its keyboard is, as the last `input-owner-changed` said; null where nothing tracks it yet. |

#### Stubs

Accepted and answered with null, so a frontend that still calls them does not error. They do nothing (`crates/cef/src/commands/stubs.rs`).

`download_file`, `quicklook`, `update_wco`, `create_workspace`, `switch_workspace`, `delete_workspace`, `set_active_tab`, `create_tab`, `close_tab`, `install_update`, `is_devtools_open`

<!-- ipc-catalog:end -->

---

## 4. Channel B: Host → Renderer Event Push (CEF JS Bridge)

**Source:** `crates/cef/src/launcher_event_bridge.rs`, `crates/cef/src/srv_event_bridge.rs`

### Transport

`frame.execute_javascript(...)` injected by the host into every top-level renderer frame. Not a network channel; runs inside the CEF process boundary.

### Authentication

None. Host process trust. A compromised renderer cannot forge these events; they originate in the Rust host.

### Wire Format

Launcher events dispatched as:
```js
window.__agentmux_launcher_event(<JSON Event>)
```

Srv events dispatched as:
```js
window.__agentmux_srv_event(<JSON Event>)
```

Event shapes are the `agentmux_common::ipc::Event` variants serialized to JSON (`crates/common/src/ipc.rs`).

### Purpose

- Launcher events: window lifecycle (open/close/pool), instance numbers, WRR drift, saga lifecycle, corrective moves, `HostShouldQuit`.
- Srv events: workspace/tab/block CRUD, layout tree mutations, active-tab changes.

---

## 5. Channel C: Host ↔ Launcher Named Pipe

**Source:** `crates/cef/src/launcher_ipc/mod.rs`, `crates/common/src/ipc.rs`

### Transport

- **Windows:** Win32 named pipe. Path passed via env var `AGENTMUX_LAUNCHER_PIPE`. Launcher creates with `first_pipe_instance(true)`.
- **Unix/macOS:** Unix domain socket. Same env var name.

Dev mode (`task dev` without launcher, or host invoked directly): `AGENTMUX_LAUNCHER_PIPE` is unset; all `report_*` calls are silent no-ops.

### Authentication

None. OS-level pipe ownership. The host process must be a child of the launcher (enforced by `parent_process::parent_is_agentmux_launcher()` check before connecting, `crates/cef/src/lib.rs`).

### Wire Format

Newline-delimited JSON. One message per line.

**Host → Launcher:** `agentmux_common::ipc::Command` variants (externally tagged: `{"cmd":"register",...}`).

**Launcher → Host:** `agentmux_common::ipc::HostFrame` envelope (Phase CPD-1+). Each frame is tagged with `"kind"`:
- `{"kind":"event","event":"<name>",...}` — launcher-emitted `Event` broadcast
- `{"kind":"command","cmd":"<name>",...}` — saga-issued `Command` dispatched to host

Backward-compat: Pre-CPD-2 launchers emit bare `Event` JSON without the `HostFrame` wrapper; the host falls back to parsing as raw `Event` (`crates/cef/src/launcher_ipc/mod.rs`).

### Command Variants (Host → Launcher)

| Command | Fields | Purpose |
|---------|--------|---------|
| `Register` | `kind, pid, version` | Handshake; MUST be first message |
| `Ping` | `nonce` | Round-trip confirmation |
| `Goodbye` | — | Graceful disconnect |
| `ReportWindowOpened` | `label, kind, parent_label?` | CEF `on_after_created` fired |
| `ReportWindowClosed` | `label` | CEF `on_before_close` fired |
| `ReportPoolWindowAdded` | `label, saga_id?` | Pool window spawned |
| `ReportPoolWindowRemoved` | `label` | Pool window leaving pool |
| `ReportPoolWindowPromoted` | `label` | Pool → user-visible window transition |
| `ReportHostCounts` | `windows, pool` | Drift detection snapshot |
| `ReportHostPoolCount` | `count` | Pool-only drift snapshot |
| `ReportBackendWindowIdRegistered` | `label, window_id` | Frontend `register_backend_window` |
| `ReportBackendWindowIdUnregistered` | `label` | Window closed |
| `ReportHwndOpened` | `hwnd, class_name, title, label_hint?` | Win32 `EVENT_OBJECT_CREATE` |
| `ReportHwndDestroyed` | `hwnd` | Win32 `EVENT_OBJECT_DESTROY` |
| `ReportHwndVisibilityChanged` | `hwnd, visible` | `EVENT_OBJECT_SHOW/HIDE` |
| `ReportHwndForegroundChanged` | `hwnd` | `EVENT_SYSTEM_FOREGROUND` |
| `ReportHwndIconicChanged` | `hwnd, iconic` | `EVENT_SYSTEM_MINIMIZE*` |
| `ReportHwndPositionChanged` | `hwnd, rect` | `WM_WINDOWPOSCHANGED` (50 ms debounce) |
| `ReportMonitorTopologyChanged` | `rects` | `WM_DISPLAYCHANGE` |
| `ReportPanesReaped` | `label, saga_id?` | Browser-pane HWNDs drained |
| `ReportPoolDrainDecision` | `label, was_last, saga_id?` | Pool-drain-if-last decision |
| `ReportSagaActionFailed` | `saga_id, reason` | Schema-only CPD-1; no producer yet |
| `GetSnapshot` | — | Request full launcher state snapshot |
| `GetSrvSnapshot` | — | Request srv reducer snapshot |
| `GetEvents` | `since` | Replay events since version |
| `SpawnPoolWindow` | `saga_id` | Saga asks host to spawn a pool window |
| `ReapPanes` | `label, saga_id` | Saga asks host to drain pane HWNDs |
| `DrainPoolIfLast` | `label, saga_id` | Saga asks host to drain pool if last window |

### Event Variants (Launcher → Host)

All `agentmux_common::ipc::Event` variants propagated. Key ones:

| Event | Purpose |
|-------|---------|
| `Registered` | Connection ack |
| `Pong` | Ping reply |
| `Error` | Parse/invariant violation |
| `WindowOpened/Closed` | Window mirror updated |
| `PoolWindowAdded/Removed/Promoted` | Pool inventory changed |
| `WindowInstanceAssigned/Released` | Instance number assigned |
| `BackendWindowIdRegistered/Unregistered` | label↔window_id mapping |
| `DriftDetected` | Mirror mismatch |
| `HwndDriftDetected` | CEF/Win32 HWND disagreement |
| `CorrectiveWindowMove` | Reducer-initiated window repositioning |
| `HostShouldQuit` | Last user-visible window gone |
| `SagaStarted/Completed/Failed` | Saga lifecycle |
| `Snapshot` | Full launcher state |
| `SrvSnapshot` | Full srv reducer state |
| `WorkspaceCreated/Deleted/Renamed` | Workspace CRUD |
| `TabCreated/Deleted/Reordered/Moved` | Tab CRUD |
| `BlockCreated/Deleted/Moved` | Block CRUD |
| `LayoutNodeDeleted`, `LayoutTreeReplaced`, `LayoutBackendActionsQueued` | Layout tree changes (with `FocusedNodeChanged` and `MagnifiedNodeChanged` for focus and magnify) |

---

## 6. Channel D: Host → Srv Named Pipe (Read-only Bridge)

**Source:** `crates/cef/src/srv_ipc.rs`

### Transport

- **Windows:** Win32 named pipe. Path in env var `AGENTMUX_SRV_PIPE_PATH` (set by launcher's `srv_spawner.rs`).
- **Unix:** Unix domain socket (same env var).

Activated only when `AGENTMUX_SRV_PIPE_PATH` is set. Dev builds (`is_dev_build_exe`) short-circuit to None (`crates/cef/src/lib.rs`).

### Authentication

None. OS-level pipe ownership.

### Wire Format

Same `agentmux_common::ipc::Event` newline-delimited JSON as Channel C. The host reads events from srv's reducer and forwards them to all renderer frames via `srv_event_bridge::dispatch_to_renderers`.

### Direction

Host is a read-only subscriber. No outbound command channel exists today (saga coordinator in Phase E.5+ will add producers).

---

## 7. Channel E: Renderer ↔ Srv WebSocket (RPC)

**Source:** `crates/srv/src/server/websocket.rs`

### Transport

WebSocket at `ws://127.0.0.1:<srv_port>/ws`.

### Authentication

`?authkey=<auth_key>` query parameter on the WebSocket upgrade URL (`crates/srv/src/server/auth.rs`). This is the only route that accepts the authkey via query string; all other routes require the `X-AuthKey` header.

**Gap (audit C3):** The query-string authkey is visible in browser history, server access logs, and `Referer` headers on cross-origin navigations. Acceptable for WebSocket (where the browser API does not permit custom headers) but represents a key leak risk if the URL is ever logged or forwarded.

### Protocol

JSON text frames. Two message directions:

**Renderer → Srv (wscommand):**
```json
{"wscommand": "<cmd>", "message": <RpcMessage>}
```
Or type-tagged messages for ping/bus/setblocktermsize/blockinput:
```json
{"type": "ping"|"bus:register"|"bus:send"|"bus:inject", ...}
```

**Srv → Renderer:**
- RPC events: `{"eventtype":"rpc","data":{...}}`
- WaveObj updates: `{"eventtype":"waveobj:update","oref":"block:<id>","data":{...}}`
- MessageBus messages: `{"type":"bus:message","data":{...}}`
- Periodic ping: `{"type":"ping","stime":<ms>}` every 10 seconds

### wscommand Variants

| Command | Purpose |
|---------|---------|
| `COMMAND_EVENT_SUB` | Subscribe to WPS event scope |
| `COMMAND_EVENT_UNSUB` | Unsubscribe from scope |
| `COMMAND_EVENT_UNSUB_ALL` | Unsubscribe all |
| `COMMAND_EVENT_READ_HISTORY` | Replay buffered WPS events |
| `COMMAND_CONTROLLER_INPUT` | Send input to block controller (PTY/stdin) |
| `COMMAND_CONTROLLER_RESYNC` | Force controller state resync |
| `COMMAND_GET_META` | Get block/tab/workspace metadata |
| `COMMAND_SET_META` | Set metadata |
| `COMMAND_GET_FULL_CONFIG` | Get full wconfig |
| `COMMAND_GET_AI_RATE_LIMIT` | Rate limit status |
| `COMMAND_ROUTE_ANNOUNCE` | Announce wshrpc route |
| `COMMAND_ROUTE_UNANNOUNCE` | Deannounce route |
| `COMMAND_SET_CONFIG` | Set config value |
| `COMMAND_APP_INFO` | Get app/version info |
| `COMMAND_SUBPROCESS_SPAWN` | Spawn subprocess in pane |
| `COMMAND_AGENT_INPUT` | Send text to agent PTY |
| `COMMAND_AGENT_STOP` | Stop agent |
| `COMMAND_TOOL_DECISION` | Accept/reject tool call |
| `COMMAND_WRITE_AGENT_CONFIG` | Write agent config |
| `setblocktermsize` | Resize PTY terminal |
| `blockinput` | Send raw bytes to PTY |

**MessageBus over WS:**

| Type | Fields | Purpose |
|------|--------|---------|
| `bus:register` | `agent_id` | Register pane as a bus agent |
| `bus:send` | `from, to, payload, priority?` | Send message to agent |
| `bus:inject` | `target, bus_message` | Deliver a jekt to an agent on this instance (legacy; agents use the `Message` tool). Structured agents get it in their conversation; terminal agents as typed input |

---

## 8. Channel F: Renderer → Srv HTTP Service

**Source:** `crates/srv/src/server/service/mod.rs`, `crates/srv/src/server/mod.rs`

### Transport

`POST http://127.0.0.1:<srv_port>/agentmux/service`

### Authentication

`X-AuthKey: <auth_key>` header required (`crates/srv/src/server/auth.rs`). Auth middleware also accepts `?authkey=` query param exclusively on the `/ws` route.

### CORS

`http://127.0.0.1:*` and `http://localhost:*` origins accepted (`crates/srv/src/server/routes.rs`). External origins rejected. This is a narrowing from the previous `CorsLayer::permissive()` that accepted any origin (corrected in 2026-05-11 audit C3).

### Wire Format

```json
POST body: {"service": "<service>", "method": "<method>", "args": [...], "uicontext": {...}}
Response:  {"success": bool, "data"?: ..., "error"?: string, "updates"?: [WaveObjUpdate]}
```

Updates from service calls are broadcast on the event bus to all WebSocket subscribers.

### Service / Method Catalog (representative subset)

| Service | Method | Purpose |
|---------|--------|---------|
| `object` | `GetObject` | Fetch one object by oref |
| `object` | `GetObjects` | Fetch multiple objects |
| `object` | `CreateBlock` | Create a new block |
| `object` | `UpdateObject` | Update object meta |
| `object` | `DeleteBlock` | Delete block |
| `tab` | `CreateTab` | Create tab in workspace |
| `tab` | `CloseTab` | Close tab |
| `workspace` | `CreateWorkspace` | New workspace |
| `workspace` | `DeleteWorkspace` | Delete workspace |
| `window` | `CloseWindow` | Close window |
| Various agent, CLI, identity, install services | | |

---

## 9. Channel G: Browser DOM API (HTTP over IPC)

**Source:** `crates/cef/src/browser_api/routes.rs`, registered via `crate::browser_api::register_routes(app)` (`ipc.rs`)

### Transport

Same HTTP server as Channel A (`127.0.0.1:<ipc_port>`). Routes under `/agentmux/browser/*`.

### Authentication

`Authorization: Bearer <ipc_token>` header required by every handler (`routes.rs`).

### Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /agentmux/browser/query` | CSS selector query in pane DOM | Returns matching `Element[]` |
| `POST /agentmux/browser/focus_info` | Get `document.activeElement` | Returns focused `Element` |
| `POST /agentmux/browser/eval` | Run arbitrary JS in pane renderer | Returns serialized value |
| `POST /agentmux/browser/screenshot` | Capture PNG of pane viewport | Returns base64 PNG |
| `POST /agentmux/browser/click_element` | Synthesize mouse click at element centroid | Dispatches `Input.dispatchMouseEvent` |
| `POST /agentmux/browser/focus_element` | Call `.focus()` on first matching element | |
| `POST /agentmux/browser/dispatch_key` | Send text or named key to focused element | Supports `Enter, Tab, Escape, Backspace, ArrowUp/Down/Left/Right, Space` |
| `POST /agentmux/browser/navigate` | Navigate pane to URL via `Page.navigate` | |
| `POST /agentmux/browser/back` | Browser history back | `Page.goBack` |
| `POST /agentmux/browser/forward` | Browser history forward | `Page.goForward` |
| `POST /agentmux/browser/reload` | Reload current page | `Page.reload` |

### Mechanism

All Browser DOM API routes speak the Chromium DevTools Protocol (CDP) **in-process**, through CEF's `SendDevToolsMessage` and a DevTools message observer on the target browser (`crates/cef/src/browser_api/cdp.rs`). They don't use the remote-debugging port (Channel I), which is off in release builds.

**Security: `/agentmux/browser/eval` runs arbitrary JS.** The `eval` route accepts a caller-supplied `script` string and executes it in the pane's JS world via `Runtime.evaluate` with no sandbox or isolation (`routes.rs`). The script runs in whatever origin the pane currently loads. Any local process holding the `ipc_token` can execute arbitrary JS in any browser pane.

---

## 10. Channel H: OSC 16162 — Terminal Shell Integration Escape Sequences

**Source:** `crates/srv/src/backend/shellintegration/bash.sh` (and zsh, fish, pwsh), `frontend/app/view/term/termosc.ts`, `frontend/app/view/term/termwrap.ts`

### Transport

VT escape sequence embedded in PTY output, parsed by xterm.js in the renderer:
```
ESC ] 16162 ; <command> ; <JSON-payload> BEL
```

Registered as an OSC handler on xterm.js number `16162` (`termwrap.ts`).

### Authentication

None. The sequence is parsed from PTY byte stream. Any program running in the terminal can emit `OSC 16162` and trigger the handler.

### Commands

| Sub-command | Wire example | Handler action | Security implication |
|-------------|-------------|----------------|---------------------|
| `E` | `\033]16162;E;{"AGENTMUX_AGENT_ID":"Alice"}\007` | Calls `RpcApi.SetMetaCommand` to write `{"cmd:env": <payload>}` into the block's persistent metadata (`termosc.ts`). Empty payload clears. | **Env-key injection**: any terminal program can write arbitrary keys into `cmd:env`. Values are then injected into child process environments (`shell.rs`). No key allow-list or value range is enforced. |
| `X` | `\033]16162;X;{"muxbus_url":"https://...","muxbus_token":"tok"}\007` | Makes an authenticated `POST /agentmux/reactive/poller/config` to reconfigure the cloud MuxBus poller URL and token (`termosc.ts`). | **Poller injection**: any terminal program can redirect the srv's outbound polling to an attacker-controlled endpoint. Pre-audit C1/C2 this route was unauthenticated; now requires `X-AuthKey`. |
| `A` | `\033]16162;A;{}\007` | Sets `shell:state = "ready"` in block RT info | State metadata injection |
| `C` | `\033]16162;C;{"cmd64":"<b64>"}\007` | Sets `shell:state = "running-command"`, decodes `cmd64` → `shell:lastcmd` | Last-command display |
| `D` | `\033]16162;D;{"exitcode":0}\007` | Sets `shell:lastcmdexitcode` | Exit code display |
| `I` | `\033]16162;I;{"inputempty":true}\007` | Sets `shell:inputempty` | Input state |
| `M` | `\033]16162;M;{"shell":"bash","shellversion":"5.2","uname":"Linux"}\007` | Sets `shell:type`, `shell:version`, `shell:uname` | Shell metadata |
| `R` | `\033]16162;R;{}\007` | If in alternate screen buffer: writes `ESC[?1049l` to exit alternate screen | Screen reset |

### Shell Integration Deployment

Scripts are embedded in the srv binary (`shellintegration.rs`) and deployed to `~/.agentmux/shell/<type>/` on first launch or version change. The shell controller sources them via `--rcfile` (bash), `ZDOTDIR` (zsh), `-File` (pwsh), or `-C source` (fish) (`shellintegration.rs`).

---

## 11. Channel I: Chromium Remote Debug Port (CDP)

**Source:** `crates/cef/src/cdp_port.rs`, `crates/cef/src/lib.rs` (port selection), `crates/cef/src/app/mod.rs` (`remote_allow_origins`)

### Transport

Chromium DevTools Protocol over HTTP and WebSocket:
- `http://127.0.0.1:9222/json` — list targets (prod)
- `ws://127.0.0.1:9222/devtools/page/<target>` — CDP per-target session

**On by default only in dev builds.** A release build starts it only when `AGENTMUX_CDP_PORT` is set to a port or to `1`/`on`/`true`/`yes`/`auto`; `0`/`off`/`false`/`no` turns it off in a dev build too (`crates/cef/src/cdp_port.rs`). The preferred port is 9222 in production and 9223 in dev builds, with an OS-assigned fallback when it is taken; the port in use is published in `authkey.dev`. `--remote-allow-origins` is limited to `http://127.0.0.1:<port>` and `http://localhost:<port>` (`crates/cef/src/app/mod.rs`, `remote_allow_origins`), so web pages can't open a DevTools WebSocket; clients that send no `Origin` are not affected. No CSP header is configured.

### Authentication

**None.** While it is on, the CDP endpoint is unauthenticated. Any local process can connect and:
- Enumerate all browser targets (main window and all panes)
- Execute arbitrary JavaScript in any target (`Runtime.evaluate`)
- Capture screenshots
- Intercept network traffic
- Modify DOM

**Note:** `no_sandbox: 1` is set in CEF settings (`crates/cef/src/lib.rs`), which means the Chromium renderer processes run without the OS sandbox. This widens the blast radius of any renderer compromise.

### Internal Use

None in the app. The Browser DOM API (Channel G) drives CDP in-process (see Channel G above), and **Inspect Element** opens CEF's native DevTools. The port exists for external tooling and test harnesses, which is why dev builds keep it on.

---

## 12. IPC Token and Auth Key — Lifecycle and Leak Surface

There are two distinct secrets:

| Secret | Name in code | Where generated | Who uses it | Scope |
|--------|-------------|-----------------|-------------|-------|
| `ipc_token` | `state.ipc_token` | Random UUID, host startup | `POST /ipc` (Channel A) and `POST /agentmux/browser/*` (Channel G) | Per-host-process |
| `auth_key` | `state.auth_key` (host); `AppState.auth_key` (srv) | Random UUID, srv startup; passed to host via env or backend-info | `/ws?authkey=` (Channel E) and `X-AuthKey` (Channel F) | Per-srv-process |

### Leak Vectors

| Vector | Leaks | Condition |
|--------|-------|-----------|
| `ipc-port-<hash>` file (`<data_dir>/ipc-port-<hash>`) | `<port>:<ipc_token>` | Always (owner-readable, but data dir may have lax permissions on some installations) |
| `authkey.dev` file (`<data_dir>/authkey.dev`) | Both `ipc_token` and `auth_key`, plus both endpoint addresses | Dev mode only (`AGENTMUX_DEV=1`); file is chmod 0600 (Unix) / DACL-restricted (Windows) (`dev_authfile.rs`) |
| Renderer URL query string | `ipc_token` via `?ipc_token=<token>` (if frontend embeds it in the URL on load) | Visible in process arguments, browser history, `Referer` headers |
| WS URL query string | `auth_key` via `?authkey=<key>` | Visible in server access logs (`crates/srv/src/server/auth.rs`) |
| `get_auth_key` IPC command | `auth_key` | Any caller that already holds `ipc_token` — no additional gate |

### `authkey.dev` File Contents

```json
{
  "version": 1,
  "auth_key": "<uuid>",
  "web_endpoint": "127.0.0.1:<port>",
  "ws_endpoint": "127.0.0.1:<port>",
  "ipc_endpoint": "127.0.0.1:<port>",
  "ipc_token": "<uuid>",
  "service_path": "/agentmux/service",
  "file_path": "/agentmux/file",
  "instance": "v<version>",
  "data_dir": "<path>",
  "host_pid": <pid>,
  "debug_port": <port>,
  "created_at": "<ISO8601>"
}
```

(`dev_authfile.rs`)

---

## 13. Launcher ↔ Srv Named Pipe (Reducer Bus)

**Source:** `crates/common/src/ipc.rs` (shared wire types), `crates/launcher/src/` (server side, not read directly)

### Transport

- **Windows:** Named pipe (path keyed on `hash(data_dir, version)` for isolation invariant I5)
- **Unix:** Unix domain socket

### Authentication

None. OS-level pipe ownership + launcher Job Object containment.

### Wire Format

Same `agentmux_common::ipc::Command` / `agentmux_common::ipc::Event` newline-delimited JSON as Channel C. The launcher is the server; srv connects as a client with `ClientKind::Srv`.

### srv-Domain Commands (routed to the srv reducer)

All `Command` variants from the second half of `ipc.rs` (Phase E.x):

| Command | Purpose |
|---------|---------|
| `GetSrvSnapshot` | Request srv reducer full snapshot |
| `CreateWorkspace`, `DeleteWorkspace`, `RenameWorkspace`, `UpdateWorkspaceMeta` | Workspace CRUD |
| `CreateTab`, `DeleteTab`, `SetActiveTab`, `ReorderTab`, `ReorderTabsBulk`, `RenameTab`, `UpdateTabMeta`, `MoveTab` | Tab CRUD and ordering |
| `CreateWindow`, `CloseWindowInternal`, `SwitchWorkspace`, `UpdateWindowMeta` | Window↔workspace mapping |
| `CreateBlock`, `DeleteBlock`, `MoveBlock`, `UpdateBlockMeta` | Block CRUD |
| `SetFocusedNode`, `SetMagnifiedNode` | Layout focus/magnify |
| `LayoutApplyIntent`, `LayoutSetTree`, `LayoutDeleteNode`, `LayoutDeleteNodeByBlock`, `LayoutStackPush`, `LayoutStackActivate`, `LayoutStackMove`, `LayoutStackMoveMany`, `LayoutQueueBackendActions` | Layout tree mutations |

### Domain Mixing Note

`crates/common/src/ipc.rs` (2034 LOC) contains a single `Command` enum that conflates two distinct domains:

- **Launcher domain** (`Register`, `Ping`, `ReportWindow*`, `ReportHwnd*`, `SpawnPoolWindow`, `ReapPanes`, `DrainPoolIfLast`, `GetSnapshot`, `GetEvents`, …) — processed by the launcher's reducer.
- **Srv domain** (`GetSrvSnapshot`, `CreateWorkspace`, `DeleteWorkspace`, `CreateTab`, `LayoutSetTree`, …) — processed by the srv reducer.

These share a wire-level namespace. The routing logic lives in the respective process's connection handler and is not enforced by the type system. A mis-addressed `CreateWorkspace` sent to the launcher pipe returns `Event::Error { code: InvalidCommand }` rather than a type error.

See `ipc.rs` for the stated backward-compat policy (externally tagged enums, unknown-command → `Event::Error`).

---

## 14. Command/Event Domain Mixing in crates/common/src/ipc.rs

`crates/common/src/ipc.rs` is 2034 lines. It defines:

- `ClientKind` enum — `Host`, `Renderer`, `Srv`, `Tool`
- `Command` enum — all commands from both the launcher domain and the srv domain (see §13 above)
- `Event` enum — all events from both domains (~60 variants)
- `HostFrame` — `{"kind":"event"|"command", ...}` CPD-1 envelope
- Helper types: `Rect`, `WindowKind`, `WindowSnapshot`, `LifecyclePhase`, `DriftKind`, `HwndDriftKind`, `Severity`, `ErrorCode`

There is no sub-module or feature-flag separation between launcher-domain and srv-domain variants. Operators reading the enum cannot tell at a glance which variants belong to which pipe. The only documentation is inline comments citing phase numbers (e.g., "Phase E.2", "Phase B.4").

**Recommendation:** Add `// === LAUNCHER DOMAIN ===` and `// === SRV DOMAIN ===` section comments at the boundary within the enum to make the split explicit without requiring a breaking split into two enums.

---

## 15. Environment Variable Contract

The variables srv puts in a pane's environment, who sets them and which are kept from the instance's own environment are in [Environment variables](/internals/env-vars/): the pane allow-list (`PANE_ENV_KEEP` in `crates/srv/src/backend/pane_env.rs`) decides which `AGENTMUX_*` variables reach a pane, and `AGENTMUX` is always set to `1`. The OSC 16162 `E` command can still write keys into a block's `cmd:env` (section 10).

`AGENTMUX_AGENT_COLOR` and `AGENTMUX_AGENT_TEXT_COLOR` are decommissioned: nothing injects or reads them, and the pane border uses the agent's persisted `ui:color`.

---

## 16. Security Findings Cross-Reference

This section maps the sweep findings to the specific code locations documented above.

| Finding | Location | Impact | Mitigation status |
|---------|----------|--------|-------------------|
| **`ipc_token` leaks via ipc-port file** | `crates/cef/src/lib.rs` writes `port:token` to `<data_dir>/ipc-port-<hash>` | Any process that can read data dir obtains both port and token; can drive Channel A and G fully | File permissions not explicitly restricted (unlike `authkey.dev`). The launcher reads it for single-instance forwarding. |
| **`ipc_token` leaks via renderer URL query** | Frontend's load-time URL (not in scope of this sweep's source read; reported by sweep) | Token in browser history, `Referer`, process arguments | Not mitigated in code seen |
| **`authkey.dev` leaks both tokens (dev mode)** | `dev_authfile.rs`; written when `AGENTMUX_DEV=1` | Full API access with both `ipc_token` and `auth_key` | File is chmod 0600 / owner DACL. Dev-only. |
| **`get_auth_key` IPC command returns srv auth key** | `ipc.rs` | Any renderer holding `ipc_token` can obtain `auth_key` (srv-side token) | No separate gate; design intentional (renderer needs both) |
| **`get_env` returns any env var** | `platform.rs`; `ipc.rs` | Renderer can extract `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, etc. from the host process environment. Requires `ipc_token`. | No allowlist or blocklist enforced |
| **`/agentmux/browser/eval` runs arbitrary JS** | `routes.rs` | Any caller with `ipc_token` can execute JS in any open browser pane (including cross-origin pages). | Auth: `ipc_token` required. No script length or content restriction. |
| **OSC 16162 `E` injects env keys into block meta** | `termosc.ts` | Any program in the PTY can write arbitrary keys into `cmd:env`. Those keys are injected into future child process environments by `shell.rs`. | No key allowlist. No value validation. |
| **OSC 16162 `X` reconfigures srv poller** | `termosc.ts` | Any terminal program can set the srv's outbound polling URL/token (pre-audit C1/C2: unauthenticated; post-audit: authed with `auth_key`) | Auth added in 2026-05-11 audit. `auth_key` required from renderer. |
| **`CorsLayer::permissive()` on host IPC server** | `ipc.rs` | Any Origin accepted on `http://127.0.0.1:<ipc_port>`. Web pages from the renderer's browsed sites can make preflight-free requests if they guess/obtain the port and token. | Not mitigated. Srv has been narrowed to loopback-only origins (`crates/srv/src/server/routes.rs`); host has not. |
| **CDP port unauthenticated, when on** | `crates/cef/src/cdp_port.rs`, `crates/cef/src/lib.rs` | Any local process can enumerate targets, execute JS, capture screens, intercept network. | Off in release builds unless `AGENTMUX_CDP_PORT` opts in; on in dev builds. Web origins refused via `--remote-allow-origins`. No auth. `no_sandbox: 1` widens blast radius. |
| **No CSP on any route** | `ipc.rs`, `crates/srv/src/server/mod.rs` | XSS in the main window or a browser pane has no Content-Security-Policy barrier. | Not mitigated. |
| **`no_sandbox: 1` in CEF settings** | `crates/cef/src/lib.rs` | Renderer processes run without OS sandbox. Renderer compromise can access host filesystem and processes directly. | Required for current platform support; documented limitation. |
| **WS authkey in query string** | `crates/srv/src/server/auth.rs` | `auth_key` in URLs, logs, `Referer`. Intentional WS-only exception (browser WS API cannot set custom headers). | Restricted to `/ws` route only by the audit C3 fix. |

---

*Document generated by AgentY (sweep 2026-06-12). Sources verified by direct code reads; no features invented.*
