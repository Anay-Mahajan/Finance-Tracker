import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
// API Configuration
const API_URL = 'http://localhost:8000/api';
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);
// Auth Context
const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/users/profile/')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);
  const login = async (username, password) => {
    const res = await api.post('/auth/login/', { username, password });
    localStorage.setItem('token', res.data.token);
    const profile = await api.get('/users/profile/');
    setUser(profile.data);
  };
  const register = async (userData) => {
    const res = await api.post('/users/', userData);
    // Auto-login after registration
    await login(userData.username, userData.password);
    return res.data;
  };
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
// Login Component with Modern Design
function Login({ onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    handleGoogleLogin();
  }, []);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setError('');
    const buttonDiv = document.getElementById('google-signin-button');
    if (!buttonDiv) {
      setError('Button container not found');
      setGoogleLoading(false);
      return;
    }
    if (typeof google === 'undefined') {
      setError('Google Sign-In library not loaded. Please refresh the page.');
      setGoogleLoading(false);
      return;
    }
    api.get('/auth/google/config/')
      .then(configRes => {
        if (!configRes.data.enabled || !configRes.data.client_id) {
          setError('Google Sign-In is not configured.');
          setGoogleLoading(false);
          return;
        }
        google.accounts.id.initialize({
          client_id: configRes.data.client_id,
          callback: handleGoogleResponse,
        });
        buttonDiv.innerHTML = '';
        google.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          width: buttonDiv.offsetWidth || 350,
          text: 'signin_with',
          shape: 'rectangular',
        });
        setGoogleLoading(false);
      })
      .catch(err => {
        setError('Failed to load Google Sign-In configuration.');
        setGoogleLoading(false);
      });
  };

  const handleGoogleResponse = async (response) => {
    setGoogleLoading(true);
    try {
      const res = await api.post('/auth/google/', {
        token: response.credential
      });
      localStorage.setItem('token', res.data.token);
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Google Sign-In failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError('Invalid credentials. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-500 mt-1 text-sm">Sign in to manage your finances</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              placeholder="Username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="px-2 bg-white text-gray-400">Or continue with</span></div>
        </div>

        <div className="mt-6 flex justify-center">
          <div id="google-signin-button" className="w-full"></div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          New here?{' '}
          <button onClick={onSwitchToRegister} className="text-indigo-600 font-semibold hover:underline">
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
// Register Component with Modern Design
function Register({ onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register } = useAuth();

  useEffect(() => {
    handleGoogleSignup();
  }, []);

  const handleGoogleSignup = () => {
    setGoogleLoading(true);
    setError('');
    const buttonDiv = document.getElementById('google-signup-button');
    if (!buttonDiv) return;
    if (typeof google === 'undefined') {
      setError('Google library not loaded.');
      return;
    }
    api.get('/auth/google/config/')
      .then(configRes => {
        if (!configRes.data.enabled || !configRes.data.client_id) return;
        google.accounts.id.initialize({
          client_id: configRes.data.client_id,
          callback: handleGoogleResponse,
        });
        buttonDiv.innerHTML = '';
        google.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          width: buttonDiv.offsetWidth || 350,
          text: 'signup_with',
          shape: 'rectangular',
        });
      })
      .catch(() => setError('Failed to load Google Sign-In.'));
  };

  const handleGoogleResponse = async (response) => {
    try {
      const res = await api.post('/auth/google/', { token: response.credential });
      localStorage.setItem('token', res.data.token);
      window.location.reload();
    } catch (err) {
      setError('Google Sign-In failed.');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    if (formData.password !== formData.password2) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    try {
      await register(formData);
    } catch (err) {
      setError('Registration failed. Please check your details.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Create account</h2>
          <p className="text-gray-500 mt-1 text-sm">Start tracking your finances today</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">First Name</label>
              <input name="first_name" type="text" value={formData.first_name} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:border-indigo-500 outline-none transition-all" placeholder="John" required />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Last Name</label>
              <input name="last_name" type="text" value={formData.last_name} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:border-indigo-500 outline-none transition-all" placeholder="Doe" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Username</label>
            <input name="username" type="text" value={formData.username} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:border-indigo-500 outline-none transition-all" placeholder="johndoe" required />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Email</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:border-indigo-500 outline-none transition-all" placeholder="john@example.com" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Password</label>
              <input name="password" type="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:border-indigo-500 outline-none transition-all" placeholder="••••••••" required minLength="8" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Confirm</label>
              <input name="password2" type="password" value={formData.password2} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:border-indigo-500 outline-none transition-all" placeholder="••••••••" required minLength="8" />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm mt-2">
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 flex justify-center">
          <div id="google-signup-button" className="w-full"></div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-indigo-600 font-semibold hover:underline">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}
// Dashboard Component with Modern Design
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/')
      .then(res => {
        setStats(res.data);
        setLoading(false);
      })
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-200 border-t-zinc-800"></div>
      </div>
    );
  }

  const totalTransactions = stats.recent_transactions.length;
  const avgTransaction = totalTransactions > 0 
    ? (parseFloat(stats.total_income) + parseFloat(stats.total_expenses)) / totalTransactions 
    : 0;

  const expenseChartData = {
    labels: stats.expense_by_category.map(c => c.category__name),
    datasets: [{
      data: stats.expense_by_category.map(c => c.total),
      backgroundColor: ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7'],
      borderWidth: 0,
    }],
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 bg-white min-h-screen text-zinc-900">
      
      {/* Minimal Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-100 pb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Overview</p>
          <h1 className="text-4xl font-light tracking-tight text-zinc-900">
            Welcome, <span className="font-semibold">User</span>
          </h1>
          <p className="text-zinc-500 mt-2 text-sm italic">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase text-zinc-400">Activity</p>
            <p className="text-xl font-medium">{totalTransactions} <span className="text-sm font-normal text-zinc-400">txns</span></p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-zinc-400">Average</p>
            <p className="text-xl font-medium">${avgTransaction.toFixed(0)}</p>
          </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total Income</p>
          <p className="text-4xl font-normal tracking-tight">${stats.total_income}</p>
          <p className="text-xs text-emerald-600 font-medium">+12.5% from last month</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total Expenses</p>
          <p className="text-4xl font-normal tracking-tight text-zinc-800">${stats.total_expenses}</p>
          <p className="text-xs text-zinc-400 font-medium">-8.2% from last month</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Net Savings</p>
          <p className="text-4xl font-semibold tracking-tight text-indigo-600">${stats.net_savings}</p>
          <p className="text-xs text-zinc-400 font-medium">85% Savings rate</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 pt-4">
        
        {/* Expenses Section */}
        <section className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-zinc-100 pb-2">Expense Distribution</h3>
          {stats.expense_by_category.length > 0 ? (
            <div className="h-64">
              <Pie 
                data={expenseChartData} 
                options={{ 
                  maintainAspectRatio: false, 
                  plugins: { 
                    legend: { position: 'right', labels: { boxWidth: 10, font: { size: 12, family: 'Inter' } } } 
                  } 
                }} 
              />
            </div>
          ) : (
            <p className="text-zinc-400 text-sm italic">No expense data available for this period.</p>
          )}
        </section>

        {/* Recent Transactions Section */}
        <section className="space-y-6">
          <div className="flex justify-between items-end border-b border-zinc-100 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-widest">Recent Activity</h3>
            <button className="text-xs font-semibold text-zinc-400 hover:text-zinc-900 transition-colors">View all</button>
          </div>
          
          <div className="divide-y divide-zinc-50">
            {stats.recent_transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-emerald-500' : 'bg-zinc-300'}`}></div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{t.description}</p>
                    <p className="text-xs text-zinc-400">{t.category_name} • {t.date}</p>
                  </div>
                </div>
                <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                  {t.type === 'income' ? '+' : '-'}${t.amount}
                </p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
// Transactions Component with Modern Design
function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    currency: 'USD',
    receipt: null
  });
  useEffect(() => {
    loadTransactions();
    loadCategories();
  }, []);
  const loadTransactions = () => {
    api.get('/transactions/').then(res => setTransactions(res.data.results || res.data));
  };
  const loadCategories = () => {
    api.get('/categories/').then(res => setCategories(res.data.results || res.data));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      submitData.append('category', formData.category);
      submitData.append('amount', formData.amount);
      submitData.append('description', formData.description);
      submitData.append('date', formData.date);
      submitData.append('type', formData.type);
      submitData.append('currency', formData.currency);
      if (formData.receipt) {
        submitData.append('receipt', formData.receipt);
      }
      if (editingId) {
        // Update existing transaction
        await api.put(`/transactions/${editingId}/`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Create new transaction
        await api.post('/transactions/', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], type: 'expense', currency: 'USD', receipt: null });
      loadTransactions();
      // Trigger budget refresh event
      window.dispatchEvent(new Event('budgetUpdate'));
    } catch (err) {
      alert(`Error ${editingId ? 'updating' : 'creating'} transaction`);
    }
  };
  const handleEdit = (transaction) => {
    setEditingId(transaction.id);
    setFormData({
      category: transaction.category,
      amount: transaction.amount,
      description: transaction.description,
      date: transaction.date,
      type: transaction.type,
      currency: transaction.currency,
      receipt: null // Don't pre-fill file input
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleCancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], type: 'expense', currency: 'USD', receipt: null });
  };
  const handleDelete = async (id) => {
    if (window.confirm('Delete this transaction?')) {
      await api.delete(`/transactions/${id}/`);
      loadTransactions();
      // Trigger budget refresh event
      window.dispatchEvent(new Event('budgetUpdate'));
    }
  };
  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Transactions</h1>
          <p className="text-gray-600">Manage your income and expenses</p>
        </div>
        <button
          onClick={() => {
            if (editingId) {
              handleCancelEdit();
            } else {
              setShowForm(!showForm);
            }
          }}
          className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
          <span>{showForm ? 'Cancel' : 'Add Transaction'}</span>
        </button>
      </div>
      {showForm && (
        <div className="bg-white p-8 rounded-2xl shadow-xl animate-slideDown">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {editingId ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                required
              >
                <option value="">Select Category</option>
                {categories.filter(c => c.type === formData.type).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="INR">INR (₹)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="CHF">CHF (Fr)</option>
                <option value="CNY">CNY (¥)</option>
                <option value="SEK">SEK (kr)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                placeholder="Enter description"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt (Optional)</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFormData({...formData, receipt: e.target.files[0]})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {formData.receipt && (
                  <p className="mt-2 text-sm text-gray-600">Selected: {formData.receipt.name}</p>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                {editingId ? 'Update Transaction' : 'Create Transaction'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Description</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Category</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Receipt</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 text-sm text-gray-600">{t.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{t.description}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                      {t.category_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'}{t.currency} {t.amount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {t.receipt ? (
                      <div className="flex items-center space-x-2">
                        <a 
                          href={t.receipt.startsWith('http') ? t.receipt : `http://localhost:8000${t.receipt.startsWith('/') ? '' : '/'}${t.receipt}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 hover:underline"
                          onClick={(e) => {
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </a>
                        <a 
                          href={t.receipt.startsWith('http') ? t.receipt : `http://localhost:8000${t.receipt.startsWith('/') ? '' : '/'}${t.receipt}`}
                          download
                          className="text-green-600 hover:text-green-800 flex items-center space-x-1 hover:underline"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download</span>
                        </a>
                      </div>
                    ) : (
                      <span className="text-gray-400">No receipt</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-indigo-600 hover:text-white hover:bg-indigo-600 px-3 py-1 rounded-lg transition-all duration-200 border border-indigo-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-red-600 hover:text-white hover:bg-red-600 px-3 py-1 rounded-lg transition-all duration-200 border border-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
// Categories Component with Modern Design
function Categories() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    description: '',
    color: '#6366f1'
  });
  useEffect(() => {
    loadCategories();
  }, []);
  const loadCategories = () => {
    api.get('/categories/').then(res => setCategories(res.data.results || res.data));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories/', formData);
      setShowForm(false);
      setFormData({ name: '', type: 'expense', description: '', color: '#6366f1' });
      loadCategories();
    } catch (err) {
      alert('Error creating category');
    }
  };
  const handleDelete = async (id) => {
    if (window.confirm('Delete this category?')) {
      try {
        await api.delete(`/categories/${id}/`);
        loadCategories();
      } catch (err) {
        alert('Cannot delete category with existing transactions');
      }
    }
  };
  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Categories</h1>
          <p className="text-gray-600">Organize your transactions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
          <span>{showForm ? 'Cancel' : 'Add Category'}</span>
        </button>
      </div>
      {showForm && (
        <div className="bg-white p-8 rounded-2xl shadow-xl animate-slideDown">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">New Category</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                  placeholder="Category name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
              <div className="flex items-center space-x-4">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  className="h-12 w-20 border-2 border-gray-200 rounded-xl cursor-pointer"
                />
                <span className="text-gray-600 font-mono">{formData.color}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                rows="3"
                placeholder="Optional description"
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
              Create Category
            </button>
          </form>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(c => (
          <div key={c.id} className="group bg-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
                  style={{ backgroundColor: c.color }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{c.name}</h3>
                  <span className={`inline-block px-3 py-1 text-xs rounded-full font-medium ${c.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.type}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{c.description || 'No description'}</p>
            <button
              onClick={() => handleDelete(c.id)}
              className="w-full text-red-600 hover:text-white hover:bg-red-600 border-2 border-red-600 px-4 py-2 rounded-xl font-medium transition-all duration-200"
            >
              Delete Category
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
// Budgets Component with Modern Design
function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    currency: 'USD',
    period: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    alert_threshold: 80
  });
  useEffect(() => {
    loadBudgets();
    loadCategories();
    // Listen for budget update events from transaction changes
    const handleBudgetUpdate = () => {
      loadBudgets();
    };
    window.addEventListener('budgetUpdate', handleBudgetUpdate);
    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('budgetUpdate', handleBudgetUpdate);
    };
  }, [refreshKey]);
  const loadBudgets = () => {
    api.get('/budgets/').then(res => {
      setBudgets(res.data.results || res.data);
    }).catch(err => {
    });
  };
  const loadCategories = () => {
    api.get('/categories/?type=expense').then(res => setCategories(res.data.results || res.data));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/budgets/', formData);
      setShowForm(false);
      setFormData({ category: '', amount: '', currency: 'USD', period: 'monthly', start_date: new Date().toISOString().split('T')[0], alert_threshold: 80 });
      loadBudgets();
    } catch (err) {
      alert('Error creating budget');
    }
  };
  const handleDelete = async (id) => {
    if (window.confirm('Delete this budget?')) {
      await api.delete(`/budgets/${id}/`);
      loadBudgets();
    }
  };
  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Budgets</h1>
          <p className="text-gray-600">Track your spending limits</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadBudgets();
            }}
            className="flex items-center space-x-2 bg-white text-indigo-600 border-2 border-indigo-500 px-4 py-3 rounded-xl font-semibold hover:bg-indigo-50 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
            title="Refresh budgets"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
            <span>{showForm ? 'Cancel' : 'Add Budget'}</span>
          </button>
        </div>
      </div>
      {showForm && (
        <div className="bg-white p-8 rounded-2xl shadow-xl animate-slideDown">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">New Budget</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                required
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="INR">INR (₹)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="CHF">CHF (Fr)</option>
                <option value="CNY">CNY (¥)</option>
                <option value="SEK">SEK (kr)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Period</label>
              <select
                value={formData.period}
                onChange={(e) => setFormData({...formData, period: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Alert Threshold ({formData.alert_threshold}%)</label>
              <input
                type="range"
                value={formData.alert_threshold}
                onChange={(e) => setFormData({...formData, alert_threshold: e.target.value})}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                min="1"
                max="100"
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                Create Budget
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.map(b => (
          <div key={b.id} className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">{b.category_name}</h3>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium uppercase">
                {b.period}
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Spent</span>
                <span className="font-bold text-gray-800">${b.spent_amount}</span>
              </div>
              <div className="relative">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all duration-500 ${
                      b.is_over_budget 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : b.should_alert 
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
                        : 'bg-gradient-to-r from-green-400 to-green-500'
                    }`}
                    style={{ width: `${Math.min(b.percentage_used, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-600">
                  <span>0%</span>
                  <span className="font-bold">{b.percentage_used.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-600">Budget</span>
                <span className="text-lg font-bold text-gray-800">${b.amount}</span>
              </div>
              {b.should_alert && !b.is_over_budget && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-yellow-800 font-medium">Alert threshold reached!</span>
                  </div>
                </div>
              )}
              {b.is_over_budget && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-800 font-medium">Over budget!</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => handleDelete(b.id)}
                className="w-full text-red-600 hover:text-white hover:bg-red-600 border-2 border-red-600 px-4 py-2 rounded-xl font-medium transition-all duration-200"
              >
                Delete Budget
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// Reports Component with Modern Design
function Reports() {
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailLoading, setEmailLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [reportType, setReportType] = useState('monthly');
  const [customEmail, setCustomEmail] = useState('');
  const { user } = useAuth();
  useEffect(() => {
    api.get('/dashboard/monthly_report/')
      .then(res => {
        setMonthlyData(res.data);
        setLoading(false);
      })
  }, []);
  useEffect(() => {
    // Set default email to user's email when modal opens
    if (showEmailModal && user) {
      setCustomEmail(user.email || '');
    }
  }, [showEmailModal, user]);
  const handleEmailReport = async () => {
    // Validate email
    if (!customEmail || !customEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    setEmailLoading(true);
    try {
      const response = await api.post('/dashboard/email_report/', {
        report_type: reportType,
        email: customEmail
      });
      alert(response.data.message || 'Report sent to your email!');
      setShowEmailModal(false);
    } catch (err) {
      alert('Failed to send email report. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
      </div>
    );
  }
  const chartData = {
    labels: monthlyData.map(m => m.month_short),
    datasets: [
      {
        label: 'Income',
        data: monthlyData.map(m => m.income),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
        borderRadius: 8,
      },
      {
        label: 'Expenses',
        data: monthlyData.map(m => m.expenses),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    }
  };
  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Financial Reports</h1>
          <p className="text-gray-600">Analyze your financial trends</p>
        </div>
        <button
          onClick={() => setShowEmailModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>Email Report</span>
        </button>
      </div>
      {/* Email Report Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-slideDown">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📧 Email Financial Report</h2>
            <p className="text-gray-600 mb-6">Choose the report period and enter email address</p>
            {/* Email Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                Report will be sent to this email address
              </p>
            </div>
            {/* Report Type Selection */}
            <div className="space-y-4 mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Report Period
              </label>
              <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-indigo-500 transition-all">
                <input
                  type="radio"
                  name="reportType"
                  value="daily"
                  checked={reportType === 'daily'}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-4 h-4 text-indigo-600"
                />
                <div>
                  <div className="font-semibold text-gray-800">Daily Report</div>
                  <div className="text-sm text-gray-500">Today's transactions</div>
                </div>
              </label>
              <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-indigo-500 transition-all">
                <input
                  type="radio"
                  name="reportType"
                  value="weekly"
                  checked={reportType === 'weekly'}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-4 h-4 text-indigo-600"
                />
                <div>
                  <div className="font-semibold text-gray-800">Weekly Report</div>
                  <div className="text-sm text-gray-500">Last 7 days</div>
                </div>
              </label>
              <label className="flex items-center space-x-3 p-4 border-2 border-indigo-500 rounded-xl cursor-pointer bg-indigo-50 transition-all">
                <input
                  type="radio"
                  name="reportType"
                  value="monthly"
                  checked={reportType === 'monthly'}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-4 h-4 text-indigo-600"
                />
                <div>
                  <div className="font-semibold text-gray-800">Monthly Report</div>
                  <div className="text-sm text-gray-500">Current month</div>
                </div>
              </label>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                disabled={emailLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleEmailReport}
                disabled={emailLoading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Report'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white p-8 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full mr-3"></span>
          Monthly Income vs Expenses (Last 12 Months)
        </h2>
        <div className="h-96">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Month</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Income</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Expenses</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Savings</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyData.map((m, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">{m.month}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-green-600 font-bold">${m.income.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-red-600 font-bold">${m.expenses.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-bold ${m.savings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      ${m.savings.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {m.savings >= 0 ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center w-fit">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Positive
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center w-fit">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Negative
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
// Admin Dashboard Component
function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/users/dashboard_stats/')
      .then(res => {
        setStats(res.data);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-200 border-t-zinc-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 bg-white min-h-screen text-zinc-900">
      
      {/* Minimal Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-100 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">System Administration</p>
            <span className="px-2 py-0.5 bg-zinc-900 text-white text-[10px] font-bold rounded">ROOT</span>
          </div>
          <h1 className="text-4xl font-light tracking-tight text-zinc-900">Admin <span className="font-semibold">Control</span></h1>
          <p className="text-zinc-500 mt-2 text-sm italic">System-wide overview and infrastructure statistics</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-[10px] font-bold uppercase text-zinc-400">Last Pulse</p>
          <p className="text-sm font-medium text-zinc-900">{new Date().toLocaleTimeString()}</p>
        </div>
      </header>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="space-y-1 border-l border-zinc-100 pl-6">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total Users</p>
          <p className="text-4xl font-normal tracking-tight text-zinc-900">{stats?.total_users || 0}</p>
          <p className="text-xs text-emerald-600 font-medium">{stats?.active_users || 0} currently active</p>
        </div>
        
        <div className="space-y-1 border-l border-zinc-100 pl-6">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Transactions</p>
          <p className="text-4xl font-normal tracking-tight text-zinc-900">{stats?.total_transactions || 0}</p>
          <p className="text-xs text-zinc-400 font-medium">Processed system-wide</p>
        </div>

        <div className="space-y-1 border-l border-zinc-100 pl-6">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total Revenue</p>
          <p className="text-4xl font-normal tracking-tight text-zinc-900">${stats?.total_income || '0.00'}</p>
          <p className="text-xs text-zinc-400 font-medium">Aggregated income</p>
        </div>

        <div className="space-y-1 border-l border-zinc-100 pl-6">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total Outflow</p>
          <p className="text-4xl font-normal tracking-tight text-zinc-900">${stats?.total_expenses || '0.00'}</p>
          <p className="text-xs text-zinc-400 font-medium">Aggregated expenses</p>
        </div>
      </div>

      {/* Secondary Stats Section */}
      <div className="pt-10">
        <h3 className="text-sm font-bold uppercase tracking-widest border-b border-zinc-100 pb-4 mb-8">Platform Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          <div className="flex items-center gap-5 group">
            <div className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-zinc-900 transition-colors">
              <svg className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-zinc-400">30-Day Growth</p>
              <p className="text-xl font-semibold text-zinc-900">+{stats?.recent_registrations || 0} Users</p>
            </div>
          </div>

          <div className="flex items-center gap-5 group">
            <div className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-zinc-900 transition-colors">
              <svg className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-zinc-400">Taxonomy</p>
              <p className="text-xl font-semibold text-zinc-900">{stats?.total_categories || 0} Categories</p>
            </div>
          </div>

          <div className="flex items-center gap-5 group">
            <div className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-zinc-900 transition-colors">
              <svg className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-zinc-400">Financial Plans</p>
              <p className="text-xl font-semibold text-zinc-900">{stats?.total_budgets || 0} active</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
// Admin User Management Component
function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    loadUsers();
  }, []);
  const loadUsers = () => {
    setLoading(true);
    api.get('/admin/users/user_list_detailed/')
      .then(res => {
        setUsers(res.data);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
      });
  };
  const viewUserDetails = (userId) => {
    api.get(`/admin/users/${userId}/user_details/`)
      .then(res => {
        setSelectedUser(res.data);
        setShowDetails(true);
      })
      .catch(err => alert('Error loading user details'));
  };
  const toggleUserActive = (userId) => {
    if (window.confirm('Toggle user active status?')) {
      api.post(`/admin/users/${userId}/toggle_active/`)
        .then(() => {
          loadUsers();
          alert('User status updated');
        })
        .catch(err => alert('Error updating user status'));
    }
  };
  const deleteUser = (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This will delete all their data permanently!')) {
      api.delete(`/admin/users/${userId}/delete_user/`)
        .then(() => {
          loadUsers();
          setShowDetails(false);
          alert('User deleted successfully');
        })
        .catch(err => alert(err.response?.data?.error || 'Error deleting user'));
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
      </div>
    );
  }
  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      {/* Admin Header with Badge */}
      <div className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-600 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h1 className="text-4xl font-bold text-white">User Management</h1>
                <span className="px-3 py-1 bg-white/30 backdrop-blur-sm text-white text-xs font-bold rounded-full">ADMIN PANEL</span>
              </div>
              <p className="text-white/90">Manage all users and their financial data</p>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <p className="text-white/80 text-sm">Total Users</p>
              <p className="text-white font-bold text-2xl">{users.length}</p>
            </div>
          </div>
        </div>
      </div>
      {/* User Details Modal */}
      {showDetails && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedUser.user.full_name || selectedUser.user.username}</h2>
                  <p className="text-white/80">@{selectedUser.user.username}</p>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-gray-800">{selectedUser.user.email}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-semibold text-gray-800">{selectedUser.user.phone_number || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm text-gray-600">Joined</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedUser.user.date_joined).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm text-gray-600">Last Login</p>
                  <p className="font-semibold text-gray-800">{selectedUser.user.last_login ? new Date(selectedUser.user.last_login).toLocaleDateString() : 'Never'}</p>
                </div>
              </div>
              {/* Statistics */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Financial Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
                    <p className="text-sm text-green-600 font-medium">Total Income</p>
                    <p className="text-2xl font-bold text-green-700">${selectedUser.statistics.total_income}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                    <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-700">${selectedUser.statistics.total_expenses}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Net Savings</p>
                    <p className="text-2xl font-bold text-blue-700">${selectedUser.statistics.net_savings}</p>
                  </div>
                </div>
              </div>
              {/* Recent Transactions */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Transactions</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedUser.recent_transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-semibold text-gray-800">{t.description}</p>
                        <p className="text-sm text-gray-500">{t.category_name} • {t.date}</p>
                      </div>
                      <span className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}${t.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Actions */}
              <div className="flex space-x-4">
                <button
                  onClick={() => toggleUserActive(selectedUser.user.id)}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                    selectedUser.user.is_active
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {selectedUser.user.is_active ? 'Deactivate User' : 'Activate User'}
                </button>
                <button
                  onClick={() => deleteUser(selectedUser.user.id)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold transition-all"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Transactions</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Net Savings</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Joined</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">{user.username.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{user.full_name || user.username}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium w-fit ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {user.is_staff && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium w-fit">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">{user.statistics.transaction_count}</td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${parseFloat(user.statistics.net_savings) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${user.statistics.net_savings}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(user.date_joined).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => viewUserDetails(user.id)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
// Main App Component with Sidebar Navigation
// Main App Component with TOP NAVIGATION
// Main App Component with REDESIGNED TOP NAVIGATION
function App() {
  const { user, logout, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showRegister, setShowRegister] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-200 border-t-zinc-800"></div>
      </div>
    );
  }

  if (!user) {
    return showRegister ? (
      <Register onSwitchToLogin={() => setShowRegister(false)} />
    ) : (
      <Login onSwitchToRegister={() => setShowRegister(true)} />
    );
  }

  // Simplified Menu Items (Budget page removed)
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'transactions', name: 'Transactions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'categories', name: 'Categories', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
    { id: 'reports', name: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  const adminMenuItems = [
    { id: 'admin-dashboard', name: 'Admin', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'admin-users', name: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* TOP NAVIGATION BAR - Minimal Light Theme */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-zinc-100 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-zinc-900 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">ET</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-zinc-900">Expense Tracker</span>
            </div>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                    currentPage === item.id
                      ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span className="font-semibold text-xs uppercase tracking-wider">{item.name}</span>
                </button>
              ))}

              {user.is_staff && (
                <>
                  <div className="w-px h-5 bg-zinc-200 mx-3"></div>
                  {adminMenuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setCurrentPage(item.id)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                        currentPage === item.id
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                      <span className="font-semibold text-xs uppercase tracking-wider">{item.name}</span>
                    </button>
                  ))}
                </>
              )}
            </nav>

            {/* User Profile & Logout */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 pr-4 border-r border-zinc-100">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-zinc-900 leading-none">{user.username}</p>
                  <p className="text-[10px] font-medium text-zinc-400 mt-1 uppercase">
                    {user.is_staff ? 'Administrator' : 'Member'}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${user.is_staff ? 'bg-indigo-600' : 'bg-zinc-800'}`}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
              </div>

              <button
                onClick={logout}
                className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-6">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'transactions' && <Transactions />}
          {currentPage === 'categories' && <Categories />}
          {currentPage === 'reports' && <Reports />}
          {currentPage === 'admin-dashboard' && user.is_staff && <AdminDashboard />}
          {currentPage === 'admin-users' && user.is_staff && <AdminUserManagement />}
        </div>
      </main>
    </div>
  );
}
export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
