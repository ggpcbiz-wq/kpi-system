/**
 * User Controller
 * Handles CRUD operations for system users and integrates with Kintone Master Worker App.
 */

const db = require('../config/db');
const kintoneService = require('../services/kintone.service');

/**
 * @route   GET /api/users
 * @desc    Fetch all registered users with aggregated department names
 * @access  Private (Admin / Authorized Users)
 */
const getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role,
        u.plant,
        u.status,
        COALESCE(array_agg(d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as departments,
        u.created_at as "createdAt"
      FROM users u 
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON ud.department_id = d.id
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

/**
 * @route   POST /api/users
 * @desc    Create a new system user and attach department mappings
 * @access  Private (Admin Only)
 */
const createUser = async (req, res) => {
  const { name, email, role, plant, departments } = req.body; 

  if (!name || !email || !role) {
    return res.status(400).json({ message: 'Missing required fields: name, email, and role are mandatory.' });
  }

  try {
    // 1. Insert primary user record
    const insertUserQuery = `
      INSERT INTO users (id, name, email, role, plant, status, created_at, updated_at) 
      VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
      RETURNING id, name, email, role, plant, status, created_at
    `;
    const userRes = await db.query(insertUserQuery, [name, email, role, plant || 'Laguna']);
    const newUser = userRes.rows[0];

    // 2. Map chosen departments via junction table
    if (departments && Array.isArray(departments) && departments.length > 0) {
      for (const deptName of departments) {
        await db.query(`
          INSERT INTO user_departments (user_id, department_id)
          VALUES ($1, (SELECT id FROM departments WHERE name = $2 LIMIT 1))
          ON CONFLICT DO NOTHING
        `, [newUser.id, deptName]);
      }
    }

    // 3. Write Audit Log
    await db.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, new_payload)
      VALUES ('users', $1, 'CREATE_USER', $2, $3)
    `, [newUser.id, req.user?.id || null, JSON.stringify({ ...newUser, departments })]);

    return res.status(201).json({ ...newUser, departments: departments || [] });
  } catch (error) {
    console.error('[UserController] Error creating user:', error);
    if (error.code === '23505') { // Unique constraint violation on email
      return res.status(409).json({ message: 'A user with this email address already exists.' });
    }
    return res.status(500).json({ message: 'Failed to create user record.' });
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Update an existing user's profile, role, status, and department assignments
 * @access  Private (Admin Only)
 */
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, plant, departments, status } = req.body;

  try {
    // 1. Fetch current user state for audit logging
    const existingUserRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingUserRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const oldUserData = existingUserRes.rows[0];

    // 2. Update core user metadata
    const updateUserQuery = `
      UPDATE users 
      SET name = $1, email = $2, role = $3, plant = $4, status = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 
      RETURNING id, name, email, role, plant, status, updated_at
    `;
    const userRes = await db.query(updateUserQuery, [
      name || oldUserData.name, 
      email || oldUserData.email, 
      role || oldUserData.role, 
      plant || oldUserData.plant, 
      status || oldUserData.status, 
      id
    ]);

    // 3. Re-synchronize department assignments
    if (departments && Array.isArray(departments)) {
      await db.query('DELETE FROM user_departments WHERE user_id = $1', [id]);
      for (const deptName of departments) {
        await db.query(`
          INSERT INTO user_departments (user_id, department_id)
          VALUES ($1, (SELECT id FROM departments WHERE name = $2 LIMIT 1))
          ON CONFLICT DO NOTHING
        `, [id, deptName]);
      }
    }

    const updatedUser = userRes.rows[0];

    // 4. Record Audit Log
    await db.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ('users', $1, 'UPDATE_USER', $2, $3, $4)
    `, [id, req.user?.id || null, JSON.stringify(oldUserData), JSON.stringify({ ...updatedUser, departments })]);

    return res.status(200).json({ ...updatedUser, departments: departments || [] });
  } catch (error) {
    console.error('[UserController] Error updating user:', error);
    return res.status(500).json({ message: 'Failed to update user profile.' });
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user account
 * @access  Private (Admin Only)
 */
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    // Record Audit Log
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

/**
 * @route   GET /api/users/lookup?email=employee@example.com
 * @desc    Fetches employee details from Kintone Master Workers App and merges with local DB RBAC
 * @access  Private
 */
const lookupEmployee = async (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ message: 'Email query parameter is required.' });
  }

  try {
    // 1. Fetch Master HR Identity from Kintone
    const kintoneRecord = await kintoneService.getEmployeeByEmail(email);
    
    if (!kintoneRecord) {
      return res.status(404).json({ message: 'No employee found with that email address in Kintone.' });
    }

    // 2. Query local PostgreSQL database to check if user already exists in this system
    const dbCheck = await db.query(`
      SELECT 
        u.role, 
        u.status,
        COALESCE(array_agg(d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as departments
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON ud.department_id = d.id
      WHERE u.email = $1
      GROUP BY u.id
    `, [email]);

    const existingDbUser = dbCheck.rows.length > 0 ? dbCheck.rows[0] : null;

    // 3. Construct unified response payload
    const employeeData = {
      firstName: kintoneRecord.First_Name?.value || '',
      lastName: kintoneRecord.Last_Name?.value || '',
      department: kintoneRecord.Department?.value || '',
      designation: kintoneRecord.Designation?.value || '',
      plant: kintoneRecord.Attribute?.value || '',
      // Merge PostgreSQL application data if registered; fallback to defaults if new
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

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  lookupEmployee
};