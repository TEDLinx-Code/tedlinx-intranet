import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getEvents, getTaggableUsers, createEvent, deleteEvent } from '../../services/calendar.service';

const TYPES = ['Project', 'Office', 'Administrative'];
const typeClass = (type) => `cal-type-${type.toLowerCase()}`;
const dotClass = (type) => `cal-dot-${type.toLowerCase()}`;

function monthKey(date) {
  return format(date, 'yyyy-MM');
}

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function CalendarPage() {
  const { user, isManager } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => toDateOnly(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', type: 'Office', dateFrom: '', dateTo: '',
    taggedAll: false, taggedUsers: [], reminderLeadDays: 1,
  });

  const fetchEvents = () => {
    setLoading(true);
    Promise.all([
      getEvents(monthKey(cursor)).then(setEvents),
      getTaggableUsers().then(setUsers),
    ]).catch(err => toast.error(err.response?.data?.message || 'Failed to load calendar.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const from = toDateOnly(new Date(ev.dateFrom));
      const to = toDateOnly(new Date(ev.dateTo));
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const key = format(d, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(ev);
      }
    }
    return map;
  }, [events]);

  const gridDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay(); // 0=Sun
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return cells;
  }, [cursor]);

  const selectedDayEvents = eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || [];
  const today = toDateOnly(new Date());

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Please enter a title.');
    if (!form.dateFrom || !form.dateTo) return toast.error('Please select a date range.');
    if (!form.taggedAll && form.taggedUsers.length === 0) return toast.error('Tag at least one employee, or select "All employees".');
    setSubmitting(true);
    try {
      await createEvent(form);
      toast.success('Event created.');
      setShowForm(false);
      setForm({ title: '', description: '', type: 'Office', dateFrom: '', dateTo: '', taggedAll: false, taggedUsers: [], reminderLeadDays: 1 });
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create event.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;
    try {
      await deleteEvent(id);
      toast.success('Event deleted.');
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete event.');
    }
  };

  const toggleTaggedUser = (id) => {
    setForm(f => ({
      ...f,
      taggedUsers: f.taggedUsers.includes(id) ? f.taggedUsers.filter(x => x !== id) : [...f.taggedUsers, id],
    }));
  };

  if (loading) return <div className="loading">Loading calendar…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Calendar</div>
        <div className="page-sub">Project milestones, office events, and approved leave</div>
      </div>

      <div className="cal-legend">
        <div className="cal-legend-item"><span className="cal-dot cal-dot-project" /> Project</div>
        <div className="cal-legend-item"><span className="cal-dot cal-dot-office" /> Office event</div>
        <div className="cal-legend-item"><span className="cal-dot cal-dot-administrative" /> Administrative</div>
        <div className="cal-legend-item"><span className="cal-dot cal-dot-leave" /> Leave</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-sm" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>←</button>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, minWidth: 150, textAlign: 'center' }}>
            {format(cursor, 'MMMM yyyy')}
          </div>
          <button className="btn btn-sm" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>→</button>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New event'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New event</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Sprint review, Diwali celebration" required />
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Reminder (days before)</label>
                <input className="form-input" type="number" min="0" max="30" value={form.reminderLeadDays} onChange={e => setForm(f => ({ ...f, reminderLeadDays: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Start date</label>
                <input className="form-input" type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value, dateTo: f.dateTo || e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">End date</label>
                <input className="form-input" type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} required />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'none' }} />
            </div>
            <div className="form-row">
              <label className="form-label">Tag employees</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', marginBottom: 8 }}>
                <input type="checkbox" checked={form.taggedAll} onChange={e => setForm(f => ({ ...f, taggedAll: e.target.checked }))} />
                All employees
              </label>
              {!form.taggedAll && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 160, overflowY: 'auto', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                  {users.map(u => (
                    <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', background: form.taggedUsers.includes(u._id) ? 'var(--color-primary-bg)' : 'var(--color-bg)', padding: '5px 10px', borderRadius: 20 }}>
                      <input type="checkbox" checked={form.taggedUsers.includes(u._id)} onChange={() => toggleTaggedUser(u._id)} />
                      {u.name}{u._id === user?._id ? ' (myself)' : ''}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create event'}
              </button>
              <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="cal-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div className="cal-weekday" key={d}>{d}</div>)}
          {gridDays.map((day, i) => {
            if (!day) return <div className="cal-day cal-day-empty" key={`empty-${i}`} />;
            const key = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(key) || [];
            const isToday = day.getTime() === today.getTime();
            const isSelected = day.getTime() === selectedDay.getTime();
            return (
              <div
                key={key}
                className={`cal-day${isToday ? ' cal-day-today' : ''}${isSelected ? ' cal-day-selected' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <div className="cal-day-num">{day.getDate()}</div>
                <div className="cal-day-dots">
                  {dayEvents.slice(0, 4).map(ev => <span key={ev._id} className={`cal-dot ${dotClass(ev.type)}`} title={ev.title} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">{format(selectedDay, 'EEEE, d MMMM yyyy')}</div>
        {selectedDayEvents.length === 0 ? (
          <div className="empty-state"><p>No events on this day.</p></div>
        ) : (
          selectedDayEvents.map(ev => {
            const canDelete = isManager || String(ev.createdBy?._id) === String(user?._id);
            return (
              <div className="list-row" key={ev._id}>
                <div className="list-row-left">
                  <div className="list-row-title">{ev.title}</div>
                  <div className="list-row-sub">
                    {ev.taggedAll ? 'All employees' : (ev.taggedUsers || []).map(u => u.name).join(', ') || '—'}
                    {ev.description ? ` · ${ev.description}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${typeClass(ev.type)}`}>{ev.type}</span>
                  {!ev.isSystemGenerated && canDelete && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(ev._id)}>Delete</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
