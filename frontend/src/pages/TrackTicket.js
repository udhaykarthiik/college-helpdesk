import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './TrackTicket.css';

function TrackTicket() {
    const navigate = useNavigate();
    const [email,         setEmail]         = useState('');
    const [ticketId,      setTicketId]      = useState('');
    const [ticket,        setTicket]        = useState(null);
    const [conversations, setConversations] = useState([]);
    const [loading,       setLoading]       = useState(false);
    const [error,         setError]         = useState(null);
    const [replyMessage,  setReplyMessage]  = useState('');
    const [sendingReply,  setSendingReply]  = useState(false);
    const [replyError,    setReplyError]    = useState(null);
    const [replySuccess,  setReplySuccess]  = useState(false);

    const messagesEndRef = useRef(null);

    // ✅ Check if user is logged in (has JWT token)
    const token = localStorage.getItem('access_token');
    const isLoggedIn = !!token;

    // Only connect WS when ticket exists and isn't resolved/closed AND user is logged in
    const cleanId    = ticketId.replace('#', '');
    const wsTicketId = (ticket && ticket.status !== 'resolved' && ticket.status !== 'closed' && isLoggedIn)
        ? cleanId : null;

    // ── WS chat callback — filters internal notes ─────────────────────────
    const handleChatMessage = useCallback((msg) => {
        if (msg.is_internal_note) return; // customers never see internal notes
        setConversations(prev => {
            if (prev.some(c => c.id === msg.id)) return prev;
            return [...prev, msg];
        });
    }, []);

    // ✅ Use WebSocket with JWT token (no publicEmail)
    const { isConnected, sendMessage } = useWebSocket(wsTicketId, {
        onChatMessage: handleChatMessage,
    });

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations]);

    // Pre-fill from URL / localStorage
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('ticket');
        if (t) setTicketId(t);
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData.email) setEmail(userData.email);
        } catch (_) {}
    }, []);

    const fetchConversations = useCallback(async (tid, userEmail) => {
        try {
            const response = await publicApi.getTicketConversations(tid, userEmail);
            // Filter internal notes — customers must not see them
            const visible = (response.data || []).filter(c => !c.is_internal_note);
            setConversations(visible);
        } catch (err) {
            console.error('Error fetching conversations:', err);
            setConversations([]);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setTicket(null);
        setConversations([]);
        setReplySuccess(false);
        setReplyError(null);

        const tid = ticketId.replace('#', '');
        try {
            const response = await publicApi.getTicketStatus(tid, email);
            setTicket(response.data);
            await fetchConversations(tid, email);
        } catch (err) {
            setError('Ticket not found. Please check your email and ticket ID.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyMessage.trim()) return;
        setSendingReply(true);
        setReplyError(null);
        setReplySuccess(false);

        const tid = ticketId.replace('#', '');
        try {
            // ✅ Try WebSocket first (real-time)
            const sent = sendMessage(replyMessage, 'user', false);

            if (!sent) {
                // WS not ready — REST fallback
                console.warn('⚠️ WS not ready, using REST');
                await publicApi.addUserReply(tid, { message: replyMessage, email });
                const [updatedTicket] = await Promise.all([
                    publicApi.getTicketStatus(tid, email),
                    fetchConversations(tid, email),
                ]);
                setTicket(updatedTicket.data);
            }

            setReplyMessage('');
            setReplySuccess(true);
            setTimeout(() => setReplySuccess(false), 3000);
        } catch (err) {
            console.error('Error sending reply:', err);
            setReplyError('Failed to send reply. Please try again.');
        } finally {
            setSendingReply(false);
        }
    };

    return (
        <div className="track-ticket-container">
            <div className="track-header">
                <h1>Track Your Ticket</h1>
                <p>Enter your email and ticket ID to check the current status</p>
            </div>

            <div className="track-content">
                {/* Search form */}
                <div className="track-form-container">
                    <form onSubmit={handleSubmit} className="track-form">
                        <div className="form-group">
                            <label>Email Address</label>
                            <input type="email" value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="john@example.com" required disabled={loading} />
                        </div>
                        <div className="form-group">
                            <label>Ticket ID</label>
                            <input type="text" value={ticketId}
                                onChange={e => setTicketId(e.target.value)}
                                placeholder="#123 or 123" required disabled={loading} />
                            <small className="hint">You can include or omit the # symbol</small>
                        </div>
                        <button type="submit" className="track-btn" disabled={loading}>
                            {loading ? 'Checking…' : 'Track Ticket'}
                        </button>
                    </form>

                    {error && (
                        <div className="error-message">
                            <span className="error-icon">❌</span>
                            <p>{error}</p>
                        </div>
                    )}
                </div>

                {/* Ticket result */}
                {ticket && (
                    <div className="ticket-result">

                        {/* ✅ Show connection status only if logged in */}
                        {isLoggedIn && wsTicketId && (
                            <div className="connection-status-bar">
                                {isConnected
                                    ? <span className="status-connected">● Real-time Connected</span>
                                    : <span className="status-disconnected">● Connecting…</span>
                                }
                            </div>
                        )}

                        {/* ✅ Show info banner for non-logged in users */}
                        {!isLoggedIn && (
                            <div className="info-banner">
                                <span>ℹ️</span>
                                <p><Link to="/signin">Sign in</Link> to enable real-time messaging</p>
                            </div>
                        )}

                        <div className="ticket-header">
                            <h2>Ticket #{ticket.id}</h2>
                            <span className={`status-badge status-${ticket.status}`}>{ticket.status}</span>
                        </div>

                        <div className="ticket-info">
                            <div className="info-row"><strong>Subject:</strong>      <span>{ticket.title}</span></div>
                            <div className="info-row"><strong>Created:</strong>      <span>{new Date(ticket.created_at).toLocaleString()}</span></div>
                            <div className="info-row"><strong>Last Updated:</strong> <span>{new Date(ticket.updated_at).toLocaleString()}</span></div>
                            <div className="info-row">
                                <strong>Priority:</strong>
                                <span className={`priority-${ticket.priority}`}>{ticket.priority}</span>
                            </div>
                        </div>

                        <div className="ticket-description">
                            <h3>Your Message</h3>
                            <p>{ticket.description}</p>
                        </div>

                        {/* Conversation history */}
                        <div className="ticket-conversations">
                            <h3>Conversation History</h3>
                            {conversations.length === 0
                                ? <div className="no-conversations"><p>No messages yet. Be the first to reply!</p></div>
                                : conversations.map((conv, idx) => (
                                    <div key={conv.id || idx} className="conversation-item">
                                        <div className="conversation-header">
                                            <span className={`sender-badge sender-${conv.sender_type}`}>
                                                {conv.sender_type === 'agent' ? 'Support Agent' : 'You'}
                                            </span>
                                            <span className="conversation-time">
                                                {new Date(conv.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="conversation-message">{conv.message}</p>
                                    </div>
                                ))
                            }
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply box — only for open tickets AND logged in users */}
                        {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                            <div className="customer-reply-section">
                                <h3>Reply to Support</h3>
                                {replySuccess && <div className="reply-success-message">✅ Your reply has been sent!</div>}
                                {replyError   && <div className="reply-error-message">❌ {replyError}</div>}
                                
                                {isLoggedIn ? (
                                    <>
                                        <textarea
                                            value={replyMessage}
                                            onChange={e => setReplyMessage(e.target.value)}
                                            onKeyDown={e => {
                                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSendReply();
                                            }}
                                            placeholder="Type your reply… (Ctrl+Enter to send)"
                                            rows="4"
                                            className="reply-textarea"
                                        />
                                        <button
                                            onClick={handleSendReply}
                                            disabled={sendingReply || !replyMessage.trim()}
                                            className="send-reply-btn"
                                        >
                                            {sendingReply ? 'Sending…' : 'Send Reply'}
                                        </button>
                                    </>
                                ) : (
                                    <div className="login-to-reply">
                                        <p>Please <Link to="/signin">sign in</Link> to reply to this ticket.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                            <div className="ticket-closed-notice">
                                <p>This ticket is {ticket.status}. If you need further assistance, please create a new ticket.</p>
                            </div>
                        )}

                        <div className="ticket-actions">
                            <Link to="/ticket/new"  className="action-btn primary">Create New Ticket</Link>
                            <Link to="/my-tickets"  className="action-btn secondary">View My Tickets</Link>
                        </div>
                    </div>
                )}
            </div>

            <div className="track-footer">
                <p>Didn't receive a ticket ID? Check your email or <Link to="/contact">contact support</Link></p>
            </div>
        </div>
    );
}

export default TrackTicket;