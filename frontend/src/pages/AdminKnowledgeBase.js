import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import './AdminKnowledgeBase.css';

function AdminKnowledgeBase() {
    const navigate = useNavigate();
    const [articles, setArticles] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingArticle, setEditingArticle] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        summary: '',
        content: '',
        category: '',
        tags: '',
        is_published: true,
        is_public: true,
        is_featured: false
    });

    useEffect(() => {
        checkAuth();
        fetchData();
    }, []);

    const checkAuth = () => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');
        
        if (!userStr || !token) {
            navigate('/signin');
            return;
        }

        const userData = JSON.parse(userStr);
        if (userData.role !== 'super_admin') {
            navigate('/');
            return;
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [articlesRes, categoriesRes] = await Promise.all([
                agentApi.getKnowledgeArticles(),
                agentApi.getKnowledgeCategories()
            ]);
            setArticles(articlesRes.data);
            setCategories(categoriesRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const articleData = {
                title: formData.title,
                summary: formData.summary,
                content: formData.content,
                category: parseInt(formData.category),
                tags: formData.tags,
                is_published: formData.is_published,
                is_public: formData.is_public,
                is_featured: formData.is_featured,
                college: 1  // Your college ID
            };
            
            console.log("Sending article data:", articleData);
            
            if (editingArticle) {
                await agentApi.updateKnowledgeArticle(editingArticle.id, articleData);
            } else {
                await agentApi.createKnowledgeArticle(articleData);
            }
            setShowForm(false);
            setEditingArticle(null);
            setFormData({
                title: '',
                summary: '',
                content: '',
                category: '',
                tags: '',
                is_published: true,
                is_public: true,
                is_featured: false
            });
            fetchData();
        } catch (err) {
            console.error('Error saving article:', err);
            alert('Failed to save article: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleEdit = (article) => {
        setEditingArticle(article);
        setFormData({
            title: article.title,
            summary: article.summary || '',
            content: article.content,
            category: article.category,
            tags: article.tags || '',
            is_published: article.is_published,
            is_public: article.is_public,
            is_featured: article.is_featured
        });
        setShowForm(true);
    };

    const handleDelete = async (id, title) => {
        if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
            try {
                await agentApi.deleteKnowledgeArticle(id);
                fetchData();
            } catch (err) {
                console.error('Error deleting article:', err);
                alert('Failed to delete article');
            }
        }
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="admin-kb-container">
            <div className="admin-header">
                <h1>Knowledge Base Management</h1>
                <button 
                    className="btn-primary"
                    onClick={() => {
                        setEditingArticle(null);
                        setFormData({
                            title: '',
                            summary: '',
                            content: '',
                            category: '',
                            tags: '',
                            is_published: true,
                            is_public: true,
                            is_featured: false
                        });
                        setShowForm(true);
                    }}
                >
                    + New Article
                </button>
            </div>

            {showForm && (
                <div className="article-form-modal">
                    <div className="article-form-container">
                        <h2>{editingArticle ? 'Edit Article' : 'New Article'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Title *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Summary</label>
                                <textarea
                                    name="summary"
                                    value={formData.summary}
                                    onChange={handleInputChange}
                                    rows="2"
                                />
                            </div>

                            <div className="form-group">
                                <label>Category *</label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Content *</label>
                                <textarea
                                    name="content"
                                    value={formData.content}
                                    onChange={handleInputChange}
                                    rows="10"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Tags (comma separated)</label>
                                <input
                                    type="text"
                                    name="tags"
                                    value={formData.tags}
                                    onChange={handleInputChange}
                                    placeholder="password, login, security"
                                />
                            </div>

                            <div className="form-row">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="is_published"
                                        checked={formData.is_published}
                                        onChange={handleInputChange}
                                    />
                                    Published
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="is_public"
                                        checked={formData.is_public}
                                        onChange={handleInputChange}
                                    />
                                    Public
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="is_featured"
                                        checked={formData.is_featured}
                                        onChange={handleInputChange}
                                    />
                                    Featured
                                </label>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-save">
                                    {editingArticle ? 'Update' : 'Create'}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-cancel"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingArticle(null);
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="articles-table-container">
                <table className="articles-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Views</th>
                            <th>Helpful %</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {articles.map(article => (
                            <tr key={article.id}>
                                <td>{article.id}</td>
                                <td>{article.title}</td>
                                <td>{article.category_name}</td>
                                <td>
                                    {article.is_published ? '✅ Published' : '📝 Draft'}
                                </td>
                                <td>{article.views || 0}</td>
                                <td>{article.helpful_percentage || 0}%</td>
                                <td>{new Date(article.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button 
                                        className="edit-btn"
                                        onClick={() => handleEdit(article)}
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        className="delete-btn"
                                        onClick={() => handleDelete(article.id, article.title)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AdminKnowledgeBase;