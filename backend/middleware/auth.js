// ============================================================================
//  Authentication and authorisation middleware
// ============================================================================
//  Before this file existed, the API issued JWTs but never verified them: every
//  write endpoint was public and the admin role checks lived only in the
//  browser, where anyone could edit localStorage. This is the server-side half
//  of requirement NFR2.
//
//  Usage on a route:
//      const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');
//
//      router.get('/',    verifyToken, requireStaff, handler);   // any logged-in staff
//      router.delete('/:id', verifyToken, requireAdmin, handler); // administrators only
//
//  verifyToken  -> 401 if the token is missing, malformed, expired or invalid.
//  requireRole  -> 403 if the caller is authenticated but not permitted.
//                  (401 and 403 mean different things; keep them distinct.)
// ============================================================================
const jwt = require('jsonwebtoken');

const env = require('../config/env');

if (!env.jwtSecret) {
    throw new Error(
        'JWT_SECRET is not set, so login tokens cannot be signed or verified.\n' +
        'Add JWT_SECRET to backend/.env — see backend/.env.example for the format.\n' +
        'Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

const JWT_SECRET = env.jwtSecret;


// Pulls the token out of `Authorization: Bearer <token>`.
// Returns null rather than throwing, so the caller decides the response.
function readBearerToken(req) {
    const header = req.headers.authorization || '';

    const parts = header.split(' ');

    if (parts.length !== 2) {
        return null;
    }

    const [scheme, token] = parts;

    if (scheme.toLowerCase() !== 'bearer') {
        return null;
    }

    return token.trim() || null;
}


// Rejects the request unless a valid, unexpired JWT is present.
// On success, attaches the payload to req.user as:
//   { role, user_id, customer_id }
// Exactly one of user_id / customer_id is present, depending on who logged in.
function verifyToken(req, res, next) {
    const token = readBearerToken(req);

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);

        req.user = {
            role: payload.role,
            user_id: payload.user_id,
            customer_id: payload.customer_id
        };

        return next();

    } catch (error) {
        // Expiry and tampering are both 401, but the frontend wants to tell
        // them apart: "session expired, please log in again" vs. a hard error.
        const expired = error.name === 'TokenExpiredError';

        return res.status(401).json({
            error: expired ? 'Session expired' : 'Invalid token'
        });
    }
}


// Must be used after verifyToken.
function requireRole(...allowedRoles) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'You do not have permission to perform this action'
            });
        }

        return next();
    };
}


module.exports = {
    verifyToken,
    requireRole,

    // Pre-built guards for the two roles in the system. These are safe to share
    // between routes because each is a pure closure over `allowedRoles`.
    requireStaff: requireRole('admin', 'staff'),
    requireAdmin: requireRole('admin')
};
