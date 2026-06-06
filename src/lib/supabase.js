import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// #region agent log
fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'00b137'},body:JSON.stringify({sessionId:'00b137',location:'supabase.js:init',message:'Supabase client config',data:{url,urlIsDashboard:typeof url==='string'&&url.includes('supabase.com/dashboard'),urlIsProjectApi:typeof url==='string'&&/\.supabase\.co\/?$/.test(url.replace(/\/$/,'')),keyPrefix:typeof key==='string'?key.slice(0,14):null},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
// #endregion

export const supabase = createClient(url, key)
