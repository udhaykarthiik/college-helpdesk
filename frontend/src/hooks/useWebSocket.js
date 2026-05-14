import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocket — manages a single persistent WebSocket connection.
 *
 * @param {string|number|null} ticketId
 *   - Pass a ticket ID for ticket-chat mode  → /ws/tickets/<id>/
 *   - Pass "dashboard" for dashboard mode    → /ws/notifications/
 *   - Pass null/undefined to stay disconnected
 */
export const useWebSocket = (ticketId) => {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [ticketUpdates, setTicketUpdates] = useState([]); // for dashboard mode
    const [error, setError] = useState(null);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const pingIntervalRef = useRef(null);
    const intentionalCloseRef = useRef(false);

    const MAX_RECONNECT_ATTEMPTS = 8;
    const BASE_RECONNECT_DELAY = 2000; // ms

    const buildWsUrl = useCallback((id) => {
        const token = localStorage.getItem('access_token');
        if (!token) return null;

        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.REACT_APP_WS_HOST || '127.0.0.1:8000';

        if (id === 'dashboard') {
            return `${proto}//${host}/ws/notifications/?token=${token}`;
        }
        return `${proto}//${host}/ws/tickets/${id}/?token=${token}`;
    }, []);

    const startPing = useCallback((ws) => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 20000);
    }, []);

    const stopPing = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        if (!ticketId) return;

        const token = localStorage.getItem('access_token');
        if (!token) {
            console.warn('🔴 No auth token — WebSocket aborted');
            setError('No authentication token');
            return;
        }

        // Clean up any existing connection
        if (wsRef.current) {
            intentionalCloseRef.current = true;
            wsRef.current.close(1000, 'Reconnecting');
            wsRef.current = null;
        }
        stopPing();

        const url = buildWsUrl(ticketId);
        if (!url) return;

        console.log(`🟡 WS connecting → ${url.replace(/token=.*/, 'token=***')}`);

        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('✅ WS connected');
            intentionalCloseRef.current = false;
            setIsConnected(true);
            setError(null);
            reconnectAttemptsRef.current = 0;
            startPing(ws);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'message':
                        // Ticket chat message
                        setMessages(prev => {
                            const exists = prev.some(m => m.id === data.message_id);
                            if (exists) return prev;
                            return [...prev, {
                                id: data.message_id || Date.now(),
                                message: data.message,
                                sender_type: data.sender_type,
                                sender_name: data.sender_name,
                                is_internal_note: data.is_internal_note || false,
                                created_at: data.created_at || new Date().toISOString()
                            }];
                        });
                        break;

                    case 'ticket_update':
                        // Dashboard notification
                        setTicketUpdates(prev => {
                            // Update existing ticket in list or prepend new one
                            const exists = prev.some(t => t.id === data.ticket_id);
                            if (exists) {
                                return prev.map(t =>
                                    t.id === data.ticket_id
                                        ? { ...t, ...data.ticket }
                                        : t
                                );
                            }
                            return [data.ticket, ...prev];
                        });
                        break;

                    case 'pong':
                        // Keepalive — no action needed
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
            } catch (err) {
                console.error('WS parse error:', err);
            }
        };

        ws.onclose = (event) => {
            console.log(`❌ WS closed — code: ${event.code}, reason: ${event.reason || 'none'}`);
            setIsConnected(false);
            stopPing();

            // Don't reconnect on intentional close or auth errors
            const noReconnect =
                intentionalCloseRef.current ||
                event.code === 1000 ||
                event.code === 4001 ||  // auth failed
                event.code === 4003;    // access denied

            if (!noReconnect && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttemptsRef.current += 1;
                const delay = Math.min(
                    BASE_RECONNECT_DELAY * reconnectAttemptsRef.current,
                    30000
                );
                console.log(
                    `🔄 Reconnecting in ${delay / 1000}s… ` +
                    `(attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
                );
                reconnectTimeoutRef.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = () => {
            // onerror fires just before onclose; real info is in onclose
            setError('WebSocket connection error');
        };

        wsRef.current = ws;
    }, [ticketId, buildWsUrl, startPing, stopPing]);

    const disconnect = useCallback(() => {
        intentionalCloseRef.current = true;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        stopPing();
        if (wsRef.current) {
            wsRef.current.close(1000, 'Normal closure');
            wsRef.current = null;
        }
        setIsConnected(false);
    }, [stopPing]);

    /**
     * Send a chat message over the WebSocket.
     * @returns {boolean} true if sent, false if WS not ready
     */
    const sendMessage = useCallback((message, senderType = 'agent', isInternalNote = false) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                message,
                sender_type: senderType,
                is_internal_note: isInternalNote
            }));
            return true;
        }
        console.warn('⚠️ WS not open — message dropped. State:', wsRef.current?.readyState);
        return false;
    }, []);

    // Connect/disconnect when ticketId changes
    useEffect(() => {
        // Reset message state when switching tickets
        setMessages([]);
        setTicketUpdates([]);
        setError(null);
        reconnectAttemptsRef.current = 0;

        if (ticketId) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps
    // NOTE: connect/disconnect intentionally omitted — including them causes
    // infinite re-renders because useCallback recreates them when ticketId changes.

    return {
        isConnected,
        messages,
        ticketUpdates,   // used by AgentDashboard
        sendMessage,
        error
    };
};

export default useWebSocket;