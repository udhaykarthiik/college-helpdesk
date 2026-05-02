import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import './AgentTicketDetail.css';

function AgentTicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState('');
    const [showCanned, setShowCanned] = useState(false);
    const [cannedResponses, setCannedResponses] = useState([]);
    const [renderingCanned, setRenderingCanned] = useState(false);
    
    const [attachments, setAttachments] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [aiSuggestedReply, setAiSuggestedReply] = useState('');
    const [loadingAiReply, setLoadingAiReply] = useState(false);

    useEffect(() => {
        fetchTicket();
        fetchCannedResponses();
        fetchAttachments();
        fetchAiAnalysis();
    }, [id]);

    // Get back URL based on user role
    const getBackUrl = () => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const userData = JSON.parse(userStr);
            if (userData.role === 'super_admin') {
                return '/super-admin/dashboard';
            }
        }
        return '/agent/dashboard';
    };

    const fetchTicket = async () => {
        try {
            setLoading(true);
            const response = await agentApi.getTicket(id);
            setTicket(response.data);
            setStatus(response.data.status);
        } catch (err) {
            console.error('Error fetching ticket:', err);
            navigate(getBackUrl());
        } finally {
            setLoading(false);
        }
    };

    const fetchCannedResponses = async () => {
        try {
            const response = await agentApi.getCannedResponses();
            setCannedResponses(response.data);
        } catch (err) {
            console.error('Error fetching canned responses:', err);
        }
    };

    const fetchAttachments = async () => {
        try {
            const response = await agentApi.getAttachments(id);
            setAttachments(response.data);
        } catch (err) {
            console.error('Error fetching attachments:', err);
        }
    };

    const fetchAiAnalysis = async () => {
        try {
            const response = await agentApi.getTicket(id);
            const aiNote = response.data.conversations?.find(
                conv => conv.is_internal_note && conv.message && conv.message.includes('[AI ANALYSIS]')
            );
            if (aiNote) {
                setAiAnalysis(aiNote.message);
            }
        } catch (err) {
            console.error('Error fetching AI analysis:', err);
        }
    };

    const getAiSuggestedReply = async () => {
        setLoadingAiReply(true);
        try {
            const response = await agentApi.aiSuggestResponse(id);
            setAiSuggestedReply(response.data.suggested_response);
        } catch (err) {
            console.error('Error getting AI suggested reply:', err);
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
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.value = '';
        } catch (err) {
            console.error('Error uploading file:', err);
            alert('Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await agentApi.quickStatusChange(id, newStatus);
            setStatus(newStatus);
            setTicket({ ...ticket, status: newStatus });
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const handleAssignToMe = async () => {
        try {
            const response = await agentApi.quickAssignToMe(id);
            setTicket({ ...ticket, assigned_to_name: response.data.assigned_to });
        } catch (err) {
            console.error('Error assigning to self:', err);
        }
    };

    const handleResolve = async () => {
        try {
            await agentApi.quickResolve(id);
            setStatus('resolved');
            setTicket({ ...ticket, status: 'resolved' });
        } catch (err) {
            console.error('Error resolving ticket:', err);
        }
    };

    const handleAddConversation = async (e) => {
        e.preventDefault();
        if (!reply.trim()) return;

        setSubmitting(true);
        try {
            await agentApi.addConversation(id, {
                sender_type: 'agent',
                message: reply,
                is_internal_note: false
            });
            setReply('');
            fetchTicket();
        } catch (err) {
            console.error('Error sending reply:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddInternalNote = async () => {
        if (!reply.trim()) return;
        
        if (submitting) return;

        setSubmitting(true);
        try {
            await agentApi.addConversation(id, {
                sender_type: 'agent',
                message: reply,
                is_internal_note: true
            });
            setReply('');
            await fetchTicket();
        } catch (err) {
            console.error('Error adding note:', err);
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
                ticket_id: parseInt(id)
            });
            const renderedContent = response.data.rendered_content;
            setReply(reply + '\n' + renderedContent);
        } catch (err) {
            console.error('Error rendering canned response:', err);
            setReply(reply + '\n' + content);
        } finally {
            setRenderingCanned(false);
            setShowCanned(false);
        }
    };

    const parseAiAnalysis = () => {
        if (!aiAnalysis) return null;
        
        const result = {};
        const lines = aiAnalysis.split('\n');
        for (const line of lines) {
            if (line.includes('Category:')) {
                result.category = line.split(':')[1]?.trim();
            }
            if (line.includes('Priority:')) {
                result.priority = line.split(':')[1]?.trim();
            }
            if (line.includes('Sentiment:')) {
                result.sentiment = line.split(':')[1]?.trim();
            }
            if (line.includes('Summary:')) {
                result.summary = line.split(':')[1]?.trim();
            }
        }
        return result;
    };

    const aiData = parseAiAnalysis();

    const getSenderName = (conv) => {
        if (conv.is_internal_note) return 'Internal Note';
        if (conv.sender_type === 'agent') return 'Agent';
        return 'Customer';
    };

    if (loading) {
        return <div className="loading">Loading ticket...</div>;
    }

    if (!ticket) {
        return <div className="loading">Ticket not found</div>;
    }

    return (
        <div className="ticket-detail-container">
            <div className="ticket-detail-header">
                <button onClick={() => navigate(getBackUrl())} className="back-btn">
                    ← Back to Dashboard
                </button>
                <h1>Ticket #{ticket.id}: {ticket.title}</h1>
            </div>

            <div className="ticket-detail-grid">
                <div className="ticket-info-panel">
                    <div className="info-section">
                        <h3>Customer Information</h3>
                        <p><strong>Name:</strong> {ticket.raised_by_name || 'Guest User'}</p>
                        <p><strong>Email:</strong> {ticket.raised_by_email || 'Not provided'}</p>
                    </div>

                    {aiData && (
                        <div className="ai-analysis-card">
                            <div className="ai-header">
                                <span className="ai-icon">AI</span>
                                <h3>AI Analysis</h3>
                            </div>
                            <div className="ai-content">
                                {aiData.category && (
                                    <p><strong>Category:</strong> {aiData.category}</p>
                                )}
                                {aiData.priority && (
                                    <p><strong>Priority:</strong> 
                                        <span className={`priority-${aiData.priority?.toLowerCase()}`}> {aiData.priority}</span>
                                    </p>
                                )}
                                {aiData.sentiment && (
                                    <p><strong>Sentiment:</strong> 
                                        <span className={`sentiment-${aiData.sentiment?.toLowerCase()}`}> {aiData.sentiment}</span>
                                    </p>
                                )}
                                {aiData.summary && (
                                    <p><strong>Summary:</strong> {aiData.summary}</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="info-section">
                        <h3>Ticket Details</h3>
                        <p><strong>Status:</strong> 
                            <select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                                <option value="new">New</option>
                                <option value="open">Open</option>
                                <option value="pending">Pending</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </p>
                        <p><strong>Priority:</strong> 
                            <span className={`priority-badge priority-${ticket.priority}`}>
                                {ticket.priority}
                            </span>
                        </p>
                        <p><strong>Channel:</strong> {ticket.channel}</p>
                        <p><strong>Created:</strong> {new Date(ticket.created_at).toLocaleString()}</p>
                        <p><strong>Assigned to:</strong> {ticket.assigned_to_name || 'Unassigned'}</p>
                    </div>

                    <div className="info-section">
                        <h3>Actions</h3>
                        <div className="action-buttons">
                            <button onClick={handleAssignToMe} className="action-btn assign">
                                Assign to Me
                            </button>
                            <button onClick={handleResolve} className="action-btn resolve">
                                Resolve Ticket
                            </button>
                        </div>
                    </div>
                </div>

                <div className="conversations-panel">
                    <div className="conversations-header">
                        <h3>Conversation History</h3>
                        <div className="header-buttons">
                            <button 
                                className="ai-suggest-btn"
                                onClick={getAiSuggestedReply}
                                disabled={loadingAiReply}
                            >
                                AI Suggest {loadingAiReply && '(Loading...)'}
                            </button>
                            <button 
                                className="canned-btn"
                                onClick={() => setShowCanned(!showCanned)}
                                disabled={renderingCanned}
                            >
                                Canned Responses {renderingCanned && '(Loading...)'}
                            </button>
                        </div>
                    </div>

                    {showCanned && (
                        <div className="canned-list">
                            <h4>Quick Templates:</h4>
                            {cannedResponses.map(cr => (
                                <button 
                                    key={cr.id}
                                    className="canned-item"
                                    onClick={() => insertCannedResponse(cr.id, cr.content)}
                                    disabled={renderingCanned}
                                >
                                    <strong>{cr.title}</strong> ({cr.shortcode})
                                </button>
                            ))}
                            {cannedResponses.length === 0 && (
                                <div className="no-canned">No canned responses found. Create some in admin panel.</div>
                            )}
                        </div>
                    )}

                    <div className="conversations-list">
                        {ticket.conversations?.map((conv, index) => (
                            <div key={conv.id || index} className={`message ${conv.sender_type} ${conv.is_internal_note ? 'internal-note' : ''}`}>
                                <div className="message-header">
                                    <span className="sender">
                                        {getSenderName(conv)}
                                    </span>
                                    <span className="time">
                                        {new Date(conv.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="message-body">
                                    {conv.message.split('\n').map((line, i) => (
                                        <p key={i}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="attachment-section">
                        <h4>Attachments</h4>
                        <div className="attachment-list">
                            {attachments.map(att => (
                                <div key={att.id} className="attachment-item">
                                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                                        📎 {att.filename} ({att.file_size_display})
                                    </a>
                                    <span className="attachment-by">Uploaded by: {att.uploaded_by}</span>
                                </div>
                            ))}
                            {attachments.length === 0 && (
                                <div className="no-attachments">No attachments yet</div>
                            )}
                        </div>
                        
                        <div className="upload-section">
                            <input 
                                type="file" 
                                id="file-input"
                                onChange={(e) => setSelectedFile(e.target.files[0])}
                            />
                            <button 
                                onClick={handleFileUpload} 
                                disabled={!selectedFile || uploading}
                                className="upload-btn"
                            >
                                {uploading ? 'Uploading...' : 'Upload File'}
                            </button>
                        </div>
                    </div>

                    {aiSuggestedReply && (
                        <div className="ai-suggestion">
                            <div className="ai-suggestion-header">
                                <span>AI Suggested Reply:</span>
                                <button onClick={() => setReply(aiSuggestedReply)} className="use-suggestion-btn">
                                    Use This
                                </button>
                            </div>
                            <div className="ai-suggestion-content">
                                {aiSuggestedReply}
                            </div>
                        </div>
                    )}

                    <div className="reply-form">
                        <h3>Reply to Customer</h3>
                        <textarea
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder="Type your reply here..."
                            rows="5"
                        />
                        <div className="reply-buttons">
                            <button 
                                type="button"
                                onClick={handleAddConversation}
                                disabled={submitting || !reply.trim()}
                                className="send-btn"
                            >
                                {submitting ? 'Sending...' : 'Send Reply'}
                            </button>
                            <button 
                                type="button"
                                onClick={handleAddInternalNote}
                                disabled={submitting || !reply.trim()}
                                className="note-btn"
                            >
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