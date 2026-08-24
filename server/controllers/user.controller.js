const db = require('../config/db');
const kintoneService = require('../services/kintone.service');

// FETCH ALL USERS (Aggregating multiple department names into an array)
const getAllUsers = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role,
        u.plant,
        u.status,
        COALESCE(array_agg(d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as departments
      FROM users u 
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON ud.department_id = d.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// CREATE NEW USER (Directly executing queries using the db.query wrapper)
const createUser = async (req, res) => {
  const { name, email, role, departments } = req.body; 
  
  try {
    // 1. Insert primary user metadata
    const userRes = await db.query(`
      INSERT INTO users (id, name, email, role, plant, status, created_at) 
      VALUES (gen_random_uuid(), $1, $2, $3, 'Laguna', 'Active', CURRENT_TIMESTAMP) 
      RETURNING id, name, email, role, status
    `, [name, email, role]);
    
    const newUserId = userRes.rows[0].id;

    // 2. Map chosen departments via the junction table sequential queries
    if (departments && departments.length > 0) {
      for (const deptName of departments) {
        await db.query(`
          INSERT INTO user_departments (user_id, department_id)
          VALUES ($1, (SELECT id FROM departments WHERE name = $2 LIMIT 1))
        `, [newUserId, deptName]);
      }
    }

    res.status(201).json({ ...userRes.rows[0], departments });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

// UPDATE USER PROFILE
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, departments, status } = req.body;

  try {
    // 1. Update basic user metadata
    const userRes = await db.query(`
      UPDATE users 
      SET name = $1, email = $2, role = $3, status = $4
      WHERE id = $5 
      RETURNING id, name, email, role, status
    `, [name, email, role, status, id]);

    // 2. Clear out legacy department maps
    await db.query('DELETE FROM user_departments WHERE user_id = $1', [id]);

    // 3. Populate new department list connections
    if (departments && departments.length > 0) {
      for (const deptName of departments) {
        await db.query(`
          INSERT INTO user_departments (user_id, department_id)
          VALUES ($1, (SELECT id FROM departments WHERE name = $2 LIMIT 1))
        `, [id, deptName]);
      }
    }

    res.status(200).json({ ...userRes.rows[0], departments });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

// DELETE USER PROFILE
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

// GET /api/users/lookup?email=test@example.com
const lookupEmployee = async (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ message: 'Email query parameter is required' });
  }

  try {
    const kintoneRecord = await kintoneService.getEmployeeByEmail(email);
    
    if (!kintoneRecord) {
      return res.status(404).json({ message: 'No employee found with that email address in Kintone.' });
    }

    // Extract exactly what the frontend needs
    const employeeData = {
      firstName: kintoneRecord.First_Name?.value || '',
      lastName: kintoneRecord.Last_Name?.value || '',
      department: kintoneRecord.Department?.value || '',
      designation: kintoneRecord.Designation?.value || '',
      plant: kintoneRecord.Attribute?.value || ''
    };

    res.status(200).json(employeeData);
  } catch (error) {
    console.error('Lookup Controller Error:', error);
    res.status(500).json({ message: 'Failed to communicate with Master Workers App' });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser, lookupEmployee };