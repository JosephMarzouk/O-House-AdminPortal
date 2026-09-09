/**
 * Runs once before any app code, on both server and edge runtimes.
 * See lib/node-ws.ts for why this exists and when to delete it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installNodeWebSocket } = await import('@/lib/node-ws');
    installNodeWebSocket();
  }
}
