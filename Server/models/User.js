const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    // Missing/false means a pre-existing member; never mark them verified automatically.
    emailVerificationRequired: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    emailSendAfter: { type: Date, select: false },
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
        minlength: 6 
    },
    name: {
        type: String,
        default: ''
    },
    gender: {
        type: String,
        enum: ['男', '女', 'unknown'],
        default: 'unknown'
    },
    birthDate: {
        type: Date,
        default: Date.now
    },
    phone: {
        type: String,
        default: ''
    },
    occupation: {
        type: String,
        default: '未設定'
    },
    role: {
        type: String,
        enum: ['user'],
        default: 'user'
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
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    if (!this.isNew) this.set({ passwordResetTokenHash: undefined, passwordResetExpiresAt: undefined, passwordResetEmail: undefined });
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// 檢查密碼
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 生成 JWT Token
userSchema.methods.generateToken = function() {
    if (this.emailVerificationRequired === true && !this.emailVerifiedAt) throw new Error('Email verification required');
    return jwt.sign({ id: this._id, role: this.role, sessionVersion: this.sessionVersion || 0 }, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '30d'
    });
};

userSchema.index({ passwordResetTokenHash: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('User', userSchema);
