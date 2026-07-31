// NaWoDo Sharing – Kalender-Feed (iCal/.ics)
// Liefert Buchungen als abonnierbaren Kalender für Google/Outlook/Apple Kalender.
// Ohne Parameter: alle Bereiche. Mit ?category=Wallbox (Kategorie-Name): nur dieser Bereich.

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const url = new URL(req.url);
  const categoryFilter = url.searchParams.get("category");

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY ?? "",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const [catResp, resResp, bookResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,name`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/resources?select=id,name,category_id`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/bookings?select=*`, { headers }),
  ]);
  const categories = await catResp.json();
  let resources = await resResp.json();
  const allBookings = await bookResp.json();

  let calendarName = "NaWoDo Sharing";
  if (categoryFilter) {
    const cat = categories.find((c: any) => c.name.toLowerCase() === categoryFilter.toLowerCase());
    if (cat) {
      resources = resources.filter((r: any) => r.category_id === cat.id);
      calendarName = `NaWoDo Sharing – ${cat.name}`;
    } else {
      resources = [];
    }
  }

  const resourceMap: Record<string, string> = {};
  for (const r of resources) resourceMap[r.id] = r.name;
  const resourceIds = new Set(resources.map((r: any) => r.id));
  const bookings = allBookings.filter((b: any) => resourceIds.has(b.resource_id));

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }
  function icsDate(dateStr: string) {
    return dateStr.replaceAll("-", "");
  }
  function icsDateTime(dateStr: string, timeStr: string) {
    const [hh, mm] = timeStr.split(":");
    return `${icsDate(dateStr)}T${hh}${mm}00`;
  }
  function addOneDay(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  }
  function escapeText(t: string) {
    return t.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NaWoDo Sharing//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarName}`,
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];

  for (const b of bookings) {
    const name = b.title || resourceMap[b.resource_id] || "Ressource";
    const endDate = b.end_date || b.date;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${b.id}@nawodo-sharing`);
    lines.push(`SUMMARY:${escapeText(`${name} – ${b.name}`)}`);
    if (b.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(b.date)}`);
      lines.push(`DTEND;VALUE=DATE:${addOneDay(endDate)}`);
    } else {
      lines.push(`DTSTART:${icsDateTime(b.date, b.start_time)}`);
      lines.push(`DTEND:${icsDateTime(endDate, b.end_time)}`);
    }
    if (b.note) lines.push(`DESCRIPTION:${escapeText(b.note)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=nawodo-sharing.ics",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
