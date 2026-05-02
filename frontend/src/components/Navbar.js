import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
    const navigate = useNavigate();
    const { isLoggedIn, user, logout } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const getDashboardLink = () => {
        if (user?.role === 'super_admin') {
            return '/super-admin/dashboard';
        } else if (user?.role === 'agent') {
            return '/agent/dashboard';
        } else {
            return '/my-tickets';
        }
    };

    return (
        <nav className="navbar">
            <div className="nav-container">
                <Link to="/" className="nav-logo">
                    <span className="logo-text">ABC Institution</span>
                    <span className="logo-badge">Helpdesk</span>
                </Link>

                <div className={`nav-menu ${menuOpen ? 'active' : ''}`}>
                    <ul className="nav-links">
                        <li><Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>Home</Link></li>
                        <li><Link to="/kb" className="nav-link" onClick={() => setMenuOpen(false)}>Knowledge Base</Link></li>
                        <li><Link to="/track" className="nav-link" onClick={() => setMenuOpen(false)}>Track Ticket</Link></li>
                        {user?.role !== 'super_admin' && (
                            <li><Link to="/ticket/new" className="nav-link" onClick={() => setMenuOpen(false)}>Submit Ticket</Link></li>
                        )}
                    </ul>

                    <div className="nav-auth">
                        {isLoggedIn ? (
                            <div className="user-menu">
                                <button className="user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                                    <span className="user-avatar">
                                        {user?.first_name?.charAt(0) || user?.username?.charAt(0)}
                                    </span>
                                    <span className="user-name">{user?.first_name || user?.username}</span>
                                </button>
                                {menuOpen && (
                                    <div className="dropdown-menu">
                                        <Link to={getDashboardLink()} className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                            Dashboard
                                        </Link>
                                        <div className="dropdown-divider"></div>
                                        <button onClick={handleLogout} className="dropdown-item logout-btn">
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="auth-buttons">
                                <Link to="/signin" className="auth-btn signin" onClick={() => setMenuOpen(false)}>Sign In</Link>
                                <Link to="/signup" className="auth-btn signup" onClick={() => setMenuOpen(false)}>Sign Up</Link>
                            </div>
                        )}
                    </div>
                </div>

                <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
                    <span className="bar"></span>
                    <span className="bar"></span>
                    <span className="bar"></span>
                </button>
            </div>
        </nav>
    );
}

export default Navbar;