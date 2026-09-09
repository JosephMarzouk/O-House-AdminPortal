import WebSocket from 'ws';

/**
 * ponytail: Node 20 ships no global WebSocket, and @supabase/supabase-js
 * constructs a RealtimeClient eagerly inside createClient() — so it throws at
 * construction, even though this portal never opens a realtime channel.
 *
 * Ceiling: one dependency (`ws`) and two call sites (instrumentation.ts for
 * the app, scripts/* for the CLI tools).
 *
 * Upgrade path: install Node 22 LTS, then delete this file, the `ws` and
 * `@types/ws` dependencies, and both callers. supabase-js already warns that
 * Node <= 20 support is going away, so this is on a clock either way.
 */
export function installNodeWebSocket(): void {
  if (typeof globalThis.WebSocket === 'undefined') {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;
  }
}
