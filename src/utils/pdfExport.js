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

export async function generateFilePDFReport(file) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const approvals = (file.approvalMatrix || [])
    .map((m) => ({
      label: m.gate === 'CEO' ? '🏛️ CEO Gate' : `🏢 ${m.departmentName || m.deptId}`,
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
      (n) => `
      <div style="background:#f8fafc;border-left:3px solid #2563eb;padding:8px 12px;margin-bottom:10px;border-radius:4px;">
        <div style="font-size:11px;font-weight:bold;color:#1e40af;margin-bottom:4px;">Note Sheet v${esc(n.version)} — ${esc(n.author)} (${esc(n.time)})</div>
        <div style="font-size:11px;color:#334155;line-height:1.4;">${esc(n.content)}</div>
      </div>`
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
        <h1 style="color:#1e3a8a;font-size:24px;margin:0;font-weight:800;">SKANDA IT SOLUTIONS [P] LTD</h1>
        <p style="margin:4px 0 0 0;font-size:11px;color:#475569;">Bangalore - 560043</p>
      </div>
      <div style="text-align:right;">
        <span style="background:#dbeafe;color:#1e40af;padding:4px 10px;font-weight:bold;border-radius:4px;font-size:12px;">OFFICIAL ARCHIVAL COMPILATION</span>
      </div>
    </div>

    <h2 style="font-size:18px;color:#1e293b;margin-top:0;margin-bottom:15px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Subject File Lifecycle Report: ${esc(file.refNo)}</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
      <tr>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;width:25%;">Subject Title:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;" colspan="3"><strong>${esc(file.subject)}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;">Raised By:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${esc(file.creator?.name || '—')} (${esc(file.creator?.departmentName || '—')})</td>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;">Created:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${esc(fmt(file.createdAt))}</td>
      </tr>
      <tr>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;">Priority / Secrecy:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${esc(file.priority)} / ${esc(file.secrecy)}</td>
        <td style="padding:6px;background:#f8fafc;font-weight:bold;">Lifecycle Status:</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;"><strong>${esc(file.status)}</strong></td>
      </tr>
    </table>

    <h3 style="font-size:14px;color:#1e40af;border-bottom:2px solid #93c5fd;padding-bottom:4px;margin-top:25px;">1. Approval Matrix &amp; Sign-Offs</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Gate</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Status</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Sign-Off By</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Timestamp</th>
          <th style="padding:8px;text-align:left;border:1px solid #cbd5e1;">Remarks</th>
        </tr>
      </thead>
      <tbody>${approvalRows || `<tr><td colspan="5" style="padding:6px;border:1px solid #cbd5e1;">Pending approvals</td></tr>`}</tbody>
    </table>

    <h3 style="font-size:14px;color:#1e40af;border-bottom:2px solid #93c5fd;padding-bottom:4px;margin-top:25px;">2. Versioned Note-Sheet History</h3>
    <div style="margin-bottom:20px;">${noteBlocks || '<p style="font-size:12px;color:#64748b;">No notes recorded.</p>'}</div>

    <div style="margin-top:30px;padding-top:15px;border-top:1px solid #cbd5e1;font-size:10px;color:#64748b;display:flex;justify-content:space-between;">
      <span>Compiled on: ${esc(new Date().toLocaleString())}</span>
      <span>Skanda IT Solutions [P] Ltd — DMS Pro Archival Engine</span>
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

    pdf.save(`DMS_Lifecycle_Report_${file.refNo}.pdf`);
  } catch (err) {
    console.error('PDF Export Error:', err);
    throw new Error('PDF export failed');
  } finally {
    document.body.removeChild(reportElement);
  }
}

function flattenNotes(notes, depth = 0) {
  const list = [];
  for (const n of notes || []) {
    list.push({
      depth,
      version: n.version,
      author: n.author?.name || 'Unknown',
      role: n.author?.role ? String(n.author.role).replace(/_/g, ' ') : '',
      time: fmt(n.createdAt),
      content: n.content || '',
      attachments: (n.attachments || []).map((a) => a.filename).filter(Boolean),
    });
    if (n.replies?.length) list.push(...flattenNotes(n.replies, depth + 1));
  }
  return list;
}

/** Notes-only PDF: subject title + every note/reply on the file. */
export async function generateNotesSheetPDF(file) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    const cont = pdf.splitTextToSize(`${file.subject} (continued)`, maxWidth);
    pdf.text(cont, margin, y);
    y += cont.length * 4.5 + 6;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y - 3, pageWidth - margin, y - 3);
    pdf.setTextColor(15, 23, 42);
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  const titleLines = pdf.splitTextToSize(file.subject || 'Untitled subject', maxWidth);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 7 + 8;

  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.6);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  const notes = flattenNotes(file.notes || []);
  if (!notes.length) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(11);
    pdf.setTextColor(100, 116, 139);
    pdf.text('No notes have been recorded on this file.', margin, y);
  } else {
    notes.forEach((note, index) => {
      const indent = Math.min(note.depth, 4) * 6;
      const width = maxWidth - indent;
      const x = margin + indent;
      const label = [
        note.depth > 0 ? 'Reply' : `Note v${note.version || index + 1}`,
        note.author,
        note.role ? `(${note.role})` : '',
        '·',
        note.time,
      ]
        .filter(Boolean)
        .join(' ');
      const headerLines = pdf.splitTextToSize(label, width);
      const bodyLines = pdf.splitTextToSize(note.content || '(empty note)', width);
      const attLine = note.attachments.length
        ? pdf.splitTextToSize(`Attachments: ${note.attachments.join(', ')}`, width)
        : [];
      const blockH = headerLines.length * 4.5 + bodyLines.length * 5 + attLine.length * 4.2 + 10;

      ensureSpace(blockH);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 64, 175);
      pdf.text(headerLines, x, y);
      y += headerLines.length * 4.5 + 2;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text(bodyLines, x, y);
      y += bodyLines.length * 5 + 2;

      if (attLine.length) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(attLine, x, y);
        y += attLine.length * 4.2;
      }

      y += 6;
      pdf.setDrawColor(241, 245, 249);
      pdf.setLineWidth(0.3);
      pdf.line(x, y - 3, pageWidth - margin, y - 3);
    });
  }

  const safeName = String(file.subject || file.refNo || 'notes')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .trim()
    .slice(0, 60);
  pdf.save(`DMS_Notes_${safeName}.pdf`);
}