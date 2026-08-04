import { createClient } from "@supabase/supabase-js";
const url = window.__SUPABASE_URL__;
const key = window.__SUPABASE_ANON_KEY__;
export const configMissing = !url || !key || url.includes("DEIN-PROJEKT") || key.includes("DEIN-ANON-KEY");
export const supabase = configMissing ? null : createClient(url, key);
// Fuer das eigene Profilfoto (wie in allen anderen Apps): oeffentlicher Bucket.
export const BUCKET = "public-media";
// Fuer Vorsorge-Dokumente: eigener, NICHT oeffentlicher Bucket - Dateien werden
// nur ueber kurzlebige signierte URLs abgerufen, nie ueber eine dauerhafte
// oeffentliche URL.
export const VORSORGE_BUCKET = "vorsorge-dokumente";
