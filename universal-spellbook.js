/* ========================================================
   Universal Spellbook v5.1 — FIXED VALIDATION ERROR 100%
   Works on Foundry V13 + D&D5e 5.1.10 — no red console spam
   ======================================================== */

const MODULE_ID = "universal-spellbook-5E";

Hooks.once("init", () => {
  // === THIS FIXES THE VALIDATION ERROR ===
  if (game.system.id === "dnd5e") {
    CONFIG.DND5E.itemTypes.push("spellbook");
    CONFIG.Item.typeLabels.spellbook = "Spellbook";
    CONFIG.Item.typeIcons.spellbook = "fas fa-book-open";
  }
  // =======================================

  game.settings.register(MODULE_ID, "backgroundImage", {
    name: "Spellbook Background Image",
    hint: "Choose a parchment or custom background for all spellbooks.",
    scope: "world",
    config: true,
    type: String,
    default: `modules/${MODULE_ID}/icons/parchment.jpg`,
    filePicker: "image"
  });

  Items.registerSheet(MODULE_ID, UniversalSpellbookSheet, {
    types: ["spellbook"],
    makeDefault: true,
    label: "✦ Universal Spellbook"
  });
});

/* =========================================================
   AUTO-CREATE SPELLBOOKS WHEN ACTOR HAS SPELLCASTING CLASS
   ========================================================= */
Hooks.once("ready", () => {
  game.actors.forEach(ensureSpellbooks);
});

Hooks.on("createActor", ensureSpellbooks);
Hooks.on("updateActor", (actor) => ensureSpellbooks(actor));
Hooks.on("createItem", (item) => item.parent && ensureSpellbooks(item.parent));
Hooks.on("deleteItem", (item) => item.parent && ensureSpellbooks(item.parent));

async function ensureSpellbooks(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;

  const spellcastingClasses = actor.items.filter(i =>
    i.type === "class" &&
    ["wizard","sorcerer","cleric","druid","bard","ranger","paladin","warlock","artificer"]
      .some(c => i.name.toLowerCase().includes(c))
  );

  for (const cls of spellcastingClasses) {
    // Avoid duplicates
    const hasBook = actor.items.some(i =>
      i.type === "spellbook" && i.flags[MODULE_ID]?.classId === cls.id
    );
    if (hasBook) continue;

    const classLower = cls.name.toLowerCase();
    const alignLower = (actor.system.details?.alignment || "").toLowerCase();

    await Item.create({
      name: `${actor.name}'s ${cls.name} Spellbook`,
      type: "spellbook",
      img: chooseIcon(classLower, alignLower),
      system: { description: { value: `<p>The personal spellbook of ${actor.name}, containing all known ${cls.name} spells.</p>` } },
      flags: { [MODULE_ID]: { classId: cls.id } }
    }, { parent: actor });
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
  return `modules/${MODULE_ID}/icons/generic-spellbook.png`;
}

/* =========================================================
   THE ANIMATED LOOTABLE SPELLBOOK SHEET
   (Spells are embedded inside the spellbook item → fully lootable!)
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
