// https://supabase.com/dashboard/project/hnrjxjeuxtmqdfowwkec/settings/api
// На сайте только publishable (или anon). secret key — никогда в браузере.

window.SUPABASE_URL = "https://hnrjxjeuxtmqdfowwkec.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_BpaLK6MMXKdHjEbwDq04uA_2dmmU0Vz";

// Cloudflare Worker — загрузка картинок в GitHub (вместо Supabase Storage)
window.UPLOAD_WORKER_URL = "https://antonovka-upload.osamdesign.workers.dev";
window.UPLOAD_WORKER_SECRET = "cf-antonovka-upload-d7f3a9b2c4e8f1a6";
