import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthHelper {
  static generateToken(userId, expiresIn = '1h') {
    return jwt.sign(
      { id: userId, iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn }
    );
  }

  static generateExpiredToken(userId) {
    return jwt.sign(
      { id: userId, iat: Math.floor(Date.now() / 1000) - 7200 },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1s' }
    );
  }

  static async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  static createAuthHeader(token) {
    return { Authorization: `Bearer ${token}` };
  }

  static extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    } catch (error) {
      return null;
    }
  }
}