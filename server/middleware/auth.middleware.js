const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decodedPayload; 
    
    next(); // Move on to the actual route handler
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized. Token is invalid or expired.' });
  }
};

module.exports = { requireAuth };