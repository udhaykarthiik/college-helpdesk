import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import './MyTickets.css';

function MyTickets() {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');
        
        if (!userStr || !token) {
            navigate('/signin');
            return;
        }
        
        const userData = JSON.parse(userStr);
        if (userData.role === 'agent') {
            navigate('/agent/dashboard');
            return;
        }
        
        setUser(userData);
        fetchMyTickets(userData);
    }, [navigate]);

    const fetchMyTickets = async () => {
        try {
            setLoading(true);
            
            // Get logged-in user from localStorage
            const userStr = localStorage.getItem('user');
            const userData = JSON.parse(userStr);
            const userEmail = userData?.email;
            
            console.log("Logged in user email:", userEmail);
            
            // Fetch all tickets
            const response = await agentApi.getTickets();
            console.log("All tickets:", response.data);
            
            // Filter tickets by email
            const myTickets = response.data.filter(ticket => {
                // Try to match by email
                return ticket.raised_by_email === userEmail;
            });
            
            console.log("My tickets:", myTickets);
            setTickets(myTickets);
            
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading">Loading your tickets...</div>;
    }

    return (
        <div className="my-tickets-container">
            <div className="page-header">
                <h1>My Tickets</h1>
                <Link to="/ticket/new" className="new-ticket-btn">+ New Ticket</Link>
            </div>

            {tickets.length === 0 ? (
                <div className="no-tickets">
                    <p>You haven't created any tickets yet.</p>
                    <Link to="/ticket/new" className="btn-primary">Submit Your First Ticket</Link>
                </div>
            ) : (
                <div className="tickets-table-container">
                    <table className="tickets-table">
                        <thead>
                            <tr>
                                <th>Ticket ID</th>
                                <th>Subject</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map(ticket => (
                                <tr key={ticket.id}>
                                    <td>#{ticket.id}</td>
                                    <td>{ticket.title}</td>
                                    <td>
                                        <span className={`status-badge status-${ticket.status}`}>
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`priority-badge priority-${ticket.priority}`}>
                                            {ticket.priority}
                                        </span>
                                    </td>
                                    <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <Link to={`/track?ticket=${ticket.id}`} className="view-btn">
                                            Track
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default MyTickets;