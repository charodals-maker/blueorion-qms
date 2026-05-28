const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// ── Load from relational tables ───────────────────────────────
function loadRelational() {
  const agenciesPath  = path.join(__dirname, '..', 'data', 'fra_agencies.json');
  const applicantsPath = path.join(__dirname, '..', 'data', 'applicant_pool.json');
  const selectionsPath = path.join(__dirname, '..', 'data', 'selection_events.json');

  const agencies   = fs.existsSync(agenciesPath)   ? JSON.parse(fs.readFileSync(agenciesPath,   'utf8')) : [];
  const applicants = fs.existsSync(applicantsPath)  ? JSON.parse(fs.readFileSync(applicantsPath, 'utf8')) : [];
  const selections = fs.existsSync(selectionsPath)  ? JSON.parse(fs.readFileSync(selectionsPath, 'utf8')) : [];

  // Build FRA_CONFIG from agencies
  const FRA_CONFIG = agencies.map(a => ({
    key:    a.id,
    name:   a.name,
    label:  a.displayLabel || a.name,
    accre:  a.remarks || '',
    color:  a.color || '1F4E79',
    accreditationStatus: a.accreditationStatus || 'Active',
    capacity: a.capacity || 20,
  }));

  // Enrich applicants with FRA name
  const agencyMap = Object.fromEntries(agencies.map(a => [a.id, a]));
  const enriched = applicants.map(p => ({
    ...p,
    fraName: p.fraId ? (agencyMap[p.fraId] ? agencyMap[p.fraId].name : 'Unknown') : 'Available Pool',
    fra: p.fraId ? (agencyMap[p.fraId] ? agencyMap[p.fraId].name : 'Unknown') : 'Available Pool',
  }));

  return { FRA_CONFIG, applicants: enriched, agencies, selections };
}

const COLS = [
    { key: 'no',          header: '#',               width: 5  },
    { key: 'applicant',   header: 'APPLICANT NAME',  width: 30 },
    { key: 'status',      header: 'STATUS',          width: 14 },
    { key: 'selectionDate', header: 'DATE',          width: 14 },
    { key: 'agent',       header: 'AGENT / RECRUITER', width: 22 },
    { key: 'remarks',     header: 'REMARKS',         width: 52 },
];

const STATUS_COLORS = {
    selected:   { bg: 'E2EFDA', font: '375623', bold: true },
    assigned:   { bg: 'DEEAF1', font: '1F4E79', bold: false },
    available:  { bg: 'FFF2CC', font: '7F6000', bold: false },
    cancelled:  { bg: 'FCE4D6', font: '843C0C', bold: false },
    default:    { bg: 'FFFFFF', font: '000000', bold: false },
};

