function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function parseNoteContent(rawContent = '') {
  const str = String(rawContent || '');
  const titleMatch = str.match(/^Title:\s*(.+?)(?:\r?\n\r?\n|$)/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    const body = str.slice(titleMatch[0].length).trim();
    return { title, body: body || title };
  }
  return { title: null, body: str };
}

export async function generateFilePDFReport(file) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const approvals = (file.approvalMatrix || [])
    .map((m) => ({
      label: m.gate === 'CEO' ? 'CEO' : (m.departmentName || m.deptId),
      status: m.status,
      reviewedBy: m.reviewedBy || '-',
      timestamp: fmt(m.timestamp),
      comments: m.comments || '-',
    }));

  const notes = (file.notes || []).map((n) => ({
    version: n.version,
    author: n.author?.name ? `${n.author.name} (${n.author.role})` : 'Unknown',
    time: fmt(n.createdAt),
    content: n.content,
  }));

  const approvalRows = approvals
    .map(
      (m, i) => `
      <tr${i === approvals.length - 1 ? ' style="background:#eff6ff;"' : ''}>
        <td style="padding:6px;border:1px solid #cbd5e1;"><strong>${esc(m.label)}</strong></td>
        <td style="padding:6px;border:1px solid #cbd5e1;"><strong>${esc(m.status)}</strong></td>
        <td style="padding:6px;border:1px solid #cbd5e1;">${esc(m.reviewedBy)}</td>
        <td style="padding:6px;border:1px solid #cbd5e1;">${esc(m.timestamp)}</td>
        <td style="padding:6px;border:1px solid #cbd5e1;">${esc(m.comments)}</td>
      </tr>`
    )
    .join('');

  const noteBlocks = notes
    .map(
      (n) => {
        const parsed = parseNoteContent(n.content);
        return `
      <div style="background:#f8fafc;border-left:3px solid #2563eb;padding:8px 12px;margin-bottom:10px;border-radius:4px;">
        <div style="font-size:11px;font-weight:bold;color:#1e40af;margin-bottom:4px;">Note v${esc(n.version)} · ${esc(n.time)}</div>
        ${parsed.title ? `<div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:4px;">${esc(parsed.title)}</div>` : ''}
        <div style="font-size:11px;color:#334155;line-height:1.4;">${esc(parsed.body)}</div>
      </div>`;
      }
    )
    .join('');

  const reportElement = document.createElement('div');
  reportElement.style.position = 'absolute';
  reportElement.style.left = '-9999px';
  reportElement.style.top = '-9999px';
  reportElement.style.width = '820px';
  reportElement.style.padding = '40px';
  reportElement.style.background = '#ffffff';
  reportElement.style.color = '#0f172a';
  reportElement.style.fontFamily = 'Helvetica, Arial, sans-serif';

  reportElement.innerHTML = `
    <div style="border-bottom:3px solid #1e40af;padding-bottom:15px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <h1 style="color:#1e3a8a;font-size:24px;margin:0;font-weight:800;">KMF Nandini</h1>
        <p style="margin:4px 0 0 0;font-size:11px;color:#475569;">Karnataka Milk Federation · Official Noting System — File report</p>
      </div>
      <div style="text-align:right;">
        <span style="background:#dbeafe;color:#1e40af;padding:4px 10px;font-weight:bold;border-radius:4px;font-size:12px;">FILE REPORT</span>
      </div>
    </div>

    <h2 style="font-size:18px;color:#1e293b;margin-top:0;margin-bottom:15px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">File: ${esc(file.refNo)}</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
      <tr>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;width:25%;">Subject Title:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;" colspan="3"><strong>${esc(file.subject)}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;">Created By:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${esc(file.creator?.name || '—')} (${esc(file.creator?.departmentName || '—')})</td>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;">Created:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${esc(fmt(file.createdAt))}</td>
      </tr>
      <tr>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;">Status:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;" colspan="3"><strong>${esc(file.status)}</strong></td>
      </tr>
    </table>

    <h3 style="font-size:14px;color:#1e40af;border-bottom:2px solid #93c5fd;padding-bottom:4px;margin-top:25px;">1. Approvals</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Department</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Status</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Approved By</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Timestamp</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Remarks</th>
        </tr>
      </thead>
      <tbody>${approvalRows || `<tr><td colspan="5" style="padding:6px;border:1px solid #cbd5e1;">Pending approvals</td></tr>`}</tbody>
    </table>

    <h3 style="font-size:14px;color:#1e40af;border-bottom:2px solid #93c5fd;padding-bottom:4px;margin-top:25px;">2. Notes</h3>
    <div style="margin-bottom:20px;">${noteBlocks || '<p style="font-size:12px;color:#64748b;">No notes recorded.</p>'}</div>

    <div style="margin-top:30px;padding-top:15px;border-top:1px solid #cbd5e1;font-size:10px;color:#64748b;display:flex;justify-content:space-between;">
      <span>Compiled on: ${esc(new Date().toLocaleString())}</span>
      <span>KMF Nandini · Document Management</span>
    </div>
  `;

  document.body.appendChild(reportElement);

  try {
    const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    const safeRefNo = String(file.refNo || 'report').replace(/[<>:"/\\|?*]+/g, '_');
    pdf.save(`File_Report_${safeRefNo}.pdf`);
  } catch (err) {
    console.error('PDF Export Error:', err);
    throw new Error('PDF export failed');
  } finally {
    document.body.removeChild(reportElement);
  }
}

/** Notes-only PDF: each note (#1, #2, ...) followed by all of its replies together. */
export async function generateNotesSheetPDF(file) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  const state = { y: margin };

  const ensureSpace = (needed) => {
    if (state.y + needed <= pageHeight - margin) return;
    pdf.addPage();
    state.y = margin;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    const cont = pdf.splitTextToSize(`${file.subject} (continued)`, maxWidth);
    pdf.text(cont, margin, state.y);
    state.y += cont.length * 4.5 + 6;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, state.y - 3, pageWidth - margin, state.y - 3);
    pdf.setTextColor(15, 23, 42);
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  const titleLines = pdf.splitTextToSize(file.subject || 'Untitled subject', maxWidth);
  pdf.text(titleLines, margin, state.y);
  state.y += titleLines.length * 7 + 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Official Noting Sheet · ${file.refNo || ''}`, margin, state.y);
  state.y += 6;

  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.6);
  pdf.line(margin, state.y, pageWidth - margin, state.y);
  state.y += 8;

  const rootNotes = (file.notes || []).filter((n) => !n.parentId);

  if (!rootNotes.length) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(11);
    pdf.setTextColor(100, 116, 139);
    pdf.text('No notes have been recorded on this file.', margin, state.y);
  } else {
    const renderNote = (note, depth, label) => {
      const indent = Math.min(depth, 4) * 6;
      const x = margin + indent;
      const width = maxWidth - indent;

      const author = note.author?.name || 'Unknown';
      const role = (note.author?.role || '').replace(/_/g, ' ');
      const headerLine = pdf.splitTextToSize(
        `${label} · ${author}${role ? ` (${role})` : ''} · ${fmt(note.createdAt)}`,
        width
      );
      const parsed = parseNoteContent(note.content);
      const parsedTitleLines = parsed.title ? pdf.splitTextToSize(`Title: ${parsed.title}`, width) : [];
      const bodyLines = pdf.splitTextToSize(parsed.body || '(empty note)', width);
      const sentToLine = note.sentTo ? pdf.splitTextToSize(`To: ${note.sentTo}`, width) : [];
      const attLine = (note.attachments || []).length
        ? pdf.splitTextToSize(`Attachments: ${note.attachments.map((a) => a.filename).join(', ')}`, width)
        : [];

      const blockH =
        2 +
        headerLine.length * 4.5 +
        (parsedTitleLines.length ? parsedTitleLines.length * 4.8 + 2 : 0) +
        bodyLines.length * 5 +
        (sentToLine.length ? sentToLine.length * 4.4 + 2 : 0) +
        (attLine.length ? attLine.length * 4.2 : 0) +
        8;

      ensureSpace(blockH);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 64, 175);
      pdf.text(headerLine, x, state.y);
      state.y += headerLine.length * 4.5 + 2;

      if (parsedTitleLines.length) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(parsedTitleLines, x, state.y);
        state.y += parsedTitleLines.length * 4.8 + 2;
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text(bodyLines, x, state.y);
      state.y += bodyLines.length * 5 + 2;

      if (sentToLine.length) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(sentToLine, x, state.y);
        state.y += sentToLine.length * 4.4 + 2;
      }

      if (attLine.length) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(attLine, x, state.y);
        state.y += attLine.length * 4.2;
      }

      state.y += 3;
      pdf.setDrawColor(241, 245, 249);
      pdf.setLineWidth(0.3);
      pdf.line(x, state.y, pageWidth - margin, state.y);
      state.y += 4;
    };

    const renderReplies = (replies, depth) => {
      for (const r of replies || []) {
        renderNote(r, depth, 'Reply');
        if (r.replies?.length) renderReplies(r.replies, depth + 1);
      }
    };

    rootNotes.forEach((note, index) => {
      renderNote(note, 0, `Note #${index + 1}`);
      renderReplies(note.replies || [], 1);

      if (index < rootNotes.length - 1) {
        state.y += 5;
        ensureSpace(2);
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.4);
        pdf.line(margin, state.y, pageWidth - margin, state.y);
        state.y += 5;
      }
    });
  }

  state.y = Math.max(state.y, margin + 6);
  ensureSpace(8);
  state.y = pageHeight - margin;
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`KMF Nandini · Karnataka Milk Federation · ${file.refNo || ''}`, margin, state.y);

  const safeName = String(file.subject || file.refNo || 'notes')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .trim()
    .slice(0, 60);
  pdf.save(`DMS_Notes_${safeName}.pdf`);
}