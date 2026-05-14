import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-section">
                    <h3>ABC Institution Helpdesk</h3>
                    <p>Your trusted support partner, available 24/7 to help you with any issues.</p>
                </div>

                <div className="footer-section">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/kb">Knowledge Base</Link></li>
                        <li><Link to="/track">Track Ticket</Link></li>
                        <li><Link to="/ticket/new">Submit Ticket</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Support</h4>
                    <ul>
                        <li><Link to="/contact">Contact Us</Link></li>
                        <li><Link to="/faq">FAQ</Link></li>
                        <li><Link to="/privacy">Privacy Policy</Link></li>
                        <li><Link to="/terms">Terms of Service</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Connect With Us</h4>
                    <p className="contact-email">support@abcinstitution.com</p>
                    <p className="contact-phone">+91 44 1234 5678</p>
                </div>
            </div>
            
            <div className="footer-bottom">
                <p>&copy; 2026 ABC Institution Helpdesk. All rights reserved.</p>
            </div>
        </footer>
    );
}

export default Footer;