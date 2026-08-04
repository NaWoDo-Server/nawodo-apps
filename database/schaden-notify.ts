// NaWoDo Schadenmelder – E-Mail bei neuer Schadensmeldung.
// Wird von der App aufgerufen, sobald ein neues Ticket angelegt wurde, und schickt
// EINE Info-Mail an das Schadensmeldungs-Postfach (schadensmeldung@nawodo.de).
//
// POST { ticket_id }  (mit Access-Token des aufrufenden Nutzers im Authorization-Header)
//
// SMTP-Zugangsdaten kommen aus eigenen Env-Variablen (NICHT die Fake-Auth-SMTP_* von
// GoTrue), damit hier ein echtes Postfach hinterlegt werden kann, ohne den Login-Mailweg
// zu beruehren. Sind sie nicht gesetzt, wird die Mail sauber uebersprungen (kein Fehler),
// damit das Anlegen eines Schadens nie an der Mail scheitert.
//
//   SCHADEN_SMTP_HOST     z.B. mail.euer-provider.de
//   SCHADEN_SMTP_PORT     587 (STARTTLS) oder 465 (TLS)
//   SCHADEN_SMTP_USER     Postfach-Benutzer
//   SCHADEN_SMTP_PASS     Postfach-Passwort
//   SCHADEN_SMTP_FROM     Absenderadresse (z.B. schadensmeldung@nawodo.de)
//   SCHADEN_NOTIFY_TO     Empfaenger (Standard: schadensmeldung@nawodo.de)
//   APP_BASE_URL          Standard: https://app.nawodo.de

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
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // --- Aufrufer verifizieren (nur echte, eingeloggte Sitzungen) ---
  const authHeader = req.headers.get("Authorization") || "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken) return jsonResponse({ error: "Nicht angemeldet." }, 401);
  const meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${callerToken}` },
  }).catch(() => null);
  if (!meResp || !meResp.ok) return jsonResponse({ error: "Anmeldung ungültig." }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "Ungültige Anfrage." }, 400); }
  const ticketId = body.ticket_id;
  if (!ticketId) return jsonResponse({ error: "Keine ticket_id angegeben." }, 400);

  // --- SMTP konfiguriert? Wenn nicht: sauber ueberspringen (kein Fehler). ---
  const host = Deno.env.get("SCHADEN_SMTP_HOST");
  const port = parseInt(Deno.env.get("SCHADEN_SMTP_PORT") || "587", 10);
  const smtpUser = Deno.env.get("SCHADEN_SMTP_USER");
  const smtpPass = Deno.env.get("SCHADEN_SMTP_PASS");
  const from = Deno.env.get("SCHADEN_SMTP_FROM") || smtpUser || "";
  const to = Deno.env.get("SCHADEN_NOTIFY_TO") || "schadensmeldung@nawodo.de";
  const appBase = Deno.env.get("APP_BASE_URL") || "https://app.nawodo.de";

  if (!host || !smtpUser || !smtpPass || !from) {
    return jsonResponse({ ok: false, skipped: true, reason: "SMTP nicht konfiguriert" }, 200);
  }

  // --- Ticket laden (Service-Role, damit unabhaengig von RLS die Felder da sind) ---
  const restHeaders = {
    apikey: SERVICE_ROLE_KEY ?? "",
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
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
    `Titel:      ${t.title || "-"}`,
    `Kategorie:  ${t.category || "-"}`,
    `Ort:        ${t.location || "-"}`,
    `Status:     ${STATUS_LABEL[t.status] || t.status || "-"}`,
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
        hostname: host,
        port,
        tls: port === 465,
        auth: { username: smtpUser, password: smtpPass },
      },
    });
    await client.send({
      from,
      to,
      subject: `Neuer Schaden: ${t.title || "Meldung"}`,
      content: text,
    });
    await client.close();
    return jsonResponse({ ok: true, sent: true }, 200);
  } catch (e) {
    // Mail-Fehler nicht als harter Fehler zurueckgeben – das Ticket existiert bereits.
    console.error("schaden-notify: send failed", String(e));
    return jsonResponse({ ok: false, sent: false, error: String(e) }, 200);
  }
});
