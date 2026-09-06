const {chromium}=require('playwright');
const assert=require('node:assert/strict');
// All auth endpoints are intercepted. These fixtures never send mail or change accounts.
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [390,1280])for(const role of ['user','admin']){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});const calls=[],errors=[];let loginMode='invalid',resetMode='expired';
 const prefix=role==='admin'?'admin-':'',base='http://127.0.0.1:4180/app/account.html#';
 await context.route('**/api/**',route=>{const request=route.request(),path=new URL(request.url()).pathname;let status=200,body={};
  if(request.method()!=='GET')calls.push({path,body:request.postDataJSON()});
  if(path.endsWith('/login')){status=loginMode==='success'?200:loginMode==='verify'?403:401;body=loginMode==='success'?{token:'qa.'+Buffer.from(JSON.stringify({exp:4102444800,role})).toString('base64')+'.invalid',user:{id:'qa',email:'sample@example.test',name:'Mock account'}}:loginMode==='verify'?{code:'EMAIL_VERIFICATION_REQUIRED',message:'請先驗證 Email。'}:{message:'帳號或密碼錯誤'};}
  if(path.endsWith('/forgot-password')){status=202;body={message:'若此信箱符合帳號重設條件，我們會寄出重設連結。'};}
  if(path.endsWith('/reset-password')){status=resetMode==='expired'?400:200;body=resetMode==='expired'?{message:'重設連結無效或已過期，請重新申請。'}:{reset:true,message:'密碼已更新，請重新登入。'};}
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/app/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Mock signed-in destination</h1>'}));
 await page.goto(base+prefix+'login');await page.locator('#login-form').waitFor();
 assert.equal(await page.locator('a[href="#verification"]').count(),0);
 await page.locator('[name=email]').fill('sample@example.test');await page.locator('[name=password]').fill('test-password');await page.locator('#login-form [type=submit]').click();
 await page.getByText('帳號或密碼錯誤',{exact:true}).waitFor();assert.deepEqual(calls.map(c=>c.path),['/api/'+role+'/login']);
 if(role==='user'){loginMode='verify';await page.locator('#login-form [type=submit]').click();await page.locator('[data-login-guidance] a').waitFor();assert.equal(await page.locator('[data-login-guidance] a').getAttribute('href'),'#verification');assert(!calls.some(c=>c.path==='/api/admin/login'));}
 loginMode='success';await page.locator('#login-form [type=submit]').click();await page.waitForURL('http://127.0.0.1:4180/app/#me');assert(await page.evaluate(key=>!!sessionStorage.getItem(key),role==='admin'?'adminToken':'userToken'));assert(!calls.filter(c=>c.path.endsWith('/login')).some(c=>c.path!=='/api/'+role+'/login'));
 await page.goto(base+prefix+'forgot-password');await page.locator('#forgot-password-form').waitFor();
 assert.match(await page.locator('.recovery-help').innerText(),/未綁定信箱/);assert.equal(await page.locator('.recovery-help a').getAttribute('href'),'#contact');
 await page.locator('[name=email]').fill('unknown@example.test');await page.locator('#forgot-password-form [type=submit]').click();await page.getByRole('heading',{name:'請查看你的信箱'}).waitFor();assert.match(await page.locator('.recovery-success').innerText(),/若此信箱符合/);assert.deepEqual(calls.at(-1),{path:'/api/'+role+'/forgot-password',body:{email:'unknown@example.test'}});
 await page.goto(base+prefix+'reset-password');await page.getByText('這個重設連結無法使用。請從信件重新開啟完整連結，或重新申請。',{exact:true}).waitFor();assert.equal(await page.locator('#reset-password-form').count(),0);
 const token='a'.repeat(64),before=calls.length;
 await page.goto(base+prefix+'reset-password/'+token);await page.locator('#reset-password-form').waitFor();assert(!page.url().includes(token));assert.equal(calls.length,before);assert.equal(await page.locator('[name=password]').getAttribute('minlength'),'6');assert.equal(await page.locator('[name=password]').getAttribute('maxlength'),'128');
 await page.locator('[name=password]').fill('new-password');await page.locator('[name=confirmPassword]').fill('not-the-same');await page.locator('#reset-password-form [type=submit]').click();await page.getByText('兩次新密碼不同，請再確認。',{exact:true}).waitFor();assert.equal(calls.length,before);
 await page.locator('[name=password]').fill('密'.repeat(25));await page.locator('[name=confirmPassword]').fill('密'.repeat(25));await page.locator('#reset-password-form [type=submit]').click();await page.getByText('密碼過長，請縮短後再試（最多72個英數字元；中文或表情符號可用字數較少）。',{exact:true}).waitFor();assert.equal(calls.length,before);await page.locator('[name=password]').fill('new-password');
 await page.locator('[name=confirmPassword]').fill('new-password');await page.locator('#reset-password-form [type=submit]').click();await page.getByText('重設連結無效或已過期，請重新申請。',{exact:true}).waitFor();assert.equal(await page.locator('.auth-help a').getAttribute('href'),'#'+prefix+'forgot-password');
 await page.screenshot({path:`tmp/password-reset-${role}-${width}.png`,fullPage:true});
 await page.evaluate(()=>{sessionStorage.setItem('adminToken','old-admin-token');localStorage.setItem('colorlab:user-session:v1','old-user-session');localStorage.setItem('colorlab-app-v1:guest','retained draft');});
 resetMode='success';await page.locator('#reset-password-form [type=submit]').click();await page.getByRole('heading',{name:'密碼已更新'}).waitFor();assert.deepEqual(calls.at(-1),{path:'/api/'+role+'/reset-password',body:{token,password:'new-password'}});
 assert.equal(await page.getByRole('link',{name:'前往登入',exact:true}).getAttribute('href'),'#'+prefix+'login');assert(await page.evaluate(()=>!sessionStorage.getItem('adminToken')&&!localStorage.getItem('colorlab:user-session:v1')));assert.equal(await page.evaluate(()=>localStorage.getItem('colorlab-app-v1:guest')),'retained draft');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(`PASS ${width} ${role}: exclusive login endpoint, recovery role, generic response, missing/expired token, password match/bounds, hash scrub, explicit relogin, retained drafts`);await context.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
