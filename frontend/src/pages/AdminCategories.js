import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../services/api';
import './AdminCategories.css';

function AdminCategories() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        is_public: true,
        display_order: 0
    });

    useEffect(() => {
        checkAuth();
        fetchCategories();
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

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await agentApi.getKnowledgeCategories();
            setCategories(response.data);
        } catch (err) {
            console.error('Error fetching categories:', err);
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
            // Use the correct college ID (replace 1 with your actual college ID)
            const categoryData = {
                name: formData.name,
                description: formData.description,
                is_public: formData.is_public,
                display_order: parseInt(formData.display_order) || 0,
                college: 1  // ← Change this if your college ID is different
            };
            
            console.log("Sending:", categoryData);
            
            if (editingCategory) {
                await agentApi.updateKnowledgeCategory(editingCategory.id, categoryData);
            } else {
                await agentApi.createKnowledgeCategory(categoryData);
            }
            setShowForm(false);
            setEditingCategory(null);
            setFormData({
                name: '',
                description: '',
                is_public: true,
                display_order: 0
            });
            fetchCategories();
        } catch (err) {
            console.error('Error:', err.response?.data);
            alert('Failed: ' + JSON.stringify(err.response?.data));
        }
    };

    const handleEdit = (category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            description: category.description || '',
            is_public: category.is_public,
            display_order: category.display_order || 0
        });
        setShowForm(true);
    };

    const handleDelete = async (id, name) => {
        if (window.confirm(`Delete category "${name}"? All articles in this category will be affected.`)) {
            try {
                await agentApi.deleteKnowledgeCategory(id);
                fetchCategories();
            } catch (err) {
                console.error('Error deleting category:', err);
                alert('Failed to delete category');
            }
        }
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="admin-categories-container">
            <div className="admin-header">
                <h1>Knowledge Base Categories</h1>
                <button 
                    className="btn-primary"
                    onClick={() => {
                        setEditingCategory(null);
                        setFormData({
                            name: '',
                            description: '',
                            is_public: true,
                            display_order: 0
                        });
                        setShowForm(true);
                    }}
                >
                    + New Category
                </button>
            </div>

            {showForm && (
                <div className="category-form-modal">
                    <div className="category-form-container">
                        <h2>{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Category Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="e.g., Account Management"
                                />
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows="3"
                                    placeholder="Brief description of this category"
                                />
                            </div>

                            <div className="form-row">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="is_public"
                                        checked={formData.is_public}
                                        onChange={handleInputChange}
                                    />
                                    Visible to all users
                                </label>
                            </div>

                            <div className="form-group">
                                <label>Display Order</label>
                                <input
                                    type="number"
                                    name="display_order"
                                    value={formData.display_order}
                                    onChange={handleInputChange}
                                    placeholder="0"
                                />
                                <small>Lower numbers appear first</small>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-save">
                                    {editingCategory ? 'Update' : 'Create'}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-cancel"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingCategory(null);
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="categories-table-container">
                <table className="categories-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Description</th>
                            <th>Articles</th>
                            <th>Public</th>
                            <th>Order</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(category => (
                            <tr key={category.id}>
                                <td>{category.id}</td>
                                <td><strong>{category.name}</strong></td>
                                <td>{category.description || '-'}</td>
                                <td>{category.article_count || 0}</td>
                                <td>{category.is_public ? '✅ Yes' : '❌ No'}</td>
                                <td>{category.display_order || 0}</td>
                                <td>
                                    <button 
                                        className="edit-btn"
                                        onClick={() => handleEdit(category)}
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        className="delete-btn"
                                        onClick={() => handleDelete(category.id, category.name)}
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

export default AdminCategories;