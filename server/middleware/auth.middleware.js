const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  // Extract token from the "Authorization: Bearer <token>" header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token using your secret
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the user context to the request object
    // Now, any route can access req.user.role or req.user.departmentId
    req.user = decodedPayload; 
    
    next(); // Move on to the actual route handler
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized. Token is invalid or expired.' });
  }
};

module.exports = { requireAuth };