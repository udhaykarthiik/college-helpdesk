import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocket
 *
 * @param {string|number|null} ticketId
 *   - number / numeric string  → ticket chat    /ws/tickets/<id>/
 *   - null / undefined         → stay disconnected
 *
 * @param {object} options
 *   - onChatMessage(msg)  — chat callback
 *   - onTicketUpdate      — dashboard callback
 */
export const useWebSocket = (ticketId, options = {}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [messages,    setMessages]    = useState([]);
    const [error,       setError]       = useState(null);

    const wsRef             = useRef(null);
    const reconnectTimer    = useRef(null);
    const reconnectAttempts = useRef(0);
    const pingTimer         = useRef(null);
    const intentionalClose  = useRef(false);
    const optionsRef        = useRef(options);
    const ticketIdRef       = useRef(ticketId);
    const connectRef        = useRef(null);

    // Always keep refs current
    useEffect(() => { optionsRef.current  = options;  });
    useEffect(() => { ticketIdRef.current = ticketId; });

    const MAX_RECONNECT = 10;
    const BASE_DELAY    = 2000;

    // ── URL builder ───────────────────────────────────────────────────────
    const buildUrl = useCallback((id) => {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host  = process.env.REACT_APP_WS_HOST || '127.0.0.1:8000';

        // Dashboard connection
        if (id === 'dashboard') {
            const token = localStorage.getItem('access_token');
            if (!token) return null;
            return `${proto}//${host}/ws/notifications/?token=${token}`;
        }

        // Ticket chat — JWT token required
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.warn('🔴 No JWT token, cannot connect to WebSocket');
            return null;
        }
        return `${proto}//${host}/ws/tickets/${id}/?token=${token}`;
    }, []);

    // ── Ping ─────────────────────────────────────────────────────────────
    const stopPing = useCallback(() => {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
    }, []);

    const startPing = useCallback((ws) => {
        stopPing();
        pingTimer.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 20000);
    }, [stopPing]);

    // ── Connect ───────────────────────────────────────────────────────────
    const connect = useCallback(() => {
        const id = ticketIdRef.current;
        if (!id) return;

        const url = buildUrl(id);
        if (!url) {
            console.warn('🔴 Cannot build WS URL — no token');
            setError('No authentication');
            return;
        }

        // Tear down existing socket
        if (wsRef.current) {
            intentionalClose.current = true;
            wsRef.current.close(1000, 'Reconnecting');
            wsRef.current = null;
        }
        stopPing();

        console.log(`🟡 WS connecting to ticket: ${id}`);
        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('✅ WS connected for ticket:', id);
            intentionalClose.current  = false;
            reconnectAttempts.current = 0;
            setIsConnected(true);
            setError(null);
            startPing(ws);
        };

        ws.onmessage = (event) => {
            let data;
            try { data = JSON.parse(event.data); }
            catch { console.error('WS parse error'); return; }

            switch (data.type) {
                case 'ticket_update': {
                    const cb = optionsRef.current?.onTicketUpdate;
                    if (typeof cb === 'function') cb(data.ticket, data.update_type);
                    break;
                }

                case 'message': {
                    const msg = {
                        id:               data.message_id || Date.now(),
                        message:          data.message,
                        sender_type:      data.sender_type,
                        sender_name:      data.sender_name,
                        is_internal_note: data.is_internal_note || false,
                        created_at:       data.created_at || new Date().toISOString(),
                    };
                    const chatCb = optionsRef.current?.onChatMessage;
                    if (typeof chatCb === 'function') {
                        chatCb(msg);
                    } else {
                        setMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                    }
                    break;
                }

                case 'pong': break;

                case 'connection':
                    console.log(`🔌 WS connected — ticket ${data.ticket_id}`);
                    break;

                case 'error':
                    console.error('WS server error:', data.error);
                    setError(data.error);
                    break;

                default:
                    console.log('WS unknown type:', data.type);
            }
        };

        ws.onclose = (event) => {
            console.log(`❌ WS closed — code ${event.code}`);
            setIsConnected(false);
            stopPing();

            const noReconnect =
                intentionalClose.current ||
                event.code === 1000 ||
                event.code === 4001 ||
                event.code === 4003;

            if (!noReconnect && reconnectAttempts.current < MAX_RECONNECT) {
                reconnectAttempts.current += 1;
                const delay = Math.min(BASE_DELAY * reconnectAttempts.current, 30000);
                console.log(`🔄 Reconnect in ${delay / 1000}s (${reconnectAttempts.current}/${MAX_RECONNECT})`);
                reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
            }
        };

        ws.onerror = () => setError('WebSocket connection error');
        wsRef.current = ws;
    }, [buildUrl, startPing, stopPing]);

    useEffect(() => { connectRef.current = connect; });

    // ── Disconnect ────────────────────────────────────────────────────────
    const disconnect = useCallback(() => {
        intentionalClose.current = true;
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
        stopPing();
        if (wsRef.current) {
            wsRef.current.close(1000, 'Normal closure');
            wsRef.current = null;
        }
        setIsConnected(false);
    }, [stopPing]);

    // ── sendMessage ───────────────────────────────────────────────────────
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

    // ── Lifecycle ─────────────────────────────────────────────────────────
    useEffect(() => {
        setMessages([]);
        setError(null);
        reconnectAttempts.current = 0;
        intentionalClose.current  = false;

        if (ticketId) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            intentionalClose.current = true;
            clearTimeout(reconnectTimer.current);
            stopPing();
            if (wsRef.current) {
                wsRef.current.close(1000, 'Unmount');
                wsRef.current = null;
            }
        };
    }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

    return { isConnected, messages, sendMessage, error };
};

export default useWebSocket;