const submissionRepo = require('../repositories/submission.repository');
const kintoneService = require('../services/kintone.service');
const driveService = require('../services/drive.service'); 
const db = require('../config/db'); 

const createSubmission = async (req, res) => {
  try {
    const { rows: targetRows } = await db.query(`
      SELECT d.name AS dept_name
      FROM kpi_targets t
      JOIN departments d ON t.department_id = d.id
      WHERE t.id = $1
    `, [req.body.target_id]);

    if (!targetRows[0]) {
      return res.status(404).json({ message: 'Target not found' });
    }

    if (!req.user.departments?.includes(targetRows[0].dept_name)) {
      return res.status(403).json({ message: 'Forbidden. You cannot submit data for this department.' });
    }

    let formattedRemark = req.body.remarks;
    if (formattedRemark && formattedRemark.trim() !== '') {
      const userRole = req.user?.role || 'Supervisor';
      const userName = req.user?.name || 'User';
      formattedRemark = `[${userRole} - ${userName}]: ${formattedRemark.trim()}`;
    }

    let attachmentUrl = null;
    if (req.file) {
      attachmentUrl = await driveService.uploadToDrive(req.file);
    }

    const submissionData = { 
      ...req.body, 
      remarks: formattedRemark, 
      // Wrap the URL in JSON.stringify so PostgreSQL's JSON column accepts it
      supporting_data: attachmentUrl ? JSON.stringify(attachmentUrl) : null, 
      submitted_by: req.user?.userId || req.body.submitted_by 
    };
    
    const newSubmission = await submissionRepo.create(submissionData);
    res.status(201).json(newSubmission);
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({ message: 'Failed to save monthly data' });
  }
};

const getSubmissions = async (req, res) => {
  try {
    const submissions = await submissionRepo.findAll(req.user);
    res.status(200).json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Failed to fetch submissions' });
  }
};

const updateSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, ...carData } = req.body;

    if (!status) return res.status(400).json({ message: 'Status is required' });

    const allowedRolesByStatus = {
      'Locked - Pending QMR Sign-Off': ['Supervisor', 'Manager'],
      'Approved': ['Administrator'],
      'CAR Requested': ['Administrator'],
      'Rejected': ['Manager', 'Administrator']
    };

    if (!allowedRolesByStatus[status]) {
      return res.status(400).json({ message: 'Invalid submission status transition' });
    }

    if (!allowedRolesByStatus[status].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden. You cannot apply this submission status.' });
    }

    if (req.user.role !== 'Administrator') {
      const { rows: submissionRows } = await db.query(`
        SELECT d.name AS dept_name
        FROM monthly_actuals m
        JOIN kpi_targets t ON m.target_id = t.id
        JOIN departments d ON t.department_id = d.id
        WHERE m.id = $1
      `, [id]);

      if (!submissionRows[0]) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      if (!req.user.departments?.includes(submissionRows[0].dept_name)) {
        return res.status(403).json({ message: 'Forbidden. You cannot modify this department submission.' });
      }
    }

    let formattedRemark = null;
    if (remarks && remarks.trim() !== '') {
      const rawRole = req.user?.role || 'QMR';
      const userRole = rawRole === 'Administrator' ? 'QMR' : rawRole;
      const userName = req.user?.name || 'System';
      
      formattedRemark = `[${userRole} - ${userName}]: ${remarks.trim()}`;
    }

    const { rows: preCheck } = await db.query(`SELECT kintone_record_id FROM monthly_actuals WHERE id = $1`, [id]);
    const existingKintoneId = preCheck[0]?.kintone_record_id;

    const updatedSubmission = await submissionRepo.updateStatus(id, status, formattedRemark, carData);
    if (!updatedSubmission) return res.status(404).json({ message: 'Submission not found' });

    // KINTONE LOGIC A
    if (status === 'Approved' || status === 'CAR Requested') {
      try {
        const { rows } = await db.query(`
          SELECT m.report_month, m.report_year, m.actual_value, m.remarks, m.kintone_car_id,
                 m.supporting_data, 
                 t.metric_name, t.target_value, t.operator, t.unit, d.name as dept_name
          FROM monthly_actuals m
          JOIN kpi_targets t ON m.target_id = t.id
          JOIN departments d ON t.department_id = d.id
          WHERE m.id = $1
        `, [id]);

        if (rows[0]) {

          let driveLink = rows[0].supporting_data || '';
          if (typeof driveLink === 'string' && driveLink.startsWith('"')) {
            driveLink = JSON.parse(driveLink);
          }

          const kintoneRes = await kintoneService.postToKintone({
            department: rows[0].dept_name,
            applied_by: req.user?.name || 'System QMR',
            status: status,
            car: rows[0].kintone_car_id || '', 
            metric: rows[0].metric_name,
            month: rows[0].report_month,
            year: rows[0].report_year,
            target: `${rows[0].operator} ${rows[0].target_value} ${rows[0].unit}`,
            actual: rows[0].actual_value,
            remarks: rows[0].remarks || '',
            attachment_link: driveLink 
          });

          if (kintoneRes && kintoneRes.id) {
            await db.query(`UPDATE monthly_actuals SET kintone_record_id = $1 WHERE id = $2`, [kintoneRes.id, id]);
          }
        }
      } catch (kintoneErr) {
        console.error("Warning: DB updated, but Kintone POST failed.", kintoneErr);
      }
    }

    // KINTONE LOGIC B
    if (status === 'Locked - Pending QMR Sign-Off' && carData.kintone_car_id && existingKintoneId) {
      try {
        await kintoneService.updateKintoneRecord(existingKintoneId, carData.kintone_car_id);
      } catch (kintoneErr) {
        console.error("Warning: DB updated, but Kintone PUT failed.", kintoneErr);
      }
    }

    res.status(200).json(updatedSubmission);
  } catch (error) {
    console.error('Error updating submission status:', error);
    res.status(500).json({ message: 'Failed to update submission status' });
  }
};

module.exports = { createSubmission, getSubmissions, updateSubmissionStatus };