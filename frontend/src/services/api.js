// import axios from 'axios';

// const API_BASE_URL = 'http://127.0.0.1:8000/api';

// const api = axios.create({
//     baseURL: API_BASE_URL,
//     headers: {
//         'Content-Type': 'application/json',
//     },
// });

// // Add token to requests if it exists
// api.interceptors.request.use(
//     (config) => {
//         const token = localStorage.getItem('access_token');
//         if (token) {
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     (error) => Promise.reject(error)
// );

// // Handle token refresh on 401 errors
// api.interceptors.response.use(
//     (response) => response,
//     async (error) => {
//         const originalRequest = error.config;
        
//         if (error.response?.status === 401 && !originalRequest._retry) {
//             originalRequest._retry = true;
            
//             try {
//                 const refreshToken = localStorage.getItem('refresh_token');
//                 const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
//                     refresh: refreshToken
//                 });
                
//                 localStorage.setItem('access_token', response.data.access);
//                 originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
                
//                 return api(originalRequest);
//             } catch (refreshError) {
//                 // Refresh failed - redirect to login
//                 localStorage.removeItem('access_token');
//                 localStorage.removeItem('refresh_token');
//                 window.location.href = '/signin';
//                 return Promise.reject(refreshError);
//             }
//         }
        
//         return Promise.reject(error);
//     }
// );

// // Public API (no auth needed)
// export const publicApi = {
//     // Tickets
//     createTicket: (data) => api.post('/tickets/public_create/', data),
    
//     // Knowledge Base
//     getKnowledgeArticles: (params) => api.get('/knowledge-articles/', { params }),
//     getArticle: (id) => api.get(`/knowledge-articles/${id}/`),
//     submitFeedback: (articleId, data) => api.post(`/knowledge-articles/${articleId}/feedback/`, data),
//     getCategories: () => api.get('/knowledge-categories/'),
//     getTicketStatus: (ticketId, email) => api.get(`/tickets/${ticketId}/status/`, { params: { email } }),
//     getTicketCategories: () => api.get('/ticket-categories/'),

//     // Auth
//     register: (data) => api.post('/auth/register/', data),
//     login: (data) => api.post('/auth/login/', data),
//     logout: () => api.post('/auth/logout/'),
//     getCurrentUser: () => api.get('/auth/user/'),
    
//     // College-specific endpoints
//     getDepartments: () => api.get('/departments/'),
//     getColleges: () => api.get('/colleges/'),
    
//     // ========== CUSTOMER REPLY ==========
//     addUserReply: (ticketId, data) => api.post(`/tickets/${ticketId}/add_user_reply/`, data),
// };

// // Agent API (requires auth)
// export const agentApi = {
//     // Tickets
//     createTicket: (data) => api.post('/tickets/', data),
//     getTickets: (params) => api.get('/tickets/', { params }),
//     getTicket: (id) => api.get(`/tickets/${id}/`),
//     updateTicket: (id, data) => api.patch(`/tickets/${id}/`, data),
//     assignTicket: (id, agentId) => api.post(`/tickets/${id}/assign/`, { agent_id: agentId }),
//     resolveTicket: (id) => api.post(`/tickets/${id}/resolve/`),
    
//     // Conversations
//     addConversation: (ticketId, data) => api.post(`/tickets/${ticketId}/add_conversation/`, data),
//     getConversations: (ticketId) => api.get(`/tickets/${ticketId}/conversations/`),
    
//     // Quick Actions
//     quickResolve: (id) => api.post(`/tickets/${id}/quick_resolve/`),
//     quickAssignToMe: (id) => api.post(`/tickets/${id}/quick_assign_to_me/`),
//     quickStatusChange: (id, status) => api.post(`/tickets/${id}/quick_status_change/`, { status }),
//     quickNote: (id, note) => api.post(`/tickets/${id}/quick_note/`, { note }),
//     quickSummary: (id) => api.get(`/tickets/${id}/quick_summary/`),
    
