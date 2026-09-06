const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminSchema = new mongoose.Schema({
    sessionVersion: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    passwordResetEmail: { type: String, select: false },
    passwordResetSendAfter: { type: Date, select: false },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 5
    },
    name: {
        type: String,
        default: ''
    },
    department: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['admin'],
        default: 'admin'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: { 
        type: Date 
    }
});

// 儲存前進行密碼加密
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    if (!this.isNew) this.set({ passwordResetTokenHash: undefined, passwordResetExpiresAt: undefined, passwordResetEmail: undefined });
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// 檢查密碼
adminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 生成 JWT Token
adminSchema.methods.generateToken = function() {
    return jwt.sign({ id: this._id, role: 'admin', sessionVersion: this.sessionVersion || 0 }, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '30d'
    });
};

adminSchema.index({ passwordResetTokenHash: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('Admin', adminSchema);
