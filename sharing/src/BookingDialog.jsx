import React from "react";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { ICONS, ICON_KEYS } from "./icons";
import { PAPER, INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";

// Desktop-Buchungsdialog: Reiter (Kategorie) und Artikel werden HIER ausgewählt,
// statt vorher über Tabs im Kalender – dadurch bleibt der Kalender selbst
// übersichtlicher (Anforderung aus dem Layout-Redesign).
export default function BookingDialog({
  open, onClose, userName,
  pickableCategories, eventCategory, resources, roomResources, zoeResource, isWallboxResource, colorFor,
  categoryId, onCategoryChange, resourceId, onResourceChange,
  formTitle, setFormTitle,
  formAllDay, setFormAllDay,
  formStartDate, setFormStartDate, formStart, setFormStart,
  formEndDate, setFormEndDate, formEnd, setFormEnd,
  formRoomId, setFormRoomId,
  formBlockZoe, setFormBlockZoe,
  formNote, setFormNote,
  formError, saving, onSave,
}) {
  if (!open) return null;

  const isEventMode = eventCategory && categoryId === eventCategory.id;
  const categoryResources = categoryId && !isEventMode ? resources.filter((r) => r.category_id === categoryId) : [];
  const selectedResource = resources.find((r) => r.id === resourceId);
  const canSave = isEventMode ? !!formTitle.trim() : !!resourceId;
  const accentColor = isEventMode ? eventCategory.color : selectedResource ? colorFor(selectedResource) : INK;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Buchen</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <label className="text-xs font-medium block mb-1.5" style={{ color: INK_SOFT }}>Reiter</label>
        <div className="flex gap-2 mb-3 flex-wrap">
          {pickableCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: categoryId === c.id ? c.color : "transparent", color: categoryId === c.id ? "#fff" : INK, border: `1.5px solid ${categoryId === c.id ? c.color : BORDER_SOFT}` }}
            >
              {c.name}
            </button>
          ))}
          {eventCategory && (
            <button
              onClick={() => onCategoryChange(eventCategory.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: isEventMode ? eventCategory.color : "transparent", color: isEventMode ? "#fff" : INK, border: `1.5px solid ${isEventMode ? eventCategory.color : BORDER_SOFT}` }}
            >
              {eventCategory.name}
            </button>
          )}
        </div>

        {!isEventMode && categoryId && (
          <>
            <label className="text-xs font-medium block mb-1.5" style={{ color: INK_SOFT }}>Artikel</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {categoryResources.length === 0 && <span className="text-xs" style={{ color: INK_SOFT }}>Keine Artikel in diesem Reiter.</span>}
              {categoryResources.map((r) => {
                const Icon = ICONS[r.icon] || ICONS.zap;
                const col = colorFor(r);
                const active = resourceId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => onResourceChange(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: active ? col : `${col}1A`, color: active ? "#fff" : INK, border: `1.5px solid ${active ? col : `${col}55`}` }}
                  >
                    <Icon size={12} /> {r.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {isEventMode && (
          <>
            <label className="text-xs font-medium block mb-1">Titel des Termins</label>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. Hoffest, Versammlung" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
          </>
        )}

        {(isEventMode || resourceId) && (
          <>
            <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: BORDER }}>
              <span className="text-xs" style={{ color: INK_SOFT }}>{isEventMode ? "Eingetragen von" : "Gebucht als"}</span>
              <span className="text-sm font-semibold">{userName}</span>
            </div>

            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Ganztägig</span>
            </label>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Start</label>
                <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                {!formAllDay && <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />}
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Ende</label>
                <input type="date" min={formStartDate} value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                {!formAllDay && <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />}
              </div>
            </div>

            {isEventMode && roomResources.length > 0 && (
              <>
                <label className="text-xs font-medium block mb-1">Raum dazu buchen (optional)</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button onClick={() => setFormRoomId(null)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: !formRoomId ? INK : "transparent", color: !formRoomId ? "#fff" : INK_SOFT, border: `1.5px solid ${!formRoomId ? INK : BORDER_SOFT}` }}>Kein Raum</button>
                  {roomResources.map((r) => (
                    <button key={r.id} onClick={() => setFormRoomId(r.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: formRoomId === r.id ? colorFor(r) : "transparent", color: formRoomId === r.id ? "#fff" : INK, border: `1.5px solid ${formRoomId === r.id ? colorFor(r) : BORDER_SOFT}` }}>{r.name}</button>
                  ))}
                </div>
              </>
            )}

            {!isEventMode && selectedResource && isWallboxResource(selectedResource) && zoeResource && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer select-none px-3 py-2.5 rounded-lg" style={{ backgroundColor: BORDER }}>
                <input type="checkbox" checked={formBlockZoe} onChange={(e) => setFormBlockZoe(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm font-medium">Zoe (E-Auto) gleichzeitig blocken</span>
              </label>
            )}

            <label className="text-xs font-medium block mb-1">Notiz (optional)</label>
            <input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="weitere Infos" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
          </>
        )}

        {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}

        <button
          onClick={onSave}
          disabled={saving || !canSave}
          className="w-full rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: accentColor, color: "#fff", opacity: saving || !canSave ? 0.6 : 1 }}
        >
          {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : isEventMode ? "Termin eintragen" : "Blocken"}
        </button>
      </div>
    </div>
  );
}
