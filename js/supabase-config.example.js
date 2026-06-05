// https://supabase.com/dashboard/project/hnrjxjeuxtmqdfowwkec/settings/api

window.SUPABASE_URL = "https://hnrjxjeuxtmqdfowwkec.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_YOUR_KEY";

// Cloudflare Worker для загрузки картинок в GitHub (cloudflare-worker/)
// URL появится после `wrangler deploy` (вида https://antonovka-upload.YOUR.workers.dev)
window.UPLOAD_WORKER_URL = "https://antonovka-upload.YOUR_SUBDOMAIN.workers.dev";
window.UPLOAD_WORKER_SECRET = "YOUR_WORKER_SECRET";
