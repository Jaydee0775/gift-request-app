// Set this to your deployed Google Apps Script Web App URL ending in /exec.
const API_URL = 'https://script.google.com/macros/s/AKfycbwiy0_O86pNjEawvKwbQ7CRKSI_7_SPipkIobRDwpyX2U95n-IeTyUGSYJgP7ywq6Fr/exec';
function api(action, options={}) {
  return new Promise((resolve,reject)=>{
    if(!API_URL.startsWith('https://script.google.com/')) return reject(new Error('Set API_URL in app.js to your deployed Apps Script /exec URL first.'));
    const callback='giftApiCb_'+Math.random().toString(36).slice(2);
    const params=new URLSearchParams({action,callback});
    if(options.token)params.set('token',options.token);
    if(options.adminKey)params.set('adminKey',options.adminKey);
    if(options.data)params.set('data',JSON.stringify(options.data));
    const script=document.createElement('script');let done=false;
    const timer=setTimeout(()=>finish(new Error('The server took too long to respond. Check the Apps Script deployment URL and try again.')),20000);
    function finish(err,result){if(done)return;done=true;clearTimeout(timer);delete window[callback];script.remove();if(err)reject(err);else resolve(result);}
    window[callback]=result=>finish(null,result);script.onerror=()=>finish(new Error('Could not contact the backend. Check the Apps Script URL and deployment permissions.'));
    script.src=API_URL+'?'+params.toString();document.head.appendChild(script);
  });
}