//     // Canned Responses
//     getCannedResponses: (params) => api.get('/canned-responses/', { params }),
//     getCannedCategories: () => api.get('/canned-categories/'),
//     renderCannedResponse: (data) => api.post('/canned-responses/render/', data),
    
//     // College-specific
//     getUsers: () => api.get('/user-profiles/'),
//     getUser: (id) => api.get(`/user-profiles/${id}/`),
//     getUserTickets: (id) => api.get(`/user-profiles/${id}/tickets/`),
    
//     // Mentions
//     getMentions: () => api.get('/tickets/mentioned_me/'),
    
//     // Attachments
//     addAttachment: (ticketId, file, uploadedBy) => {
//         const formData = new FormData();
//         formData.append('file', file);
//         formData.append('uploaded_by', uploadedBy);
//         return api.post(`/tickets/${ticketId}/add_attachment/`, formData, {
//             headers: { 'Content-Type': 'multipart/form-data' }
//         });
//     },
//     getAttachments: (ticketId) => api.get(`/tickets/${ticketId}/attachments/`),
    
//     // AI Features
//     aiSuggestResponse: (ticketId) => api.post(`/tickets/${ticketId}/ai_suggest_response/`, {}),
    
//     // ========== KNOWLEDGE BASE (Admin) ==========
//     getKnowledgeArticles: (params) => api.get('/knowledge-articles/', { params }),
//     getKnowledgeArticle: (id) => api.get(`/knowledge-articles/${id}/`),
//     createKnowledgeArticle: (data) => api.post('/knowledge-articles/', data),
//     updateKnowledgeArticle: (id, data) => api.patch(`/knowledge-articles/${id}/`, data),
//     deleteKnowledgeArticle: (id) => api.delete(`/knowledge-articles/${id}/`),
    
//     getKnowledgeCategories: () => api.get('/knowledge-categories/'),
//     createKnowledgeCategory: (data) => api.post('/knowledge-categories/', data),
//     updateKnowledgeCategory: (id, data) => api.patch(`/knowledge-categories/${id}/`, data),
//     deleteKnowledgeCategory: (id) => api.delete(`/knowledge-categories/${id}/`),
    
//     // ========== SUPER ADMIN FEATURES ==========
//     getAdminStats: () => api.get('/admin-stats/'),
//     updateUserRole: (userId, role) => api.patch(`/admin-stats/${userId}/update_role/`, { role }),
//     deleteUser: (userId) => api.delete(`/admin-stats/${userId}/delete_user/`),
// };

// export default api;












import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests if it exists
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle token refresh on 401 errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                const refreshToken = localStorage.getItem('refresh_token');
                const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
                    refresh: refreshToken
                });
                
                localStorage.setItem('access_token', response.data.access);
                originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
                
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed - redirect to login
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/signin';
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

// Public API (no auth needed)
export const publicApi = {
    // Tickets
    createTicket: (data) => api.post('/tickets/public_create/', data),
    
    // Knowledge Base
    getKnowledgeArticles: (params) => api.get('/knowledge-articles/', { params }),
    getArticle: (id) => api.get(`/knowledge-articles/${id}/`),
    submitFeedback: (articleId, data) => api.post(`/knowledge-articles/${articleId}/feedback/`, data),
    getCategories: () => api.get('/knowledge-categories/'),
    getTicketStatus: (ticketId, email) => api.get(`/tickets/${ticketId}/status/`, { params: { email } }),
    getTicketCategories: () => api.get('/ticket-categories/'),

    // Auth
    register: (data) => api.post('/auth/register/', data),
    login: (data) => api.post('/auth/login/', data),
    logout: () => api.post('/auth/logout/'),
    getCurrentUser: () => api.get('/auth/user/'),
    
    // College-specific endpoints
    getDepartments: () => api.get('/departments/'),
    getColleges: () => api.get('/colleges/'),
    
    // ========== CUSTOMER REPLY ==========
    addUserReply: (ticketId, data) => api.post(`/tickets/${ticketId}/add_user_reply/`, data),
    
    // ========== PUBLIC CONVERSATIONS (ADDED) ==========
    getTicketConversations: (ticketId, email) => 
        api.get(`/tickets/${ticketId}/public_conversations/`, { params: { email } }),
};

