// Exact origins only; repository transfers may temporarily serve both Pages hosts.
export function allowedAppOrigin(origin,env){
 return typeof origin==='string'&&[env.ALLOWED_ORIGIN,...String(env.ADDITIONAL_ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean)].includes(origin);
}
