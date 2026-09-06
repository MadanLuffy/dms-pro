import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export default function PdfPreview({ data, page, zoom, rotation, onNumPages }) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;
    let doc;
    setPdf(null);
    setError('');
    (async () => {
      try {
        const task = getDocument({ data: data.slice() });
        doc = await task.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdf(doc);
        onNumPages?.(doc.numPages);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not open PDF');
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [data, onNumPages]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return undefined;
    const pageNum = Math.min(Math.max(page, 1), pdf.numPages);
    let cancelled = false;
    let renderTask;
    (async () => {
      try {
        const pdfPage = await pdf.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale: zoom / 100, rotation });
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = pdfPage.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (err) {
        if (err?.name === 'RenderingCancelledException') return;
        if (!cancelled) setError(err.message || 'Could not show this page');
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, page, zoom, rotation]);

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: 'var(--danger-deep)', fontSize: '0.85rem' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="pdf-stage">
      <canvas ref={canvasRef} />
    </div>
  );
}
