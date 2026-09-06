const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 if(!process.env.CONTENT_REVIEW_INGEST_KEY)throw new Error('尚未設定待審同步授權。');
 const response=await fetch('https://color-web-server-jprj.onrender.com/api/content-review-ingest/current',{headers:{'X-Content-Review-Key':process.env.CONTENT_REVIEW_INGEST_KEY},signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw new Error('未能讀取現有資訊清單，請勿推定沒有需下架內容。');
 const items=await response.json();if(!Array.isArray(items))throw new Error('資訊清單格式不正確。');
 const file=path.resolve(__dirname,'../tmp/content-review/current-content.json');
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,JSON.stringify({checkedAt:new Date().toISOString(),items},null,2));
 console.log('已保存現有資訊清單（含已到期項目），不含會員或帳號資料。');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
