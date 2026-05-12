import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (ticketId) => {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 10;
    const pingIntervalRef = useRef(null);

    const connect = useCallback(() => {
        const token = localStorage.getItem('access_token');
        
        console.log('🔍 WebSocket Debug - ticketId:', ticketId);
        console.log('🔍 WebSocket Debug - token exists:', !!token);
        
        if (!token) {
            console.log('🔴 No auth token, WebSocket connection aborted');
            setError('No authentication token');
            return;
        }
        
        if (!ticketId) {
            console.log('🔴 No ticketId, WebSocket connection aborted');
            return;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close();
        }

        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//127.0.0.1:8000/ws/tickets/${ticketId}/?token=${token}`;
        
        console.log(`🟡 Connecting to WebSocket: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('✅ WebSocket connected successfully!');
            setIsConnected(true);
            setError(null);
            reconnectAttemptsRef.current = 0;
            
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                    console.log('🏓 Ping sent');
                }
            }, 15000);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 WebSocket message received:', data.type);
                
                if (data.type === 'message') {
                    setMessages(prev => {
                        if (prev.some(m => m.id === data.message_id)) return prev;
                        return [...prev, {
                            id: data.message_id || Date.now(),
                            message: data.message,
                            sender_type: data.sender_type,
                            sender_name: data.sender_name,
                            is_internal_note: data.is_internal_note || false,
                            created_at: data.created_at || new Date().toISOString()
                        }];
                    });
                } else if (data.type === 'pong') {
                    console.log('🏓 Pong received');
                } else if (data.type === 'connection') {
                    console.log(`🔌 Connection: ${data.status}`);
                } else if (data.type === 'error') {
                    console.error('WebSocket error:', data.error);
                    setError(data.error);
                }
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };
        
        ws.onclose = (event) => {
            console.log(`❌ WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason || 'No reason'}`);
            setIsConnected(false);
            
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            
            if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
                reconnectAttemptsRef.current++;
                const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000);
                console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttemptsRef.current})`);
                
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, delay);
            }
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket error event:', error);
            setError('WebSocket connection error');
        };
        
        wsRef.current = ws;
    }, [ticketId]);
    
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close(1000, 'Normal closure');
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);
    
    const sendMessage = useCallback((message, senderType = 'agent', isInternalNote = false) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                message: message,
                sender_type: senderType,
                is_internal_note: isInternalNote
            }));
            console.log(`📤 Message sent via WebSocket (${senderType})`);
            return true;
        }
        console.warn('⚠️ WebSocket not connected, message not sent. ReadyState:', wsRef.current?.readyState);
        return false;
    }, []);
    
    useEffect(() => {
        if (ticketId) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [ticketId, connect, disconnect]);
    
    return {
        isConnected,
        messages,
        sendMessage,
        error
    };
};

export default useWebSocket;