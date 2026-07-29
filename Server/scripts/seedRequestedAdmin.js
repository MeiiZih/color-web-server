const Admin = require('../models/Admin');

// Temporary one-time production seed. This file is removed after verification.
const ADMIN_EMAIL = 'yehpty@gmail.com';
const ADMIN_PASSWORD_HASH = '$2a$12$nG0jWZu66sDnbeMliz1n4e/IJlj52MpHSQweViR7.MVoVHAZJik0K';

async function seedRequestedAdmin() {
  await Admin.collection.updateOne(
    { email: ADMIN_EMAIL },
    {
      $set: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD_HASH,
        name: 'ColorMind Admin',
        department: 'System Administration',
        phone: '',
        role: 'admin',
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log(`Admin account is ready: ${ADMIN_EMAIL}`);
}

module.exports = seedRequestedAdmin;
