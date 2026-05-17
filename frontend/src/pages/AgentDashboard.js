import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './AgentDashboard.css';

// ── helpers ──────────────────────────────────────────────────────────────────

function calcStats(list) {
    return list.reduce(
        (acc, t) => {
            acc.total += 1;
            if (t.status === 'new')      acc.new      += 1;
            if (t.status === 'open')     acc.open     += 1;
            if (t.status === 'pending')  acc.pending  += 1;
            if (t.status === 'resolved') acc.resolved += 1;
            return acc;
        },
        { total: 0, new: 0, open: 0, pending: 0, resolved: 0 }
    );
}

/**
 * Safe merge — never overwrites an existing truthy value with undefined/null/empty.
 * This prevents customer_name from disappearing when a WS update only carries
 * partial ticket data.
 */
function safeMerge(existing, incoming) {
    const merged = { ...existing };
    Object.keys(incoming).forEach(key => {
        const val = incoming[key];
        // Only overwrite if the incoming value is actually meaningful
        if (val !== undefined && val !== null && val !== '') {
            merged[key] = val;
        }
    });
    return merged;
}

// ── component ────────────────────────────────────────────────────────────────

function AgentDashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [user,    setUser]    = useState(null);
    const [tickets, setTickets] = useState([]);
    const [stats,   setStats]   = useState({ total: 0, new: 0, open: 0, pending: 0, resolved: 0 });
    const [filter,  setFilter]  = useState('all');
    const [toast,   setToast]   = useState(null);
    const toastTimer = useRef(null);

    // ── WS callback — fires DIRECTLY when ticket_update arrives ──────────
    // useCallback with empty deps → stable reference → hook never reconnects
    const handleTicketUpdate = useCallback((incomingTicket, updateType) => {
        if (!incomingTicket) return;
        console.log(`📥 WS [${updateType}] ticket #${incomingTicket.id}`);

        setTickets(prev => {
            const idx = prev.findIndex(t => t.id === incomingTicket.id);
            let next;
            if (idx !== -1) {
                // ✅ safeMerge: never wipe customer_name with undefined
                next = prev.map((t, i) => i === idx ? safeMerge(t, incomingTicket) : t);
            } else {
                // New ticket — prepend
                next = [incomingTicket, ...prev];
            }
            setStats(calcStats(next));
            return next;
        });

        if (updateType === 'new_ticket') {
            clearTimeout(toastTimer.current);
            setToast(`New ticket #${incomingTicket.id}: ${incomingTicket.title}`);
            toastTimer.current = setTimeout(() => setToast(null), 5000);
        }
    }, []);

    // ── WebSocket ─────────────────────────────────────────────────────────
    const { isConnected } = useWebSocket('dashboard', {
        onTicketUpdate: handleTicketUpdate,
    });

    // ── Initial fetch ─────────────────────────────────────────────────────
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
        return () => clearTimeout(toastTimer.current);
    }, [navigate, fetchTickets]);

    // ── Filtered list ─────────────────────────────────────────────────────
    const filteredTickets = filter === 'all'
        ? tickets
        : tickets.filter(t => t.status === filter);

    if (loading) return <div className="loading">Loading dashboard...</div>;

    return (
        <div className="agent-dashboard">

            {/* Toast */}
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
                        : <span className="status-disconnected">● Connecting…</span>
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

            {/* Table */}
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
                                    {/* ✅ fallback so cell is never blank */}
                                    <td>{ticket.customer_name || ticket.raised_by_name || '—'}</td>
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