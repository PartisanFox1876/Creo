import { getCurrentProfile } from "./supabase-client.js";
import {
  listSpecies, upsertSpecies, deleteSpecies,
  listItems, upsertItem, deleteItem,
  uploadSprite,
} from "./supabase-client.js";

// ---------------- Gate: must be signed in AND admin ----------------

const gateMessage = document.getElementById("gate-message");
const adminContent = document.getElementById("admin-content");

async function gate() {
  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error(err);
  }

  if (!profile) {
    gateMessage.textContent = "You need to sign in first — head back to the main page.";
    return false;
  }
  if (!profile.is_admin) {
    gateMessage.textContent = "This account isn't an admin. Ask whoever runs the Supabase project to flip your is_admin flag.";
    return false;
  }
  gateMessage.hidden = true;
  adminContent.hidden = false;
  return true;
}

// ---------------- Tabs ----------------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("creatures-tab").hidden = btn.dataset.tab !== "creatures";
    document.getElementById("items-tab").hidden = btn.dataset.tab !== "items";
  });
});

// ---------------- Sprite preview helper ----------------

function wireSpritePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) { preview.hidden = true; return; }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
}
wireSpritePreview("species-sprite", "species-sprite-preview");
wireSpritePreview("item-sprite", "item-sprite-preview");

// ================================================================
// Creatures
// ================================================================

const speciesForm = document.getElementById("species-form");
const speciesList = document.getElementById("species-list");
const speciesStatus = document.getElementById("species-form-status");
let speciesCache = [];

function resetSpeciesForm() {
  speciesForm.reset();
  document.getElementById("species-id").value = "";
  document.getElementById("species-form-title").textContent = "New creature";
  document.getElementById("species-form-cancel").hidden = true;
  document.getElementById("species-sprite-preview").hidden = true;
  speciesStatus.textContent = "";
}

async function refreshSpeciesList() {
  speciesCache = await listSpecies();
  speciesList.innerHTML = speciesCache.map((s) => `
    <li class="entity-row">
      ${s.sprite_url ? `<img src="${s.sprite_url}" class="entity-thumb" alt="">` : `<div class="entity-thumb placeholder"></div>`}
      <div class="entity-info">
        <strong>${escapeHtml(s.name)}</strong>
        <span class="dim-note">HP ${s.base_hp} · ATK ${s.base_atk} · DEF ${s.base_def} · SPD ${s.base_spd} · capture ×${s.capture_rate_modifier}</span>
      </div>
      <button type="button" class="ghost-btn small" data-edit="${s.id}">Edit</button>
      <button type="button" class="ghost-btn small danger" data-delete="${s.id}">Delete</button>
    </li>
  `).join("") || `<li class="dim-note">No creatures yet.</li>`;

  speciesList.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => loadSpeciesIntoForm(btn.dataset.edit)));
  speciesList.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => handleDeleteSpecies(btn.dataset.delete)));
}

function loadSpeciesIntoForm(id) {
  const s = speciesCache.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("species-id").value = s.id;
  document.getElementById("species-name").value = s.name;
  document.getElementById("species-description").value = s.description || "";
  document.getElementById("species-hp").value = s.base_hp;
  document.getElementById("species-atk").value = s.base_atk;
  document.getElementById("species-def").value = s.base_def;
  document.getElementById("species-spd").value = s.base_spd;
  document.getElementById("species-capture-rate").value = s.capture_rate_modifier;
  const preview = document.getElementById("species-sprite-preview");
  if (s.sprite_url) { preview.src = s.sprite_url; preview.hidden = false; } else { preview.hidden = true; }
  document.getElementById("species-form-title").textContent = `Editing: ${s.name}`;
  document.getElementById("species-form-cancel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("species-form-cancel").addEventListener("click", resetSpeciesForm);

speciesForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  speciesStatus.textContent = "Saving…";
  speciesStatus.className = "form-status";
  try {
    const id = document.getElementById("species-id").value || undefined;
    let spriteUrl = speciesCache.find((s) => s.id === id)?.sprite_url || null;
    const file = document.getElementById("species-sprite").files[0];
    if (file) spriteUrl = await uploadSprite(file, "species");

    await upsertSpecies({
      id,
      name: document.getElementById("species-name").value.trim(),
      description: document.getElementById("species-description").value.trim(),
      sprite_url: spriteUrl,
      base_hp: Number(document.getElementById("species-hp").value),
      base_atk: Number(document.getElementById("species-atk").value),
      base_def: Number(document.getElementById("species-def").value),
      base_spd: Number(document.getElementById("species-spd").value),
      capture_rate_modifier: Number(document.getElementById("species-capture-rate").value),
    });

    speciesStatus.textContent = "Saved!";
    speciesStatus.className = "form-status success";
    resetSpeciesForm();
    await refreshSpeciesList();
  } catch (err) {
    console.error(err);
    speciesStatus.textContent = err.message || "Couldn't save.";
    speciesStatus.className = "form-status error";
  }
});

