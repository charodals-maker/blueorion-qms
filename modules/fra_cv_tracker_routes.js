/**
 * FRA CV Tracker - Backend Routes
 * Handles CV management, FRA assignments, and Excel export per FRA
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Models
let CVApplication = require('../models/cv_models').CVApplication;
let FRATracker = require('../models/cv_models').FRATracker;

// Get all CVs
router.get('/api/cv/all', async (req, res) => {
    try {
        const cvs = await CVApplication.find().sort({ createdAt: -1 });
        res.json({ success: true, data: cvs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get CVs by FRA
router.get('/api/cv/fra/:fraId', async (req, res) => {
    try {
        const cvs = await CVApplication.find({ fraAssigned: parseInt(req.params.fraId) });
        res.json({ success: true, data: cvs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available CVs (not assigned)
router.get('/api/cv/available', async (req, res) => {
    try {
        const cvs = await CVApplication.find({ fraAssigned: null, status: 'available' });
        res.json({ success: true, data: cvs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new CV
router.post('/api/cv/add', async (req, res) => {
    try {
        const { name, age, position, qualifications, contact, notes } = req.body;

        const newCV = new CVApplication({
            applicantName: name,
            age: age,
            position: position,
            qualifications: qualifications,
            contact: contact,
            notes: notes,
            status: 'available',
            fraAssigned: null,
            createdAt: new Date()
        });

        await newCV.save();

        console.log(`[CV TRACKER] Added new CV: ${name}`);
        res.json({ success: true, data: newCV });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Assign CV to FRA
router.post('/api/cv/assign', async (req, res) => {
    try {
        const { cvId, fraId, assignedBy, notes } = req.body;

        const cv = await CVApplication.findByIdAndUpdate(
            cvId,
            {
                fraAssigned: fraId,
                status: 'assigned',
                assignmentDate: new Date(),
                assignedBy: assignedBy,
                assignmentNotes: notes
            },
            { new: true }
        );

        // Update FRA tracker
        const fraTracker = await FRATracker.findOneAndUpdate(
            { fraId: fraId },
            {
                $inc: { totalAssigned: 1 },
                lastUpdated: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`[CV TRACKER] Assigned CV ${cvId} to FRA ${fraId}`);
        res.json({ success: true, data: cv });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark CV as selected
router.post('/api/cv/select', async (req, res) => {
    try {
        const { cvId, selectedBy, selectionDate, selectionNotes } = req.body;

        const cv = await CVApplication.findByIdAndUpdate(
            cvId,
            {
                status: 'selected',
                selectionDate: new Date(selectionDate),
                selectedBy: selectedBy,
                selectionNotes: selectionNotes
            },
            { new: true }
        );

        // Update FRA tracker
        const fraTracker = await FRATracker.findOneAndUpdate(
            { fraId: cv.fraAssigned },
            {
                $inc: { totalSelected: 1 },
                lastUpdated: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`[CV TRACKER] Marked CV ${cvId} as selected`);
        res.json({ success: true, data: cv });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get FRA statistics
router.get('/api/fra/stats', async (req, res) => {
    try {
        const stats = [];
        const fraNames = {
            1: 'Can Alriyadh',
            2: 'Rawdah Audh',
            3: 'IRC Agency',
            4: 'Service Engineer',
            5: 'MALAYSIA (AGENSI PEKERJAAN)'
        };

        for (let i = 1; i <= 5; i++) {
            const assigned = await CVApplication.countDocuments({ fraAssigned: i });
            const selected = await CVApplication.countDocuments({ fraAssigned: i, status: 'selected' });

            stats.push({
                fraId: i,
                fraName: fraNames[i],
                assigned: assigned,
                selected: selected,
                available: assigned - selected
            });
        }

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export individual FRA to Excel
router.get('/api/export/fra/:fraId', async (req, res) => {
    try {
        const fraId = parseInt(req.params.fraId);
        const fraNames = {
            1: 'Can Alriyadh',
            2: 'Rawdah Audh',
            3: 'IRC Agency',
            4: 'Service Engineer',
            5: 'MALAYSIA (AGENSI PEKERJAAN)'
        };

        const fraName = fraNames[fraId] || 'FRA';
        const cvs = await CVApplication.find({ fraAssigned: fraId }).sort({ selectionDate: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${fraName}`);

        // Add title
        worksheet.merge('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `${fraName} - CV Assignment Report`;
        titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF667EEA' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'center' };
        worksheet.getRow(1).height = 25;

        // Add generation date
        worksheet.merge('A2:H2');
        const dateCell = worksheet.getCell('A2');
        dateCell.value = `Generated: ${new Date().toLocaleString()}`;
        dateCell.font = { italic: true, size: 10 };
        dateCell.alignment = { horizontal: 'center' };

        // Add headers
        const headerRow = worksheet.getRow(4);
        const headers = ['Applicant Name', 'Age', 'Position', 'Status', 'Assignment Date', 'Selection Date', 'Assigned By', 'Selected By'];
        headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF764BA2' } };
            cell.alignment = { horizontal: 'center', vertical: 'center' };
        });

        // Set column widths
        worksheet.columns = [
            { width: 25 },
            { width: 8 },
            { width: 20 },
            { width: 12 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];

        // Add data rows
        let rowNum = 5;
        cvs.forEach(cv => {
            const row = worksheet.getRow(rowNum);
            row.values = [
                cv.applicantName,
                cv.age || '-',
                cv.position || '-',
                cv.status.toUpperCase(),
                cv.assignmentDate ? new Date(cv.assignmentDate).toLocaleDateString() : '-',
                cv.selectionDate ? new Date(cv.selectionDate).toLocaleDateString() : '-',
                cv.assignedBy || '-',
                cv.selectedBy || '-'
            ];

            // Color code by status
            if (cv.status === 'selected') {
                row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
            } else if (cv.status === 'assigned') {
                row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
            }

            rowNum++;
        });

        // Add summary
        const summaryRow = rowNum + 2;
        worksheet.merge(`A${summaryRow}:B${summaryRow}`);
        worksheet.getCell(`A${summaryRow}`).value = 'SUMMARY:';
        worksheet.getCell(`A${summaryRow}`).font = { bold: true };

        worksheet.getCell(`A${summaryRow + 1}`).value = 'Total Assigned:';
        worksheet.getCell(`B${summaryRow + 1}`).value = cvs.length;

        worksheet.getCell(`A${summaryRow + 2}`).value = 'Total Selected:';
        worksheet.getCell(`B${summaryRow + 2}`).value = cvs.filter(cv => cv.status === 'selected').length;

        worksheet.getCell(`A${summaryRow + 3}`).value = 'Pending:';
        worksheet.getCell(`B${summaryRow + 3}`).value = cvs.filter(cv => cv.status === 'assigned').length;

        // Generate file
        const fileName = `${fraName}_CV_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(__dirname, '../exports', fileName);

        await workbook.xlsx.writeFile(filePath);

        console.log(`[CV EXPORT] Created Excel report for ${fraName}`);

        res.download(filePath, fileName, (err) => {
            if (err) console.error('Download error:', err);
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export all FRAs to individual Excel files (zipped)
router.get('/api/export/all-fra', async (req, res) => {
    try {
        const fraNames = {
            1: 'Can Alriyadh',
            2: 'Rawdah Audh',
            3: 'IRC Agency',
            4: 'Service Engineer',
            5: 'MALAYSIA (AGENSI PEKERJAAN)'
        };

        // Create master workbook with all FRAs
        const workbook = new ExcelJS.Workbook();

        for (let fraId = 1; fraId <= 5; fraId++) {
            const cvs = await CVApplication.find({ fraAssigned: fraId }).sort({ selectionDate: -1 });
            const fraName = fraNames[fraId];

            const worksheet = workbook.addWorksheet(`${fraName}`);

            // Add title
            worksheet.merge('A1:H1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = `${fraName} - CV Assignment Report`;
            titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF667EEA' } };

            // Add headers
            const headerRow = worksheet.getRow(3);
            const headers = ['Applicant Name', 'Age', 'Position', 'Status', 'Assignment Date', 'Selection Date', 'Assigned By', 'Selected By'];
            headers.forEach((header, index) => {
                const cell = headerRow.getCell(index + 1);
                cell.value = header;
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF764BA2' } };
            });

            worksheet.columns = [
                { width: 25 }, { width: 8 }, { width: 20 }, { width: 12 },
                { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
            ];

            // Add data
            let rowNum = 4;
            cvs.forEach(cv => {
                const row = worksheet.getRow(rowNum);
                row.values = [
                    cv.applicantName,
                    cv.age || '-',
                    cv.position || '-',
                    cv.status.toUpperCase(),
                    cv.assignmentDate ? new Date(cv.assignmentDate).toLocaleDateString() : '-',
                    cv.selectionDate ? new Date(cv.selectionDate).toLocaleDateString() : '-',
                    cv.assignedBy || '-',
                    cv.selectedBy || '-'
                ];
                rowNum++;
            });
        }

        const fileName = `FRA_CV_Reports_All_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(__dirname, '../exports', fileName);

        await workbook.xlsx.writeFile(filePath);

        console.log('[CV EXPORT] Created all FRA Excel reports');

        res.download(filePath, fileName);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export CV pool
router.get('/api/export/cv-pool', async (req, res) => {
    try {
        const cvs = await CVApplication.find().sort({ createdAt: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CV Pool');

        // Add title
        worksheet.merge('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'Complete CV Pool - Available CVs';
        titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF667EEA' } };
        titleCell.alignment = { horizontal: 'center' };

        // Headers
        const headerRow = worksheet.getRow(3);
        const headers = ['Applicant Name', 'Age', 'Position', 'Status', 'FRA Assigned', 'Assignment Date', 'Selection Date', 'Contact'];
        headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF764BA2' } };
        });

        worksheet.columns = [
            { width: 25 }, { width: 8 }, { width: 20 }, { width: 12 },
            { width: 18 }, { width: 15 }, { width: 15 }, { width: 20 }
        ];

        // Data
        const fraNames = { 1: 'Can Alriyadh', 2: 'Rawdah Audh', 3: 'IRC Agency', 4: 'Service Engineer', 5: 'MALAYSIA (AGENSI PEKERJAAN)' };
        let rowNum = 4;
        cvs.forEach(cv => {
            const row = worksheet.getRow(rowNum);
            row.values = [
                cv.applicantName,
                cv.age || '-',
                cv.position || '-',
                cv.status.toUpperCase(),
                cv.fraAssigned ? fraNames[cv.fraAssigned] : 'Not Assigned',
                cv.assignmentDate ? new Date(cv.assignmentDate).toLocaleDateString() : '-',
                cv.selectionDate ? new Date(cv.selectionDate).toLocaleDateString() : '-',
                cv.contact || '-'
            ];
            rowNum++;
        });

        const fileName = `CV_Pool_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(__dirname, '../exports', fileName);

        await workbook.xlsx.writeFile(filePath);

        console.log('[CV EXPORT] Created CV pool export');

        res.download(filePath, fileName);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete CV
router.delete('/api/cv/:id', async (req, res) => {
    try {
        await CVApplication.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
