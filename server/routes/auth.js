const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'ng_financial_system_local_secret_key_2026';

// Middleware to verify JWT token or local admin session
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح لك بالوصول، يرجى تسجيل الدخول' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'الجلسة منتهية، يرجى إعادة تسجيل الدخول' });
  }
};

// Check role middleware
const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'ليس لديك الصلاحية لتنفيذ هذا الإجراء' });
  }
  next();
};

// 1. Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    const user = await db.getOne(`SELECT * FROM users WHERE username = ? AND is_active = 1`, [username.trim()]);
    if (!user) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    await db.execute(`
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, details, created_at)
      VALUES (?, ?, 'LOGIN', 'users', 'تسجيل دخول ناجح إلى النظام', datetime('now', 'localtime'))
    `, [user.id, user.username]);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// 2. Get Current User info
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.getOne(`SELECT id, username, full_name, role, is_active FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. List Users (Admin only)
router.get('/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const users = await db.query(`SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id ASC`);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create User (Admin only)
router.post('/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }
    const existing = await db.getOne(`SELECT id FROM users WHERE username = ?`, [username.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await db.execute(`
      INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, datetime('now', 'localtime'))
    `, [username.trim(), hash, fullName.trim(), role || 'viewer']);

    res.json({ success: true, userId: result.insertId, message: 'تم إنشاء المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update User (Admin only)
router.put('/users/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { fullName, role, is_active, password } = req.body;
    const userId = req.params.id;

    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      await db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, userId]);
    }

    await db.execute(`
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          role = COALESCE(?, role),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [fullName, role, is_active !== undefined ? is_active : 1, userId]);

    res.json({ success: true, message: 'تم تحديث بيانات المستخدم' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authenticate, requireRole };
