import Joi from 'joi';

export const authValidators = {
  register: {
    body: Joi.object({
      username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required()
        .messages({
          'string.alphanum': 'Username must only contain alphanumeric characters',
          'string.min': 'Username must be at least 3 characters long',
          'string.max': 'Username must not exceed 30 characters'
        }),
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Please provide a valid email address'
        }),
      password: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
        .required()
        .messages({
          'string.min': 'Password must be at least 8 characters long',
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        }),
      firstName: Joi.string().max(100).optional(),
      lastName: Joi.string().max(100).optional()
    })
  },

  login: {
    body: Joi.object({
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Please provide a valid email address'
        }),
      password: Joi.string()
        .required()
        .messages({
          'string.empty': 'Password is required'
        })
    })
  },

  refreshToken: {
    body: Joi.object({
      refreshToken: Joi.string()
        .required()
        .messages({
          'string.empty': 'Refresh token is required'
        })
    })
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string()
        .required()
        .messages({
          'string.empty': 'Current password is required'
        }),
      newPassword: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
        .required()
        .messages({
          'string.min': 'New password must be at least 8 characters long',
          'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        })
    })
  },

  forgotPassword: {
    body: Joi.object({
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Please provide a valid email address'
        })
    })
  },

  resetPassword: {
    body: Joi.object({
      token: Joi.string()
        .required()
        .messages({
          'string.empty': 'Reset token is required'
        }),
      newPassword: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
        .required()
        .messages({
          'string.min': 'New password must be at least 8 characters long',
          'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        })
    })
  },

  logout: {
    body: Joi.object({
      refreshToken: Joi.string().optional()
    })
  }
};