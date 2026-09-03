/**
 * User Controller
 * Handles CRUD operations for system users and integrates with Kintone Master Worker App.
 */

const db = require('../config/db');
const kintoneService = require('../services/kintone.service');

const getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, u.name, u.email, u.role, u.plant, u.status,
        u.dept_head_email, u.div_head_email,
        COALESCE(array_agg(DISTINCT d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as departments,
        COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') as sections,
        u.created_at as "createdAt"
      FROM users u 
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON ud.department_id = d.id
      LEFT JOIN user_sections us ON u.id = us.user_id
      LEFT JOIN sections s ON us.section_id = s.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    const { rows } = await db.query(query);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('[UserController] Error fetching users:', error);
    return res.status(500).json({ message: 'Failed to retrieve system users.' });
  }
};

const createUser = async (req, res) => {
  const { name, email, role, plant, departments, section, deptHeadEmail, divHeadEmail } = req.body; 

  if (!name || !email || !role) {
    return res.status(400).json({ message: 'Missing required fields: name, email, and role are mandatory.' });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Insert primary user record with hierarchy
    const insertUserQuery = `
      INSERT INTO users (id, name, email, role, plant, status, dept_head_email, div_head_email, created_at, updated_at) 
      VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Active', $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
      RETURNING id, name, email, role, plant, status, created_at
    `;
    const userRes = await client.query(insertUserQuery, [
      name, email, role, plant || 'Laguna', deptHeadEmail || null, divHeadEmail || null
    ]);
    const newUser = userRes.rows[0];

    // 2. Map chosen departments
    if (departments && Array.isArray(departments) && departments.length > 0) {
      for (const deptName of departments) {
        await client.query(`
          INSERT INTO user_departments (user_id, department_id)
          VALUES ($1, (SELECT id FROM departments WHERE name = $2 LIMIT 1))
          ON CONFLICT DO NOTHING
        `, [newUser.id, deptName]);
      }
    }

    // 3. Map execution section for Supervisors
    if (section) {
      await client.query(`
        INSERT INTO user_sections (user_id, section_id)
        VALUES ($1, (SELECT id FROM sections WHERE name = $2 LIMIT 1))
        ON CONFLICT DO NOTHING
      `, [newUser.id, section]);
    }

    await client.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, new_payload)
      VALUES ('users', $1, 'CREATE_USER', $2, $3)
    `, [newUser.id, req.user?.id || null, JSON.stringify({ ...newUser, departments, section })]);

    await client.query('COMMIT');
    return res.status(201).json({ ...newUser, departments: departments || [], section });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[UserController] Error creating user:', error);
    if (error.code === '23505') return res.status(409).json({ message: 'User with this email already exists.' });
    return res.status(500).json({ message: 'Failed to create user record.' });
  } finally {
    client.release();
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, plant, departments, status, section, deptHeadEmail, divHeadEmail } = req.body;

  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const existingUserRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingUserRes.rows.length === 0) throw new Error('NOT_FOUND');
    
    const oldUserData = existingUserRes.rows[0];

    const updateUserQuery = `
      UPDATE users 
      SET name = $1, email = $2, role = $3, plant = $4, status = $5, dept_head_email = $6, div_head_email = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING id, name, email, role, plant, status, updated_at
    `;
    
    const userRes = await client.query(updateUserQuery, [
      name || oldUserData.name, email || oldUserData.email, role || oldUserData.role, 
      plant || oldUserData.plant, status || oldUserData.status, 
      deptHeadEmail !== undefined ? deptHeadEmail : oldUserData.dept_head_email, 
      divHeadEmail !== undefined ? divHeadEmail : oldUserData.div_head_email, 
      id
    ]);

    if (departments && Array.isArray(departments)) {
      await client.query('DELETE FROM user_departments WHERE user_id = $1', [id]);
      for (const deptName of departments) {
        await client.query(`
          INSERT INTO user_departments (user_id, department_id)
          VALUES ($1, (SELECT id FROM departments WHERE name = $2 LIMIT 1)) ON CONFLICT DO NOTHING
        `, [id, deptName]);
      }
    }

    if (section !== undefined) {
      await client.query('DELETE FROM user_sections WHERE user_id = $1', [id]);
      if (section) {
        await client.query(`
          INSERT INTO user_sections (user_id, section_id)
          VALUES ($1, (SELECT id FROM sections WHERE name = $2 LIMIT 1)) ON CONFLICT DO NOTHING
        `, [id, section]);
      }
    }

    const updatedUser = userRes.rows[0];

    await client.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ('users', $1, 'UPDATE_USER', $2, $3, $4)
    `, [id, req.user?.id || null, JSON.stringify(oldUserData), JSON.stringify({ ...updatedUser, departments, section })]);

    await client.query('COMMIT');
    return res.status(200).json({ ...updatedUser, departments: departments || [], section });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[UserController] Error updating user:', error);
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'User not found.' });
    return res.status(500).json({ message: 'Failed to update user profile.' });
  } finally {
    client.release();
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    await db.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload)
      VALUES ('users', $1, 'DELETE_USER', $2, $3)
    `, [id, req.user?.id || null, JSON.stringify(checkRes.rows[0])]);

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('[UserController] Error deleting user:', error);
    return res.status(500).json({ message: 'Failed to delete user.' });
  }
};

const lookupEmployee = async (req, res) => {
  const { email } = req.query;
  
  if (!email) return res.status(400).json({ message: 'Email query parameter is required.' });

  try {
    const kintoneRecord = await kintoneService.getEmployeeByEmail(email);
    if (!kintoneRecord) return res.status(404).json({ message: 'No employee found with that email in Kintone.' });

    const dbCheck = await db.query(`
      SELECT u.role, u.status, 
        COALESCE(array_agg(d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as departments
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON ud.department_id = d.id
      WHERE u.email = $1 GROUP BY u.id
    `, [email]);

    const existingDbUser = dbCheck.rows.length > 0 ? dbCheck.rows[0] : null;

    // ✨ ARCHITECTURAL FIX: Extract hierarchy and section mapping
    const employeeData = {
      firstName: kintoneRecord.First_Name?.value || '',
      lastName: kintoneRecord.Last_Name?.value || '',
      department: kintoneRecord.Department?.value || '',
      section: kintoneRecord.Section?.value || '',
      deptHeadEmail: kintoneRecord['Department Head E-mail']?.value || '',
      divHeadEmail: kintoneRecord['Division Head E-mail']?.value || '',
      designation: kintoneRecord.Designation?.value || '',
      plant: kintoneRecord.Attribute?.value || '',
      role: existingDbUser ? existingDbUser.role : 'Unassigned',
      status: existingDbUser ? existingDbUser.status : 'Pending',
      assignedDepartments: existingDbUser ? existingDbUser.departments : []
    };

    return res.status(200).json(employeeData);
  } catch (error) {
    console.error('[UserController] Lookup Error:', error);
    return res.status(500).json({ message: 'Failed to communicate with Master Workers App.' });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser, lookupEmployee };