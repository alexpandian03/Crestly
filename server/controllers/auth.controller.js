import { changeUserPassword, loginUser, publicUser } from '../services/auth.service.js';

export async function login(req, res, next) {
  try {
    const result = await loginUser({
      email: req.body.email,
      password: req.body.password,
      ip: req.ip,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    return res.status(200).json({ success: true, data: { user: publicUser(req.user) } });
  } catch (err) {
    return next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await changeUserPassword(req.user._id, req.body.currentPassword, req.body.newPassword);
    return res.status(200).json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (err) {
    return next(err);
  }
}
