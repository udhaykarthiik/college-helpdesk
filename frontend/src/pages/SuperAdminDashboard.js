import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import './SuperAdminDashboard.css';

function SuperAdminDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalStaff: 0,
        totalParents: 0,
        totalAgents: 0,
        totalTickets: 0,
        openTickets: 0,
        resolvedTickets: 0
    });
    const [recentTickets, setRecentTickets] = useState([]);
    const [users, setUsers] = useState([]);
    const [error, setError] = useState(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');
        
        if (!userStr || !token) {
            navigate('/signin');
            return;
        }

        const userData = JSON.parse(userStr);
        if (userData.role !== 'super_admin') {
            if (userData.role === 'agent') {
                navigate('/agent/dashboard');
            } else {
                navigate('/my-tickets');
            }
            return;
        }

        setUser(userData);
        fetchDashboardData();
    }, [navigate]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await agentApi.getAdminStats();
            console.log("Admin stats response:", response.data);
            
            setStats({
                totalStudents: response.data.stats.students,
                totalStaff: response.data.stats.staff,
                totalParents: response.data.stats.parents,
                totalAgents: response.data.stats.agents,
                totalTickets: response.data.stats.total_tickets,
                openTickets: response.data.stats.open_tickets,
                resolvedTickets: response.data.stats.resolved_tickets
            });
            
            setRecentTickets(response.data.recent_tickets);
            setUsers(response.data.users);
            
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError('Failed to load dashboard data. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        if (updating) return;
        
        setUpdating(true);
        try {
            await agentApi.updateUserRole(userId, newRole);
            await fetchDashboardData();
        } catch (err) {
            console.error('Error updating role:', err);
            alert('Failed to update user role');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
            try {
                await agentApi.deleteUser(userId);
                await fetchDashboardData();
            } catch (err) {
                console.error('Error deleting user:', err);
                alert('Failed to delete user');
            }
        }
    };

    const handleViewTicket = (ticketId) => {
        window.open(`/agent/tickets/${ticketId}`, '_blank');
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        navigate('/');
    };

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="super-admin-dashboard">
            <div className="dashboard-header">
                <h1>Super Admin Dashboard</h1>
                <p>Welcome, {user?.first_name || user?.username}!</p>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Total Students</h3>
                    <p className="stat-number">{stats.totalStudents}</p>
                </div>
                <div className="stat-card">
                    <h3>Total Staff</h3>
                    <p className="stat-number">{stats.totalStaff}</p>
                </div>
                <div className="stat-card">
                    <h3>Total Parents</h3>
                    <p className="stat-number">{stats.totalParents}</p>
                </div>
                <div className="stat-card">
                    <h3>Total Agents</h3>
                    <p className="stat-number">{stats.totalAgents}</p>
                </div>
                <div className="stat-card">
                    <h3>Total Tickets</h3>
                    <p className="stat-number">{stats.totalTickets}</p>
                </div>
                <div className="stat-card">
                    <h3>Open Tickets</h3>
                    <p className="stat-number">{stats.openTickets}</p>
                </div>
                <div className="stat-card">
                    <h3>Resolved Tickets</h3>
                    <p className="stat-number">{stats.resolvedTickets}</p>
                </div>
            </div>

            <div className="admin-actions">
                <h2>Admin Actions</h2>
                <div className="action-buttons">
                    <button className="action-btn" onClick={() => navigate('/admin/knowledge-base')}>
                        Manage Articles
                    </button>
                    <button className="action-btn" onClick={() => navigate('/admin/categories')}>
                        Manage Categories
                    </button>
                    <button className="action-btn" onClick={() => navigate('/admin')}>
                        Django Admin
                    </button>
                    <button className="action-btn" onClick={() => fetchDashboardData()}>
                        Refresh Data
                    </button>
                </div>
            </div>

            <div className="users-section">
                <h2>Manage Users</h2>
                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Department/Roll No</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td>{user.first_name} {user.last_name}</td>
                                    <td>
                                        <select 
                                            value={user.role} 
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            className="role-select"
                                            disabled={updating}
                                        >
                                            <option value="student">Student</option>
                                            <option value="staff">Staff</option>
                                            <option value="parent">Parent</option>
                                            <option value="agent">Agent</option>
                                        </select>
                                    </td>
                                    <td>{user.department || user.roll_number || '-'}</td>
                                    <td>
                                        {user.username !== 'super_admin' && (
                                            <button 
                                                onClick={() => handleDeleteUser(user.id, user.username)} 
                                                className="delete-btn"
                                                disabled={updating}
                                            >
                                                Delete
                                            </button>
                                        )}
                                        {user.username === 'super_admin' && (
                                            <span className="super-admin-badge">Super Admin</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="recent-tickets">
                <h2>Recent Tickets</h2>
                <div className="tickets-table-container">
                    <table className="tickets-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Title</th>
                                <th>Raised By</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTickets.map(ticket => (
                                <tr key={ticket.id}>
                                    <td>#{ticket.id}</td>
                                    <td>{ticket.title}</td>
                                    <td>{ticket.raised_by_name || 'Guest'}</td>
                                    <td>{ticket.category_name}</td>
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
                                        <button 
                                            className="view-btn"
                                            onClick={() => handleViewTicket(ticket.id)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {recentTickets.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="no-data">No tickets found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default SuperAdminDashboard;