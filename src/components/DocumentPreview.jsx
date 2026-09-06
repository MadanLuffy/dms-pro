import { useCallback, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, FileText, Table, Download, Loader2, AlertTriangle } from 'lucide-react';
import { fetchAttachment } from '../lib/api';
import { formatBytes } from '../utils/format';

const typeFromMime = (attachment) => {
  const mime = (attachment?.mimeType || attachment?.type || '').toLowerCase();
  const name = (attachment?.filename || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.includes('wordprocessingml') || mime === 'application/msword' || name.endsWith('.docx') || name.endsWith('.doc')) return 'docx';
  if (mime.includes('spreadsheetml') || mime.includes('ms-excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  if (mime === 'text/csv' || name.endsWith('.csv')) return 'csv';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'image';
  return 'other';
};

export default function DocumentPreview({ attachment }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [docxHtml, setDocxHtml] = useState(null);
  const [grid, setGrid] = useState(null);
  const [gridError, setGridError] = useState('');
  const [converting, setConverting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);

  const type = attachment ? typeFromMime(attachment) : 'unknown';

  useEffect(() => {
    setZoom(100);
    setRotation(0);
    setDocxHtml(null);
    setGrid(null);
    setGridError('');
    setPreviewError('');
    setPreviewBusy(false);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [attachment?.id]);

  useEffect(() => {
    if (!attachment?.fileUrl || (type !== 'pdf' && type !== 'image')) return undefined;
    let objectUrl;
    let cancelled = false;
    setPreviewBusy(true);
    setPreviewError('');
    (async () => {
      try {
        const res = await fetchAttachment(attachment.fileUrl);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (!cancelled) setPreviewError(err.message || 'Could not open this file');
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment?.fileUrl, attachment?.id, type]);

  const renderDocx = useCallback(async () => {
    if (!attachment?.fileUrl || type !== 'docx') return;
    setConverting(true);
    try {
      const res = await fetchAttachment(attachment.fileUrl);
      const buf = await res.arrayBuffer();
      const [mammoth, DOMPurify] = await Promise.all([import('mammoth'), import('dompurify')]);
      const result = await mammoth.convertToHtml({ arrayBuffer: buf });
      setDocxHtml(DOMPurify.default.sanitize(result.value));
    } catch (err) {
      setGridError(err.message || 'DOCX conversion failed');
    } finally {
      setConverting(false);
    }
  }, [attachment, type]);

  const renderSpreadsheet = useCallback(async () => {
    if (!attachment?.fileUrl) return;
    if (type !== 'xlsx' && type !== 'csv') return;
    setConverting(true);
    try {
      const res = await fetchAttachment(attachment.fileUrl);
      const buf = await res.arrayBuffer();
      const mod = await import('xlsx');
      const XLSX = mod.default || mod;
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      setGrid({ sheets: wb.SheetNames, rows });
    } catch (err) {
      setGridError(err.message || 'Spreadsheet preview failed');
    } finally {
      setConverting(false);
    }
  }, [attachment, type]);

  useEffect(() => {
    if (type === 'docx') renderDocx();
    if (type === 'xlsx' || type === 'csv') renderSpreadsheet();
  }, [type, renderDocx, renderSpreadsheet, attachment?.id]);

  const handleDownload = async () => {
    try {
      const res = await fetchAttachment(attachment.fileUrl);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = attachment.filename || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setPreviewError(err.message || 'Download failed');
    }
  };

  if (!attachment) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.9rem' }}>
        No attachment selected for preview.
      </div>
    );
  }

  const zoomStyle = type === 'image' ? { transformOrigin: 'center center' } : { transformOrigin: 'top center' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', overflow: 'hidden' }}>
      <div className="preview-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          {type === 'pdf' && <FileText size={17} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
          {type === 'docx' && <FileText size={17} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
          {(type === 'xlsx' || type === 'csv') && <Table size={17} style={{ color: 'var(--success)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.filename}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{formatBytes(attachment.sizeBytes)} · {type.toUpperCase()}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button type="button" onClick={() => setZoom((z) => Math.max(z - 25, 50))} className="btn btn-secondary btn-sm" aria-label="Zoom out"><ZoomOut size={14} /></button>
          <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', minWidth: 42, textAlign: 'center', fontWeight: 700 }}>{zoom}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(z + 25, 200))} className="btn btn-secondary btn-sm" aria-label="Zoom in"><ZoomIn size={14} /></button>
          <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className="btn btn-secondary btn-sm" aria-label="Rotate"><RotateCw size={14} /></button>
          <button type="button" onClick={handleDownload} className="btn btn-secondary btn-sm" aria-label="Download">
            <Download size={14} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: type === 'pdf' ? 0 : '1.25rem', display: 'flex', justifyContent: 'center', alignItems: type === 'image' ? 'center' : 'flex-start' }}>
        {(previewError || gridError) && (
          <div style={{ padding: '2rem', color: 'var(--danger-deep)', display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: 520 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{previewError || gridError}</span>
          </div>
        )}

        {type === 'pdf' && !previewError && (
          previewBusy ? (
            <div style={{ padding: '2rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={16} className="spin" /> Opening PDF...
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title={attachment.filename}
              style={{ width: '100%', height: '100%', border: 'none', transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, ...zoomStyle, transition: 'transform 0.2s ease' }}
            />
          ) : (
            <div style={{ padding: '2rem', color: 'var(--text-light)' }}>No preview available.</div>
          )
        )}

        {type === 'docx' && !gridError && (
          <div style={{ width: '100%', maxWidth: 800, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: '2rem', minHeight: 480, transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, ...zoomStyle, transition: 'transform 0.2s ease' }}>
            {converting && <div style={{ color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={16} className="spin" /> Converting document...</div>}
            {docxHtml && <div className="docx-container" dangerouslySetInnerHTML={{ __html: docxHtml }} style={{ fontSize: '0.9rem', lineHeight: 1.6 }} />}
          </div>
        )}

        {(type === 'xlsx' || type === 'csv') && !gridError && (
          <div style={{ width: '100%', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, boxShadow: 'var(--shadow-md)', overflow: 'hidden', transform: `scale(${zoom / 100})`, ...zoomStyle, transition: 'transform 0.2s ease' }}>
            {converting && <div style={{ color: 'var(--text-light)', padding: '1rem' }}><Loader2 size={16} className="spin" /> Parsing spreadsheet...</div>}
            {grid && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                      {grid.rows[0]?.map((h, i) => (
                        <th key={i} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 700, color: '#1e3a8a', borderRight: '1px solid #cbd5e1' }}>{h ?? ''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.rows.slice(1).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #e2e8f0', background: ri % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '0.55rem 1rem', borderRight: '1px solid #e2e8f0' }}>{cell ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {grid.rows.length === 0 && <div style={{ padding: '1rem', color: 'var(--text-light)' }}>Empty sheet.</div>}
              </div>
            )}
          </div>
        )}

        {type === 'image' && !previewError && (
          previewBusy ? (
            <div style={{ padding: '2rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={16} className="spin" /> Opening image...
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={attachment.filename}
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 10, boxShadow: 'var(--shadow-lg)', border: '1px solid #cbd5e1', objectFit: 'contain', transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, ...zoomStyle, transition: 'transform 0.2s ease' }}
            />
          ) : null
        )}

        {type === 'other' && (
          <div style={{ padding: '2rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> This file type cannot be previewed inline. Use the download button.
          </div>
        )}
      </div>
    </div>
  );
}
