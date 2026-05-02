import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../services/api';
import './TrackTicket.css';

function TrackTicket() {
    const [email, setEmail] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Reply states
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [replyError, setReplyError] = useState(null);
    const [replySuccess, setReplySuccess] = useState(false);

    // Check URL for ticket parameter on load
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const ticketFromUrl = urlParams.get('ticket');
        if (ticketFromUrl) {
            setTicketId(ticketFromUrl);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setTicket(null);
        setReplySuccess(false);
        setReplyError(null);

        const cleanTicketId = ticketId.replace('#', '');

        try {
            const response = await publicApi.getTicketStatus(cleanTicketId, email);
            setTicket(response.data);
        } catch (err) {
            setError('Ticket not found. Please check your email and ticket ID.');
            console.error('Track ticket error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyMessage.trim()) return;
        
        setSendingReply(true);
        setReplyError(null);
        setReplySuccess(false);
        
        const cleanTicketId = ticketId.replace('#', '');
        
        try {
            const response = await publicApi.addUserReply(cleanTicketId, {
                message: replyMessage,
                email: email
            });
            
            if (response.data.success) {
                setReplySuccess(true);
                setReplyMessage('');
                // Refresh ticket to show new message
                const updatedTicket = await publicApi.getTicketStatus(cleanTicketId, email);
                setTicket(updatedTicket.data);
            }
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
                <div className="track-form-container">
                    <form onSubmit={handleSubmit} className="track-form">
                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="john@example.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Ticket ID</label>
                            <input
                                type="text"
                                value={ticketId}
                                onChange={(e) => setTicketId(e.target.value)}
                                placeholder="#123 or 123"
                                required
                                disabled={loading}
                            />
                            <small className="hint">You can include or omit the # symbol</small>
                        </div>

                        <button 
                            type="submit" 
                            className="track-btn"
                            disabled={loading}
                        >
                            {loading ? 'Checking...' : 'Track Ticket'}
                        </button>
                    </form>

                    {error && (
                        <div className="error-message">
                            <span className="error-icon">❌</span>
                            <p>{error}</p>
                        </div>
                    )}
                </div>

                {ticket && (
                    <div className="ticket-result">
                        <div className="ticket-header">
                            <h2>Ticket #{ticket.id}</h2>
                            <span className={`status-badge status-${ticket.status}`}>
                                {ticket.status}
                            </span>
                        </div>

                        <div className="ticket-info">
                            <div className="info-row">
                                <strong>Subject:</strong>
                                <span>{ticket.title}</span>
                            </div>
                            <div className="info-row">
                                <strong>Created:</strong>
                                <span>{new Date(ticket.created_at).toLocaleString()}</span>
                            </div>
                            <div className="info-row">
                                <strong>Last Updated:</strong>
                                <span>{new Date(ticket.updated_at).toLocaleString()}</span>
                            </div>
                            <div className="info-row">
                                <strong>Priority:</strong>
                                <span className={`priority-${ticket.priority}`}>
                                    {ticket.priority}
                                </span>
                            </div>
                        </div>

                        <div className="ticket-description">
                            <h3>Your Message</h3>
                            <p>{ticket.description}</p>
                        </div>

                        {ticket.conversations && ticket.conversations.length > 0 && (
                            <div className="ticket-conversations">
                                <h3>Conversation History</h3>
                                {ticket.conversations.map((conv, index) => (
                                    <div key={conv.id || index} className="conversation-item">
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
                                ))}
                            </div>
                        )}

                        {/* Customer Reply Section */}
                        {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                            <div className="customer-reply-section">
                                <h3>Reply to Support</h3>
                                {replySuccess && (
                                    <div className="reply-success-message">
                                        ✅ Your reply has been sent successfully!
                                    </div>
                                )}
                                {replyError && (
                                    <div className="reply-error-message">
                                        ❌ {replyError}
                                    </div>
                                )}
                                <textarea
                                    value={replyMessage}
                                    onChange={(e) => setReplyMessage(e.target.value)}
                                    placeholder="Type your reply here..."
                                    rows="4"
                                    className="reply-textarea"
                                />
                                <button 
                                    onClick={handleSendReply}
                                    disabled={sendingReply || !replyMessage.trim()}
                                    className="send-reply-btn"
                                >
                                    {sendingReply ? 'Sending...' : 'Send Reply'}
                                </button>
                            </div>
                        )}

                        <div className="ticket-actions">
                            <Link to="/ticket/new" className="action-btn primary">
                                Create New Ticket
                            </Link>
                            <Link to="/my-tickets" className="action-btn secondary">
                                View My Tickets
                            </Link>
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