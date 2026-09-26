import { scopes } from "./core"

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)

export const consentPage = (options: { id: string; csrf: string; name: string; user: string; redirect: string; scope: string }) => new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connect to Pupler</title>
<style>body{font:16px "Segoe UI",sans-serif;margin:0;min-height:100vh;background:radial-gradient(circle at top left,#ffdfb0,transparent 40%),#f7f3ea;color:#2f241b}main{box-sizing:border-box;max-width:540px;margin:8vh auto;padding:28px;background:#fffcf6;border:1px solid #dfd8ce;border-radius:24px;box-shadow:0 24px 60px #462a1724}h1{font-size:26px;margin-top:0}p{line-height:1.5;color:#7a6654}label{display:flex;gap:12px;align-items:start;padding:12px 0}input{margin-top:4px;accent-color:#ba5a31}button{font:inherit;font-weight:600;padding:12px 20px;border-radius:24px;border:0;background:#e2ece6;color:#2d7c6f;cursor:pointer}button[value=allow]{background:#ba5a31;color:white}footer{display:flex;gap:12px;margin-top:24px}.callback{overflow-wrap:anywhere;font-size:13px}@media(max-width:600px){main{margin:20px 12px;padding:22px}}</style></head>
<body><main><h1>Connect to Pupler</h1><p><strong>${escape(options.name)}</strong> is requesting access as <strong>${escape(options.user)}</strong>.</p>
<p>Receipts and products are shared with other users of this Pupler instance. Choose what this app can do.</p>
<form method="post" action="/oauth/authorize"><input type="hidden" name="request" value="${escape(options.id)}"><input type="hidden" name="csrf" value="${escape(options.csrf)}">
${options.scope.split(" ").map(scope => `<label><input type="checkbox" name="scope" value="${scope}" checked><span>${escape(scopes[scope as keyof typeof scopes])}</span></label>`).join("")}
<p class="callback">App callback: ${escape(options.redirect)}</p><footer><button name="decision" value="allow">Allow access</button><button name="decision" value="deny">Cancel</button></footer></form></main></body></html>`, {
	headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY", "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(options.redirect).origin}; frame-ancestors 'none'; base-uri 'none'` },
})
