// NaWoDo Mitglieder – Admin: Login-Accounts anlegen und löschen
// Nur für Admins: legt einen neuen Account (auth.users) über die offizielle
// GoTrue-Admin-API an, oder löscht einen bestehenden Account inkl. seines
// Mitglieder-Profils vollständig (unwiderruflich).
// POST { email, password, name } -> Account anlegen
// DELETE { user_id } -> Account (+ Profil) löschen
// Beide Aufrufe erwarten den Access-Token des aufrufenden Admins im Authorization-Header.

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  function jsonResponse(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Aufrufer verifizieren + Admin-Check mit dessen EIGENEM Token (nicht dem Service-Key,
  // damit hier wirklich nur echte, gültige Sitzungen akzeptiert werden).
  // Accounts anlegen/löschen ist bewusst enger gefasst als der normale Admin-Status:
  // nur wer "is_superadmin" gesetzt hat, darf das (aktuell nur ein einzelner Account).
  async function requireSuperAdmin(): Promise<Response | null> {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) return jsonResponse({ error: "Nicht angemeldet." }, 401);

    const meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${callerToken}` },
    });
    if (!meResp.ok) return jsonResponse({ error: "Anmeldung ungültig." }, 401);
    const me = await meResp.json();
    const isSuperAdmin = me?.user_metadata?.is_superadmin === true;
    if (!isSuperAdmin) return jsonResponse({ error: "Dafür fehlt die Berechtigung." }, 403);
    return null;
  }

  const adminError = await requireSuperAdmin();
  if (adminError) return adminError;

  if (req.method === "POST") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Ungültige Anfrage." }, 400);
    }

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const name = (body.name || "").trim();

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "Bitte eine gültige Email-Adresse angeben." }, 400);
    }
    if (!password || password.length < 6) {
      return jsonResponse({ error: "Passwort muss mindestens 6 Zeichen haben." }, 400);
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
      return jsonResponse(
        { error: created?.msg || created?.message || "Account konnte nicht angelegt werden." },
        createResp.status
      );
    }

    return jsonResponse({ id: created.id, email: created.email }, 200);
  }

  if (req.method === "DELETE") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Ungültige Anfrage." }, 400);
    }

    const userId = body.user_id;
    if (!userId) {
      return jsonResponse({ error: "Keine user_id angegeben." }, 400);
    }

    const restHeaders = {
      apikey: SERVICE_ROLE_KEY ?? "",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };

    // 1) Eigenen Mitglieder-Eintrag löschen (falls vorhanden) - Gruppen-Zuordnungen
    //    fallen per "on delete cascade" automatisch mit weg.
    await fetch(`${SUPABASE_URL}/rest/v1/members?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: restHeaders,
    });

    // 2) Falls diese Person als Elternteil bei Kindern verknüpft ist: Verknüpfung
    //    entfernen (Kind-Eintrag selbst bleibt erhalten), damit die Fremdschlüssel
    //    dem Löschen des Accounts nicht im Weg stehen.
    await fetch(`${SUPABASE_URL}/rest/v1/members?parent1_user_id=eq.${userId}`, {
      method: "PATCH",
      headers: restHeaders,
      body: JSON.stringify({ parent1_user_id: null }),
    });
    await fetch(`${SUPABASE_URL}/rest/v1/members?parent2_user_id=eq.${userId}`, {
      method: "PATCH",
      headers: restHeaders,
      body: JSON.stringify({ parent2_user_id: null }),
    });

    // 3) Account selbst löschen (offizielle GoTrue-Admin-API).
    const delResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });

    if (!delResp.ok) {
      const errBody = await delResp.json().catch(() => ({}));
      return jsonResponse(
        { error: errBody?.msg || errBody?.message || "Account konnte nicht gelöscht werden." },
        delResp.status
      );
    }

    return jsonResponse({ ok: true }, 200);
  }

  return jsonResponse({ error: "Methode nicht erlaubt." }, 405);
});