// Agent API (requires auth)
export const agentApi = {
    // Tickets
    createTicket: (data) => api.post('/tickets/', data),
    getTickets: (params) => api.get('/tickets/', { params }),
    getTicket: (id) => api.get(`/tickets/${id}/`),
    updateTicket: (id, data) => api.patch(`/tickets/${id}/`, data),
    assignTicket: (id, agentId) => api.post(`/tickets/${id}/assign/`, { agent_id: agentId }),
    resolveTicket: (id) => api.post(`/tickets/${id}/resolve/`),
    
    // Conversations
    addConversation: (ticketId, data) => api.post(`/tickets/${ticketId}/add_conversation/`, data),
    getConversations: (ticketId) => api.get(`/tickets/${ticketId}/conversations/`),
    
    // Quick Actions
    quickResolve: (id) => api.post(`/tickets/${id}/quick_resolve/`),
    quickAssignToMe: (id) => api.post(`/tickets/${id}/quick_assign_to_me/`),
    quickStatusChange: (id, status) => api.post(`/tickets/${id}/quick_status_change/`, { status }),
    quickNote: (id, note) => api.post(`/tickets/${id}/quick_note/`, { note }),
    quickSummary: (id) => api.get(`/tickets/${id}/quick_summary/`),
    
    // Canned Responses
    getCannedResponses: (params) => api.get('/canned-responses/', { params }),
    getCannedCategories: () => api.get('/canned-categories/'),
    renderCannedResponse: (data) => api.post('/canned-responses/render/', data),
    
    // College-specific
    getUsers: () => api.get('/user-profiles/'),
    getUser: (id) => api.get(`/user-profiles/${id}/`),
    getUserTickets: (id) => api.get(`/user-profiles/${id}/tickets/`),
    
    // Mentions
    getMentions: () => api.get('/tickets/mentioned_me/'),
    
    // Attachments
    addAttachment: (ticketId, file, uploadedBy) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploaded_by', uploadedBy);
        return api.post(`/tickets/${ticketId}/add_attachment/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getAttachments: (ticketId) => api.get(`/tickets/${ticketId}/attachments/`),
    
    // AI Features
    aiSuggestResponse: (ticketId) => api.post(`/tickets/${ticketId}/ai_suggest_response/`, {}),
    
    // ========== KNOWLEDGE BASE (Admin) ==========
    getKnowledgeArticles: (params) => api.get('/knowledge-articles/', { params }),
    getKnowledgeArticle: (id) => api.get(`/knowledge-articles/${id}/`),
    createKnowledgeArticle: (data) => api.post('/knowledge-articles/', data),
    updateKnowledgeArticle: (id, data) => api.patch(`/knowledge-articles/${id}/`, data),
    deleteKnowledgeArticle: (id) => api.delete(`/knowledge-articles/${id}/`),
    
    getKnowledgeCategories: () => api.get('/knowledge-categories/'),
    createKnowledgeCategory: (data) => api.post('/knowledge-categories/', data),
    updateKnowledgeCategory: (id, data) => api.patch(`/knowledge-categories/${id}/`, data),
    deleteKnowledgeCategory: (id) => api.delete(`/knowledge-categories/${id}/`),
    
    // ========== SUPER ADMIN FEATURES ==========
    getAdminStats: () => api.get('/admin-stats/'),
    updateUserRole: (userId, role) => api.patch(`/admin-stats/${userId}/update_role/`, { role }),
    deleteUser: (userId) => api.delete(`/admin-stats/${userId}/delete_user/`),
};

export default api;