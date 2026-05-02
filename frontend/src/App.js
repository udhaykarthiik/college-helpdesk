import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import TicketForm from './components/TicketForm';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import KnowledgeBase from './pages/KnowledgeBase';
import KnowledgeArticle from './pages/KnowledgeArticle';
import TrackTicket from './pages/TrackTicket';
import AgentDashboard from './pages/AgentDashboard';
import AgentTicketDetail from './pages/AgentTicketDetail';
import MyTickets from './pages/MyTickets';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminKnowledgeBase from './pages/AdminKnowledgeBase';
import AdminCategories from './pages/AdminCategories';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ticket/new" element={<TicketForm />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            {/* <Route path="/dashboard" element={<Dashboard />} /> */}
            <Route path="/admin/knowledge-base" element={<AdminKnowledgeBase />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/kb" element={<KnowledgeBase />} />
            <Route path="/kb/:id" element={<KnowledgeArticle />} />
            <Route path="/track" element={<TrackTicket />} />
            <Route path="/agent/dashboard" element={<AgentDashboard />} />
            <Route path="/agent/tickets/:id" element={<AgentTicketDetail />} />
            <Route path="/my-tickets" element={<MyTickets />} />
            <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
            {/* Footer Pages */}
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;