import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './AgentDashboard.css';

// ─── helpers ───────────────────────────────────────────────────────────────

function calcStats(list) {
    return list.reduce(
        (acc, t) => {
            acc.total    += 1;
            if (t.status === 'new')      acc.new      += 1;
            if (t.status === 'open')     acc.open     += 1;
            if (t.status === 'pending')  acc.pending  += 1;
            if (t.status === 'resolved') acc.resolved += 1;
            return acc;
        },
        { total: 0, new: 0, open: 0, pending: 0, resolved: 0 }
    );
}

// ─── component ─────────────────────────────────────────────────────────────

function AgentDashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [user,    setUser]    = useState(null);
    const [tickets, setTickets] = useState([]);
    const [stats,   setStats]   = useState({ total: 0, new: 0, open: 0, pending: 0, resolved: 0 });
    const [filter,  setFilter]  = useState('all');

    // Toast state for "new ticket" notification
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    // ── callback fired DIRECTLY when a ticket_update WS message arrives ──
    // Using useCallback with no deps so the reference is stable and doesn't
    // cause the WS hook to reconnect on every render.
    const handleTicketUpdate = useCallback((incomingTicket, updateType) => {
        console.log(`📥 WS ticket_update [${updateType}]:`, incomingTicket?.id);

        setTickets(prev => {
            const idx = prev.findIndex(t => t.id === incomingTicket.id);
            let next;
            if (idx !== -1) {
                // Merge update into the existing row
                next = prev.map((t, i) => i === idx ? { ...t, ...incomingTicket } : t);
            } else {
                // Prepend brand-new ticket to top of list
                next = [incomingTicket, ...prev];
            }
            // Recalculate stats in the same setState call
            setStats(calcStats(next));
            return next;
        });

        // Show a brief toast for new tickets
        if (updateType === 'new_ticket') {
            clearTimeout(toastTimerRef.current);
            setToast(`New ticket #${incomingTicket.id}: ${incomingTicket.title}`);
            toastTimerRef.current = setTimeout(() => setToast(null), 5000);
        }
    }, []); // no deps — intentionally stable

    // ── WebSocket — dashboard mode ────────────────────────────────────────
    const { isConnected } = useWebSocket('dashboard', {
        onTicketUpdate: handleTicketUpdate,
    });

    // ── initial REST fetch ────────────────────────────────────────────────
    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            const response = await agentApi.getTickets();
            const data = response.data || [];
            setTickets(data);
            setStats(calcStats(data));
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token   = localStorage.getItem('access_token');

        if (!userStr || !token) { navigate('/signin'); return; }

        const userData = JSON.parse(userStr);
        if (userData.role !== 'agent') { navigate('/dashboard'); return; }

        setUser(userData);
        fetchTickets();

        // Cleanup toast timer on unmount
        return () => clearTimeout(toastTimerRef.current);
    }, [navigate, fetchTickets]);

    // ── filtered view ─────────────────────────────────────────────────────
    const filteredTickets = filter === 'all'
        ? tickets
        : tickets.filter(t => t.status === filter);

    if (loading) return <div className="loading">Loading dashboard...</div>;

    return (
        <div className="agent-dashboard">

            {/* Toast notification */}
            {toast && (
                <div className="ws-toast">
                    🎫 {toast}
                    <button onClick={() => setToast(null)}>✕</button>
                </div>
            )}

            {/* Header */}
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

            {/* Stats */}
            <div className="stats-grid">
                {[
                    { label: 'Total Tickets', key: 'total',    cls: 'total'    },
                    { label: 'New',           key: 'new',      cls: 'new'      },
                    { label: 'Open',          key: 'open',     cls: 'open'     },
                    { label: 'Pending',       key: 'pending',  cls: 'pending'  },
                    { label: 'Resolved',      key: 'resolved', cls: 'resolved' },
                ].map(({ label, key, cls }) => (
                    <div key={key} className={`stat-card ${cls}`}>
                        <h3>{label}</h3>
                        <p className="stat-number">{stats[key]}</p>
                    </div>
                ))}
            </div>

            {/* Ticket table */}
            <div className="tickets-section">
                <div className="section-header">
                    <h2>All Tickets</h2>
                    <div className="filter-buttons">
                        {[
                            { key: 'all',      label: 'All'      },
                            { key: 'new',      label: 'New'      },
                            { key: 'open',     label: 'Open'     },
                            { key: 'pending',  label: 'Pending'  },
                            { key: 'resolved', label: 'Resolved' },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                className={`filter-btn ${filter === key ? 'active' : ''}`}
                                onClick={() => setFilter(key)}
                            >
                                {label} ({key === 'all' ? stats.total : (stats[key] ?? 0)})
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
                            {filteredTickets.map(ticket => (
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

                            {filteredTickets.length === 0 && (
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