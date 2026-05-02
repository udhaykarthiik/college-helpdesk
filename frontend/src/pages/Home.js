import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user');
        
        if (token && userStr) {
            const userData = JSON.parse(userStr);
            setIsLoggedIn(true);
            setUser(userData);
            
            // Redirect super admin to their dashboard
            if (userData.role === 'super_admin') {
                navigate('/super-admin/dashboard');
                return;
            }
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        setIsLoggedIn(false);
        setUser(null);
        navigate('/');
    };

    return (
        <div className="home">
            {/* Hero Section */}
            <div className="hero-section">
                <h1>ABC Institution Helpdesk</h1>
                <p>24/7 Support for Students, Staff, and Parents</p>
                
                {isLoggedIn ? (
                    <div className="cta-buttons">
                        {user?.role === 'agent' ? (
                            <Link to="/agent/dashboard" className="btn btn-primary">Go to Dashboard</Link>
                        ) : (
                            <Link to="/my-tickets" className="btn btn-primary">My Tickets</Link>
                        )}
                        {user?.role !== 'super_admin' && (
                            <Link to="/ticket/new" className="btn btn-secondary">Submit Ticket</Link>
                        )}
                        <Link to="/kb" className="btn btn-outline">Knowledge Base</Link>
                        <button onClick={handleLogout} className="btn btn-outline">Logout</button>
                    </div>
                ) : (
                    <div className="cta-buttons">
                        <Link to="/ticket/new" className="btn btn-primary">Submit a Ticket</Link>
                        <Link to="/kb" className="btn btn-secondary">Knowledge Base</Link>
                        <Link to="/signup" className="btn btn-outline">Sign Up</Link>
                        <Link to="/signin" className="btn btn-outline">Sign In</Link>
                    </div>
                )}
            </div>

            {/* Welcome Section for Logged-in Users (excluding super admin) */}
            {isLoggedIn && user?.role !== 'super_admin' && (
                <div className="welcome-section">
                    <h2>Welcome back, {user?.first_name || user?.username}!</h2>
                    <p>What would you like to do today?</p>
                    <div className="quick-actions-grid">
                        {user?.role !== 'agent' && (
                            <>
                                <Link to="/my-tickets" className="quick-action-card">
                                    <div className="quick-icon"></div>
                                    <h3>My Tickets</h3>
                                    <p>View and track your support requests</p>
                                </Link>
                                <Link to="/ticket/new" className="quick-action-card">
                                    <div className="quick-icon"></div>
                                    <h3>New Ticket</h3>
                                    <p>Submit a new support request</p>
                                </Link>
                                <Link to="/kb" className="quick-action-card">
                                    <div className="quick-icon"></div>
                                    <h3>Knowledge Base</h3>
                                    <p>Find answers in our help center</p>
                                </Link>
                            </>
                        )}
                        {user?.role === 'agent' && (
                            <>
                                <Link to="/agent/dashboard" className="quick-action-card">
                                    <div className="quick-icon"></div>
                                    <h3>Dashboard</h3>
                                    <p>View all tickets and stats</p>
                                </Link>
                                <Link to="/ticket/new" className="quick-action-card">
                                    <div className="quick-icon"></div>
                                    <h3>New Ticket</h3>
                                    <p>Create a ticket for a customer</p>
                                </Link>
                                <Link to="/kb" className="quick-action-card">
                                    <div className="quick-icon"></div>
                                    <h3>Knowledge Base</h3>
                                    <p>Manage help articles</p>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Features Section - Visible to everyone */}
            <div className="features-section">
                <h2>How can we help you today?</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon"></div>
                        <h3>Email Support</h3>
                        <p>Get help via email within 24 hours</p>
                        <div className="feature-detail">support@abcinstitution.edu</div>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"></div>
                        <h3>Knowledge Base</h3>
                        <p>Find answers instantly in our help center</p>
                        <Link to="/kb" className="feature-link">Browse Articles →</Link>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"></div>
                        <h3>Phone Support</h3>
                        <p>Speak with a live agent</p>
                        <div className="feature-detail">+91 44 1234 5678</div>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"></div>
                        <h3>Live Chat</h3>
                        <p>Chat with support in real-time</p>
                        <div className="feature-detail">Available 9AM-6PM</div>
                    </div>
                </div>
            </div>

            {/* CTA Section - Only for non-logged-in users */}
            {!isLoggedIn && (
                <div className="cta-section">
                    <h2>Ready to get started?</h2>
                    <p>Create an account to track your tickets and get faster support</p>
                    <Link to="/signup" className="btn btn-primary btn-large">Create Free Account</Link>
                </div>
            )}
        </div>
    );
}

export default Home;