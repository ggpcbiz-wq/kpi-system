const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); 

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body; 

    if (!credential) {
      return res.status(400).json({ message: 'No credential provided.' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });
    
    const payload = ticket.getPayload();
    const email = payload.email;

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
      return res.status(403).json({ message: 'Access denied. You are not registered in the system.' });
    }

    const dbUser = rows[0]; 

    if (dbUser.status !== 'Active') {
      return res.status(403).json({ message: 'Access denied. Your account has been deactivated.' });
    }

    // ✨ FIX: Injected dbUser.name into the JWT payload for downstream audit logging
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

    res.status(200).json({
      token,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        departments: dbUser.departments, 
        plant: dbUser.plant
      }
    });

  } catch (error) {
    console.error('Authentication Error:', error);
    res.status(401).json({ message: 'Invalid or expired Google Token.' });
  }
};

module.exports = {
  googleLogin
};