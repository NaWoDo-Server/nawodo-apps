// NaWoDo Schadenmelder – E-Mail bei neuer Schadensmeldung.
// Wird von der App aufgerufen, sobald ein neues Ticket angelegt wurde, und schickt
// EINE Info-Mail an das Schadensmeldungs-Postfach.
//
// POST { ticket_id }  (mit Access-Token des aufrufenden Nutzers im Authorization-Header)
//
// Die SMTP-Zugangsdaten und das Ziel-Postfach kommen jetzt aus der Datenbank-Tabelle
// mail_settings (pflegbar ueber Settings -> E-Mail bzw. im Schadenmelder). Ist der
// Versand dort nicht aktiviert/konfiguriert, wird die Mail sauber uebersprungen
// (kein Fehler), damit das Anlegen eines Schadens nie an der Mail scheitert.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const STATUS_LABEL: Record<string, string> = {
  gemeldet: "Gemeldet",
  begutachtung: "In Begutachtung",
  freigegeben: "Zur Behebung freigegeben",
  behebung: "In Behebung",
  erledigt: "Erledigt",
  abgelehnt: "Abgelehnt / kein Schaden",
};

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  function jsonResponse(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") return jsonResponse({ error: "Methode nicht erlaubt." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appBase = Deno.env.get("APP_BASE_URL") || "https://app.nawodo.de";

  // --- Aufrufer verifizieren (nur echte, eingeloggte Sitzungen) ---
  const authHeader = req.headers.get("Authorization") || "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken) return jsonResponse({ error: "Nicht angemeldet." }, 401);
  const meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${callerToken}` },
  }).catch(() => null);
  if (!meResp || !meResp.ok) return jsonResponse({ error: "Anmeldung ungültig." }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "Ungültige Anfrage." }, 400); }
  const ticketId = body.ticket_id;
  if (!ticketId) return jsonResponse({ error: "Keine ticket_id angegeben." }, 400);

  const restHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // --- Mail-Konfiguration aus der DB (Service-Role, umgeht RLS) ---
  const mResp = await fetch(`${SUPABASE_URL}/rest/v1/mail_settings?id=eq.1&select=*`, { headers: restHeaders });
  const mRows = await mResp.json().catch(() => []);
  const cfg = Array.isArray(mRows) ? mRows[0] : null;
  if (!cfg || !cfg.enabled || !cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass || !cfg.smtp_from) {
    return jsonResponse({ ok: false, skipped: true, reason: "Mailversand nicht aktiviert/konfiguriert" }, 200);
  }
  const port = parseInt(String(cfg.smtp_port || "465"), 10);
  const to = cfg.schaden_notify_to || "schadensmeldung@nawodo.de";

  // --- Ticket laden ---
  const tResp = await fetch(
    `${SUPABASE_URL}/rest/v1/schaden_tickets?id=eq.${ticketId}&select=*`,
    { headers: restHeaders },
  );
  const rows = await tResp.json().catch(() => []);
  const t = Array.isArray(rows) ? rows[0] : null;
  if (!t) return jsonResponse({ error: "Ticket nicht gefunden." }, 404);

  const lines = [
    `Es wurde ein neuer Schaden im NaWoDo-Schadenmelder gemeldet.`,
    ``,
    `Titel:        ${t.title || "-"}`,
    `Kategorie:    ${t.category || "-"}`,
    `Ort:          ${t.location || "-"}`,
    `Status:       ${STATUS_LABEL[t.status] || t.status || "-"}`,
    `Gemeldet von: ${t.created_by_name || "-"}`,
    ``,
    `Beschreibung:`,
    `${t.description || "(keine)"}`,
    ``,
    `Zur Meldung: ${appBase}/schadenmelder/`,
  ];
  const text = lines.join("\n");

  try {
    const client = new SMTPClient({
      connection: {
        hostname: cfg.smtp_host,
        port,
        tls: port === 465,
        auth: { username: cfg.smtp_user, password: cfg.smtp_pass },
      },
    });
    await client.send({
      from: cfg.smtp_from,
      to,
      subject: `Neuer Schaden: ${t.title || "Meldung"}`,
      content: text,
    });
    await client.close();
    return jsonResponse({ ok: true, sent: true }, 200);
  } catch (e) {
    console.error("schaden-notify: send failed", String(e));
    return jsonResponse({ ok: false, sent: false, error: String(e) }, 200);
  }
});
