const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

// 初始管理員賬號列表
const adminUsers = [
    {
        name: '王管理',
        email: 'admin1@example.com',
        password: 'admin123',
        role: 'admin',
        gender: '男',
        occupation: '系統管理員',
        department: '資訊部門'
    },
    {
        name: '林管理',
        email: 'admin2@example.com',
        password: 'admin123',
        role: 'admin',
        gender: '女',
        occupation: '系統管理員',
        department: '行政部門'
    },
    {
        name: '陳管理',
        email: 'admin3@example.com',
        password: 'admin123',
        role: 'admin',
        gender: '男',
        occupation: '系統管理員',
        department: '人事部門'
    }
];

// 創建管理員用戶
const createAdminUsers = async () => {
    try {
        // 獲取命令行參數，確定使用本地還是遠程資料庫
        const args = process.argv.slice(2);
        const useLocal = args.includes('--local');
        
        // 設置環境變量，以便connectDB使用正確的資料庫
        if (useLocal) {
            process.env.USE_LOCAL_DB = 'true';
            console.log('🔧 使用本地資料庫');
        } else {
            process.env.USE_LOCAL_DB = 'false';
            console.log('🔧 使用遠程資料庫');
        }

        // 連接數據庫
        await connectDB();
        console.log('✅ 數據庫連接成功');

        // 依次處理每個管理員帳號
        for (const adminData of adminUsers) {
            // 檢查該郵箱是否已註冊
            const existingAdmin = await Admin.findOne({ email: adminData.email });
            if (existingAdmin) {
                console.log(`⚠️ 管理員 ${adminData.email} 已存在，略過創建。`);
            } else {
                // 創建新的管理員帳號
                const newAdmin = new Admin(adminData);
                await newAdmin.save();
                console.log(`✅ 已創建管理員帳號：${adminData.email}`);
            }
        }

        console.log('✅ 所有管理員帳號已創建/更新完成');
        process.exit(0);
    } catch (error) {
        console.error('❌ 創建管理員帳號時出錯：', error);
        process.exit(1);
    }
};

// 執行創建管理員操作
createAdminUsers(); 