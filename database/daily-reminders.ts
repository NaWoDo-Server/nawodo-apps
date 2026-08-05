// NaWoDo – taegliche Erinnerungs-Mails (ein Aufruf pro Tag per Cron).
// Neues Modell (Etappe 3): Erinnerungen sind PERSOENLICHE Abos (Settings -> Mein Bereich),
// zusaetzlich global freigegeben ueber die Hauptschalter des Superadmins (mail_settings).
// Erst wenn BEIDES an ist, wird gesendet.
//
//   1) Grossgruppe (Workshop/Steuerungskreis): Treffen MORGEN -> an alle, die
//      "vor Workshop/Steuerungskreis erinnern" abonniert haben.
//   2) Vorsorge:   nur am 1.1. und 1.7. -> an alle mit Vorsorge-Abo (dokumentunabhaengig).
//   3) Notfallpass: nur am 1.1. und 1.7. -> an alle mit Notfallpass-Abo.
//
// Doppel-Versand wird ueber die Tabelle reminder_sends verhindert.
// SMTP-Zugangsdaten kommen aus mail_settings. Ist der Versand nicht aktiviert/konfiguriert,
// wird sauber uebersprungen.
//
// Schutz: Aufruf nur mit dem Service-Role-Key im Authorization-Header.

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

  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE_KEY || bearer !== SERVICE_ROLE_KEY) return json({ error: "forbidden" }, 403);

  const restHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

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

  const berlinDate = (ms: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(ms));
  const todayStr = berlinDate(Date.now());
  const tomorrowStr = berlinDate(Date.now() + 24 * 60 * 60 * 1000);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const isReminderDay = (tm === 1 && td === 1) || (tm === 7 && td === 1); // 1.1. und 1.7.
  const halfYearTag = `${ty}-H${tm <= 6 ? 1 : 2}`;

  const result = { grossgruppe_sent: 0, vorsorge_sent: 0, notfallpass_sent: 0, errors: [] as string[] };

  // Verhindert Doppel-Versand am selben Tag (kind+ref+user).
  async function sendOnce(kind: string, ref: string, userId: string, subject: string, text: string): Promise<boolean> {
    const email = await emailFor(userId);
    if (!email) return false;
    try {
      const chk = await fetch(
        `${SUPABASE_URL}/rest/v1/reminder_sends?kind=eq.${encodeURIComponent(kind)}&ref=eq.${encodeURIComponent(ref)}&user_id=eq.${userId}&sent_date=eq.${todayStr}&select=id`,
        { headers: restHeaders },
      );
      const ex = await chk.json().catch(() => []);
      if (Array.isArray(ex) && ex.length) return false;
      await sendMail(email, subject, text);
      await fetch(`${SUPABASE_URL}/rest/v1/reminder_sends`, {
        method: "POST", headers: restHeaders,
        body: JSON.stringify({ kind, ref, user_id: userId, sent_date: todayStr }),
      });
      return true;
    } catch (e) {
      result.errors.push(`${kind} ${userId}: ${String(e)}`);
      return false;
    }
  }

  async function optedInUsers(col: string): Promise<string[]> {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/user_hub_prefs?${col}=eq.true&select=user_id`, { headers: restHeaders });
      const rows = (await r.json().catch(() => [])) as any[];
      return Array.isArray(rows) ? rows.map((x) => x.user_id).filter(Boolean) : [];
    } catch (_e) { return []; }
  }

  // 1) GROSSGRUPPE (Workshop/Steuerungskreis) – Treffen morgen
  if (cfg.notify_grossgruppe_enabled) try {
    const wResp = await fetch(
      `${SUPABASE_URL}/rest/v1/workshops?date=eq.${tomorrowStr}&select=id,date,moderator_name,themen,themen_info,agenda,meeting_type,mode,zoom_link`,
      { headers: restHeaders },
    );
    const workshops = (await wResp.json().catch(() => [])) as any[];
    if (Array.isArray(workshops) && workshops.length) {
      const users = await optedInUsers("notify_grossgruppe");
      for (const w of workshops) {
        const isSK = w.meeting_type === "steuerungskreis";
        const typeName = isSK ? "Steuerungskreis" : "Workshop";
        const zeit = isSK ? "20:00–22:00 Uhr" : "10:00–16:00 Uhr";
        const isZoom = isSK && w.mode === "zoom";
        const titles = (w.themen || "").split("\n").map((s: string) => s.trim()).filter(Boolean);
        const infos = (w.themen_info || "").split("\n").map((s: string) => s.trim());
        const themenTitles = titles.length ? titles.map((t: string) => `  - ${t}`).join("\n") : "  (keine)";
        const themenDetail = titles.length
          ? titles.map((t: string, i: number) => infos[i] ? `  - ${t}\n    Notiz: ${infos[i]}` : `  - ${t}`).join("\n")
          : "  (keine)";
        const onlineLines = isZoom
          ? [`ACHTUNG: Dieser Steuerungskreis findet ONLINE per Zoom statt.`,
             `Zoom-Link: ${w.zoom_link || "(wird noch bekannt gegeben)"}`, ``]
          : [];
        let lastProtokoll: string | null = null;
        try {
          const pResp = await fetch(
            `${SUPABASE_URL}/rest/v1/workshops?meeting_type=eq.${w.meeting_type}&protokoll_url=not.is.null&date=lt.${tomorrowStr}&select=protokoll_url&order=date.desc&limit=1`,
            { headers: restHeaders },
          );
          const pRows = (await pResp.json().catch(() => [])) as any[];
          lastProtokoll = Array.isArray(pRows) && pRows[0] ? pRows[0].protokoll_url : null;
        } catch (_e) { /* ignore */ }
        const protokollLines = lastProtokoll ? [`Protokoll vom letzten Treffen: ${lastProtokoll}`, ``] : [];
        const text = [
          `Hallo,`, ``,
          `morgen findet ein ${typeName} statt.`, ``,
          ...onlineLines,
          `Datum:        ${fmtDateLong(w.date)}`,
          `Uhrzeit:      ${zeit}`,
          `Moderator/in: ${w.moderator_name || "-"}`, ``,
          `Agenda:`, `${w.agenda || "(keine)"}`, ``,
          `Themen:`, themenTitles, ``,
          `Themen mit Notizen:`, themenDetail, ``,
          ...protokollLines,
          `Zur Großgruppe: ${appBase}/grossgruppe/`,
        ].join("\n");
        const subject = `Erinnerung: ${typeName} morgen (${fmtDateLong(w.date)})`;
        for (const uid of users) {
          if (await sendOnce("grossgruppe", String(w.id), uid, subject, text)) result.grossgruppe_sent++;
        }
      }
    }
  } catch (e) { result.errors.push(`grossgruppe: ${String(e)}`); }

  // 2) VORSORGE – nur am 1.1. und 1.7.
  if (cfg.notify_vorsorge_enabled && isReminderDay) try {
    const users = await optedInUsers("notify_vorsorge");
    const text = [
      `Hallo,`, ``,
      `es ist wieder Zeit für den halbjährlichen Vorsorge-Check.`,
      `Bitte sieh dir deine Vorsorge-Dokumente an und prüfe, ob sie noch aktuell sind`,
      `(z. B. Patientenverfügung, Vollmachten, letzte Wünsche) – und aktualisiere sie bei Bedarf.`, ``,
      `Zu deinen Vorsorge-Dokumenten: ${appBase}/vorsorge/`,
    ].join("\n");
    for (const uid of users) {
      if (await sendOnce("vorsorge", `vorsorge-${halfYearTag}`, uid, "Vorsorge: Halbjährlicher Check", text)) result.vorsorge_sent++;
    }
  } catch (e) { result.errors.push(`vorsorge: ${String(e)}`); }

  // 3) NOTFALLPASS – nur am 1.1. und 1.7.
  if (cfg.notify_notfallpass_enabled && isReminderDay) try {
    const users = await optedInUsers("notify_notfallpass");
    const text = [
      `Hallo,`, ``,
      `es ist wieder Zeit, deinen Notfallpass zu prüfen.`,
      `Bitte kontrolliere, ob die Angaben noch stimmen (z. B. Kontakte, Medikamente, wichtige Hinweise)`,
      `und aktualisiere sie bei Bedarf.`, ``,
      `Zu deinen Vorsorge-Unterlagen: ${appBase}/vorsorge/`,
    ].join("\n");
    for (const uid of users) {
      if (await sendOnce("notfallpass", `notfallpass-${halfYearTag}`, uid, "Notfallpass: Halbjährlicher Check", text)) result.notfallpass_sent++;
    }
  } catch (e) { result.errors.push(`notfallpass: ${String(e)}`); }

  return json({ ok: true, today: todayStr, ...result }, 200);
});
