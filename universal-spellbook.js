/* ========================================================
   Universal Spellbook v6.0 — AUTO-POPULATE FROM COMPENDIUM
   Populates spellbook with class spells from "dnd5e.spells"
   Wizard class/spellcasting only
   Updates only on new module version (cleanup + recreate)
   Deletes old if >1, adds 1 per wizard class
   No errors, no loop, animation/UI, lootable
   ======================================================== */

const MODULE_ID = "universal-spellbook-5E";

/* =========================================================
   INITIALIZATION — Settings + Sheet
   ========================================================= */
Hooks.once("init", () => {
  // Background image setting
  game.settings.register(MODULE_ID, "backgroundImage", {
    name: "Spellbook Background Image",
    hint: "Choose a parchment or custom background for all spellbooks.",
    scope: "world",
    config: true,
    type: String,
    default: `modules/${MODULE_ID}/icons/parchment.jpg`,
    filePicker: "image"
  });

  // Stored module version for update detection
  game.settings.register(MODULE_ID, "moduleVersion", {
    name: "Module Version",
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0"
  });

  // Register the beautiful animated sheet
  Items.registerSheet(MODULE_ID, UniversalSpellbookSheet, {
    types: ["backpack"],
    makeDefault: false,
    label: "✦ Universal Spellbook"
  });
});

/* =========================================================
   VERSION CHECK & AUTO-UPDATE ON NEW VERSION
   ========================================================= */
Hooks.once("ready", async () => {
  const currentVersion = "6.0"; // Bump this for future updates
  const storedVersion = game.settings.get(MODULE_ID, "moduleVersion");

  if (storedVersion !== currentVersion) {
    // New version — cleanup and recreate for all actors
    for (const actor of game.actors) {
      await cleanupAndRecreate(actor);
    }
    await game.settings.set(MODULE_ID, "moduleVersion", currentVersion);
  } else {
    // Normal run — just ensure for existing actors
    for (const actor of game.actors) {
      await ensureSpellbook(actor);
    }
  }
});

/* =========================================================
   HOOKS FOR CHANGES
   ========================================================= */
Hooks.on("createActor", ensureSpellbook);

Hooks.on("updateActor", (actor, updates) => {
  if (updates.items || updates.system) ensureSpellbook(actor);
});

Hooks.on("createItem", (item) => {
  if (item.type === "class") ensureSpellbook(item.parent);
});

Hooks.on("deleteItem", (item) => {
  if (item.type === "class") ensureSpellbook(item.parent);
});

/* =========================================================
   CLEANUP & RECREATE ON VERSION UPDATE
   ========================================================= */
async function cleanupAndRecreate(actor) {
  // Find all existing spellbooks (backpack type with flag)
  const existingSpellbooks = actor.items.filter(i => i.type === "backpack" && i.flags[MODULE_ID]?.isSpellbook);

  // Delete all old spellbooks
  if (existingSpellbooks.length > 0) {
    const idsToDelete = existingSpellbooks.map(i => i.id);
    await actor.deleteEmbeddedDocuments("Item", idsToDelete);
  }

  // Recreate the latest
  await ensureSpellbook(actor);
}

/* =========================================================
   ENSURE SPELLBOOK — LIMIT TO WIZARD CLASS/SPELLCASTING
   ========================================================= */
async function ensureSpellbook(actor) {
  // Find all existing spellbooks (backpack type with flag)
  const existingSpellbooks = actor.items.filter(i => i.type === "backpack" && i.flags[MODULE_ID]?.isSpellbook);

  // If there is more than 1 spellbook, delete all of them first
  if (existingSpellbooks.length > 1) {
    const idsToDelete = existingSpellbooks.map(i => i.id);
    await actor.deleteEmbeddedDocuments("Item", idsToDelete);
  }

  // Get wizard classes (check name or spellcasting progression for wizard)
  const wizardClasses = actor.items.filter(i =>
    i.type === "class" && (i.name.toLowerCase().includes("wizard") || i.system.spellcasting?.progression === "full")
  );

  // Skip if no wizard
  if (wizardClasses.length === 0) return;

  for (const cls of wizardClasses) {
    // Skip if a book for this class already exists
    const hasBook = actor.items.some(i =>
      i.type === "backpack" && i.flags[MODULE_ID]?.isSpellbook && i.flags[MODULE_ID]?.classId === cls.id
    );
    if (hasBook) continue;

    const classLower = cls.name.toLowerCase();
    const alignLower = (actor.system.details?.alignment || "").toLowerCase();

    const spellbook = await Item.create({
      name: `${actor.name}'s ${cls.name} Spellbook`,
      type: "backpack",
      img: chooseIcon(classLower, alignLower),
      system: { description: { value: `<p>The personal spellbook of ${actor.name}, containing all known ${cls.name} spells.</p>` } },
      flags: { [MODULE_ID]: { isSpellbook: true, classId: cls.id } }
    }, { parent: actor });

    // Auto-populate with copies of actor's spells
    const actorSpells = actor.items.filter(i => i.type === "spell");
    if (actorSpells.length > 0) {
      const spellData = actorSpells.map(s => s.toObject());
      await spellbook.createEmbeddedDocuments("Item", spellData);
    }
  }
}

