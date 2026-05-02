import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi, agentApi } from '../services/api';
import './TicketForm.css';

function TicketForm() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        customer_name: '',
        customer_email: '',
        category: '',
        priority: 'medium'
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await publicApi.getTicketCategories();
                setCategories(response.data);
                // Set default category
                if (response.data.length > 0) {
                    setFormData(prev => ({ ...prev, category: response.data[0].id }));
                }
            } catch (err) {
                console.error('Error fetching categories:', err);
            }
        };
        fetchCategories();
    }, []);

    // Check if user is logged in
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const userData = JSON.parse(userStr);
            setUser(userData);
            setFormData(prev => ({
                ...prev,
                customer_name: `${userData.first_name} ${userData.last_name}`.trim() || userData.username,
                customer_email: userData.email
            }));
        }
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            let response;
            
            // If user is logged in, use authenticated endpoint
            if (user) {
                response = await agentApi.createTicket({
                    title: formData.title,
                    description: formData.description,
                    category: parseInt(formData.category),
                    priority: formData.priority,
                    channel: 'web'
                });
                
                setSuccess({
                    ticketId: response.data.id,
                    message: 'Your ticket has been created. We will respond within 24 hours.'
                });
            } else {
                // For guest users, use public endpoint
                response = await publicApi.createTicket({
                    title: formData.title,
                    description: formData.description,
                    category: parseInt(formData.category),
                    priority: formData.priority,
                    email: formData.customer_email,
                    name: formData.customer_name
                });
                
                setSuccess({
                    ticketId: response.data.ticket_id,
                    message: response.data.message
                });
            }
            
            // Clear form
            setFormData(prev => ({
                title: '',
                description: '',
                customer_name: user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '',
                customer_email: user ? user.email : '',
                category: categories.length > 0 ? categories[0].id : '',
                priority: 'medium'
            }));

            window.scrollTo(0, 0);

        } catch (err) {
            console.error('Error:', err.response?.data);
            setError(err.response?.data?.error || err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const createAnother = () => {
        setSuccess(null);
    };

    return (
        <div className="ticket-form-container">
            <div className="form-header">
                <h1>Submit a Support Ticket</h1>
                <p>Submit your issue and we'll get back to you within 24 hours</p>
            </div>
            
            {success && (
                <div className="success-card">
                    <div className="success-icon">✅</div>
                    <h2>Ticket #{success.ticketId} Created!</h2>
                    <p>{success.message}</p>
                    <div className="success-actions">
                        <button onClick={createAnother} className="btn-secondary">
                            Create Another Ticket
                        </button>
                        <button onClick={() => navigate('/')} className="btn-primary">
                            Go to Home
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="error-card">
                    <div className="error-icon">❌</div>
                    <p>{error}</p>
                </div>
            )}

            {!success && (
                <form onSubmit={handleSubmit} className="ticket-form">
                    {!user && (
                        <>
                            <div className="form-section">
                                <h3>Your Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Your Name *</label>
                                        <input
                                            type="text"
                                            name="customer_name"
                                            value={formData.customer_name}
                                            onChange={handleChange}
                                            required
                                            placeholder="John Doe"
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Email Address *</label>
                                        <input
                                            type="email"
                                            name="customer_email"
                                            value={formData.customer_email}
                                            onChange={handleChange}
                                            required
                                            placeholder="john@abc.edu.in"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-section">
                        <h3>Ticket Details</h3>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label>Category</label>
                                <select name="category" value={formData.category} onChange={handleChange} disabled={loading}>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.display_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Priority</label>
                                <select
                                    name="priority"
                                    value={formData.priority}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="low">Low - General question</option>
                                    <option value="medium">Medium - Need help</option>
                                    <option value="high">High - Urgent issue</option>
                                    <option value="urgent">Urgent - System down</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Subject *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                required
                                placeholder="Brief summary of your issue"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Description *</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                required
                                rows="6"
                                placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or relevant information."
                                disabled={loading}
                            />
                            <small className="field-hint">
                                Be as detailed as possible to help us resolve your issue faster.
                            </small>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="submit-btn"
                        >
                            {loading ? 'Submitting...' : 'Submit Ticket'}
                        </button>
                        <button 
                            type="button"
                            onClick={() => navigate('/')}
                            className="cancel-btn"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default TicketForm;