// NaWoDo – taegliche Erinnerungs-Mails (ein Aufruf pro Tag per Cron).
//   1) Vorsorge: Dokumente mit aktivierter Erinnerung, die >= 6 Monate alt sind
//      (bzw. deren letzte Erinnerung >= 6 Monate her ist) -> Mail an den Eigentuemer.
//   2) Workshop: Workshops MORGEN -> Mail an alle, die "E-Mail-Erinnerung 1 Tag vorher"
//      angekreuzt haben. Inhalt = Datum, Moderator/in, Themen, Agenda (OHNE Essensabfrage
//      und OHNE "wer kommt").
//
// SMTP-Zugangsdaten kommen aus der DB-Tabelle mail_settings (Settings -> E-Mail).
// Ist der Versand dort nicht aktiviert/konfiguriert, wird sauber uebersprungen.
//
// Schutz: Aufruf nur mit dem Service-Role-Key im Authorization-Header
// (der taegliche Cron liest ihn aus /root/supabase/docker/.env). Kein eigenes Geheimnis noetig.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
function fmtDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d}. ${MONTHS[m - 1]} ${y}`;
}

Deno.serve(async (req) => {
  const json = (obj: unknown, status: number) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appBase = Deno.env.get("APP_BASE_URL") || "https://app.nawodo.de";

  // --- Zugriffsschutz: nur mit dem Service-Role-Key ---
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE_KEY || bearer !== SERVICE_ROLE_KEY) return json({ error: "forbidden" }, 403);

  const restHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // --- Mail-Konfiguration aus der DB ---
  const mResp = await fetch(`${SUPABASE_URL}/rest/v1/mail_settings?id=eq.1&select=*`, { headers: restHeaders });
  const mRows = await mResp.json().catch(() => []);
  const cfg = Array.isArray(mRows) ? mRows[0] : null;
  if (!cfg || !cfg.enabled || !cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass || !cfg.smtp_from) {
    return json({ ok: false, skipped: true, reason: "Mailversand nicht aktiviert/konfiguriert" }, 200);
  }
  const port = parseInt(String(cfg.smtp_port || "465"), 10);

  async function sendMail(to: string, subject: string, text: string) {
    const client = new SMTPClient({
      connection: { hostname: cfg.smtp_host, port, tls: port === 465, auth: { username: cfg.smtp_user, password: cfg.smtp_pass } },
    });
    await client.send({ from: cfg.smtp_from, to, subject, content: text });
    await client.close();
  }

  const emailCache = new Map<string, string | null>();
  async function emailFor(userId: string): Promise<string | null> {
    if (emailCache.has(userId)) return emailCache.get(userId)!;
    let email: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      });
      if (r.ok) { const u = await r.json(); email = u?.email || null; }
    } catch (_e) { /* ignore */ }
    emailCache.set(userId, email);
    return email;
  }

  const result = { vorsorge_sent: 0, workshop_sent: 0, errors: [] as string[] };

  // 1) VORSORGE (nur wenn im Settings-Reiter freigegeben)
  if (cfg.notify_vorsorge_enabled) try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffIso = cutoff.toISOString();

    const dResp = await fetch(
      `${SUPABASE_URL}/rest/v1/vorsorge_documents?reminder_enabled=eq.true&select=id,title,category,created_at,last_reminded_at,owner_user_id`,
      { headers: restHeaders },
    );
    const docs = (await dResp.json().catch(() => [])) as any[];
    for (const doc of Array.isArray(docs) ? docs : []) {
      const baseline = doc.last_reminded_at || doc.created_at;
      if (!baseline || baseline > cutoffIso) continue;
      const email = await emailFor(doc.owner_user_id);
      if (!email) continue;
      const text = [
        `Hallo,`, ``,
        `dein Vorsorge-Dokument ist inzwischen mindestens ein halbes Jahr alt.`,
        `Bitte pruefe, ob es noch aktuell ist, und aktualisiere es bei Bedarf.`, ``,
        `Dokument:  ${doc.title || "-"}`,
        `Kategorie: ${doc.category || "-"}`, ``,
        `Zu deinen Vorsorge-Dokumenten: ${appBase}/vorsorge/`,
      ].join("\n");
      try {
        await sendMail(email, "Vorsorge: Dokument pruefen/aktualisieren", text);
        await fetch(`${SUPABASE_URL}/rest/v1/vorsorge_documents?id=eq.${doc.id}`, {
          method: "PATCH", headers: restHeaders,
          body: JSON.stringify({ last_reminded_at: new Date().toISOString() }),
        });
        result.vorsorge_sent++;
      } catch (e) { result.errors.push(`vorsorge ${doc.id}: ${String(e)}`); }
    }
  } catch (e) { result.errors.push(`vorsorge: ${String(e)}`); }

  // 2) WORKSHOP / STEUERUNGSKREIS (morgen) -- nur wenn im Settings-Reiter freigegeben
  if (cfg.notify_grossgruppe_enabled) try {
    const tomorrowStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" })
      .format(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const wResp = await fetch(
      `${SUPABASE_URL}/rest/v1/workshops?date=eq.${tomorrowStr}&select=id,date,moderator_name,themen,themen_info,agenda`,
      { headers: restHeaders },
    );
    const workshops = (await wResp.json().catch(() => [])) as any[];
    for (const w of Array.isArray(workshops) ? workshops : []) {
      const rResp = await fetch(
        `${SUPABASE_URL}/rest/v1/workshop_reminders?workshop_id=eq.${w.id}&reminded_at=is.null&select=id,user_id`,
        { headers: restHeaders },
      );
      const rows = (await rResp.json().catch(() => [])) as any[];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const titles = (w.themen || "").split("\n").map((s: string) => s.trim()).filter(Boolean);
      const infos = (w.themen_info || "").split("\n").map((s: string) => s.trim());
      const themenLines = titles.length
        ? titles.map((t: string, i: number) => `  - ${t}${infos[i] ? ` (${infos[i]})` : ""}`).join("\n")
        : "  (keine)";
      const text = [
        `Hallo,`, ``,
        `morgen findet ein Workshop statt, fuer den du eine Erinnerung aktiviert hast.`, ``,
        `Datum:        ${fmtDateLong(w.date)}`,
        `Moderator/in: ${w.moderator_name || "-"}`, ``,
        `Themen:`, themenLines, ``,
        `Agenda:`, `${w.agenda || "(keine)"}`, ``,
        `Zum Workshop: ${appBase}/workshop/`,
      ].join("\n");

      for (const row of rows) {
        const email = await emailFor(row.user_id);
        if (!email) continue;
        try {
          await sendMail(email, `Erinnerung: Workshop morgen (${fmtDateLong(w.date)})`, text);
          await fetch(`${SUPABASE_URL}/rest/v1/workshop_reminders?id=eq.${row.id}`, {
            method: "PATCH", headers: restHeaders,
            body: JSON.stringify({ reminded_at: new Date().toISOString() }),
          });
          result.workshop_sent++;
        } catch (e) { result.errors.push(`workshop ${row.id}: ${String(e)}`); }
      }
    }
  } catch (e) { result.errors.push(`workshop: ${String(e)}`); }

  return json({ ok: true, ...result }, 200);
});
