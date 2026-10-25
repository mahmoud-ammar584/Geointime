// Hosting-neutral request guard. Identity is verified by signed session, not user-supplied headers.
export function sameOriginWrite(request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