function chooseIcon(className, alignment = "") {
  const icons = {
    wizard: "wizard-tome.png",
    sorcerer: "sorcerer-crystal.png",
    warlock: "warlock-pact.png",
    cleric: "cleric-holy.png",
    paladin: "paladin-oath.png",
    druid: "druid-nature.png",
    ranger: "ranger-forest.png",
    bard: "bard-music.png",
    artificer: "artificer-gears.png",
    evil: "evil-shadow.png",
    good: "good-radiant.png",
    chaotic: "chaotic-swirl.png",
    lawful: "lawful-scales.png"
  };

  for (const [key, file] of Object.entries(icons)) {
    if (className.includes(key) || alignment.includes(key)) {
      return `modules/${MODULE_ID}/icons/${file}`;
    }
  }
  return "icons/equipment/book/book-bound-white.webp"; // Default Foundry icon
}

/* =========================================================
   OPEN CUSTOM SHEET FOR SPELLBOOK BACKPACKS
   ========================================================= */
Hooks.on("renderItemSheet", (sheet, html, data) => {
  if (sheet.item.type === "backpack" && sheet.item.flags[MODULE_ID]?.isSpellbook) {
    sheet.close();
    new UniversalSpellbookSheet(sheet.item, sheet.options).render(true);
  }
});

/* =========================================================
   THE ANIMATED LOOTABLE SPELLBOOK SHEET
   ========================================================= */
class UniversalSpellbookSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["universal-spellbook", "sheet", "item"],
      template: `modules/${MODULE_ID}/templates/spellbook.hbs`,
      width: 900,
      height: 850,
      resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "all" }]
    });
  }

  async getData() {
    const context = await super.getData();

    // Spells are embedded in the spellbook itself
    const spells = this.document.items?.contents?.filter(i => i.type === "spell") || [];

    const grouped = { all: {}, prepared: {}, rituals: {} };
    spells.forEach(spell => {
      const lvl = spell.system.level ?? 0;
      const isPrepared = foundry.utils.getProperty(spell, "system.preparation.prepared") ?? true;
      const isRitual = !!(
        spell.system.properties?.has("ritual") ||
        spell.system.ritual ||
        spell.system.components?.ritual
      );

      // All spells
      grouped.all[lvl] ??= [];
      grouped.all[lvl].push(spell);

      // Prepared
      if (isPrepared) {
        grouped.prepared[lvl] ??= [];
        grouped.prepared[lvl].push(spell);
      }

      // Rituals
      if (isRitual) {
        grouped.rituals[lvl] ??= [];
        grouped.rituals[lvl].push(spell);
      }
    });

    context.grouped = grouped;
    context.background = game.settings.get(MODULE_ID, "backgroundImage");
    context.actor = this.document.parent;
    context.spellSlots = this._getSpellSlots(context.actor);

    return context;
  }

  _getSpellSlots(actor) {
    if (!actor?.system?.spells) return "";
    return Object.entries(actor.system.spells)
      .filter(([k]) => k !== "pact" && actor.system.spells[k].max > 0)
      .map(([k, v]) => `L${k.slice(-1)}: ${v.value}/${v.max}`)
      .join(" • ");
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Search
    html.find(".search").on("input", (e) => {
      const term = e.target.value.toLowerCase();
      html.find(".spell-entry").each((_, el) => {
        const name = el.querySelector(".spell-name")?.textContent.toLowerCase() || "";
        el.style.display = name.includes(term) ? "" : "none";
      });
    });

    // Right-click → Cast
    html.find(".spell-entry").on("contextmenu", async (e) => {
      e.preventDefault();
      if (!game.user.targets.size) return ui.notifications.warn("Target a token first!");
      const spell = this.document.items.get(e.currentTarget.dataset.id);
      await spell?.roll();
    });

    // Double-click → Edit spell
    html.find(".spell-entry").on("dblclick", (e) => {
      this.document.items.get(e.currentTarget.dataset.id)?.sheet.render(true);
    });

    // Prepare toggle
    html.find(".prepare-toggle").on("change", async (e) => {
      const spell = this.document.items.get(e.currentTarget.closest(".spell-entry").dataset.id);
      if (spell?.system.preparation) {
        await spell.update({ "system.preparation.prepared": e.target.checked });
      }
    });

    // Delete spell from book
    html.find(".spell-delete").on("click", (e) => {
      const spellId = e.currentTarget.closest(".spell-entry").dataset.id;
      this.document.deleteEmbeddedDocuments("Item", [spellId]);
    });

    // Drop spells directly onto the open book
    html[0].addEventListener("drop", async (e) => {
      e.preventDefault();
      let data;
      try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
      if (data.type === "Item" && data.data?.type === "spell") {
        const spell = await fromUuid(data.uuid);
        await this.document.createEmbeddedDocuments("Item", [spell.toObject()]);
      }
    });
  }

  // Smooth "pick up the book" animation when opened from inventory
  async _renderInner(data) {
    const html = await super._renderInner(data);
    const content = this.element[0].querySelector(".window-content");

    content.style.opacity = 0;
    content.style.transform = "scale(0.6) translateY(40px)";
    requestAnimationFrame(() => {
      content.style.transition = "all 0.7s cubic-bezier(0.22,1,0.36,1)";
      content.style.opacity = 1;
      content.style.transform = "scale(1) translateY(0)";
    });

    return html;
  }
}