function applyFRASheet(ws, fra, records, isIndividual = false) {
    const themeColor = fra.color;
    const numCols = COLS.length;

    // ── Row 1: FRA Title Banner ──────────────────────────────
    ws.mergeCells(1, 1, 1, numCols);
    const titleCell = ws.getCell('A1');
    titleCell.value = fra.label;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + themeColor } };
    ws.getRow(1).height = 28;

    // ── Row 2: Accreditation info ────────────────────────────
    ws.mergeCells(2, 1, 2, numCols);
    const accreCell = ws.getCell('A2');
    accreCell.value = fra.accre || ' ';
    accreCell.font = { italic: true, size: 10, color: { argb: 'FF' + themeColor }, name: 'Calibri' };
    accreCell.alignment = { horizontal: 'center', vertical: 'middle' };
    accreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
    ws.getRow(2).height = 18;

    // ── Row 3: Generated date ────────────────────────────────
    ws.mergeCells(3, 1, 3, numCols);
    const dateCell = ws.getCell('A3');
    dateCell.value = `Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}   |   Total Applicants: ${records.length}`;
    dateCell.font = { size: 9, color: { argb: 'FF595959' }, name: 'Calibri' };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
    ws.getRow(3).height = 14;

    // ── Row 4: Column headers ────────────────────────────────
    COLS.forEach((col, i) => {
        const cell = ws.getCell(4, i + 1);
        cell.value = col.header;
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + themeColor } };
        cell.border = {
            top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            left:   { style: 'thin', color: { argb: 'FFFFFFFF' } },
            right:  { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };
        ws.getColumn(i + 1).width = col.width;
    });
    ws.getRow(4).height = 22;

    // ── Data rows ────────────────────────────────────────────
    records.forEach((item, idx) => {
        const rowNum = 5 + idx;
        const statusKey = (item.status || 'assigned').toLowerCase();
        const sc = STATUS_COLORS[statusKey] || STATUS_COLORS.default;
        const rowData = [
            idx + 1,
            item.name || item.applicant || '',
            (item.status || '').toUpperCase(),
            item.dateAdded || item.selectionDate || '',
            item.agent || '',
            item.processStep ? item.processStep + (item.remarks ? ' | ' + item.remarks : '') : (item.remarks || ''),
        ];
        rowData.forEach((val, ci) => {
            const cell = ws.getCell(rowNum, ci + 1);
            cell.value = val;
            cell.font = { bold: sc.bold, size: 10, color: { argb: 'FF' + sc.font }, name: 'Calibri' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + sc.bg } };
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: ci === 0 ? 'center' : 'left' };
            cell.border = {
                top:    { style: 'hair', color: { argb: 'FFCCCCCC' } },
                bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
                left:   { style: 'hair', color: { argb: 'FFCCCCCC' } },
                right:  { style: 'hair', color: { argb: 'FFCCCCCC' } },
            };
        });
        ws.getRow(rowNum).height = 18;
    });

    // ── Freeze pane below headers ────────────────────────────
    ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function generateExcel() {
    const { FRA_CONFIG, applicants, selections: selData } = loadRelational();

    // Also add Available Pool as a virtual FRA tab
    const allConfigs = [
        ...FRA_CONFIG,
        { key: null, name: 'Available Pool', label: 'AVAILABLE CV POOL', accre: 'Applicants not yet assigned to any FRA', color: '0D5C63' },
    ];

    // Ensure output dirs exist
    const exportsDir = path.join(__dirname, '..', 'exports');
    const fraDir = path.join(exportsDir, 'fra');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);
    if (!fs.existsSync(fraDir)) fs.mkdirSync(fraDir);

    const masterWorkbook = new ExcelJS.Workbook();
    masterWorkbook.creator = 'BLUEORION QMS';
    masterWorkbook.created = new Date();

    // ── Master: Summary sheet (first tab) ───────────────────
    const sumWs = masterWorkbook.addWorksheet('SUMMARY', { properties: { tabColor: { argb: 'FF1F4E79' } } });

    sumWs.mergeCells('A1:F1');
    sumWs.getCell('A1').value = 'BLUEORION QMS — FRA CV TRACKER (Relational)';
    sumWs.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    sumWs.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sumWs.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    sumWs.getRow(1).height = 28;

    sumWs.mergeCells('A2:F2');
    sumWs.getCell('A2').value = `Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })} | Total Applicants: ${applicants.length}`;
    sumWs.getCell('A2').font = { italic: true, size: 10 };
    sumWs.getCell('A2').alignment = { horizontal: 'center' };
    sumWs.getRow(2).height = 16;

    const sumHeaders = ['FRA Agency', 'Capacity', 'Total CVs', 'Selected', 'Assigned/Processing', 'Accre Status'];
    sumHeaders.forEach((h, i) => {
        const c = sumWs.getCell(3, i + 1);
        c.value = h; c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sumWs.getRow(3).height = 20;
    [36, 12, 14, 12, 22, 16].forEach((w, i) => sumWs.getColumn(i + 1).width = w);

    allConfigs.forEach((fra, idx) => {
        const records = fra.key === null
            ? applicants.filter(r => !r.fraId)
            : applicants.filter(r => r.fraId === fra.key);
        const selected = records.filter(r => (r.status||'').toLowerCase() === 'selected').length;
        const assigned = records.filter(r => ['assigned','processing','flight'].includes((r.status||'').toLowerCase())).length;
        const rowNum = 4 + idx;
        const vals = [fra.label, fra.capacity || '—', records.length, selected, assigned, fra.accreditationStatus || '—'];
        vals.forEach((v, ci) => {
            const c = sumWs.getCell(rowNum, ci + 1);
            c.value = v;
            c.font = { size: 10, bold: ci === 0 };
            c.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF2F2F2' : 'FFFFFFFF' } };
            if (ci === 5 && v === 'Expired') {
                c.font = { size: 10, bold: true, color: { argb: 'FF843C0C' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
            }
        });
        sumWs.getRow(rowNum).height = 18;
    });

    // Total row
    const totalRow = 4 + allConfigs.length;
    const totals = ['TOTAL', '—', applicants.length,
        applicants.filter(r => (r.status||'').toLowerCase() === 'selected').length,
        applicants.filter(r => ['assigned','processing','flight'].includes((r.status||'').toLowerCase())).length, '—'];
    totals.forEach((v, ci) => {
        const c = sumWs.getCell(totalRow, ci + 1);
        c.value = v;
        c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        c.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
    });
    sumWs.getRow(totalRow).height = 22;

    for (const fra of allConfigs) {
        const records = fra.key === null
            ? applicants.filter(r => !r.fraId)
            : applicants.filter(r => r.fraId === fra.key);
        const sheetName = (fra.name || 'Sheet').substring(0, 31);

        // ── Individual workbook ──────────────────────────────
        const indWb = new ExcelJS.Workbook();
        indWb.creator = 'BLUEORION QMS';
        indWb.created = new Date();
        const indWs = indWb.addWorksheet(sheetName, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true } });
        applyFRASheet(indWs, fra, records, true);
        const fileName = `${sheetName.replace(/[\s\/\\]+/g, '_')}.xlsx`;
        await indWb.xlsx.writeFile(path.join(fraDir, fileName));

        // ── Master workbook tab ──────────────────────────────
        const masterWs = masterWorkbook.addWorksheet(sheetName, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true } });
        applyFRASheet(masterWs, fra, records, false);
    }

    // ── Selection History tab ────────────────────────────────
    if (selData && selData.length) {
        const histWs = masterWorkbook.addWorksheet('Selection History');
        const histHeaders = ['Sel ID', 'Applicant Name', 'FRA Agency', 'Selection Date', 'Process Step', 'Selected By', 'Notes'];
        const histWidths  = [10, 28, 22, 16, 20, 16, 40];
        histHeaders.forEach((h, i) => {
            histWs.getColumn(i + 1).width = histWidths[i];
            const c = histWs.getCell(1, i + 1);
            c.value = h;
            c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C2B6B' } };
            c.alignment = { horizontal: 'center' };
        });
        const sorted = [...selData].sort((a,b) => (b.selectionDate||'').localeCompare(a.selectionDate||''));
        sorted.forEach((s, idx) => {
            const r = idx + 2;
            [s.id, s.applicantName, s.fraName, s.selectionDate, s.processStep, s.selectedBy, s.notes].forEach((v, ci) => {
                const c = histWs.getCell(r, ci + 1);
                c.value = v || '—';
                c.font = { size: 10 };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF2F2F2' : 'FFFFFFFF' } };
            });
            histWs.getRow(r).height = 16;
        });
        histWs.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const masterPath = path.join(exportsDir, 'FRA_Tracker_Master.xlsx');
    await masterWorkbook.xlsx.writeFile(masterPath);
    console.log('Excel files generated successfully.');
}

generateExcel().catch(err => {
    console.error(err);
    process.exit(1);
});
