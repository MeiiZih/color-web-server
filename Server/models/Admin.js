const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminSchema = new mongoose.Schema({
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
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// 檢查密碼
adminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 生成 JWT Token
adminSchema.methods.generateToken = function() {
    return jwt.sign({ id: this._id, role: 'admin' }, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '30d'
    });
};

module.exports = mongoose.model('Admin', adminSchema); 