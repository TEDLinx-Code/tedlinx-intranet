import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimetype) {
  if (!mimetype) return 'ti-file';
  if (mimetype.includes('pdf')) return 'ti-file-type-pdf';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'ti-file-type-doc';
  if (mimetype.includes('sheet') || mimetype.includes('excel')) return 'ti-file-type-xls';
  if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return 'ti-file-type-ppt';
  if (mimetype.includes('image')) return 'ti-photo';
  if (mimetype.includes('video')) return 'ti-video';
  if (mimetype.includes('zip') || mimetype.includes('compressed')) return 'ti-file-zip';
  return 'ti-file';
}

function fileIconColor(mimetype) {
  if (!mimetype) return 'var(--color-text-tertiary)';
  if (mimetype.includes('pdf')) return '#E24B4A';
  if (mimetype.includes('word') || mimetype.includes('document')) return '#185FA5';
  if (mimetype.includes('sheet') || mimetype.includes('excel')) return '#3B6D11';
  if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return '#D85A30';
  if (mimetype.includes('image')) return '#854F0B';
  return 'var(--color-text-secondary)';
}

export default function DocumentsPage() {
  const [root, setRoot] = useState(null);
  const [subfolders, setSubfolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [activeFolderName, setActiveFolderName] = useState('All documents');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);

  // Load folders on mount
  useEffect(() => {
    Promise.all([
      api.get('/documents/folders').then(r => {
        setRoot(r.data.root);
        setSubfolders(r.data.subfolders);
        setActiveFolderName(r.data.root?.name || 'Intranet');
      }),
      api.get('/documents').then(r => setDocuments(r.data.documents)),
    ]).catch(() => toast.error('Could not load documents from Odoo.'))
      .finally(() => setLoading(false));
  }, []);

  // Reload docs when folder or search changes
  useEffect(() => {
    if (loading) return;
    setDocsLoading(true);
    const params = new URLSearchParams();
    if (activeFolderId) params.set('folderId', activeFolderId);
    if (search) params.set('search', search);
    api.get(`/documents?${params}`)
      .then(r => setDocuments(r.data.documents))
      .catch(() => toast.error('Could not load documents.'))
      .finally(() => setDocsLoading(false));
  }, [activeFolderId, search]);

  const selectFolder = (folder) => {
    setActiveFolderId(folder ? folder.id : null);
    setActiveFolderName(folder ? folder.name : 'All documents');
    setSearch('');
  };

  const handleDownload = (doc) => {
    // Open Odoo download URL in a new tab, passing the auth token as a query param
    // since window.open cannot send custom headers like Authorization.
    const token = localStorage.getItem('token');
    window.open(`/api/documents/${doc.id}/download?token=${encodeURIComponent(token)}`, '_blank');
  };

  if (loading) return <div className="loading">Loading documents…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Documents</div>
        <div className="page-sub">Company policies, SOPs, and shared files — synced from Odoo</div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Folder sidebar */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div className="card" style={{ padding: '10px 0', marginBottom: 0 }}>
            {/* Root "All" entry */}
            <div
              onClick={() => selectFolder(null)}
              style={{
                padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                borderLeft: !activeFolderId ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: !activeFolderId ? 'var(--color-primary-bg)' : 'transparent',
                color: !activeFolderId ? 'var(--color-primary-text)' : 'var(--color-text-secondary)',
                fontWeight: !activeFolderId ? 500 : 400,
              }}
            >
              <i className="ti ti-folder" style={{ marginRight: 6, fontSize: 15, verticalAlign: -2 }} aria-hidden="true" />
              {root?.name || 'Intranet'}
            </div>
            {/* Subfolders */}
            {subfolders.map(f => (
              <div
                key={f.id}
                onClick={() => selectFolder(f)}
                style={{
                  padding: '8px 16px 8px 28px', fontSize: 13, cursor: 'pointer',
                  borderLeft: activeFolderId === f.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                  background: activeFolderId === f.id ? 'var(--color-primary-bg)' : 'transparent',
                  color: activeFolderId === f.id ? 'var(--color-primary-text)' : 'var(--color-text-secondary)',
                  fontWeight: activeFolderId === f.id ? 500 : 400,
                  transition: 'all 0.12s',
                }}
              >
                <i className="ti ti-folder" style={{ marginRight: 6, fontSize: 14, verticalAlign: -2 }} aria-hidden="true" />
                {f.name}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search bar */}
          <div className="search-bar">
            <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              className="form-input"
              style={{ paddingLeft: 32 }}
              type="text"
              placeholder={`Search in ${activeFolderName}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{activeFolderName}</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                {docsLoading ? 'Loading…' : `${documents.length} file${documents.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {docsLoading ? (
              <div className="loading" style={{ padding: '24px 0' }}>Loading…</div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-folder-off" style={{ fontSize: 32, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
                <p>{search ? `No documents matching "${search}"` : 'No documents in this folder.'}</p>
              </div>
            ) : (
              documents.map(doc => (
                <div className="list-row" key={doc.id} style={{ gap: 12 }}>
                  {/* File icon */}
                  <i
                    className={`ti ${fileIcon(doc.mimetype)}`}
                    style={{ fontSize: 22, color: fileIconColor(doc.mimetype), flexShrink: 0, width: 24, textAlign: 'center' }}
                    aria-hidden="true"
                  />

                  {/* Name + meta */}
                  <div className="list-row-left">
                    <div className="list-row-title">{doc.name}</div>
                    <div className="list-row-sub">
                      {[
                        doc.folder_id?.[1],
                        formatBytes(doc.file_size),
                        doc.write_date ? `Updated ${format(new Date(doc.write_date), 'd MMM yyyy')}` : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  {/* Download / open button */}
                  <button
                    className="btn btn-sm"
                    onClick={() => handleDownload(doc)}
                    style={{ flexShrink: 0 }}
                  >
                    {doc.type === 'url'
                      ? <><i className="ti ti-external-link" aria-hidden="true" /> Open</>
                      : <><i className="ti ti-download" aria-hidden="true" /> Download</>
                    }
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
