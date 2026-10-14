/** Gift Request App V1 — Google Apps Script backend.
 * Spreadsheet tabs are created by setup(). Set ADMIN_KEY in Script Properties before deployment.
 * API uses JSONP for GitHub Pages compatibility. See README for security notes.
 */
const APP = { ACCOUNTS: 'Accounts', GIFTS: 'Gifts', VERSION: '1.0.0' };
const ACCOUNT_HEADERS = ['accountId','name','tokenHash','status','createdAt'];
const GIFT_HEADERS = ['giftId','accountId','name','productLink','notes','priority','price','createdAt','updatedAt'];

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_KEY')) throw new Error('First set Script Property ADMIN_KEY to a long random secret.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open Apps Script from the target Google Sheet (Extensions → Apps Script).');
  ensureSheet_(ss, APP.ACCOUNTS, ACCOUNT_HEADERS);
  ensureSheet_(ss, APP.GIFTS, GIFT_HEADERS);
  return 'Setup complete. Accounts and Gifts sheets are ready.';
}
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1); sh.getRange(1,1,1,headers.length).setFontWeight('bold');
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = String(p.callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$\.]{0,80}$/.test(callback)) return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  let result;
  try { result = route_(p); }
  catch (err) { result = { ok:false, error: safeMessage_(err) }; }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function route_(p) {
  const action = String(p.action || '');
  const data = p.data ? JSON.parse(p.data) : {};
  if (action === 'userGet' || action === 'giftAdd' || action === 'giftUpdate' || action === 'giftDelete') {
    const account = findAccountByToken_(String(p.token || ''));
    if (!account || account.status !== 'active') throw new Error('This link is invalid or has been deactivated.');
    if (action === 'userGet') return {ok:true, account:{name:account.name}, gifts:listGifts_(account.accountId)};
    if (action === 'giftAdd') return addGift_(account.accountId, data);
    if (action === 'giftUpdate') return updateGift_(account.accountId, data);
    if (action === 'giftDelete') return deleteGift_(account.accountId, String(data.giftId || ''));
  }
  if (action.startsWith('admin')) requireAdmin_(String(p.adminKey || ''));
  if (action === 'adminList') return {ok:true, accounts:listAccounts_()};
  if (action === 'adminCreate') return createAccount_(String(data.name || '').trim());
  if (action === 'adminToggle') return toggleAccount_(String(data.accountId || ''), Boolean(data.active));
  if (action === 'adminDelete') return deleteAccount_(String(data.accountId || ''));
  if (action === 'adminGifts') {
    const accountId = String(data.accountId || ''); const account = findAccountById_(accountId);
    if (!account) throw new Error('Account not found.');
    return {ok:true, account:{accountId:account.accountId,name:account.name,status:account.status,createdAt:account.createdAt}, gifts:listGifts_(accountId)};
  }
  if (action === 'health') return {ok:true, version:APP.VERSION};
  throw new Error('Unknown action.');
}
function requireAdmin_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expected || !constantTimeEquals_(key, expected)) throw new Error('Admin access denied.');
}
function constantTimeEquals_(a,b) { if (a.length !== b.length) return false; let n=0; for(let i=0;i<a.length;i++) n |= a.charCodeAt(i)^b.charCodeAt(i); return n===0; }
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) { const s=ss_().getSheetByName(name); if(!s) throw new Error('Missing sheet. Run setup() first.'); return s; }
function rows_(name) { const s=sheet_(name), v=s.getDataRange().getValues(); return v.slice(1).map((r,i)=>({row:i+2,values:r})).filter(x=>x.values.some(v=>v!=='')); }
function findAccountById_(id) { return rows_(APP.ACCOUNTS).map(x=>accountObj_(x.values,x.row)).find(a=>a.accountId===id)||null; }
function findAccountByToken_(token) { if(!token) return null; const hash=sha256_(token); return rows_(APP.ACCOUNTS).map(x=>accountObj_(x.values,x.row)).find(a=>a.tokenHash===hash)||null; }
function accountObj_(r,row) { return {row,accountId:String(r[0]),name:String(r[1]),tokenHash:String(r[2]),status:String(r[3]),createdAt:String(r[4])}; }
function listAccounts_() { return rows_(APP.ACCOUNTS).map(x=>{const a=accountObj_(x.values,x.row);return {accountId:a.accountId,name:a.name,status:a.status,createdAt:a.createdAt,giftCount:rows_(APP.GIFTS).filter(g=>String(g.values[1])===a.accountId).length};}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); }
function createAccount_(name) {
  if(!name || name.length>100) throw new Error('Enter a name (up to 100 characters).');
  const id=Utilities.getUuid(), token=randomToken_(), now=new Date().toISOString();
  sheet_(APP.ACCOUNTS).appendRow([id,name,sha256_(token),'active',now]);
  return {ok:true,account:{accountId:id,name,status:'active',createdAt:now},token:token};
}
function toggleAccount_(id,active) { const a=findAccountById_(id); if(!a) throw new Error('Account not found.'); sheet_(APP.ACCOUNTS).getRange(a.row,4).setValue(active?'active':'inactive'); return {ok:true,status:active?'active':'inactive'}; }
function deleteAccount_(id) {
  const a=findAccountById_(id); if(!a) throw new Error('Account not found.');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try { const gifts=rows_(APP.GIFTS).filter(g=>String(g.values[1])===id).map(g=>g.row).sort((x,y)=>y-x); gifts.forEach(r=>sheet_(APP.GIFTS).deleteRow(r)); sheet_(APP.ACCOUNTS).deleteRow(a.row); }
  finally { lock.releaseLock(); }
  return {ok:true};
}
function listGifts_(accountId) { return rows_(APP.GIFTS).filter(x=>String(x.values[1])===accountId).map(x=>giftObj_(x.values)); }
function giftObj_(r) { return {giftId:String(r[0]),name:String(r[2]),productLink:String(r[3]),notes:String(r[4]),priority:String(r[5]),price:String(r[6]),createdAt:String(r[7]),updatedAt:String(r[8])}; }
function cleanGift_(d) {
  const name=String(d.name||'').trim(), link=String(d.productLink||'').trim(), notes=String(d.notes||'').trim(), priority=String(d.priority||'Normal'), price=String(d.price||'').trim();
  if(!name || name.length>200) throw new Error('Gift name is required (max 200 characters).');
  if(link && !/^https?:\/\//i.test(link)) throw new Error('Product link must start with http:// or https://.');
  if(notes.length>2000) throw new Error('Notes must be 2,000 characters or fewer.');
  if(!['Low','Normal','High','Top'].includes(priority)) throw new Error('Choose a valid priority.');
  if(price && (price.length>30 || !/^[£$€]?\s*\d{1,7}(?:[.,]\d{1,2})?$/.test(price))) throw new Error('Enter a simple price, such as £15 or 12.50.');
  return {name,productLink:link,notes,priority,price};
}
function addGift_(accountId,d) { const g=cleanGift_(d), id=Utilities.getUuid(), now=new Date().toISOString(); sheet_(APP.GIFTS).appendRow([id,accountId,g.name,g.productLink,g.notes,g.priority,g.price,now,now]); return {ok:true,gift:{giftId:id,...g,createdAt:now,updatedAt:now}}; }
function updateGift_(accountId,d) {
  const id=String(d.giftId||''); const found=rows_(APP.GIFTS).find(x=>String(x.values[0])===id && String(x.values[1])===accountId); if(!found) throw new Error('Gift not found.');
  const g=cleanGift_(d), now=new Date().toISOString(); sheet_(APP.GIFTS).getRange(found.row,3,1,7).setValues([[g.name,g.productLink,g.notes,g.priority,g.price,String(found.values[7]),now]]);
  return {ok:true,gift:{giftId:id,...g,createdAt:String(found.values[7]),updatedAt:now}};
}
function deleteGift_(accountId,id) { const found=rows_(APP.GIFTS).find(x=>String(x.values[0])===id && String(x.values[1])===accountId); if(!found) throw new Error('Gift not found.'); sheet_(APP.GIFTS).deleteRow(found.row); return {ok:true}; }
function randomToken_() { return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''); }
function sha256_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(b=>(b+256).toString(16).slice(-2)).join(''); }
function safeMessage_(err) { const s=(err && err.message)?err.message:'Something went wrong.'; return s.slice(0,240); }
