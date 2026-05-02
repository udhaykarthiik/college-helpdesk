import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './SignUp.css';

function SignUp() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [loadingDepts, setLoadingDepts] = useState(true);
    
    // Password visibility states
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        first_name: '',
        last_name: '',
        role: 'student',
        roll_number: '',
        employee_id: '',
        student_type: 'hosteller',
        department_id: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [passwordError, setPasswordError] = useState('');

    // Fetch departments
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const response = await publicApi.getDepartments();
                setDepartments(response.data);
            } catch (err) {
                console.error('Error fetching departments:', err);
            } finally {
                setLoadingDepts(false);
            }
        };
        fetchDepartments();
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        
        if (e.target.name === 'password' || e.target.name === 'confirmPassword') {
            setPasswordError('');
            setError(null);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    const validateForm = () => {
        if (formData.password !== formData.confirmPassword) {
            setPasswordError('Passwords do not match');
            return false;
        }
        if (formData.password.length < 8) {
            setPasswordError('Password must be at least 8 characters');
            return false;
        }
        
        // Student validations
        if (formData.role === 'student') {
            if (!formData.roll_number) {
                setError('Roll number is required for students');
                return false;
            }
            if (!formData.department_id) {
                setError('Please select a department');
                return false;
            }
        }
        
        // Staff validations
        if (formData.role === 'staff') {
            if (!formData.employee_id) {
                setError('Employee ID is required for staff');
                return false;
            }
            if (!formData.department_id) {
                setError('Please select a department');
                return false;
            }
        }
        
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { confirmPassword, ...registerData } = formData;
            
            // Remove department_id and other unnecessary fields for parent and agent roles
            if (registerData.role === 'parent') {
                delete registerData.department_id;
                delete registerData.employee_id;
                delete registerData.student_type;
                // Keep roll_number as optional
            }
            
            if (registerData.role === 'agent') {
                delete registerData.department_id;
                delete registerData.roll_number;
                delete registerData.employee_id;
                delete registerData.student_type;
            }
            
            if (registerData.role === 'staff') {
                // Keep department_id and employee_id
            }
            
            if (registerData.role === 'student') {
                // Keep all fields
            }
            
            console.log('Sending registration data:', registerData);
            
            const response = await publicApi.register(registerData);
            
            login(response.data.user, {
                access: response.data.access,
                refresh: response.data.refresh
            });
            
            setSuccess(`Welcome ${response.data.user.first_name || response.data.user.username}! Registration successful.`);
            
            setTimeout(() => {
                const userRole = response.data.user?.role || 'student';
                if (userRole === 'agent') {
                    navigate('/agent/dashboard');
                } else {
                    navigate('/my-tickets');
                }
            }, 2000);
            
        } catch (err) {
            console.error('Registration error:', err.response?.data);
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-card">
                <h2>Create Account</h2>
                <p className="subtitle">Join ABC Institution Helpdesk</p>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        ✓ {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="signup-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>First Name *</label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                                placeholder="Enter your first name"
                            />
                        </div>

                        <div className="form-group">
                            <label>Last Name</label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                placeholder="Enter your last name"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Username *</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="Choose a username"
                        />
                    </div>

                    <div className="form-group">
                        <label>Email *</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="you@college.edu"
                        />
                        <small className="field-hint">Use your college email ID</small>
                    </div>

                    <div className="form-group">
                        <label>Role *</label>
                        <select name="role" value={formData.role} onChange={handleChange} className="role-select">
                            <option value="student">Student</option>
                            <option value="staff">Staff / Teacher</option>
                            <option value="parent">Parent</option>
                            <option value="agent">Support Agent</option>
                        </select>
                    </div>

                    {formData.role === 'student' && (
                        <>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Roll Number *</label>
                                    <input
                                        type="text"
                                        name="roll_number"
                                        value={formData.roll_number}
                                        onChange={handleChange}
                                        placeholder="Enter your roll number"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Student Type</label>
                                    <select name="student_type" value={formData.student_type} onChange={handleChange}>
                                        <option value="hosteller">Hosteller</option>
                                        <option value="day_scholar">Day Scholar</option>
                                        <option value="transport_user">Transport User</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Department *</label>
                                <select name="department_id" value={formData.department_id} onChange={handleChange}>
                                    <option value="">Select Department</option>
                                    {loadingDepts ? (
                                        <option disabled>Loading...</option>
                                    ) : (
                                        departments.map(dept => (
                                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </>
                    )}

                    {formData.role === 'staff' && (
                        <>
                            <div className="form-group">
                                <label>Employee ID *</label>
                                <input
                                    type="text"
                                    name="employee_id"
                                    value={formData.employee_id}
                                    onChange={handleChange}
                                    placeholder="Enter your employee ID"
                                />
                            </div>
                            <div className="form-group">
                                <label>Department *</label>
                                <select name="department_id" value={formData.department_id || ''} onChange={handleChange}>
                                    <option value="">-- Select Department --</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>
                                            {dept.name} ({dept.code})
                                        </option>
                                    ))}
                                </select>
                                {loadingDepts && <small>Loading departments...</small>}
                            </div>
                        </>
                    )}

                    {formData.role === 'parent' && (
                        <div className="form-group">
                            <label>Student's Roll Number</label>
                            <input
                                type="text"
                                name="roll_number"
                                value={formData.roll_number}
                                onChange={handleChange}
                                placeholder="Enter your ward's roll number"
                            />
                            <small className="field-hint">Optional - to link with your child's account</small>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Password *</label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                placeholder="Create a password"
                            />
                            <button 
                                type="button" 
                                className="password-toggle"
                                onClick={togglePasswordVisibility}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                        <small className="field-hint">At least 8 characters</small>
                    </div>

                    <div className="form-group">
                        <label>Confirm Password *</label>
                        <div className="password-wrapper">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                placeholder="Confirm your password"
                            />
                            <button 
                                type="button" 
                                className="password-toggle"
                                onClick={toggleConfirmPasswordVisibility}
                            >
                                {showConfirmPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                        {passwordError && (
                            <div className="password-error">{passwordError}</div>
                        )}
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="signup-btn"
                    >
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <p className="login-link">
                    Already have an account? <Link to="/signin">Sign In</Link>
                </p>
            </div>
        </div>
    );
}

export default SignUp;