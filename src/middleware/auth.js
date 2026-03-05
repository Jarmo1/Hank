import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'forgeai-dev-secret-change-in-production';
export const COOKIE_NAME = 'forgeai_token';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}
