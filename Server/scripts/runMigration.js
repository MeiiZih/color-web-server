const { migrateColorTest } = require('./migrateColorTest');

console.log('🚀 開始執行資料遷移...');
migrateColorTest()
    .then(() => {
        console.log('✅ 遷移完成！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 遷移失敗:', error);
        process.exit(1);
    });
