// CSV + .xlsx (hand-rolled OOXML in a stored ZIP — no dependencies).
import { CHANNEL_LABEL, LINK_STATUS_LABEL, FU_STATUS_LABEL, RESOLVED_LABEL, SCORE_LABELS } from './data.js';
import { fmt } from './time.js';

export const HEADERS = [
  'เลขเคส', 'ผลิตภัณฑ์', 'ผู้ดูแล', 'ช่องทาง', 'เลขอ้างอิงภายนอก', 'เปิดใหม่ต่อจากเคส', 'วันเวลาสร้าง', 'สถานะลิงก์',
  'เปิดดูครั้งแรก', 'หมดอายุ', 'วันเวลาตอบ', 'คะแนน', 'ระดับ', 'พอใจ (4–5)', 'เหตุผลที่เลือก', 'สถานะการแก้ปัญหา',
  'ความเห็น', 'เวอร์ชันแบบฟอร์ม', 'สถานะติดตาม', 'ผู้รับผิดชอบติดตาม', 'วันที่ติดต่อ', 'วันที่ปิดเรื่อง', 'บันทึกการติดตาม',
];

export function toRow(b) {
  const c = b.case;
  const r = b.resp;
  const f = b.fu;
  return [
    c.no, b.productName, c.agentNick, CHANNEL_LABEL[c.channel] || c.channel, c.extRef || '', c.parentCase || '',
    fmt(c.createdAt), LINK_STATUS_LABEL[b.status], fmt(c.openedAt), fmt(c.expiresAt),
    r ? fmt(r.answeredAt) : '', r ? r.score : '', r ? SCORE_LABELS[r.score - 1] : '', r ? (r.score >= 4 ? 1 : 0) : '',
    r ? (r.reasons || []).join(', ') : '', r?.resolved ? RESOLVED_LABEL[r.resolved] : '', r?.comment || '', r?.formVersion || '',
    f ? FU_STATUS_LABEL[f.status] : '', f ? b.assignee?.nickname || b.assignee?.name || '' : '', f ? fmt(f.contactedAt) : '',
    f ? fmt(f.closedAt) : '', f ? (f.notes || []).map((n) => `[${fmt(n.at)} ${n.by}] ${n.text}`).join(' | ') : '',
  ];
}

export function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

/* ------------------------------ xlsx ------------------------------ */
const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const parts = [];
  const cen = [];
  let off = 0;
  for (const f of files) {
    const nb = Buffer.from(f.name, 'utf8');
    const data = Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30 + nb.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nb.length, 26);
    nb.copy(lh, 30);
    parts.push(lh, data);
    const ch = Buffer.alloc(46 + nb.length);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(off, 42);
    nb.copy(ch, 46);
    cen.push(ch);
    off += lh.length + data.length;
  }
  const cdSize = cen.reduce((a, c) => a + c.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, ...cen, end]);
}

const xesc = (s) =>
  String(s ?? '')
    // strip control chars that are illegal in XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const col = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));

function sheetXml(rows, widths = []) {
  const body = rows
    .map((row, ri) => {
      const cells = row
        .map((v, ci) => {
          const ref = `${col(ci)}${ri + 1}`;
          const s = ri === 0 ? ' s="1"' : '';
          if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`;
}

/** sheets: [{ name, rows: [[...]], widths?: [] }] → Buffer */
export function toXlsx(sheets) {
  const n = sheets.length;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip([
    { name: '[Content_Types].xml', data: ct },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: wb },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/styles.xml', data: styles },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows, s.widths) })),
  ]);
}