async function handleDeleteSpecies(id) {
  const s = speciesCache.find((x) => x.id === id);
  if (!confirm(`Delete "${s?.name}"? This can't be undone.`)) return;
  try {
    await deleteSpecies(id);
    await refreshSpeciesList();
  } catch (err) {
    alert(err.message || "Couldn't delete.");
  }
}

// ================================================================
// Items
// ================================================================

const itemForm = document.getElementById("item-form");
const itemList = document.getElementById("item-list");
const itemStatus = document.getElementById("item-form-status");
let itemCache = [];

document.getElementById("item-type").addEventListener("change", updateEffectFieldsVisibility);
function updateEffectFieldsVisibility() {
  const type = document.getElementById("item-type").value;
  document.getElementById("capture-fields").hidden = type !== "capture";
  document.getElementById("buff-fields").hidden = type === "capture";
}
updateEffectFieldsVisibility();

function resetItemForm() {
  itemForm.reset();
  document.getElementById("item-id").value = "";
  document.getElementById("item-form-title").textContent = "New item";
  document.getElementById("item-form-cancel").hidden = true;
  document.getElementById("item-sprite-preview").hidden = true;
  itemStatus.textContent = "";
  updateEffectFieldsVisibility();
}

function effectSummary(item) {
  if (item.item_type === "capture") return `capture ×${item.effect?.capture_bonus ?? "?"}`;
  return `${item.item_type} ${item.effect?.stat ?? "?"} ${item.effect?.amount ?? "?"} for ${item.effect?.duration_turns ?? "?"} turns`;
}

async function refreshItemList() {
  itemCache = await listItems();
  itemList.innerHTML = itemCache.map((it) => `
    <li class="entity-row">
      ${it.sprite_url ? `<img src="${it.sprite_url}" class="entity-thumb" alt="">` : `<div class="entity-thumb placeholder"></div>`}
      <div class="entity-info">
        <strong>${escapeHtml(it.name)}</strong>
        <span class="dim-note">${escapeHtml(effectSummary(it))}</span>
      </div>
      <button type="button" class="ghost-btn small" data-edit="${it.id}">Edit</button>
      <button type="button" class="ghost-btn small danger" data-delete="${it.id}">Delete</button>
    </li>
  `).join("") || `<li class="dim-note">No items yet.</li>`;

  itemList.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => loadItemIntoForm(btn.dataset.edit)));
  itemList.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => handleDeleteItem(btn.dataset.delete)));
}

function loadItemIntoForm(id) {
  const it = itemCache.find((x) => x.id === id);
  if (!it) return;
  document.getElementById("item-id").value = it.id;
  document.getElementById("item-name").value = it.name;
  document.getElementById("item-description").value = it.description || "";
  document.getElementById("item-type").value = it.item_type;
  updateEffectFieldsVisibility();
  if (it.item_type === "capture") {
    document.getElementById("item-capture-bonus").value = it.effect?.capture_bonus ?? 1.5;
  } else {
    document.getElementById("item-stat").value = it.effect?.stat ?? "atk";
    document.getElementById("item-amount").value = it.effect?.amount ?? 10;
    document.getElementById("item-duration").value = it.effect?.duration_turns ?? 3;
  }
  const preview = document.getElementById("item-sprite-preview");
  if (it.sprite_url) { preview.src = it.sprite_url; preview.hidden = false; } else { preview.hidden = true; }
  document.getElementById("item-form-title").textContent = `Editing: ${it.name}`;
  document.getElementById("item-form-cancel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("item-form-cancel").addEventListener("click", resetItemForm);

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  itemStatus.textContent = "Saving…";
  itemStatus.className = "form-status";
  try {
    const id = document.getElementById("item-id").value || undefined;
    let spriteUrl = itemCache.find((it) => it.id === id)?.sprite_url || null;
    const file = document.getElementById("item-sprite").files[0];
    if (file) spriteUrl = await uploadSprite(file, "items");

    const type = document.getElementById("item-type").value;
    const effect = type === "capture"
      ? { capture_bonus: Number(document.getElementById("item-capture-bonus").value) }
      : {
          stat: document.getElementById("item-stat").value,
          amount: Number(document.getElementById("item-amount").value),
          duration_turns: Number(document.getElementById("item-duration").value),
        };

    await upsertItem({
      id,
      name: document.getElementById("item-name").value.trim(),
      description: document.getElementById("item-description").value.trim(),
      sprite_url: spriteUrl,
      item_type: type,
      effect,
    });

    itemStatus.textContent = "Saved!";
    itemStatus.className = "form-status success";
    resetItemForm();
    await refreshItemList();
  } catch (err) {
    console.error(err);
    itemStatus.textContent = err.message || "Couldn't save.";
    itemStatus.className = "form-status error";
  }
});

async function handleDeleteItem(id) {
  const it = itemCache.find((x) => x.id === id);
  if (!confirm(`Delete "${it?.name}"? This can't be undone.`)) return;
  try {
    await deleteItem(id);
    await refreshItemList();
  } catch (err) {
    alert(err.message || "Couldn't delete.");
  }
}

// ---------------- Utility ----------------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------- Boot ----------------

gate().then((ok) => {
  if (!ok) return;
  refreshSpeciesList();
  refreshItemList();
});
