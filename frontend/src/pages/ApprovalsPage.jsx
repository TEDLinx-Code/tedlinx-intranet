import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ApprovalsPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null); // id of item being acted on

  useEffect(() => {
    Promise.all([
      api.get('/leave/team').then(r => setLeaveRequests(r.data.requests)),
      api.get('/expenses/team').then(r => setExpenses(r.data.expenses)),
    ]).catch(err => toast.error(err.response?.data?.message || 'Failed to load approvals.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLeave = async (id, action, leaveRecord) => {
    setActing(id);
    try {
      await api.put(`/leave/${id}/${action}`, {
        employeeOdooId: leaveRecord.employee_id?.[0],
        leaveType: leaveRecord.holiday_status_id?.[1] || 'Leave',
        dateFrom: leaveRecord.date_from || '',
        dateTo: leaveRecord.date_to || '',
        days: leaveRecord.number_of_days || '',
      });
      toast.success(action === 'approve' ? 'Leave approved.' : 'Leave refused.');
      setLeaveRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  const handleExpense = async (id, action, expenseRecord) => {
    setActing(id);
    try {
      await api.put(`/expenses/${id}/${action}`, {
        employeeOdooId: expenseRecord.employee_id?.[0],
        expenseName: expenseRecord.name || '',
      });
      toast.success(action === 'approve' ? 'Expense approved.' : 'Expense refused.');
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="loading">Loading approvals…</div>;

  const totalPending = leaveRequests.length + expenses.length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Approvals</div>
        <div className="page-sub">
          {totalPending === 0 ? 'All caught up — no pending approvals.' : `${totalPending} item(s) waiting for your action`}
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Leave requests</div>
          <div className="metric-value" style={{ color: leaveRequests.length ? 'var(--color-warning-text)' : 'var(--color-text)' }}>
            {leaveRequests.length}
          </div>
          <div className="metric-hint">pending</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Expense claims</div>
          <div className="metric-value" style={{ color: expenses.length ? 'var(--color-warning-text)' : 'var(--color-text)' }}>
            {expenses.length}
          </div>
          <div className="metric-hint">pending</div>
        </div>
      </div>

      {leaveRequests.length > 0 && (
        <div className="card">
          <div className="card-title">Leave requests</div>
          {leaveRequests.map(r => (
            <div className="approval-row" key={r.id}>
              <div className="approval-header">
                <div className="approval-name">{r.employee_id?.[1]} — {r.holiday_status_id?.[1]}</div>
                <span className="badge badge-pending">Pending</span>
              </div>
              <div className="approval-detail">
                {r.date_from ? format(new Date(r.date_from), 'd MMM') : ''} –{' '}
                {r.date_to ? format(new Date(r.date_to), 'd MMM yyyy') : ''} · {r.number_of_days} day(s)
                {r.name ? ` · ${r.name}` : ''}
              </div>
              <div className="approval-actions">
                <button
                  className="btn btn-success btn-sm"
                  disabled={acting === r.id}
                  onClick={() => handleLeave(r.id, 'approve', r)}
                >
                  {acting === r.id ? '…' : '✓ Approve'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={acting === r.id}
                  onClick={() => handleLeave(r.id, 'refuse', r)}
                >
                  {acting === r.id ? '…' : '✕ Refuse'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {expenses.length > 0 && (
        <div className="card">
          <div className="card-title">Expense claims</div>
          {expenses.map(e => (
            <div className="approval-row" key={e.id}>
              <div className="approval-header">
                <div className="approval-name">{e.employee_id?.[1]} — {e.name}</div>
                <span className="badge badge-pending">Pending</span>
              </div>
              <div className="approval-detail">
                {e.currency_id?.[1] || '₹'} {parseFloat(e.total_amount).toFixed(2)}
                {e.date ? ` · ${format(new Date(e.date), 'd MMM yyyy')}` : ''}
              </div>
              <div className="approval-actions">
                <button
                  className="btn btn-success btn-sm"
                  disabled={acting === e.id}
                  onClick={() => handleExpense(e.id, 'approve', e)}
                >
                  {acting === e.id ? '…' : '✓ Approve'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={acting === e.id}
                  onClick={() => handleExpense(e.id, 'refuse', e)}
                >
                  {acting === e.id ? '…' : '✕ Refuse'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPending === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 24 }}>✓</p>
          <p style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>All caught up</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>No pending approvals at this time.</p>
        </div>
      )}
    </div>
  );
}
