interface Context {request:Request;env:{UPIC_API:{fetch(request:Request):Promise<Response>}}}
// Same-origin proxy keeps wallet sessions first-party, including WebSocket upgrades.
export async function onRequest(context:Context){const url=new URL(context.request.url);url.pathname=url.pathname.replace(/^\/api/,'')||'/';return context.env.UPIC_API.fetch(new Request(url,context.request));}
