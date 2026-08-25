const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); 

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleLogin = async (req, res) => {
  const { credential } = req.body; 

  if (!credential) {
    return res.status(400).json({ message: 'No credential provided.' });
  }

  let email;

  // ==========================================
  // 1. Authentication Layer (Google)
  // ==========================================
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });
    
    const payload = ticket.getPayload();
    email = payload.email;
  } catch (error) {
    console.error('[Auth Error] Google Token Verification Failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired Google Token.' });
  }

  // ==========================================
  // 2. Data Layer (Cloud SQL Database)
  // ==========================================
  try {
    const { rows } = await db.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.status, 
        u.plant,
        COALESCE(array_agg(d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as departments
      FROM users u 
      LEFT JOIN user_departments ud ON u.id = ud.user_id
      LEFT JOIN departments d ON ud.department_id = d.id 
      WHERE u.email = $1
      GROUP BY u.id
    `, [email]);
    
    if (rows.length === 0) {
      console.warn(`[Auth Warning] Unregistered email login attempt: ${email}`);
      return res.status(403).json({ message: 'Access denied. You are not registered in the system.' });
    }

    const dbUser = rows[0]; 

    if (dbUser.status !== 'Active') {
      return res.status(403).json({ message: 'Access denied. Your account has been deactivated.' });
    }

    // ==========================================
    // 3. Application Layer (RBAC JWT)
    // ==========================================
    const token = jwt.sign(
      { 
        userId: dbUser.id, 
        name: dbUser.name,     
        role: dbUser.role, 
        departments: dbUser.departments, 
        plant: dbUser.plant
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '12h' } 
    );

    return res.status(200).json({ token, user: dbUser });

  } catch (error) {
    console.error('[Database Error] Failed to execute user lookup query:', error.message);
    // Explicit 500 error if Cloud SQL connection/schema fails
    return res.status(500).json({ message: 'Internal server error during database lookup.' });
  }
};

module.exports = { googleLogin };