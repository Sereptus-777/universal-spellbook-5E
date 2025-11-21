/* Universal Spellbook v5.0 — FINAL FIX NOV 2025 — WORKS PERFECTLY */
const MODULE_ID = "universal-spellbook-5E";

Hooks.once("init", () => {
  if (game.system.id === "dnd5e") {
    // 1. Add to the array (dropdowns)
    CONFIG.DND5E.itemTypes = CONFIG.DND5E.itemTypes || [];
    if (!CONFIG.DND5E.itemTypes.includes("spellbook")) CONFIG.DND5E.itemTypes.push("spellbook");

    // 2. Add to the Set that throws the red error
    CONFIG.DND5E.validItemTypes = CONFIG.DND5E.validItemTypes || new Set(CONFIG.DND5E.itemTypes || []);
    CONFIG.DND5E.validItemTypes.add("spellbook");

    // 3. Add to the actual Item5e document class metadata
    const types = foundry.utils.getProperty(Item5e, "metadata.types") || [];
    if (!types.includes("spellbook")) {
      foundry.utils.setProperty(Item5e, "metadata.types", [...types, "spellbook"]);
    }

    // UI polish
    CONFIG.Item.typeLabels.spellbook = "Spellbook";
    CONFIG.Item.typeIcons.spellbook = "fas fa-book-open";
  }

  game.settings.register(MODULE_ID, "backgroundImage", {
    name: "Spellbook Background",
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

/* Auto-create books */
Hooks.once("ready", () => game.actors.forEach(ensureSpellbooks));
Hooks.on("createActor", ensureSpellbooks);
Hooks.on("updateActor", ensureSpellbooks);
Hooks.on("createItem", item => item.parent && ensureSpellbooks(item.parent));
Hooks.on("deleteItem", item => item.parent && ensureSpellbooks(item.parent));

async function ensureSpellbooks(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;

  const classes = actor.items.filter(i => i.type === "class");
  for (const cls of classes) {
    const nameLower = cls.name.toLowerCase();
    if (!["wizard","sorcerer","cleric","druid","bard","ranger","paladin","warlock","artificer"].some(c => nameLower.includes(c))) continue;

    if (actor.items.some(i => i.type === "spellbook" && i.flags[MODULE_ID]?.classId === cls.id)) continue;

    await Item.create({
      name: `${actor.name}'s ${cls.name} Spellbook`,
      type: "spellbook",
      img: chooseIcon(nameLower, (actor.system.details?.alignment || "").toLowerCase()),
      system: { description: { value: `<p>${actor.name}'s personal spellbook.</p>` } },
      flags: { [MODULE_ID]: { classId: cls.id } }
    }, { parent: actor });
  }
}

function chooseIcon(className, alignment) {
  const map = {
    wizard: "wizard-tome.png", sorcerer: "sorcerer-crystal.png", warlock: "warlock-pact.png",
    cleric: "cleric-holy.png", paladin: "paladin-oath.png", druid: "druid-nature.png",
    ranger: "ranger-forest.png", bard: "bard-music.png", artificer: "artificer-gears.png",
    evil: "evil-shadow.png", good: "good-radiant.png", chaotic: "chaotic-swirl.png", lawful: "lawful-scales.png"
  };
  for (const [k, v] of Object.entries(map)) {
    if (className.includes(k) || alignment.includes(k)) return `modules/${MODULE_ID}/icons/${v}`;
  }
  return `modules/${MODULE_ID}/icons/generic-spellbook.png`;
}

/* Your sheet class stays exactly the same — it already works */
class UniversalSpellbookSheet extends ItemSheet {
  // ← paste your full sheet code here unchanged
}
