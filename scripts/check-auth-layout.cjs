// Local-only browser contract and layout fixtures: no real account or email writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base='http://127.0.0.1:4180';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [390,1280,320]) {
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',dialog=>dialog.accept());
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base) return route.abort();
    if(url.pathname.startsWith('/app/')&&/\.(mjs|js|css)$/.test(url.pathname)) {
     const file=path.resolve('color-web',url.pathname.slice(1));
     try{return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.css')?'text/css':'text/javascript'});}catch{}
    }
    if(route.request().method()==='POST') {
     writes.push(url.pathname);
     if(url.pathname.endsWith('/login'))return route.fulfill({json:{token:'qa.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64')+'.invalid',user:{id:'444444444444444444444444',email:'qa@example.invalid',name:'測試帳號'}}});
     if(url.pathname==='/api/user/register')return route.fulfill({status:202,json:{verificationRequired:true,email:'qa@example.invalid',mailSent:true,message:'測試驗證信已排入'}});
     if(url.pathname.endsWith('/forgot-password'))return route.fulfill({json:{message:'測試已受理'}});
     if(url.pathname.endsWith('/email-verification/resend'))return route.fulfill({json:{message:'測試已受理'}});
     throw new Error('Unexpected mutation: '+url.pathname);
    }
    return route.continue();
   });
   const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const admin of [false,true]) {
    const route=admin?'admin-login':'login',role=admin?'admin':'user';
    await page.goto(`${base}/app/account.html#${route}`);
    await page.locator('#login-form').waitFor();
    assert.equal(await page.locator('.auth-role-nav [aria-current]').getAttribute('href'),'#'+route);
    assert.equal(await page.locator('.auth-panel>a').first().getAttribute('href'),'/app/#me');
    assert.equal(await page.locator('#resend-form').count(),0);
    const forgot=page.locator('.auth-password-help a');
    assert.equal(await forgot.getAttribute('href'),admin?'#admin-forgot-password':'#forgot-password');
    assert(await page.locator('#login-form').evaluate(form=>{
     const password=form.querySelector('[name=password]'),help=form.querySelector('.auth-password-help'),submit=form.querySelector('[type=submit]');
     return !!(password.compareDocumentPosition(help)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(help.compareDocumentPosition(submit)&Node.DOCUMENT_POSITION_FOLLOWING);
    }));
    for(const control of await page.locator('.auth-panel a,.auth-panel button').all()) {
     const box=await control.boundingBox();assert(box&&box.height>=43.99,`auth control ${await control.textContent()} has a 44px height: ${JSON.stringify(box)}`);
    }
    assert.equal(await page.locator('.auth-register').count(),admin?0:1);
    await noOverflow();await page.screenshot({path:`tmp/auth-${width}-${role}.png`,fullPage:true});
    await forgot.click();await page.locator('#forgot-password-form').waitFor();
    await page.locator('[name=email]').fill('qa@example.invalid');await page.locator('[type=submit]').click();
    await page.locator('.recovery-success').waitFor();assert.equal(writes.at(-1),`/api/${role}/forgot-password`);
    await page.goto(`${base}/app/account.html#${route}`);await page.locator('#login-form').waitFor();
    await page.locator('[name=email]').fill('qa@example.invalid');await page.locator('[name=password]').fill('fixture-password');
    const before=writes.length;await page.locator('#login-form [type=submit]').click();
    await page.waitForURL(`${base}/app/#me`);assert.deepEqual(writes.slice(before),[`/api/${role}/login`]);
    await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
   }
   await page.goto(`${base}/app/account.html#register`);await page.locator('#register-form').waitFor();
   assert.equal(await page.getByRole('button',{name:'重發驗證信'}).count(),0);
   for(const name of ['name','gender','birthDate','email','password','confirmPassword','consent'])assert(await page.locator(`[name=${name}]`).evaluate(e=>e.required),name+' required');
   assert.equal(await page.locator('[name=phone]').evaluate(e=>e.required),false);
   assert.equal(await page.locator('[name=gender]').inputValue(),'');
   await noOverflow();await page.screenshot({path:`tmp/auth-${width}-register.png`,fullPage:true});
   await page.locator('[name=name]').fill('註冊測試');await page.locator('[name=gender]').selectOption('unknown');
   await page.locator('[name=birthDate]').fill('2000-01-01');await page.locator('[name=email]').fill('qa@example.invalid');
   for(const name of ['password','confirmPassword'])await page.locator(`[name=${name}]`).fill('fixture-password');
   await page.locator('[name=consent]').check();await page.locator('#register-form [type=submit]').click();
   await page.waitForURL(/#verification$/);await page.getByRole('button',{name:'重發驗證信',exact:true}).waitFor();
   assert.equal(await page.locator('#resend-form [name=email]').inputValue(),'qa@example.invalid');
   await noOverflow();assert.deepEqual(errors,[]);await page.close();
   console.log(`PASS ${width}: isolated login/recovery endpoints, account return, auth hierarchy/44px, required fields, post-registration verification, no overflow or real writes`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
