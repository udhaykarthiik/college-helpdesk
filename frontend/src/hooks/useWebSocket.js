import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocket
 *
 * @param {string|number|null} ticketId
 *   - number / numeric string  → ticket chat   /ws/tickets/<id>/
 *   - "dashboard"              → dashboard      /ws/notifications/
 *   - null / undefined         → disconnected
 *
 * @param {object} callbacks
 *   - onTicketUpdate(ticket, updateType) — called immediately when a
 *     ticket_update message arrives (dashboard mode).  Bypasses state
 *     relay so the dashboard component owns its own state directly.
 *   - onChatMessage(msg)  — called for each incoming chat message.
 */
export const useWebSocket = (ticketId, callbacks = {}) => {
    const [isConnected, setIsConnected]   = useState(false);
    const [messages,    setMessages]      = useState([]);
    const [error,       setError]         = useState(null);

    const wsRef                = useRef(null);
    const reconnectTimeoutRef  = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const pingIntervalRef      = useRef(null);
    const intentionalCloseRef  = useRef(false);

    // Keep latest callbacks in a ref so the stable WS handlers always
    // call the current version without needing to re-create the socket.
    const callbacksRef = useRef(callbacks);
    useEffect(() => { callbacksRef.current = callbacks; });

    const MAX_RECONNECT  = 10;
    const BASE_DELAY_MS  = 2000;

    // ── URL builder ─────────────────────────────────────────────────────
    const buildUrl = useCallback((id) => {
        const token = localStorage.getItem('access_token');
        if (!token) return null;
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host  = process.env.REACT_APP_WS_HOST || '127.0.0.1:8000';
        return id === 'dashboard'
            ? `${proto}//${host}/ws/notifications/?token=${token}`
            : `${proto}//${host}/ws/tickets/${id}/?token=${token}`;
    }, []);

    // ── Ping helpers ─────────────────────────────────────────────────────
    const stopPing  = useCallback(() => {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
    }, []);

    const startPing = useCallback((ws) => {
        stopPing();
        pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 20000);
    }, [stopPing]);

    // ── Core connect ─────────────────────────────────────────────────────
    const connect = useCallback(() => {
        if (!ticketId) return;

        if (!localStorage.getItem('access_token')) {
            console.warn('🔴 No token — WS aborted');
            setError('No authentication token');
            return;
        }

        // Tear down any existing socket cleanly
        if (wsRef.current) {
            intentionalCloseRef.current = true;
            wsRef.current.close(1000, 'Reconnecting');
            wsRef.current = null;
        }
        stopPing();

        const url = buildUrl(ticketId);
        if (!url) return;

        console.log(`🟡 WS → ${url.replace(/token=\S+/, 'token=***')}`);
        const ws = new WebSocket(url);

        // ── onopen ──────────────────────────────────────────────────────
        ws.onopen = () => {
            console.log('✅ WS connected');
            intentionalCloseRef.current  = false;
            reconnectAttemptsRef.current = 0;
            setIsConnected(true);
            setError(null);
            startPing(ws);
        };

        // ── onmessage ───────────────────────────────────────────────────
        ws.onmessage = (event) => {
            let data;
            try { data = JSON.parse(event.data); }
            catch { console.error('WS parse error'); return; }

            switch (data.type) {

                case 'ticket_update': {
                    // ✅ Fire callback directly into the dashboard component.
                    // No intermediate state array — zero relay latency.
                    const cb = callbacksRef.current.onTicketUpdate;
                    if (typeof cb === 'function') {
                        cb(data.ticket, data.update_type);
                    }
                    break;
                }

                case 'message': {
                    const chatCb = callbacksRef.current.onChatMessage;
                    const msg = {
                        id:               data.message_id || Date.now(),
                        message:          data.message,
                        sender_type:      data.sender_type,
                        sender_name:      data.sender_name,
                        is_internal_note: data.is_internal_note || false,
                        created_at:       data.created_at || new Date().toISOString(),
                    };
                    if (typeof chatCb === 'function') {
                        chatCb(msg);
                    } else {
                        // Fallback: keep internal messages state for
                        // consumers that don't pass a callback
                        setMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                    }
                    break;
                }

                case 'pong':
                    break;

                case 'connection':
                    console.log(`🔌 WS handshake: mode=${data.mode}, user=${data.user}`);
                    break;

                case 'error':
                    console.error('WS server error:', data.error);
                    setError(data.error);
                    break;

                default:
                    console.log('WS unknown type:', data.type);
            }
        };

        // ── onclose ─────────────────────────────────────────────────────
        ws.onclose = (event) => {
            console.log(`❌ WS closed — code ${event.code}`);
            setIsConnected(false);
            stopPing();

            const noReconnect =
                intentionalCloseRef.current ||
                event.code === 1000 ||
                event.code === 4001 ||
                event.code === 4003;

            if (!noReconnect && reconnectAttemptsRef.current < MAX_RECONNECT) {
                reconnectAttemptsRef.current += 1;
                const delay = Math.min(BASE_DELAY_MS * reconnectAttemptsRef.current, 30000);
                console.log(`🔄 Reconnecting in ${delay / 1000}s (${reconnectAttemptsRef.current}/${MAX_RECONNECT})`);
                reconnectTimeoutRef.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = () => setError('WebSocket connection error');

        wsRef.current = ws;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketId, buildUrl, startPing, stopPing]);
    // NOTE: `connect` intentionally recreates when ticketId changes.

    // ── disconnect ───────────────────────────────────────────────────────
    const disconnect = useCallback(() => {
        intentionalCloseRef.current = true;
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
        stopPing();
        if (wsRef.current) {
            wsRef.current.close(1000, 'Normal closure');
            wsRef.current = null;
        }
        setIsConnected(false);
    }, [stopPing]);

    // ── sendMessage ──────────────────────────────────────────────────────
    const sendMessage = useCallback((message, senderType = 'agent', isInternalNote = false) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type:             'message',
                message,
                sender_type:      senderType,
                is_internal_note: isInternalNote,
            }));
            return true;
        }
        console.warn('⚠️ WS not open, state:', wsRef.current?.readyState);
        return false;
    }, []);

    // ── lifecycle ────────────────────────────────────────────────────────
    useEffect(() => {
        setMessages([]);
        setError(null);
        reconnectAttemptsRef.current = 0;

        if (ticketId) connect();

        return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketId]);
    // connect/disconnect omitted from deps intentionally — they change when
    // ticketId changes (same cycle), which would double-run the effect.

    return { isConnected, messages, sendMessage, error };
};

export default useWebSocket;