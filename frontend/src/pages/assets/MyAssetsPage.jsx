import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

const categoryIcon = (cat) => {
  const icons = { Laptop: '💻', Phone: '📱', Tablet: '📟', Instrument: '🔧', Vehicle: '🚗', Furniture: '🪑', Other: '📦' };
  return icons[cat] || '📦';
};

export default function MyAssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/assets/my')
      .then(r => setAssets(r.data.assets))
      .catch(() => toast.error('Could not load your assets.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading your assets…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">My assets</div>
        <div className="page-sub">Items currently assigned to you</div>
      </div>

      {assets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <p style={{ fontSize: 36 }}>📦</p>
          <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 500, marginTop: 12 }}>No assets assigned</p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Contact your admin or storekeeper to assign assets to you.
          </p>
        </div>
      ) : (
        <div className="card">
          {assets.map(asset => (
            <div className="list-row" key={asset._id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{categoryIcon(asset.category)}</div>
                <div className="list-row-left">
                  <div className="list-row-title">{asset.name}</div>
                  <div className="list-row-sub">
                    {[
                      asset.make,
                      asset.model,
                      asset.serialNumber ? `S/N: ${asset.serialNumber}` : null,
                      asset.assetTag ? `Tag: ${asset.assetTag}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {asset.assignedAt && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      Assigned {format(new Date(asset.assignedAt), 'd MMM yyyy')}
                    </div>
                  )}
                </div>
              </div>
              <span className="badge badge-approved">{asset.category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
