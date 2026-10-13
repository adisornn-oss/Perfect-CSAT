// FR-406: case-level export (CSV / Excel) following the dashboard filters.
import { handler, qs } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { exportRows, computeStats } from '@/lib/stats';
import { HEADERS, toRow, toCsv, toXlsx } from '@/lib/export';
import { audit } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const u = await requireRole('lead');
  const q = qs(req);
  const { filters, rows } = await exportRows(q, u);
  const data = [HEADERS, ...rows.map(toRow)];
  const name = `perfect-csat_${filters.from}_${filters.to}${filters.product ? '_' + filters.product : ''}`;
  await audit(u, 'export', { format: q.format, ...filters, rows: rows.length });
  if (q.format === 'xlsx') {
    const st = await computeStats(q, u);
    const summary = [
      ['เดือน', 'CSAT (%)', 'ค่ากรอกชีต KPI', 'ผู้ตอบ', 'ลิงก์ที่สร้าง', 'อัตราตอบกลับ (%)', 'หมายเหตุ'],
      ...st.kpiSheet.map((k) => [
        k.label, k.csat ?? '', k.sheetValue ?? '', k.n, k.links, k.responseRate ?? '',
        [k.partial ? 'เดือนยังไม่จบ' : '', k.n < st.settings.minSample ? `ตัวอย่างน้อย (<${st.settings.minSample})` : ''].filter(Boolean).join(' · '),
      ]),
      [],
      ['ผู้ดูแล', 'CSAT (%)', 'ผู้ตอบ', 'คะแนนต่ำ (1–3)', 'ลิงก์ที่สร้าง', 'อัตราตอบกลับ (%)', 'หมายเหตุ'],
      ...st.byAgent.map((a) => [a.label, a.csat ?? '', a.n, a.low, a.links, a.responseRate ?? '', a.smallSample ? `ตัวอย่างน้อย (<${st.settings.minAgentSample})` : '']),
    ];
    const buf = toXlsx([
      { name: 'สรุป', rows: summary, widths: [16, 10, 14, 10, 12, 16, 28] },
      { name: 'รายเคส', rows: data, widths: [16, 12, 12, 12, 18, 16, 18, 12, 18, 18, 18, 8, 10, 10, 34, 16, 40, 10, 16, 16, 18, 18, 60] },
    ]);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}.xlsx"`,
      },
    });
  }
  return new Response(toCsv(data), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` },
  });
});
