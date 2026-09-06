const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),calls=[],errors=[];
  let changed=false;const user={id:'fixture',email:'fixture@example.invalid',name:'Fixture',department:'Testing'};
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid');localStorage.setItem('colorlab-app-v1:guest','retained fixture');}});
  await page.route('**/api/**',route=>{
    const request=route.request();let body={user};
    if(request.method()!=='GET'){assert(new URL(request.url()).pathname.endsWith('/admin/update-profile'));const payload=request.postDataJSON();calls.push(payload);body={user,passwordChanged:changed};}
    return route.fulfill({json:body});
  });
  await page.goto('http://127.0.0.1:4180/app/account.html#admin-profile');await page.locator('#profile-form').waitFor();
  await page.locator('#profile-form [type=submit]').click();await page.getByText('資料已儲存。',{exact:true}).waitFor();
  assert.equal(calls.length,1);assert.equal(calls[0].password,'');assert(await page.evaluate(()=>!!sessionStorage.getItem('adminToken')));
  await page.getByText('修改管理員密碼',{exact:true}).click();
  await page.locator('[name=password]').fill('new-fixture-password');await page.locator('[name=confirmPassword]').fill('new-fixture-password');
  await page.locator('#profile-form [type=submit]').click();await page.getByText('修改密碼時請輸入目前密碼。',{exact:true}).waitFor();assert.equal(calls.length,1);
  await page.locator('[name=currentPassword]').fill('old-fixture-password');changed=true;
  await page.locator('#profile-form [type=submit]').click();await page.waitForURL('**/account.html#admin-login');await page.locator('#login-form').waitFor();
  assert.equal(calls.length,2);assert.equal(calls[1].currentPassword,'old-fixture-password');
  assert(await page.evaluate(()=>!sessionStorage.getItem('adminToken')&&!localStorage.getItem('adminToken')));
  assert.equal(await page.evaluate(()=>localStorage.getItem('colorlab-app-v1:guest')),'retained fixture');
  assert.deepEqual(errors,[]);console.log('PASS',width,'ordinary profile keeps login, missing current password blocked, password change clears session and preserves drafts');await page.close();
}}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
