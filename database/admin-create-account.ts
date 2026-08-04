// NaWoDo Mitglieder – Superadmin: Login-Accounts und Kinder anlegen, Accounts löschen
// Nur für den Superadmin: legt einen neuen Login-Account (auth.users) über die offizielle
// GoTrue-Admin-API an, oder ein Kind-Profil ohne Login (nur members-Tabelle), oder löscht
// einen bestehenden Account inkl. seines Mitglieder-Profils vollständig (unwiderruflich).
// POST { type: "account", email, password, vorname, nachname, mitgliedstyp, related_user_id, app_permissions } -> Login-Account anlegen
//   (related_user_id ist Pflicht, wenn mitgliedstyp "gast" oder "bewohner" ist - zu welchem Mitglied gehoert die Person)
// POST { type: "child", vorname, nachname, parent1_user_id, parent2_user_id, mitgliedstyp } -> Kind-Profil anlegen (kein Login), mind. ein Elternteil noetig
// POST { type: "toggle_admin", target_user_id, is_admin } -> globalen Admin-Status setzen/entfernen
// POST { type: "set_password", target_user_id, password } -> neues Passwort fuer bestehenden Account setzen
// POST { type: "set_permission", target_user_id, app_key, allowed } -> App-Zugriff einzeln erlauben/sperren
// DELETE { user_id } -> Account (+ Profil) löschen
// Alle Aufrufe erwarten den Access-Token des aufrufenden Superadmins im Authorization-Header.

