import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Backend URL is injected at build/runtime via environment variable.
// In Kubernetes this points to the Ingress path / backend service.
const const API_URL = process.env.REACT_APP_API_URL || '';

function App() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ name: '', role: '', department: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/employees`);
      setEmployees(res.data);
      setError(null);
    } catch (err) {
      setError('Could not reach backend API. Check service connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.role || !form.department) return;
    await axios.post(`${API_URL}/api/employees`, form);
    setForm({ name: '', role: '', department: '' });
    fetchEmployees();
  };

  const handleDelete = async (id) => {
    await axios.delete(`${API_URL}/api/employees/${id}`);
    fetchEmployees();
  };

  return (
    <div className="container">
      <h1>Three-Tier DevOps Project</h1>
      <p className="subtitle">Frontend (React) → Backend (Node/Express) → Database (MySQL)</p>

      <form onSubmit={handleSubmit} className="form">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />
        <input
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />
        <button type="submit">Add Employee</button>
      </form>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Department</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.id}</td>
              <td>{emp.name}</td>
              <td>{emp.role}</td>
              <td>{emp.department}</td>
              <td>
                <button onClick={() => handleDelete(emp.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
