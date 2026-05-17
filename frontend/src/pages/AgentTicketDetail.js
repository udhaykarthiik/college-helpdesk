import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './AgentTicketDetail.css';

function AgentTicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    const [ticket,           setTicket]           = useState(null);
    const [conversations,    setConversations]     = useState([]);
    const [loading,          setLoading]           = useState(true);
    const [reply,            setReply]             = useState('');
    const [submitting,       setSubmitting]        = useState(false);
    const [status,           setStatus]            = useState('');
    const [showCanned,       setShowCanned]        = useState(false);
    const [cannedResponses,  setCannedResponses]   = useState([]);
    const [renderingCanned,  setRenderingCanned]   = useState(false);
    const [attachments,      setAttachments]       = useState([]);
    const [selectedFile,     setSelectedFile]      = useState(null);
    const [uploading,        setUploading]         = useState(false);
    const [aiAnalysis,       setAiAnalysis]        = useState(null);
    const [aiSuggestedReply, setAiSuggestedReply]  = useState('');
    const [loadingAiReply,   setLoadingAiReply]    = useState(false);

    // ── WS: direct callback — no relay through state array ───────────────
    const handleChatMessage = useCallback((msg) => {
        setConversations(prev => {
            if (prev.some(c => c.id === msg.id)) return prev;
            return [...prev, msg];
        });
    }, []);

    // Agent always has JWT token — no publicEmail needed
    const { isConnected, sendMessage } = useWebSocket(id, {
        onChatMessage: handleChatMessage,
    });

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations]);

    const getBackUrl = () => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData.role === 'super_admin') return '/super-admin/dashboard';
        } catch (_) {}
        return '/agent/dashboard';
    };

    // ── Fetchers ─────────────────────────────────────────────────────────
    const fetchTicket = useCallback(async () => {
        try {
            setLoading(true);
            const response = await agentApi.getTicket(id);
            if (response?.data) {
                setTicket(response.data);
                setStatus(response.data.status);
            } else {
                navigate(getBackUrl());
            }
        } catch (err) {
            console.error('Error fetching ticket:', err);
            navigate(getBackUrl());
        } finally {
            setLoading(false);
        }
    }, [id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchConversations = useCallback(async () => {
        try {
            const response = await agentApi.getConversations(id);
            setConversations(response.data || []);
        } catch (err) {
            console.error('Error fetching conversations:', err);
        }
    }, [id]);

    const fetchCannedResponses = useCallback(async () => {
        try {
            const response = await agentApi.getCannedResponses();
            setCannedResponses(response.data || []);
        } catch (err) {
            console.error('Error fetching canned responses:', err);
        }
    }, []);

    const fetchAttachments = useCallback(async () => {
        try {
            const response = await agentApi.getAttachments(id);
            setAttachments(response.data || []);
        } catch (err) {
            console.error('Error fetching attachments:', err);
        }
    }, [id]);

    const fetchAiAnalysis = useCallback(async () => {
        try {
            const response = await agentApi.getTicket(id);
            const aiNote = response.data?.conversations?.find(
                c => c.is_internal_note && c.message?.includes('[AI ANALYSIS]')
            );
            if (aiNote) setAiAnalysis(aiNote.message);
        } catch (err) {
            console.error('Error fetching AI analysis:', err);
        }
    }, [id]);

    useEffect(() => {
        fetchTicket();
        fetchConversations();
        fetchCannedResponses();
        fetchAttachments();
        fetchAiAnalysis();
    }, [fetchTicket, fetchConversations, fetchCannedResponses, fetchAttachments, fetchAiAnalysis]);

    // ── Actions ───────────────────────────────────────────────────────────
    const getAiSuggestedReply = async () => {
        setLoadingAiReply(true);
        try {
            const response = await agentApi.aiSuggestResponse(id);
            setAiSuggestedReply(response.data.suggested_response || '');
        } catch (err) {
            console.error('AI suggestion error:', err);
        } finally {
            setLoadingAiReply(false);
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        try {
            await agentApi.addAttachment(id, selectedFile, 'agent');
            setSelectedFile(null);
            fetchAttachments();
            const el = document.getElementById('file-input');
            if (el) el.value = '';
        } catch (err) {
            alert('Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await agentApi.quickStatusChange(id, newStatus);
            setStatus(newStatus);
            setTicket(prev => ({ ...prev, status: newStatus }));
        } catch (err) {
            console.error('Status change error:', err);
        }
    };

    const handleAssignToMe = async () => {
        try {
            const response = await agentApi.quickAssignToMe(id);
            setTicket(prev => ({ ...prev, assigned_to_name: response.data.assigned_to }));
        } catch (err) {
            console.error('Assign error:', err);
        }
    };

    const handleResolve = async () => {
        try {
            await agentApi.quickResolve(id);
            setStatus('resolved');
            setTicket(prev => ({ ...prev, status: 'resolved' }));
        } catch (err) {
            console.error('Resolve error:', err);
        }
    };

    // Send via WS; REST fallback if WS not ready
    const handleAddConversation = async (e) => {
        e?.preventDefault();
        if (!reply.trim() || submitting) return;
        setSubmitting(true);
        try {
            const sent = sendMessage(reply, 'agent', false);
            if (!sent) {
                console.warn('⚠️ WS not ready, using REST');
                await agentApi.addConversation(id, {
                    sender_type: 'agent',
                    message: reply,
                    is_internal_note: false,
                });
                await fetchConversations();
            }
            setReply('');
        } catch (err) {
            alert('Failed to send message. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddInternalNote = async () => {
        if (!reply.trim() || submitting) return;
        setSubmitting(true);
        try {
            await agentApi.addConversation(id, {
                sender_type: 'agent',
                message: reply,
                is_internal_note: true,
            });
            setReply('');
            await fetchConversations();
        } catch (err) {
            alert('Failed to add internal note');
        } finally {
            setSubmitting(false);
        }
    };

    const insertCannedResponse = async (cannedId, content) => {
        setRenderingCanned(true);
        try {
            const response = await agentApi.renderCannedResponse({
                canned_response_id: cannedId,
                ticket_id: parseInt(id),
            });
            setReply(prev => prev + (prev ? '\n' : '') + response.data.rendered_content);
        } catch {
            setReply(prev => prev + (prev ? '\n' : '') + content);
        } finally {
            setRenderingCanned(false);
            setShowCanned(false);
        }
    };

    const parseAiAnalysis = () => {
        if (!aiAnalysis) return null;
        const result = {};
        for (const line of aiAnalysis.split('\n')) {
            if (line.includes('Category:')) result.category = line.split(':')[1]?.trim();
            if (line.includes('Priority:'))  result.priority  = line.split(':')[1]?.trim();
            if (line.includes('Sentiment:')) result.sentiment = line.split(':')[1]?.trim();
            if (line.includes('Summary:'))   result.summary   = line.split(':')[1]?.trim();
        }
        return result;
    };

    const getSenderLabel = (conv) => {
        if (conv.is_internal_note) return '🔒 Internal Note';
        if (conv.sender_type === 'agent') return conv.sender_name || 'Agent';
        return conv.sender_name || 'Customer';
    };

    const aiData = parseAiAnalysis();

    if (loading) return <div className="loading">Loading ticket...</div>;
    if (!ticket)  return <div className="loading">Ticket not found</div>;

    return (
        <div className="ticket-detail-container">
            <div className="ticket-detail-header">
                <button onClick={() => navigate(getBackUrl())} className="back-btn">
                    ← Back to Dashboard
                </button>
                <h1>Ticket #{ticket.id}: {ticket.title}</h1>
            </div>

            <div className="connection-status-bar">
                {isConnected
                    ? <span className="status-connected">● Real-time Connected</span>
                    : <span className="status-disconnected">● Connecting…</span>
                }
            </div>

            <div className="ticket-detail-grid">

                {/* Left Panel */}
                <div className="ticket-info-panel">
                    <div className="info-section">
                        <h3>Customer Information</h3>
                        <p><strong>Name:</strong>  {ticket.raised_by_name  || 'Guest User'}</p>
                        <p><strong>Email:</strong> {ticket.raised_by_email || 'Not provided'}</p>
                    </div>

                    {aiData && (
                        <div className="ai-analysis-card">
                            <div className="ai-header">
                                <span className="ai-icon">AI</span>
                                <h3>AI Analysis</h3>
                            </div>
                            <div className="ai-content">
                                {aiData.category  && <p><strong>Category:</strong>  {aiData.category}</p>}
                                {aiData.priority  && <p><strong>Priority:</strong>  <span className={`priority-${aiData.priority?.toLowerCase()}`}>{aiData.priority}</span></p>}
                                {aiData.sentiment && <p><strong>Sentiment:</strong> <span className={`sentiment-${aiData.sentiment?.toLowerCase()}`}>{aiData.sentiment}</span></p>}
                                {aiData.summary   && <p><strong>Summary:</strong>   {aiData.summary}</p>}
                            </div>
                        </div>
                    )}

                    <div className="info-section">
                        <h3>Ticket Details</h3>
                        <p>
                            <strong>Status:</strong>{' '}
                            <select value={status} onChange={e => handleStatusChange(e.target.value)}>
                                {['new','open','pending','resolved','closed'].map(s => (
                                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                            </select>
                        </p>
                        <p><strong>Priority:</strong> <span className={`priority-badge priority-${ticket.priority}`}>{ticket.priority}</span></p>
                        <p><strong>Channel:</strong>  {ticket.channel}</p>
                        <p><strong>Created:</strong>  {new Date(ticket.created_at).toLocaleString()}</p>
                        <p><strong>Assigned to:</strong> {ticket.assigned_to_name || 'Unassigned'}</p>
                    </div>

                    <div className="info-section">
                        <h3>Actions</h3>
                        <div className="action-buttons">
                            <button onClick={handleAssignToMe} className="action-btn assign">Assign to Me</button>
                            <button onClick={handleResolve}    className="action-btn resolve">Resolve Ticket</button>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="conversations-panel">
                    <div className="conversations-header">
                        <h3>Conversation History</h3>
                        <div className="header-buttons">
                            <button className="ai-suggest-btn" onClick={getAiSuggestedReply} disabled={loadingAiReply}>
                                {loadingAiReply ? 'Loading…' : '✨ AI Suggest'}
                            </button>
                            <button className="canned-btn" onClick={() => setShowCanned(!showCanned)} disabled={renderingCanned}>
                                {renderingCanned ? 'Loading…' : '📋 Canned Responses'}
                            </button>
                        </div>
                    </div>

                    {showCanned && (
                        <div className="canned-list">
                            <h4>Quick Templates:</h4>
                            {cannedResponses.length === 0
                                ? <div className="no-canned">No canned responses found.</div>
                                : cannedResponses.map(cr => (
                                    <button key={cr.id} className="canned-item" disabled={renderingCanned}
                                        onClick={() => insertCannedResponse(cr.id, cr.content)}>
                                        <strong>{cr.title}</strong> <span className="shortcode">({cr.shortcode})</span>
                                    </button>
                                ))
                            }
                        </div>
                    )}

                    <div className="conversations-list">
                        {conversations.length === 0
                            ? <div className="no-conversations"><p>No messages yet. Start the conversation!</p></div>
                            : conversations.map((conv, idx) => (
                                <div key={conv.id || idx}
                                    className={`message ${conv.sender_type} ${conv.is_internal_note ? 'internal-note' : ''}`}>
                                    <div className="message-header">
                                        <span className="sender">{getSenderLabel(conv)}</span>
                                        <span className="time">{new Date(conv.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="message-body">
                                        {conv.message.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                                    </div>
                                </div>
                            ))
                        }
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Attachments */}
                    <div className="attachment-section">
                        <h4>Attachments</h4>
                        <div className="attachment-list">
                            {attachments.length === 0
                                ? <div className="no-attachments">No attachments yet</div>
                                : attachments.map(att => (
                                    <div key={att.id} className="attachment-item">
                                        <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                                            📎 {att.filename} ({att.file_size_display})
                                        </a>
                                        <span className="attachment-by">by {att.uploaded_by}</span>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="upload-section">
                            <input type="file" id="file-input" onChange={e => setSelectedFile(e.target.files[0])} />
                            <button onClick={handleFileUpload} disabled={!selectedFile || uploading} className="upload-btn">
                                {uploading ? 'Uploading…' : 'Upload File'}
                            </button>
                        </div>
                    </div>

                    {/* AI Suggested Reply */}
                    {aiSuggestedReply && (
                        <div className="ai-suggestion">
                            <div className="ai-suggestion-header">
                                <span>✨ AI Suggested Reply:</span>
                                <button onClick={() => setReply(aiSuggestedReply)} className="use-suggestion-btn">Use This</button>
                            </div>
                            <div className="ai-suggestion-content">{aiSuggestedReply}</div>
                        </div>
                    )}

                    {/* Reply form */}
                    <div className="reply-form">
                        <h3>Reply to Customer</h3>
                        <textarea
                            value={reply}
                            onChange={e => setReply(e.target.value)}
                            onKeyDown={e => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleAddConversation(e);
                            }}
                            placeholder="Type your reply… (Ctrl+Enter to send)"
                            rows="4"
                            className="reply-textarea"
                        />
                        <div className="reply-buttons">
                            <button type="button" onClick={handleAddConversation}
                                disabled={submitting || !reply.trim()} className="send-btn">
                                {submitting ? 'Sending…' : 'Send Reply'}
                            </button>
                            <button type="button" onClick={handleAddInternalNote}
                                disabled={submitting || !reply.trim()} className="note-btn">
                                Add Internal Note
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AgentTicketDetail;