// NaWoDo Mitglieder – Admin: neuen Login-Account anlegen
// Nur für Admins: legt einen neuen Account (auth.users) über die offizielle
// GoTrue-Admin-API an (kein direktes Schreiben in interne Auth-Tabellen).
// Erwartet POST { email, password, name } mit dem Access-Token des aufrufenden
// Admins im Authorization-Header.

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Nur POST erlaubt." }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("Authorization") || "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken) {
    return new Response(JSON.stringify({ error: "Nicht angemeldet." }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Aufrufer verifizieren + Admin-Check mit dessen EIGENEM Token (nicht dem Service-Key,
  // damit hier wirklich nur echte, gültige Sitzungen akzeptiert werden).
  const meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${callerToken}` },
  });
  if (!meResp.ok) {
    return new Response(JSON.stringify({ error: "Anmeldung ungültig." }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const me = await meResp.json();
  const isAdmin = me?.user_metadata?.is_admin === true;
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Nur Admins dürfen Accounts anlegen." }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ungültige Anfrage." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const name = (body.name || "").trim();

  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ error: "Bitte eine gültige Email-Adresse angeben." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!password || password.length < 6) {
    return new Response(JSON.stringify({ error: "Passwort muss mindestens 6 Zeichen haben." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY ?? "",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { name } : {},
    }),
  });

  const created = await createResp.json();
  if (!createResp.ok) {
    return new Response(
      JSON.stringify({ error: created?.msg || created?.message || "Account konnte nicht angelegt werden." }),
      { status: createResp.status, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ id: created.id, email: created.email }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
