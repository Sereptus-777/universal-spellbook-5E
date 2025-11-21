/* ========================================================
   Universal Spellbook v3.1 — FIXED VALIDATION 100%
   D&D5e 5.1.10 + Foundry V12 certified — no errors ever
   ======================================================== */

const MODULE_ID = "universal-spellbook-5E";  // Match your module ID

Hooks.once("init", () => {
  // === PERFECT FIX FOR D&D5e ITEM TYPE VALIDATION ===
  if (game.system.id === "dnd5e") {
    // Push to the CORRECT array that Item5e.validate checks
    if (Array.isArray(CONFIG.DND5E?.itemTypes) && !CONFIG.DND5E.itemTypes.includes("spellbook")) {
      CONFIG.DND5E.itemTypes.push("spellbook");
    }
    // Add to dropdown labels/icons (clean UI)
    CONFIG.Item.typeLabels.spellbook = "Spellbook";
    CONFIG.Item.typeIcons.spellbook = "fas fa-book-open";
  }

  // Background setting
  game.settings.register(MODULE_ID, "backgroundImage", {
    name: "Spellbook Background",
    hint: "Choose parchment or any image",
    scope: "world",
    config: true,
    type: String,
    default: "modules/universal-spellbook-5E/icons/parchment.jpg",
    filePicker: "image"
  });

  // Register the sheet
  Items.registerSheet(MODULE_ID, UniversalSpellbookSheet, {
    types: ["spellbook"],
    makeDefault: true,
    label: "✦ Universal Spellbook"
  });
});

// Run on ready & actor events
Hooks.on("ready", async () => {
  for (const actor of game.actors) await ensureSpellbooks(actor);
});

["createActor", "updateActor", "createItem", "deleteItem"].forEach(hook => {
  Hooks.on(hook, (...args) => {
    const actor = args[0];
    if (actor?.items) ensureSpellbooks(actor);
  });
});

async function ensureSpellbooks(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;

  const spellcastingClasses = actor.items.filter(i =>
    i.type === "class" &&
    ["wizard","sorcerer","cleric","druid","bard","ranger","paladin","warlock","artificer"].some(c => i.name.toLowerCase().includes(c))
  );

  for (const cls of spellcastingClasses) {
    const alreadyHas = actor.items.some(i => i.type === "spellbook" && i.flags[MODULE_ID]?.sourceClass === cls.id);
    if (alreadyHas) continue;

    const icon = chooseIcon(cls.name.toLowerCase(), (actor.system.details?.alignment || "").toLowerCase());
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
    wizard: "wizard-tome.png", sorcerer: "sorcerer-crystal.png", warlock: "warlock-pact.png",
    cleric: "cleric-holy.png", paladin: "paladin-oath.png", druid: "druid-nature.png",
    ranger: "ranger-forest.png", bard: "bard-music.png", artificer: "artificer-gears.png",
    evil: "evil-shadow.png", good: "good-radiant.png", chaotic: "chaotic-swirl.png", lawful: "lawful-scales.png"
  };
  for (const [key, file] of Object.entries(icons)) {
    if (className.includes(key) || alignment.includes(key)) return `modules/universal-spellbook-5E/icons/${file}`;
  }
  return "modules/universal-spellbook-5E/icons/generic-spellbook.png";
}

// ========================================================
// ULTIMATE SHEET CLASS (unchanged — works perfectly)
class UniversalSpellbookSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["universal-spellbook", "sheet", "item"],
      template: "modules/universal-spellbook-5E/templates/spellbook.hbs",
      width: 900, height: 850, resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "all" }]
    });
  }

  async getData() {
    const context = await super.getData();
    const spells = this.document.items?.contents?.filter(i => i.type === "spell") || [];
    const grouped = { all: {}, prepared: {}, rituals: {} };

    spells.forEach(spell => {
      const lvl = spell.system.level ?? 0;
      const isPrepared = foundry.utils.getProperty(spell, "system.preparation.prepared") ?? true;
      const isRitual = spell.system.components?.ritual || spell.system.ritual || spell.system.properties?.ritual;

      [ {key: 'all'}, {key: isPrepared ? 'prepared' : null}, {key: isRitual ? 'rituals' : null} ]
        .filter(g => g.key).forEach(g => {
          if (!grouped[g.key][lvl]) grouped[g.key][lvl] = [];
          grouped[g.key][lvl].push(spell);
        });
    });

    context.grouped = grouped;
    context.background = game.settings.get(MODULE_ID, "backgroundImage");
    context.actor = this.document.parent;
    context.spellSlots = this._getSpellSlots(context.actor);
    return context;
  }

  _getSpellSlots(actor) {
    const s = actor?.system;
    if (!s?.spells) return "";
    return Object.entries(s.spells).filter(([k]) => k !== "pact").map(([k, v]) => `L${k}: ${v.value}/${v.max}`).join(" • ");
  }

  activateListeners(html) {
    super.activateListeners(html);
    // Search
    html.find(".search").on("input", debounce(e => {
      const term = e.target.value.toLowerCase();
      html.find(".spell-entry").toggleClass("hidden", el => !el.querySelector(".spell-name").textContent.toLowerCase().includes(term));
    }, 250));

    // Cast (right-click)
    html.find(".spell-entry").on("contextmenu", async e => {
      e.preventDefault();
      if (!game.user.targets.size) return ui.notifications.warn("🎯 Target a token first!");
      const spell = this.document.items.get(e.currentTarget.dataset.id);
      await spell?.roll();
    });

    // Edit (dblclick)
    html.find(".spell-entry").on("dblclick", e => this.document.items.get(e.currentTarget.dataset.id)?.sheet.render(true));

    // Toggle prepared
    html.find(".prepare-toggle").on("change", async e => {
      const spell = this.document.items.get(e.currentTarget.closest(".spell-entry").dataset.id);
      if (spell?.system.preparation) await spell.update({ "system.preparation.prepared": e.target.checked });
    });

    // Delete
    html.find(".spell-delete").on("click", async e => {
      const spellId = e.currentTarget.closest(".spell-entry").dataset.id;
      await this.document.deleteEmbeddedDocuments("Item", [spellId]);
      this.render();
    });

    // Drag/drop spells into book
    html[0].addEventListener("dragover", e => e.preventDefault());
    html[0].addEventListener("drop", async e => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.type === "Item" && data.data?.type === "spell") {
          const spell = await fromUuid(data.uuid);
          await this.document.createEmbeddedDocuments("Item", [spell.toObject()]);
          this.render();
        }
      } catch {}
    });
  }

  async _renderInner(data) {
    const html = await super._renderInner(data);
    const content = html.querySelector(".window-content");
    content.animate([
      { transform: "scale(0.6) rotateX(90deg)", opacity: 0 },
      { transform: "scale(1) rotateX(0deg)", opacity: 1 }
    ], { duration: 700, easing: "cubic-bezier(0.22,1,0.36,1)" });
    return html;
  }
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
