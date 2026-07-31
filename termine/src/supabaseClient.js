import { createClient } from "@supabase/supabase-js";

const url = window.__SUPABASE_URL__;
const key = window.__SUPABASE_ANON_KEY__;

export const configMissing =
  !url || !key || url.includes("DEIN-PROJEKT") || key.includes("DEIN-ANON-KEY");

export const supabase = configMissing ? null : createClient(url, key);

export const BUCKET = "public-media";
