import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

function stateLabel(state, paid) {
  if (paid) return 'Paid';
  if (state === 'done') return 'Done';
  return state;
}
function stateClass(state, paid) {
  if (paid) return 'badge badge-approved';
  if (state === 'done') return 'badge badge-pending';
  return 'badge badge-draft';
}

// Category codes to group salary lines
const CATEGORY_ORDER = ['BASIC', 'ALW', 'GROSS', 'DED', 'NET'];
const CATEGORY_LABELS = {
  BASIC: 'Basic',
  ALW: 'Allowances',
  GROSS: 'Gross',
  DED: 'Deductions',
  NET: 'Net Pay',
};

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);

  useEffect(() => {
    api.get('/payslips')
      .then(r => setPayslips(r.data.payslips))
      .catch(() => toast.error('Could not load payslips.'))
      .finally(() => setLoading(false));
  }, []);

  const openPayslip = async (payslip) => {
    setSelected(payslip);
    setLines([]);
    setLinesLoading(true);
    try {
      const res = await api.get(`/payslips/${payslip.id}/lines`);
      setLines(res.data.lines);
    } catch {
      toast.error('Could not load payslip details.');
    } finally {
      setLinesLoading(false);
    }
  };

  const handleDownload = (id) => {
    const token = localStorage.getItem('token');
    window.open(`/api/payslips/${id}/download?token=${encodeURIComponent(token)}`, '_blank');
  };

  // Group lines by category code
  const groupedLines = lines.reduce((acc, line) => {
    const cat = line.category_id?.[1] || 'Other';
    const code = line.category_id?.[0] ? line.code?.slice(0, 3) : 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(line);
    return acc;
  }, {});

  // Find net pay
  const netLine = lines.find(l => l.code === 'NET');
  const grossLine = lines.find(l => l.code === 'GROSS');

  if (loading) return <div className="loading">Loading payslips…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Payslips</div>
        <div className="page-sub">Your salary statements</div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Payslip list */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {payslips.length === 0 ? (
              <div className="empty-state"><p>No payslips found.</p></div>
            ) : (
              payslips.map(p => (
                <div
                  key={p.id}
                  onClick={() => openPayslip(p)}
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderBottom: '0.5px solid var(--color-border)',
                    background: selected?.id === p.id ? 'var(--color-primary-bg)' : 'transparent',
                    borderLeft: selected?.id === p.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: selected?.id === p.id ? 'var(--color-primary-text)' : 'var(--color-text)' }}>
                    {p.name || (p.date_from ? format(new Date(p.date_from), 'MMMM yyyy') : `Payslip #${p.id}`)}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                    {p.date_from ? format(new Date(p.date_from), 'd MMM') : ''} –{' '}
                    {p.date_to ? format(new Date(p.date_to), 'd MMM yyyy') : ''}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className={stateClass(p.state, p.paid)}>{stateLabel(p.state, p.paid)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payslip detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: 32 }}>📄</p>
              <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 500, marginTop: 12 }}>Select a payslip</p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Click any payslip from the list to view details
              </p>
            </div>
          ) : (
            <div className="card">
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 4 }}>
                    {selected.name || format(new Date(selected.date_from), 'MMMM yyyy')}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {selected.date_from ? format(new Date(selected.date_from), 'd MMM yyyy') : ''} –{' '}
                    {selected.date_to ? format(new Date(selected.date_to), 'd MMM yyyy') : ''}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => handleDownload(selected.id)}>
                  ↓ Download PDF
                </button>
              </div>

              {/* Summary metrics */}
              {(grossLine || netLine) && (
                <div className="metric-grid" style={{ marginBottom: 20 }}>
                  {grossLine && (
                    <div className="metric-card">
                      <div className="metric-label">Gross pay</div>
                      <div className="metric-value" style={{ fontSize: 22 }}>
                        {selected.currency_id?.[1] || '₹'} {grossLine.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                  {netLine && (
                    <div className="metric-card" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                      <div className="metric-label">Net pay</div>
                      <div className="metric-value" style={{ fontSize: 22, color: 'var(--color-primary-text)' }}>
                        {selected.currency_id?.[1] || '₹'} {netLine.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Salary lines */}
              {linesLoading ? (
                <div className="loading" style={{ padding: '24px 0' }}>Loading details…</div>
              ) : lines.length === 0 ? (
                <div className="empty-state"><p>No salary lines found.</p></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Description</th>
                      <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Code</th>
                      <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => {
                      const isNet = line.code === 'NET';
                      const isGross = line.code === 'GROSS';
                      return (
                        <tr key={line.id} style={{
                          borderBottom: '0.5px solid var(--color-border)',
                          background: isNet ? 'var(--color-primary-bg)' : isGross ? 'var(--color-bg)' : 'transparent',
                          fontWeight: (isNet || isGross) ? 600 : 400,
                        }}>
                          <td style={{ padding: '10px 0', color: isNet ? 'var(--color-primary-text)' : 'var(--color-text)' }}>
                            {line.name}
                          </td>
                          <td style={{ padding: '10px 0', color: 'var(--color-text-tertiary)', fontFamily: 'monospace', fontSize: 12 }}>
                            {line.code}
                          </td>
                          <td style={{ padding: '10px 0', textAlign: 'right', color: isNet ? 'var(--color-primary-text)' : line.total < 0 ? 'var(--color-danger-text)' : 'var(--color-text)' }}>
                            {selected.currency_id?.[1] || '₹'} {line.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
