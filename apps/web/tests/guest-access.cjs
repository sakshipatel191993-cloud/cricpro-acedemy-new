const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path,mocks) { const exports={}; new Function('exports','require',ts.transpile(fs.readFileSync(path,'utf8'),{module:ts.ModuleKind.CommonJS}))(exports,name=>name in mocks?mocks[name]:require(name));return exports; }
(async()=> {
 let owner=null, session=null;
 const scopes={ booking_id:'first-booking',id:'first-scope',owner_id:'alice',access_version:1 };
 const db={ rpc:async()=>({data:session?[session]:[],error:null}),from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:scopes,error:null})}) };
 const access=load('apps/web/lib/security/guest-access.ts',{'@/lib/services/supabase':{supabaseAdmin:db},'@/lib/security/customer-auth':{getVerifiedCustomerId:async()=>owner}});
 const token=access.newAccessToken();
 assert.equal(Buffer.from(token,'base64url').length,32);assert(access.validAccessToken(token));
 assert.notEqual(access.hashAccessToken(token),token);assert.equal(access.hashAccessToken(token).length,64);
 const request=new Request('https://example.test/api/private-booking',{headers:{cookie:`${access.guestCookieName}=${token}`}});
 assert.equal(access.guestSameOrigin(request),false);
 assert.equal(access.guestSameOrigin(new Request(request,{headers:{origin:'https://attacker.invalid'}})),false);
 assert.equal(access.guestSameOrigin(new Request(request,{headers:{origin:'https://example.test'}})),true);
 assert.equal(await access.accessibleScope(request,'resource','first-booking'),null);
 owner='bob';assert.equal(await access.accessibleScope(request,'resource','first-booking'),null,'other account cannot read');
 owner='alice';assert.equal((await access.accessibleScope(request,'resource','first-booking')).id,'first-scope');
 owner=null;session={scope_id:'other-scope',access_version:1};assert.equal(await access.accessibleScope(request,'resource','first-booking'),null,'other guest scope cannot read');
 session={scope_id:'first-scope',access_version:0};assert.equal(await access.accessibleScope(request,'resource','first-booking'),null,'revoked version cannot read');
 session={scope_id:'first-scope',access_version:1};assert.equal((await access.accessibleScope(request,'resource','first-booking')).id,'first-scope');
 assert.equal(access.guestCookie(token).options.httpOnly,true);
 assert.equal(access.guestCookie(token).options.sameSite,'lax');
 console.log('PASS guest random 256-bit tokens/hash, origin guards, cross-account/guest isolation, revocation version and cookie protections');
})().catch(error=>{console.error(error);process.exitCode=1});
