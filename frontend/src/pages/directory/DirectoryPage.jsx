import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

function initials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}
const avatarColors = [
  { bg: '#E6F1FB', color: '#0C447C' },
  { bg: '#E1F5EE', color: '#085041' },
  { bg: '#FAEEDA', color: '#633806' },
  { bg: '#FAECE7', color: '#712B13' },
  { bg: '#EEEDFE', color: '#3C3489' },
];
function avatarColor(name) {
  const idx = (name?.charCodeAt(0) || 0) % avatarColors.length;
  return avatarColors[idx];
}

export default function DirectoryPage() {
  const [employees, setEmployees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/directory')
      .then(r => { setEmployees(r.data.employees); setFiltered(r.data.employees); })
      .catch(() => toast.error('Could not load employee directory.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? employees.filter(e =>
            e.name?.toLowerCase().includes(q) ||
            e.job_title?.toLowerCase().includes(q) ||
            e.department_id?.[1]?.toLowerCase().includes(q) ||
            e.work_location_id?.[1]?.toLowerCase().includes(q)
          )
        : employees
    );
  }, [search, employees]);

  if (loading) return <div className="loading">Loading directory…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Employee directory</div>
        <div className="page-sub">{employees.length} employees</div>
      </div>

      <div className="search-bar">
        <SearchIcon />
        <input
          className="form-input"
          type="text"
          placeholder="Search by name, role, or department…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>{search ? `No employees matching "${search}"` : 'No employees found.'}</p>
          </div>
        ) : (
          filtered.map(emp => {
            const { bg, color } = avatarColor(emp.name);
            return (
              <div className="emp-row" key={emp.id}>
                <div className="avatar" style={emp.image_128 ? {} : { background: bg, color }}>
                  {emp.image_128
                  ? <img src={`data:image/png;base64,${emp.image_128}`} alt={emp.name}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : initials(emp.name)
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div className="emp-name">{emp.name}</div>
                  <div className="emp-sub">
                    {[emp.job_title, emp.department_id?.[1], emp.work_location_id?.[1]].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {emp.mobile_phone && (
                  <a href={`tel:${emp.mobile_phone}`} style={{ fontSize: 12, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                    {emp.mobile_phone}
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);
