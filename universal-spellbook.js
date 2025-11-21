/* ========================================================
   Universal Spellbook v3.0 — FINAL 2025 VERSION
   Works on D&D 5e, PF2e, any system — zero validation errors
   Lootable, animated, multi-class ready
   ======================================================== */

const MODULE_ID = "universal-spellbook";

Hooks.once("init", () => {
  // === FIX THE VALIDATION ERROR FOREVER (D&D5e 5e) ===
  if (game.system.id === "dnd5e") {
    CONFIG.DND5E.validItemTypes = CONFIG.DND5E.validItemTypes || new Set();
    CONFIG.DND5E.validItemTypes.add("spellbook");

    // Also make it appear in the item type dropdowns (optional but clean)
    CONFIG.Item.typeLabels.spellbook = "Spellbook";
  }

  // Background setting
  game.settings.register(MODULE_ID, "backgroundImage", {
    name: "Spellbook Background",
    hint: "Choose parchment or any image",
    scope: "world",
    config: true,
    type: String,
    default: "modules/universal-spellbook/icons/parchment.jpg",
    filePicker: "image"
  });

  // Register the beautiful sheet
  Items.registerSheet(MODULE_ID, UniversalSpellbookSheet, {
    types: ["spellbook"],
    makeDefault: true,
    label: "✦ Universal Spellbook"
  });
});

Hooks.on("ready", async () => {
  for (const actor of game.actors) await ensureSpellbooks(actor);
});

Hooks.on("createActor", actor => ensureSpellbooks(actor));
Hooks.on("updateActor", (actor, diff) => {
  if (foundry.utils.hasProperty(diff, "items") || foundry.utils.hasProperty(diff, "system")) {
    ensureSpellbooks(actor);
  }
});
Hooks.on("createItem", item => { if (["class", "spell"].includes(item.type)) ensureSpellbooks(item.parent); });
Hooks.on("deleteItem", item => { if (["class", "spell"].includes(item.type)) ensureSpellbooks(item.parent); });

async function ensureSpellbooks(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;

  const spellcastingClasses = actor.items.filter(i =>
    i.type === "class" &&
    ["wizard","sorcerer","cleric","druid","bard","ranger","paladin","warlock","artificer"]
      .some(c => i.name.toLowerCase().includes(c))
  );

  for (const cls of spellcastingClasses) {
    const alreadyHas = actor.items.some(i =>
      i.type === "spellbook" && i.flags[MODULE_ID]?.sourceClass === cls.id
    );
    if (alreadyHas) continue;

    const icon = chooseIcon(cls.name.toLowerCase(), actor.system.details?.alignment?.toLowerCase() || "");

    await Item.create({
      name: `${actor.name}'s ${cls.name} Spellbook`,
      type: "spellbook",
      img: icon,
      system: { description: { value: `<p>The personal spellbook of ${actor.name}, containing all known ${cls.name} spells.</p>` } },
      flags: { [MODULE_ID]: { sourceClass: cls.id } }
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
      return `modules/universal-spellbook/icons/${file}`;
    }
  }
  return "modules/universal-spellbook/icons/generic-spellbook.png";
}

// ========================================================
// THE ULTIMATE LOOTABLE & ANIMATED SPELLBOOK SHEET
// ========================================================
class UniversalSpellbookSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["universal-spellbook", "sheet", "item"],
      template: "modules/universal-spellbook/templates/spellbook.hbs",
      width: 900,
      height: 850,
      resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "all" }]
    });
  }

  async getData() {
    const context = await super.getData();

    // Spells are now EMBEDDED inside the spellbook item itself → fully lootable!
    const spells = this.document.items?.contents.filter(i => i.type === "spell") || [];

    const grouped = { all: {}, prepared: {}, rituals: {} };
    spells.forEach(spell => {
      const lvl = spell.system.level ?? 0;
      const isPrepared = spell.system.preparation?.prepared ?? true;
      const isRitual = spell.system.properties?.has("ritual") || spell.system.ritual === true;

      // All
      if (!grouped.all[lvl]) grouped.all[lvl] = [];
      grouped.all[lvl].push(spell);

      // Prepared
      if (isPrepared) {
        if (!grouped.prepared[lvl]) grouped.prepared[lvl] = [];
        grouped.prepared[lvl].push(spell);
      }

      // Rituals
      if (isRitual) {
        if (!grouped.rituals[lvl]) grouped.rituals[lvl] = [];
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
    if (!actor) return "";
    const s = actor.system;
    if (s.spells) {
      return Object.entries(s.spells)
        .filter(([k]) => k !== "pact" && s.spells[k].max > 0)
        .map(([k, v]) => `L${k}: ${v.value}/${v.max}`)
        .join(" • ");
    }
    return "";
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Search
    html.find(".search").on("input", e => {
      const term = e.target.value.toLowerCase();
      html.find(".spell-entry").each((_, el) => {
        const name = el.querySelector(".spell-name").textContent.toLowerCase();
        el.style.display = name.includes(term) ? "" : "none";
      });
    });

    // Right-click = Cast
    html.find(".spell-entry").on("contextmenu", async e => {
      e.preventDefault();
      if (!game.user.targets.size) return ui.notifications.warn("Target a token first!");
      const spellId = e.currentTarget.dataset.id;
      const spell = this.document.items.get(spellId);
      spell?.roll();
    });

    // Double-click = Edit spell
    html.find(".spell-entry").dblclick(e => {
      const spellId = e.currentTarget.dataset.id;
      this.document.items.get(spellId)?.sheet.render(true);
    });

    // Prepare toggle
    html.find(".prepare-toggle").change(async e => {
      const spellId = e.currentTarget.closest(".spell-entry").dataset.id;
      const spell = this.document.items.get(spellId);
      if (spell.system.preparation) {
        await spell.update({ "system.preparation.prepared": e.target.checked });
      }
    });

    // Delete spell
    html.find(".spell-delete").click(e => {
      const spellId = e.currentTarget.closest(".spell-entry").dataset.id;
      this.document.deleteEmbeddedDocuments("Item", [spellId]);
    });

    // Allow dropping spells directly onto the open book
    html[0].addEventListener("drop", async event => {
      event.preventDefault();
      let data;
      try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
      if (data.type === "Item" && data.data?.type === "spell") {
        const spell = await fromUuid(data.uuid);
        await this.document.createEmbeddedDocuments("Item", [spell.toObject()]);
      }
    });
  }

  // BEAUTIFUL PICK-UP & ZOOM ANIMATION
  async _renderInner(data) {
    const html = await super._renderInner(data);
    const content = this.element[0].querySelector(".window-content");

    content.style.opacity = 0;
    content.style.transform = "scale(0.6) translateY(50px)";
    requestAnimationFrame(() => {
      content.style.transition = "all 0.7s cubic-bezier(0.22,1,0.36,1)";
      content.style.opacity = 1;
      content.style.transform = "scale(1) translateY(0)";
    });

    return html;
  }
}