const APP_KEYS = ["sharing", "termine", "fahrtenbuch", "faq", "pinnwand", "mitglieder", "workshop", "bulldozer"];
// Feingranulare Unter-Rechte (kein eigener App-Zugriff, sondern ein Bereich innerhalb
// einer App). Anders als bei APP_KEYS gilt hier: fehlende Zeile = NICHT erlaubt (Opt-in).
const OPT_IN_PERMISSION_KEYS = ["faq_projekt", "mitglieder_gaeste", "mitglieder_bewohner"];
const MITGLIEDSTYP_VALUES = ["mitglied", "gast", "bewohner"];

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const restHeaders = {
    apikey: SERVICE_ROLE_KEY ?? "",
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  function jsonResponse(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Aufrufer verifizieren + Berechtigung mit dessen EIGENEM Token pruefen (nicht dem
  // Service-Key, damit hier wirklich nur echte, gueltige Sitzungen akzeptiert werden).
  // Accounts/Kinder anlegen und Accounts loeschen ist bewusst enger gefasst als der normale
  // Admin-Status: nur wer "is_superadmin" gesetzt hat, darf das (aktuell nur ein Account).
  async function verifySuperAdmin(): Promise<{ error: Response } | { me: any }> {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) return { error: jsonResponse({ error: "Nicht angemeldet." }, 401) };

    console.log("verifySuperAdmin: SUPABASE_URL=", SUPABASE_URL, "hasServiceKey=", !!SERVICE_ROLE_KEY, "tokenLen=", callerToken.length);
    let meResp: Response;
    try {
      meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${callerToken}` },
      });
    } catch (e) {
      console.error("verifySuperAdmin: fetch threw", String(e));
      return { error: jsonResponse({ error: "Anmeldung ungültig (Netzwerkfehler beim Auth-Check)." }, 401) };
    }
    if (!meResp.ok) {
      const errText = await meResp.text().catch(() => "");
      console.error("verifySuperAdmin: /auth/v1/user not ok", meResp.status, errText);
      return { error: jsonResponse({ error: "Anmeldung ungültig." }, 401) };
    }
    const me = await meResp.json();
    const isSuperAdmin = me?.user_metadata?.is_superadmin === true;
    if (!isSuperAdmin) return { error: jsonResponse({ error: "Dafür fehlt die Berechtigung." }, 403) };
    return { me };
  }

  const authResult = await verifySuperAdmin();
  if ("error" in authResult) return authResult.error;
  const callerId = authResult.me.id;

  if (req.method === "POST") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Ungültige Anfrage." }, 400);
    }

    const type = ["child", "toggle_admin", "set_password", "set_permission"].includes(body.type)
      ? body.type
      : "account";

    // --- Globalen Admin-Status setzen/entfernen (nur Superadmin, siehe verifySuperAdmin oben). ---
    if (type === "toggle_admin") {
      const targetUserId = body.target_user_id;
      if (!targetUserId) {
        return jsonResponse({ error: "Keine target_user_id angegeben." }, 400);
      }
      const nextIsAdmin = body.is_admin === true;

      // Aktuelle Metadaten holen, damit beim Update nur is_admin geaendert wird und der Rest
      // (z.B. name, is_superadmin) nicht versehentlich ueberschrieben wird.
      const getResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUserId}`, {
        headers: { apikey: SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      });
      const current = await getResp.json();
      if (!getResp.ok) {
        return jsonResponse(
          { error: current?.msg || current?.message || "Nutzer nicht gefunden." },
          getResp.status
        );
      }
      const mergedMetadata = {
        ...(current?.user_metadata || current?.raw_user_meta_data || {}),
        is_admin: nextIsAdmin,
      };

      const putResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUserId}`, {
        method: "PUT",
        headers: restHeaders,
        body: JSON.stringify({ user_metadata: mergedMetadata }),
      });
      const updated = await putResp.json();
      if (!putResp.ok) {
        return jsonResponse(
          { error: updated?.msg || updated?.message || "Admin-Status konnte nicht geaendert werden." },
          putResp.status
        );
      }
      return jsonResponse({ ok: true, is_admin: nextIsAdmin }, 200);
    }

    // --- Neues Passwort fuer einen bestehenden Account setzen (z.B. wenn jemand es
    // vergessen hat). Nur Superadmin, siehe verifySuperAdmin oben. ---
    if (type === "set_password") {
      const targetUserId = body.target_user_id;
      const newPassword = body.password || "";
      if (!targetUserId) {
        return jsonResponse({ error: "Keine target_user_id angegeben." }, 400);
      }
      if (!newPassword || newPassword.length < 6) {
        return jsonResponse({ error: "Passwort muss mindestens 6 Zeichen haben." }, 400);
      }
      const putResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUserId}`, {
        method: "PUT",
        headers: restHeaders,
        body: JSON.stringify({ password: newPassword }),
      });
      const updated = await putResp.json();
      if (!putResp.ok) {
        return jsonResponse(
          { error: updated?.msg || updated?.message || "Passwort konnte nicht gesetzt werden." },
          putResp.status
        );
      }
      return jsonResponse({ ok: true }, 200);
    }

    // --- App-Zugriff bzw. Unter-Recht einzeln erlauben/sperren (member_permissions). ---
    // Fuer normale App-Keys (APP_KEYS) gilt: fehlende Zeile = erlaubt (Standard), zum
    // Sperren wird eine Zeile mit allowed=false angelegt.
    // Fuer Opt-in-Keys (OPT_IN_PERMISSION_KEYS) gilt das Gegenteil: fehlende Zeile =
    // NICHT erlaubt, zum Erlauben wird eine Zeile mit allowed=true angelegt.
    if (type === "set_permission") {
      const targetUserId = body.target_user_id;
      const appKey = body.app_key;
      const isOptIn = OPT_IN_PERMISSION_KEYS.includes(appKey);
      const allowed = body.allowed !== false;
      if (!targetUserId || !(APP_KEYS.includes(appKey) || isOptIn)) {
        return jsonResponse({ error: "Ungültige Angabe." }, 400);
      }
      await fetch(
        `${SUPABASE_URL}/rest/v1/member_permissions?user_id=eq.${targetUserId}&app_key=eq.${appKey}`,
        { method: "DELETE", headers: restHeaders }
      );
      const needsRow = isOptIn ? allowed : !allowed;
      if (needsRow) {
        const insResp = await fetch(`${SUPABASE_URL}/rest/v1/member_permissions`, {
          method: "POST",
          headers: restHeaders,
          body: JSON.stringify({ user_id: targetUserId, app_key: appKey, allowed }),
        });
        if (!insResp.ok) {
          const errBody = await insResp.json().catch(() => ({}));
          return jsonResponse(
            { error: errBody?.message || "Recht konnte nicht geändert werden." },
            insResp.status
          );
        }
      }
      return jsonResponse({ ok: true, allowed }, 200);
    }

    const vorname = (body.vorname || "").trim();
    const nachname = (body.nachname || "").trim();
    const mitgliedstyp = MITGLIEDSTYP_VALUES.includes(body.mitgliedstyp) ? body.mitgliedstyp : "mitglied";

    if (!vorname) {
      return jsonResponse({ error: "Bitte einen Vornamen angeben." }, 400);
    }

    // --- Kind anlegen: nur ein Profil in der members-Tabelle - optional (individuell,
    // nicht jedes Kind braucht das) zusaetzlich mit eigenem Login. ---
    if (type === "child") {
      const parent1UserId = body.parent1_user_id || body.parent_user_id || null;
      const parent2UserId = body.parent2_user_id || null;
      if (!parent1UserId && !parent2UserId) {
        return jsonResponse({ error: "Bitte mindestens einen Elternteil (Vater oder Mutter) auswählen." }, 400);
      }

      let childUserId: string | null = null;

      if (body.email) {
        const childEmail = (body.email || "").trim().toLowerCase();
        const childPassword = body.password || "";
        if (!childEmail || !childEmail.includes("@")) {
          return jsonResponse({ error: "Bitte eine gültige Email-Adresse angeben." }, 400);
        }
        if (!childPassword || childPassword.length < 6) {
          return jsonResponse({ error: "Passwort muss mindestens 6 Zeichen haben." }, 400);
        }
        const childFullName = [vorname, nachname].filter(Boolean).join(" ");
        const childCreateResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: "POST",
          headers: restHeaders,
          body: JSON.stringify({
            email: childEmail,
            password: childPassword,
            email_confirm: true,
            user_metadata: childFullName ? { name: childFullName } : {},
          }),
        });
        const childCreated = await childCreateResp.json();
        if (!childCreateResp.ok) {
          return jsonResponse(
            { error: childCreated?.msg || childCreated?.message || "Account konnte nicht angelegt werden." },
            childCreateResp.status
          );
        }
        childUserId = childCreated.id;
      }

      const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
        method: "POST",
        headers: { ...restHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          vorname,
          nachname,
          is_child: true,
          created_by: callerId,
          parent1_user_id: parent1UserId,
          parent2_user_id: parent2UserId,
          mitgliedstyp,
          ...(childUserId ? { user_id: childUserId } : {}),
        }),
      });
      const inserted = await insertResp.json();
      if (!insertResp.ok) {
        return jsonResponse(
          { error: inserted?.message || "Kind konnte nicht angelegt werden." },
          insertResp.status
        );
      }

      if (childUserId) {
        const perms = body.app_permissions || {};
        const deniedRows = APP_KEYS
          .filter((k) => perms[k] === false)
          .map((k) => ({ user_id: childUserId, app_key: k, allowed: false }));
        if (deniedRows.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/member_permissions`, {
            method: "POST",
            headers: restHeaders,
            body: JSON.stringify(deniedRows),
          });
        }
      }

      return jsonResponse({ id: Array.isArray(inserted) ? inserted[0]?.id : inserted?.id }, 200);
    }

    // --- Login-Account anlegen (offizielle GoTrue-Admin-API). ---
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const relatedUserId = body.related_user_id || null;

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "Bitte eine gültige Email-Adresse angeben." }, 400);
    }
    if (!password || password.length < 6) {
      return jsonResponse({ error: "Passwort muss mindestens 6 Zeichen haben." }, 400);
    }
    if ((mitgliedstyp === "gast" || mitgliedstyp === "bewohner") && !relatedUserId) {
      return jsonResponse({ error: "Bitte angeben, zu welchem Mitglied diese Person gehört." }, 400);
    }

    const fullName = [vorname, nachname].filter(Boolean).join(" ");
    const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { name: fullName } : {},
      }),
    });

    const created = await createResp.json();
    if (!createResp.ok) {
      return jsonResponse(
        { error: created?.msg || created?.message || "Account konnte nicht angelegt werden." },
        createResp.status
      );
    }

    // Direkt ein Mitglieder-Profil dazu anlegen, statt nur einen leeren Platzhalter -
    // so sind Mitgliedstyp und App-Berechtigungen sofort gesetzt.
    await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({
        user_id: created.id,
        is_child: false,
        created_by: callerId,
        vorname,
        nachname,
        mitgliedstyp,
        related_user_id: relatedUserId,
      }),
    });

    // App-Berechtigungen: nur explizit gesperrte Apps bekommen eine Zeile (allowed=false),
    // erlaubte Apps brauchen keinen Eintrag (Standard = erlaubt).
    const perms = body.app_permissions || {};
    const deniedRows = APP_KEYS
      .filter((k) => perms[k] === false)
      .map((k) => ({ user_id: created.id, app_key: k, allowed: false }));
    if (deniedRows.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/member_permissions`, {
        method: "POST",
        headers: restHeaders,
        body: JSON.stringify(deniedRows),
      });
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

    // 3) Account selbst löschen (offizielle GoTrue-Admin-API). member_permissions-Zeilen
    //    fallen per "on delete cascade" automatisch mit weg.
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
