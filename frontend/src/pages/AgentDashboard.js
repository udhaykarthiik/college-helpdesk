import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './AgentDashboard.css';

function AgentDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [filter, setFilter] = useState('all');
    const [stats, setStats] = useState({ total: 0, open: 0, pending: 0, resolved: 0, new: 0 });

    // Connect to dashboard WebSocket for real-time ticket notifications
    const { isConnected, ticketUpdates } = useWebSocket('dashboard');

    // Apply real-time ticket updates from WebSocket
    useEffect(() => {
        if (!ticketUpdates || ticketUpdates.length === 0) return;

        setTickets(prev => {
            let updated = [...prev];
            ticketUpdates.forEach(updatedTicket => {
                const idx = updated.findIndex(t => t.id === updatedTicket.id);
                if (idx !== -1) {
                    // Update existing ticket in place
                    updated[idx] = { ...updated[idx], ...updatedTicket };
                } else {
                    // Brand new ticket — prepend it
                    updated = [updatedTicket, ...updated];
                }
            });
            return updated;
        });

        // Recalculate stats after update
        setTickets(prev => {
            setStats({
                total: prev.length,
                open: prev.filter(t => t.status === 'open').length,
                pending: prev.filter(t => t.status === 'pending').length,
                resolved: prev.filter(t => t.status === 'resolved').length,
                new: prev.filter(t => t.status === 'new').length,
            });
            return prev;
        });
    }, [ticketUpdates]);

    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            const response = await agentApi.getTickets();
            const data = response.data || [];
            setTickets(data);
            setStats({
                total: data.length,
                open: data.filter(t => t.status === 'open').length,
                pending: data.filter(t => t.status === 'pending').length,
                resolved: data.filter(t => t.status === 'resolved').length,
                new: data.filter(t => t.status === 'new').length,
            });
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');

        if (!userStr || !token) { navigate('/signin'); return; }

        const userData = JSON.parse(userStr);
        if (userData.role !== 'agent') { navigate('/dashboard'); return; }

        setUser(userData);
        fetchTickets();
    }, [navigate, fetchTickets]);

    const getFilteredTickets = () => {
        if (filter === 'all') return tickets;
        return tickets.filter(t => t.status === filter);
    };

    if (loading) return <div className="loading">Loading dashboard...</div>;

    return (
        <div className="agent-dashboard">
            <div className="dashboard-header">
                <div>
                    <h1>Welcome back, {user?.first_name || user?.username}!</h1>
                    <p className="agent-badge">Agent Dashboard</p>
                </div>
                <div className="realtime-indicator">
                    {isConnected
                        ? <span className="status-connected">● Live</span>
                        : <span className="status-disconnected">● Offline</span>
                    }
                </div>
            </div>

            <div className="stats-grid">
                {[
                    { label: 'Total Tickets', key: 'total', cls: 'total' },
                    { label: 'New', key: 'new', cls: 'new' },
                    { label: 'Open', key: 'open', cls: 'open' },
                    { label: 'Pending', key: 'pending', cls: 'pending' },
                    { label: 'Resolved', key: 'resolved', cls: 'resolved' },
                ].map(({ label, key, cls }) => (
                    <div key={key} className={`stat-card ${cls}`}>
                        <h3>{label}</h3>
                        <p className="stat-number">{stats[key] || 0}</p>
                    </div>
                ))}
            </div>

            <div className="tickets-section">
                <div className="section-header">
                    <h2>All Tickets</h2>
                    <div className="filter-buttons">
                        {['all', 'new', 'open', 'pending', 'resolved'].map(f => (
                            <button
                                key={f}
                                className={`filter-btn ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                {f === 'all' ? ` (${stats.total})` : ` (${stats[f] || 0})`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="tickets-table-container">
                    <table className="tickets-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Title</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Assigned To</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getFilteredTickets().map(ticket => (
                                <tr key={ticket.id}>
                                    <td>#{ticket.id}</td>
                                    <td>{ticket.title}</td>
                                    <td>{ticket.customer_name}</td>
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
                                    <td>{ticket.assigned_to_name || 'Unassigned'}</td>
                                    <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button
                                            className="view-btn"
                                            onClick={() => navigate(`/agent/tickets/${ticket.id}`)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {getFilteredTickets().length === 0 && (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                        No tickets found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default AgentDashboard;