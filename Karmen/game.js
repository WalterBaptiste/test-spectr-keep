"use strict";

const CONFIG = {
  maxCrowd: 500,
  maxItems: 2,
  storageKey: "spectr-karmen-story-v3",
  endpoint: "https://script.google.com/macros/s/AKfycbzrT1hwBcnNaSviDYW5s7slpVo1C8easqEdkCRe7TZ6gJU-Ewip72FoXDALimEQbx4/exec",
  music: {
    // Ajoute le MP3 dans dist/assets, puis indique ici par exemple : "assets/spectr-theme.mp3"
    src: "",
    title: "Spectr Radio",
    artist: "Morceau de la soirée"
  }
};

const AVATARS = [
  "AOUJ", "Senorita", "Driia", "Nolita", "GTK",
  "OG TT", "Raver", "Lakaii", "Blanka", "Invité mystère"
];

const ITEMS = {
  headphones: { icon: "🎧", name: "Casque", desc: "Tu entends ce que les autres ratent.", stat: "music" },
  water: { icon: "💧", name: "Gourde", desc: "Le vrai objet légendaire d’une soirée.", stat: "care" },
  powerbank: { icon: "🔋", name: "Batterie", desc: "Plus personne ne tombe à 1 %.", stat: "care" },
  camera: { icon: "📷", name: "Caméra", desc: "Pour garder une trace de l’imprévisible.", stat: "vibe" },
  pass: { icon: "★", name: "Pin’s étoile", desc: "Il ressemble étrangement à un pass.", stat: "audacity" }
};

const DEFAULT_STATE = () => ({
  version: 3,
  screen: "intro",
  avatar: 0,
  name: "",
  startedAt: null,
  inventory: [],
  stats: { care: 0, audacity: 0, music: 0, vibe: 0 },
  crowd: 60,
  lateness: 0,
  knowledge: 0,
  exteriorTried: [],
  exteriorChoice: null,
  metGuide: false,
  entryChoice: null,
  barActions: [],
  route: null,
  routeChoice: null,
  clubIntroSeen: false,
  clubChoice: null,
  combo: null,
  finalProfile: null,
  sent: false
});

let state = DEFAULT_STATE();
let soundOn = true;
let toastTimer = null;
let audioCtx = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const screens = {
  intro: $("#introScreen"),
  creator: $("#creatorScreen"),
  exterior: $("#exteriorScreen"),
  entrance: $("#entranceScreen"),
  bar: $("#barScreen"),
  stairs: $("#stairsScreen"),
  route: $("#routeScreen"),
  club: $("#clubScreen"),
  final: $("#finalScreen")
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hasItem(id) {
  return state.inventory.includes(id);
}

function addStat(key, amount = 1) {
  state.stats[key] = Math.max(0, (state.stats[key] || 0) + amount);
}

function addCrowd(amount) {
  state.crowd = clamp(state.crowd + amount, 0, CONFIG.maxCrowd);
  updateHud();
}

function addLateness(amount) {
  state.lateness = Math.max(0, state.lateness + amount);
}

function addKnowledge(amount) {
  state.knowledge = Math.max(0, state.knowledge + amount);
}

function addCombo(label) {
  if (!label) return;
  if (!state.combo) state.combo = label;
  else if (!state.combo.includes(label)) state.combo += ` + ${label}`;
}

function playTone(kind = "tap") {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    const presets = {
      tap: [220, .045, "square"],
      good: [520, .09, "square"],
      great: [760, .14, "triangle"],
      bad: [120, .1, "sawtooth"]
    };
    const [freq, duration, type] = presets[kind] || presets.tap;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (kind === "great") osc.frequency.exponentialRampToValueAtTime(980, now + duration);
    gain.gain.setValueAtTime(.035, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch (_) {}
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function saveGame() {
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch (_) {}
  updateResumeButton();
}

function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 3) return false;
    state = { ...DEFAULT_STATE(), ...parsed };
    state.stats = { ...DEFAULT_STATE().stats, ...(parsed.stats || {}) };
    state.inventory = Array.isArray(parsed.inventory) ? parsed.inventory : [];
    return true;
  } catch (_) {
    return false;
  }
}

function clearGame() {
  try { localStorage.removeItem(CONFIG.storageKey); } catch (_) {}
}

function updateResumeButton() {
  let resumable = false;
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "null");
    resumable = Boolean(data && data.version === 3 && data.screen !== "intro");
  } catch (_) {}
  $("#resumeBtn").hidden = !resumable;
}

function showScreen(name, persist = true) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
  state.screen = name;
  if (persist) saveGame();
  window.scrollTo({ top: 0, behavior: "instant" });
  renderAll();
}

function updateHud() {
  $("#crowdValue").textContent = `${state.crowd} / ${CONFIG.maxCrowd}`;
  $("#crowdFill").style.width = `${(state.crowd / CONFIG.maxCrowd) * 100}%`;
}

function prepareAvatarElement(element, avatar) {
  element.dataset.avatar = String(avatar);
  element.classList.add("legacy");
  element.setAttribute("aria-label", AVATARS[avatar] || "Personnage");
}

function renderAvatarState() {
  $$(".current-avatar").forEach(element => prepareAvatarElement(element, state.avatar));
  $$(".avatar-option").forEach(button => {
    const selected = Number(button.dataset.avatarChoice) === state.avatar;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  $("#playerName").value = state.name || "";
}

function renderInventory() {
  $$("[data-inventory]").forEach(container => {
    if (!state.inventory.length) {
      container.innerHTML = '<span class="inventory-label">Sac :</span><span class="empty-bag">vide — fouille le bar</span>';
      return;
    }
    container.innerHTML = '<span class="inventory-label">Sac :</span>' + state.inventory.map(id => {
      const item = ITEMS[id];
      return `<span class="item-pill"><strong>${item.icon}</strong>${item.name}</span>`;
    }).join("");
  });
}

function renderRouteScene() {
  if (!state.route || state.route === "sound") return;
  const image = $("#routeImage");
  const person = $("#routePersonBtn");
  const detail = $("#routeDetailBtn");
  const exit = $("#routeExitBtn");

  if (state.route === "expo") {
    image.src = "assets/venue-gallery.webp";
    image.alt = "Le couloir d’exposition du Karmen Camina.";
    $("#routeTitle").textContent = "L’expo · 21:13 · Un badge a disparu";
    $("#routeObjective").innerHTML = "<b>Mission :</b> quelqu’un a perdu son badge. Aide, observe… ou descends au son.";
    setHotspot(person, "Personne", "21%", "54%", "Parler à la personne qui a perdu son badge");
    setHotspot(detail, "Les œuvres", "63%", "43%", "Observer l’exposition");
    setHotspot(exit, "Vers le son", "92%", "70%", "Quitter l’exposition pour rejoindre le son");
  } else {
    image.src = "assets/venue-terrace.webp";
    image.alt = "La terrasse du Karmen Camina.";
    $("#routeTitle").textContent = "La terrasse · 21:11 · Conversation dangereuse";
    $("#routeObjective").innerHTML = "<b>Mission :</b> une connaissance veut tout te raconter et quelqu’un cherche son sac.";
    setHotspot(person, "Bavard·e", "72%", "50%", "Parler à la connaissance très bavarde");
    setHotspot(detail, "Sac perdu", "45%", "72%", "Aider à retrouver un sac perdu");
    setHotspot(exit, "Escalier", "8%", "76%", "Quitter la terrasse pour rejoindre le son");
  }
}

function setHotspot(button, label, x, y, aria) {
  button.style.setProperty("--x", x);
  button.style.setProperty("--y", y);
  button.querySelector("span").textContent = label;
  button.setAttribute("aria-label", aria);
}

function renderAll() {
  updateHud();
  renderAvatarState();
  renderInventory();
  renderRouteScene();
  $$("[data-lateness]").forEach(el => { el.textContent = `${state.lateness} min`; });
  $$("[data-knowledge]").forEach(el => { el.textContent = `${state.knowledge} pts`; });
  $$("[data-exterior-action]").forEach(btn => {
    btn.classList.toggle("used", state.exteriorTried.includes(btn.dataset.exteriorAction));
  });
  $$("[data-bar-action]").forEach(btn => {
    btn.classList.toggle("used", state.barActions.includes(btn.dataset.barAction));
  });
}

function buildAvatarGrid() {
  $("#avatarGrid").innerHTML = AVATARS.map((label, index) => `
    <button class="avatar-option${index === state.avatar ? " selected" : ""}" type="button"
            data-avatar-choice="${index}" aria-label="Choisir ${label}" aria-pressed="${index === state.avatar}">
      <div class="avatar-sprite legacy" data-avatar="${index}" aria-hidden="true"></div>
      <span class="avatar-name">${label}</span>
    </button>
  `).join("");
}

function showDialog({ kicker = "", title = "", text = "", choices = [], closable = true, onClose = null }) {
  const layer = $("#dialogLayer");
  $("#dialogKicker").textContent = kicker;
  $("#dialogTitle").textContent = title;
  $("#dialogText").textContent = text;
  $("#dialogClose").hidden = !closable;
  const choicesBox = $("#dialogChoices");
  choicesBox.innerHTML = "";

  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn" + (choice.chosen ? " chosen" : "");
    button.disabled = Boolean(choice.disabled);
    button.innerHTML = `
      <span><strong>${choice.label}</strong>${choice.sub ? `<small>${choice.sub}</small>` : ""}</span>
      <span class="choice-icon" aria-hidden="true">${choice.icon || "→"}</span>
    `;
    button.addEventListener("click", () => {
      playTone(choice.tone || "tap");
      if (choice.onClick) choice.onClick();
    });
    choicesBox.appendChild(button);
  });

  layer.hidden = false;
  layer._onClose = onClose;
  requestAnimationFrame(() => {
    const focusTarget = choicesBox.querySelector("button:not(:disabled)") || $("#dialogClose");
    if (focusTarget) focusTarget.focus();
  });
}

function closeDialog() {
  const layer = $("#dialogLayer");
  layer.hidden = true;
  if (typeof layer._onClose === "function") {
    const fn = layer._onClose;
    layer._onClose = null;
    fn();
  }
}

function markOnce(listName, action) {
  if (state[listName].includes(action)) return false;
  state[listName].push(action);
  saveGame();
  return true;
}

function toggleItem(id) {
  if (hasItem(id)) {
    state.inventory = state.inventory.filter(item => item !== id);
    addStat(ITEMS[id].stat, -1);
    playTone("bad");
  } else {
    if (state.inventory.length >= CONFIG.maxItems) {
      showToast("Ton sac est plein : retire d’abord un objet.");
      playTone("bad");
      return;
    }
    state.inventory.push(id);
    addStat(ITEMS[id].stat, 1);
    playTone("good");
  }
  saveGame();
  renderAll();
}

function handleExterior(action) {
  if (state.exteriorChoice) return;
  const first = markOnce("exteriorTried", action);

  if (action === "child") {
    if (first) {
      state.metGuide = true;
      addStat("care", 2);
      addKnowledge(1);
      addCrowd(10);
      saveGame();
    }
    showDialog({
      kicker: "PNJ anonymisé",
      title: "Le petit guide pixelisé",
      text: "« Je garde mon identité secrète… mais l’entrée, c’est la porte tout à gauche. Pas les grandes vitres, pas la terrasse. »",
      choices: [{ label: "Merci, petit guide", sub: "+1 Culture · La porte de gauche clignote", icon: "←", tone: "good", onClick: closeDialog }]
    });
    return;
  }

  if (action === "windows" || action === "terrace") {
    if (first) addLateness(2);
    saveGame();
    showDialog({
      kicker: first ? "+2 min de détour" : "Déjà essayé",
      title: action === "windows" ? "Très belles fenêtres" : "Bonne terrasse, mauvaise entrée",
      text: action === "windows"
        ? "Tu vois la salle derrière les vitres, mais aucune poignée. Un petit personnage semble vouloir t’indiquer quelque chose."
        : "Tu contournes les tables. Ça sent la discussion de trente minutes, mais l’entrée de la soirée n’est pas ici.",
      choices: [{ label: "Revenir devant le bâtiment", icon: "↶", onClick: closeDialog }]
    });
    renderAll();
    return;
  }

  state.exteriorChoice = "left-door";
  addCrowd(state.metGuide ? 25 : 15);
  addStat(state.metGuide ? "care" : "audacity", 1);
  saveGame();
  showDialog({
    kicker: "Bonne porte",
    title: state.metGuide ? "Le petit guide avait raison" : "Pur instinct",
    text: state.metGuide
      ? "La porte de gauche s’ouvre. Tu salues une dernière fois le PNJ en mosaïque et entres dans le couloir."
      : "Tu tentes directement la petite porte à gauche. Elle s’ouvre : première épreuve réussie sans indice.",
    closable: false,
    choices: [{
      label: "Entrer dans le Karmen",
      sub: "Le physio t’attend au bout du couloir.",
      icon: "→",
      tone: "great",
      onClick: () => { closeDialog(); startEntrance(); }
    }]
  });
}

function startEntrance() {
  showScreen("entrance");
  setTimeout(() => {
    if (!state.entryChoice) showPhysioDialog();
  }, 180);
}

function showPhysioDialog() {
  showDialog({
    kicker: "Le physio",
    title: "Bonsoir. Ton billet ?",
    text: "Le physio explique calmement la file, le vestiaire et le respect du lieu. Il attend ta réponse.",
    closable: true,
    choices: [
      { label: "Bonsoir ! Oui, billet prêt.", sub: "Tu écoutes, tu souris, écran déjà ouvert.", icon: "✓", tone: "great", onClick: () => resolveEntry("ready") },
      { label: "Oui… il est au fond du sac.", sub: "Il faut tout vider devant la porte.", icon: "⌕", onClick: () => resolveEntry("bag") },
      { label: "Pas encore. Je peux l’acheter ici ?", sub: "Franc, poli, mais passage par la billetterie.", icon: "€", onClick: () => resolveEntry("buy") },
      { label: "Je connais quelqu’un de l’orga.", sub: "Le classique qui ne remplace pas un billet.", icon: "?", tone: "bad", onClick: () => resolveEntry("friend") }
    ]
  });
}

function resolveEntry(choice) {
  if (state.entryChoice) return;
  const outcomes = {
    ready: { title: "Entrée fluide", text: "Tu as écouté, répondu avec le sourire et préparé ton billet. Le physio te souhaite une bonne soirée.", crowd: 45, late: 0, stat: "care", statGain: 2, knowledge: 1 },
    bag: { title: "Le grand déballage", text: "Billet retrouvé sous trois câbles et un chewing-gum. Le physio reste patient. Tu passes enfin.", crowd: 30, late: 5, stat: "vibe", statGain: 1, knowledge: 0 },
    buy: { title: "Direction billetterie", text: "Bonne réponse : mieux vaut être honnête. Le physio t’indique le comptoir et garde ta place dans la file.", crowd: 25, late: 10, stat: "care", statGain: 2, knowledge: 1 },
    friend: { title: "La liste imaginaire", text: "Le physio vérifie. Puis revérifie. Ton nom n’est nulle part : tu achètes ton billet comme tout le monde, un peu plus tard.", crowd: 8, late: 15, stat: "audacity", statGain: 2, knowledge: 0 }
  };
  const result = outcomes[choice];
  state.entryChoice = choice;
  addCrowd(result.crowd);
  addLateness(result.late);
  addKnowledge(result.knowledge);
  addStat(result.stat, result.statGain);
  saveGame();
  closeDialog();
  showDialog({
    kicker: result.late ? `+${result.late} min · +${result.crowd} public` : `Sans retard · +${result.crowd} public`,
    title: result.title,
    text: result.text,
    closable: false,
    choices: [{ label: "Passer au bar", sub: "Deux objets pourront changer la suite.", icon: "→", tone: "good", onClick: () => { closeDialog(); showScreen("bar"); } }]
  });
}

function handleEntrance(action) {
  if (action === "physio") {
    if (state.entryChoice) showToast("Le physio t’a déjà laissé passer.");
    else showPhysioDialog();
  } else if (!state.entryChoice) {
    showToast("D’abord, écoute le physio.");
    playTone("bad");
    showPhysioDialog();
  } else {
    showScreen("bar");
  }
}

function openItemPicker(source) {
  const sourceItems = {
    tables: ["headphones", "camera"],
    counter: ["powerbank", "camera"],
    shelves: ["water", "headphones"],
    dog: ["pass"]
  };
  const titles = {
    tables: "Les tables du bar",
    counter: "Derrière le comptoir",
    shelves: "L’étagère de survie",
    dog: "Le gardien à quatre pattes"
  };
  const ids = sourceItems[source] || [];

  const render = () => {
    showDialog({
      kicker: `Sac · ${state.inventory.length} / ${CONFIG.maxItems}`,
      title: titles[source] || "Une trouvaille",
      text: source === "dog"
        ? "Le chien surveille un étrange pin’s tombé au sol. Tu peux le prendre… si tu lui rends son regard."
        : "Ton sac ne peut contenir que 2 objets. Certaines associations débloquent des scènes cachées.",
      choices: [
        ...ids.map(id => ({
          label: `${ITEMS[id].icon} ${ITEMS[id].name}`,
          sub: hasItem(id) ? "Dans ton sac — clique pour retirer" : ITEMS[id].desc,
          icon: hasItem(id) ? "−" : "+",
          chosen: hasItem(id),
          onClick: () => { toggleItem(id); render(); }
        })),
        { label: state.inventory.length === CONFIG.maxItems ? "Sac prêt" : "Continuer à fouiller", sub: state.inventory.length === CONFIG.maxItems ? "Deux objets, pas un de plus." : "Tu peux revenir plus tard.", icon: "✓", onClick: closeDialog }
      ]
    });
  };
  render();
}

function handleBar(action) {
  const first = markOnce("barActions", action);

  if (action === "wall") {
    if (first) { addKnowledge(1); addStat("music", 1); }
    saveGame();
    renderAll();
    showDialog({
      kicker: first ? "+1 Culture" : "Déjà observé",
      title: "Le lieu garde les traces",
      text: first ? "Sous les carreaux, les affiches et les marques du mur, tu devines les soirées passées du Karmen." : "Le mur ne donnera pas un deuxième point, même en le fixant très fort.",
      choices: [{ label: "Continuer", icon: "✓", onClick: closeDialog }]
    });
    return;
  }

  if (["tables", "counter", "shelves", "dog"].includes(action)) {
    openItemPicker(action);
    return;
  }

  if (action === "exit") {
    if (state.inventory.length !== CONFIG.maxItems) {
      showDialog({
        kicker: "Avant l’escalier",
        title: "Ton sac n’est pas prêt",
        text: `Tu as ${state.inventory.length} objet${state.inventory.length > 1 ? "s" : ""}. Choisis-en exactement 2 sur les tables, au comptoir, aux étagères ou près du chien.`,
        choices: [{ label: "Retourner fouiller", icon: "⌕", onClick: closeDialog }]
      });
      playTone("bad");
      return;
    }
    showDialog({
      kicker: "Sac verrouillé",
      title: `${state.inventory.map(id => ITEMS[id].name).join(" + ")}`,
      text: "Tu quittes le bar et arrives au pied d’un escalier. La basse vient d’en bas, mais deux détours te font de l’œil.",
      closable: false,
      choices: [{ label: "Voir les trois chemins", icon: "→", tone: "great", onClick: () => { closeDialog(); startStairs(); } }]
    });
  }
}

function startStairs() {
  showScreen("stairs");
  setTimeout(() => {
    showDialog({
      kicker: "Point de décision",
      title: "En bas, en haut ou à gauche ?",
      text: "La basse vient clairement d’en bas. En haut : l’exposition. À gauche : la terrasse. Chaque détour peut apporter quelque chose… ou te faire rater une partie de la nuit.",
      choices: [{ label: "Choisir directement sur la photo", sub: "Les trois petits marqueurs sont cliquables.", icon: "⌕", onClick: closeDialog }]
    });
  }, 180);
}

function chooseRoute(route) {
  if (state.route) return;
  state.route = route;

  if (route === "sound") {
    addCrowd(40);
    addStat("music", 2);
    addCombo("Premier kick");
    saveGame();
    showDialog({
      kicker: "Chemin direct · aucun retard ajouté",
      title: "La basse gagne",
      text: "Tu descends sans te retourner. Le premier vrai kick te cueille au bas des marches : tu n’as rien vu de l’expo, mais tu n’as rien raté du set.",
      closable: false,
      choices: [{ label: "Entrer dans la salle", icon: "↓", tone: "great", onClick: () => { closeDialog(); startClub(); } }]
    });
    return;
  }

  if (route === "expo") {
    addLateness(10);
    addKnowledge(1);
    addStat("music", 1);
  } else {
    addLateness(8);
    addStat("vibe", 1);
  }
  saveGame();
  showScreen("route");
  setTimeout(() => {
    showDialog({
      kicker: route === "expo" ? "+10 min · +1 Culture" : "+8 min",
      title: route === "expo" ? "Tu montes vers l’exposition" : "Tu pousses la porte de la terrasse",
      text: route === "expo"
        ? "Une personne cherche son badge au milieu des œuvres. Tu peux aider, regarder… ou faire demi-tour."
        : "À peine dehors, une connaissance t’attrape dans une conversation. Plus loin, quelqu’un cherche son sac.",
      choices: [{ label: "Explorer ce détour", icon: "⌕", onClick: closeDialog }]
    });
  }, 180);
}

function completeRoute(result) {
  state.routeChoice = result.id;
  addLateness(result.late || 0);
  addKnowledge(result.knowledge || 0);
  addCrowd(result.crowd || 0);
  Object.entries(result.stats || {}).forEach(([key, value]) => addStat(key, value));
  addCombo(result.combo);
  saveGame();
  renderAll();
  showDialog({
    kicker: `${result.late ? `+${result.late} min` : "Pas de détour"} · +${result.crowd || 0} public`,
    title: result.title,
    text: result.text + (result.combo ? `\n\nCOMBO — ${result.combo}` : ""),
    closable: false,
    choices: [{ label: "Rejoindre enfin le son", sub: `Retard cumulé : ${state.lateness} min`, icon: "↓", tone: "great", onClick: () => { closeDialog(); startClub(); } }]
  });
}

function handleRoute(action) {
  if (state.routeChoice) {
    showToast("Ce détour est terminé. Le son t’attend.");
    return;
  }

  if (state.route === "expo") {
    if (action === "person") {
      showDialog({
        kicker: "Quête secondaire · Badge perdu",
        title: "« Tu peux m’aider ? »",
        text: "Le badge est tombé quelque part devant les œuvres. La musique commence en bas.",
        choices: [
          { label: "Chercher avec la personne", sub: "+12 min · beaucoup de Culture et de bienveillance", icon: "⌕", onClick: () => { closeDialog(); completeRoute({ id: "help-badge", title: "Badge retrouvé", text: "Vous refaites le couloir ensemble. Le badge était coincé sous le grand cartel — et tu repars avec toute l’histoire de l’expo.", late: 12, knowledge: 3, crowd: 55, stats: { care: 3, music: 1 } }); } },
          { label: "Prêter ton Pin’s étoile", sub: hasItem("pass") ? "Combo rapide · le badge peut attendre" : "Il faudrait avoir pris le Pin’s au bar", icon: "★", disabled: !hasItem("pass"), tone: "great", onClick: () => { closeDialog(); completeRoute({ id: "loan-pass", title: "Pass de secours", text: "Ton Pin’s ressemble assez au badge pour débloquer la situation. Vous descendez ensemble avant le prochain morceau.", late: 5, knowledge: 2, crowd: 80, stats: { audacity: 3, care: 2 }, combo: "Étoile de secours" }); } },
          { label: "Donner un indice puis descendre", sub: "+5 min · petit bonus Culture", icon: "→", onClick: () => { closeDialog(); completeRoute({ id: "hint-badge", title: "Indice transmis", text: "Tu montres la zone où tu as vu briller quelque chose, puis tu files. Quelques minutes plus tard, un cri confirme que ça a marché.", late: 5, knowledge: 1, crowd: 30, stats: { vibe: 1 } }); } }
        ]
      });
      return;
    }

    if (action === "detail") {
      showDialog({
        kicker: "L’exposition",
        title: "Jusqu’où vas-tu regarder ?",
        text: "Chaque image raconte une nuit, une personne ou un morceau. En bas, la basse devient plus forte.",
        choices: [
          { label: "Tout lire, vraiment tout", sub: "+22 min · +5 Culture", icon: "◎", onClick: () => { closeDialog(); completeRoute({ id: "read-all", title: "Visite complète", text: "Tu connais maintenant les références, les artistes et les histoires derrière chaque image. Le set a bien commencé sans toi.", late: 22, knowledge: 5, crowd: 50, stats: { music: 3 } }); } },
          { label: "Choisir une œuvre", sub: "+9 min · +2 Culture", icon: "◈", onClick: () => { closeDialog(); completeRoute({ id: "one-work", title: "Une image reste", text: "Tu prends le temps d’une seule œuvre. Assez pour apprendre quelque chose, pas assez pour oublier complètement le dancefloor.", late: 9, knowledge: 2, crowd: 38, stats: { vibe: 2 } }); } }
        ]
      });
      return;
    }

    completeRoute({ id: "skip-expo", title: "Photo mentale", text: "Un dernier regard sur le mur, puis tu suis la vibration de l’escalier.", late: 3, knowledge: 1, crowd: 22, stats: { audacity: 1 } });
    return;
  }

  if (action === "person") {
    showDialog({
      kicker: "Piège social",
      title: "« Attends, je te raconte… »",
      text: "La phrase commence en 2019, passe par trois afters et ne semble pas avoir de fin.",
      choices: [
        { label: "Écouter toute l’histoire", sub: "+35 min · tu rates une grosse partie du set", icon: "∞", onClick: () => { closeDialog(); completeRoute({ id: "long-chat", title: "L’histoire sans fin", text: "Tu connais désormais toute la généalogie du crew. Quand tu redescends, la soirée est déjà bien lancée — mais quelle anecdote.", late: 35, knowledge: 2, crowd: 55, stats: { vibe: 4, care: 1 }, combo: "Prisonnier·e de la terrasse" }); } },
        { label: "Couper gentiment", sub: "+8 min · propre et efficace", icon: "✓", onClick: () => { closeDialog(); completeRoute({ id: "kind-exit", title: "Sortie élégante", text: "Tu promets de reprendre la conversation plus tard et redescends sans froisser personne.", late: 8, knowledge: 1, crowd: 42, stats: { care: 3 } }); } },
        { label: "« Mon téléphone est à 1 % ! »", sub: "+5 min · audacieux, surtout avec une batterie dans le sac", icon: "🔋", onClick: () => { closeDialog(); completeRoute({ id: "phone-excuse", title: "L’excuse à 1 %", text: hasItem("powerbank") ? "Ta batterie dépasse du sac pendant que tu prononces la phrase. La personne l’a vue. Vous riez, puis tu files quand même." : "L’excuse fonctionne. Tu disparais vers l’escalier avant la question suivante.", late: 5, knowledge: 0, crowd: hasItem("powerbank") ? 52 : 32, stats: { audacity: 3, vibe: hasItem("powerbank") ? 2 : 0 }, combo: hasItem("powerbank") ? "Mensonge chargé à 100 %" : null }); } }
      ]
    });
    return;
  }

  if (action === "detail") {
    showDialog({
      kicker: "Quête secondaire · Sac perdu",
      title: "Un sac noir, forcément",
      text: "Quelqu’un ne retrouve plus son sac parmi les chaises. Le dancefloor peut attendre quelques minutes… peut-être.",
      choices: [
        { label: "Aider à le chercher", sub: "+18 min · gros bonus crew", icon: "⌕", onClick: () => { closeDialog(); completeRoute({ id: "find-bag", title: "Sac retrouvé", text: hasItem("camera") ? "En zoomant sur une photo prise en arrivant, tu repères la sangle derrière une chaise. Recherche express." : "Après avoir déplacé beaucoup trop de chaises, vous retrouvez le sac sous la table la plus évidente.", late: hasItem("camera") ? 10 : 18, knowledge: 1, crowd: hasItem("camera") ? 85 : 62, stats: { care: 4, vibe: hasItem("camera") ? 2 : 0 }, combo: hasItem("camera") ? "Replay détective" : null }); } },
        { label: "Prévenir l’accueil", sub: "+7 min · solution collective", icon: "!", onClick: () => { closeDialog(); completeRoute({ id: "call-desk", title: "Relais efficace", text: "Tu transmets une description précise à l’accueil et laisses le réseau du lieu faire son travail.", late: 7, knowledge: 1, crowd: 40, stats: { care: 2 } }); } }
      ]
    });
    return;
  }

  completeRoute({ id: "skip-terrace", title: "Demi-tour stratégique", text: "Tu salues de loin, évites les chaises et retrouves l’escalier avant d’être happé·e.", late: 4, knowledge: 0, crowd: 24, stats: { audacity: 1 } });
}

function formatArrival() {
  const total = 21 * 60 + 12 + state.lateness;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function startClub() {
  showScreen("club");
  $("#clubTitle").textContent = `Système son · ${formatArrival()} · Enfin`;
  const routeText = {
    sound: "Tu as suivi la basse : tu es là dès le premier kick.",
    expo: `Tu arrives avec ${state.lateness} min de retard et ${state.knowledge} points de Culture.`,
    terrace: `Tu arrives avec ${state.lateness} min de retard et une histoire de terrasse à raconter.`
  }[state.route] || "Tu arrives enfin devant le système son.";
  $("#clubObjective").innerHTML = `<b>Final :</b> ${routeText} Choisis comment tu entres dans la danse.`;
  saveGame();

  if (!state.clubIntroSeen) {
    state.clubIntroSeen = true;
    saveGame();
    setTimeout(() => {
      showDialog({
        kicker: `Arrivée · ${formatArrival()}`,
        title: state.lateness >= 35 ? "Tu as raté une partie… pas toute la nuit" : "Le système son est devant toi",
        text: `${routeText}\n\nUne personne du crew cherche de l’aide, la cabine s’active et la foule ouvre un passage. Ton dernier choix définira ton profil.`,
        choices: [{ label: "Choisir sur la photo", icon: "⌕", onClick: closeDialog }]
      });
    }, 180);
  }
}

function resolveClub(action) {
  if (state.clubChoice) {
    showToast("Ton histoire est déjà écrite.");
    return;
  }

  const map = {
    crowd: { title: "Au milieu du mouvement", text: "Tu rejoins le public et transformes l’espace autour de toi en mini dancefloor.", crowd: 135, stats: { vibe: 4 } },
    booth: { title: "Près de la cabine", text: "Tu repères un câble mal rangé, aides sans gêner et restes pour la transition suivante.", crowd: 155, stats: { music: 4, care: 1 } },
    speaker: { title: "Face au caisson", text: "Tu trouves exactement l’endroit où le son est puissant sans avaler tous les détails.", crowd: 145, stats: { music: 3, audacity: 1 } },
    crew: { title: "Le crew d’abord", text: "Une personne cherche une rallonge et de l’eau. Tu poses ton sac et aides avant de danser.", crowd: 150, stats: { care: 4, vibe: 1 } }
  };
  const result = map[action];
  let bonus = state.knowledge * 5;
  const penalty = Math.min(90, state.lateness * 2);
  const notes = [];

  if (action === "crowd" && hasItem("camera")) {
    bonus += 35;
    result.stats.vibe += 2;
    addCombo("Souvenir collectif");
    notes.push("ta Caméra rassemble tout le monde dans le même souvenir");
  }
  if (action === "crowd" && hasItem("water")) {
    bonus += 20;
    result.stats.care = (result.stats.care || 0) + 2;
    notes.push("ta Gourde sauve le premier rang");
  }
  if ((action === "booth" || action === "speaker") && hasItem("headphones")) {
    bonus += 45;
    result.stats.music += 3;
    addCombo("Oreille absolue");
    notes.push("ton Casque révèle le détail que personne n’entendait");
  }
  if (action === "booth" && hasItem("powerbank")) {
    bonus += 35;
    result.stats.care += 2;
    addCombo("Régie de poche");
    notes.push("ta Batterie alimente le contrôleur de secours");
  }
  if (action === "crew" && hasItem("water")) {
    bonus += 40;
    result.stats.care += 3;
    addCombo("Hydratation légendaire");
    notes.push("la Gourde arrive exactement au bon moment");
  }
  if (action === "crew" && hasItem("powerbank")) {
    bonus += 35;
    result.stats.care += 3;
    addCombo("Crew à 100 %");
    notes.push("la Batterie remet le téléphone du crew en vie");
  }
  if (hasItem("water") && hasItem("powerbank")) {
    bonus += 20;
    addCombo("Kit de survie");
  }

  const gained = Math.max(45, result.crowd + bonus - penalty);
  state.clubChoice = action;
  Object.entries(result.stats).forEach(([key, value]) => addStat(key, value));
  addCrowd(gained);
  saveGame();
  playTone(gained >= 160 ? "great" : "good");

  showDialog({
    kicker: `Final · +${gained} public`,
    title: result.title,
    text: `${result.text}${notes.length ? `\n\nBONUS OBJET — ${notes.join(" · ")}` : ""}${penalty ? `\n\nRETARD — ton détour coûte ${penalty} points, mais tes découvertes en récupèrent ${state.knowledge * 5}.` : ""}`,
    closable: false,
    choices: [{ label: "Découvrir mon profil", sub: "Et générer ma carte Story avec mon personnage.", icon: "★", tone: "great", onClick: async () => { closeDialog(); await finishGame(); } }]
  });
}

function getProfile() {
  const entries = Object.entries(state.stats).sort((a, b) => b[1] - a[1]);
  const top = entries[0] || ["vibe", 0];
  const second = entries[1] || ["music", 0];

  if (state.lateness >= 40) {
    return { name: "Légende de la terrasse", copy: "Tu as raté des morceaux, mais gagné une histoire impossible à résumer. Chez toi, le détour fait partie de la soirée." };
  }
  if (state.knowledge >= 7) {
    return { name: "Curateur·ice du dancefloor", copy: "Tu ne viens pas seulement danser : tu regardes, tu comprends et tu relis les images au son. La fête a maintenant des notes de bas de page." };
  }
  if (state.route === "sound" && state.lateness <= 4 && state.stats.music >= 4) {
    return { name: "Premier kick du Karmen", copy: "Tu reconnais une basse à travers trois murs et tu prends toujours le chemin le plus court vers elle. Rien du set ne t’échappe." };
  }
  if (Math.abs(top[1] - second[1]) <= 1 && state.crowd >= 380) {
    return { name: "Passe-partout du Karmen", copy: "Tu lis le lieu, aides le crew et trouves toujours la bonne porte. Les imprévus deviennent tes meilleurs souvenirs." };
  }

  const profiles = {
    care: { name: "Cœur du crew", copy: "Tu fais attention aux personnes avant de chercher le meilleur spot. Avec toi, personne ne reste sans billet, sans sac, sans batterie ou sans eau." },
    audacity: { name: "Agent du chaos doux", copy: "Tu choisis rarement la réponse évidente, mais tu arrives avec une histoire que tout le monde racontera demain." },
    music: { name: "Oreille cosmique", copy: "Tu entends le détail qui change tout. Une basse, une transition ou un câble : la nuit te parle directement." },
    vibe: { name: "Aimant à dancefloor", copy: "Tu ne suis pas l’ambiance : tu la crées. Les gens viennent pour le son et restent pour ton énergie." }
  };
  return profiles[top[0]] || profiles.vibe;
}

function routeLabel() {
  return ({ sound: "DIRECT AU SON", expo: "DÉTOUR PAR L’EXPO", terrace: "DÉTOUR PAR LA TERRASSE" })[state.route] || "NUIT AU KARMEN";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function fitText(ctx, text, maxWidth, startSize, minSize = 24, weight = 900) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px "Courier New", monospace`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawSelectedAvatar(ctx, legacySheet, x, y, size) {
  const legacyIndex = state.avatar;
  const sw = legacySheet.width / 5;
  const sh = legacySheet.height / 4;
  const col = legacyIndex % 5;
  const row = legacyIndex < 5 ? 0 : 2;
  ctx.drawImage(legacySheet, col * sw, row * sh, sw, sh, x, y, size, size);
}

async function drawStory() {
  const canvas = $("#storyCanvas");
  const ctx = canvas.getContext("2d");
  const [background, legacySheet] = await Promise.all([
    loadImage("assets/venue-dancefloor.webp"),
    loadImage("assets/legacy-characters.png")
  ]);
  const profile = state.finalProfile || getProfile();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCover(ctx, background, 0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(19,5,31,.54)");
  gradient.addColorStop(.48, "rgba(19,5,31,.78)");
  gradient.addColorStop(1, "rgba(19,5,31,.98)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ff3e87";
  ctx.fillRect(0, 0, 1080, 34);
  ctx.fillStyle = "#fff619";
  ctx.fillRect(0, 34, 1080, 18);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 96px "Courier New", monospace';
  ctx.fillText("SPECTR", 64, 175);
  ctx.fillStyle = "#fff619";
  ctx.font = '900 42px "Courier New", monospace';
  ctx.fillText("LA QUÊTE DU KARMEN", 68, 238);

  ctx.fillStyle = "rgba(75,17,125,.9)";
  ctx.fillRect(150, 315, 780, 780);
  ctx.strokeStyle = "#ff3e87";
  ctx.lineWidth = 14;
  ctx.strokeRect(150, 315, 780, 780);
  drawSelectedAvatar(ctx, legacySheet, 180, 345, 720);

  ctx.fillStyle = "#13051f";
  ctx.fillRect(76, 1145, 928, 570);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.strokeRect(76, 1145, 928, 570);

  ctx.fillStyle = "#ff3e87";
  ctx.font = '900 31px "Courier New", monospace';
  ctx.fillText((state.name || AVATARS[state.avatar] || "NIGHT RIDER").toUpperCase(), 120, 1215);

  ctx.fillStyle = "#fff619";
  fitText(ctx, profile.name.toUpperCase(), 840, 66, 36);
  ctx.fillText(profile.name.toUpperCase(), 120, 1310);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 42px "Courier New", monospace';
  ctx.fillText(`${state.crowd} / 500 AU KARMEN`, 120, 1390);

  ctx.fillStyle = "#d9baf6";
  ctx.font = '900 29px "Courier New", monospace';
  ctx.fillText(routeLabel(), 120, 1460);
  ctx.fillText(`ARRIVÉE ${formatArrival()} · RETARD ${state.lateness} MIN`, 120, 1510);
  ctx.fillText(`CULTURE ${state.knowledge} · ${state.inventory.map(id => ITEMS[id].name).join(" + ").toUpperCase()}`, 120, 1560);

  if (state.combo) {
    const comboText = `COMBO : ${state.combo}`.toUpperCase();
    ctx.fillStyle = "#ff3e87";
    fitText(ctx, comboText, 830, 29, 20);
    ctx.fillText(comboText, 120, 1635);
  }

  ctx.fillStyle = "#fff619";
  ctx.font = '900 30px "Courier New", monospace';
  ctx.fillText("ET TOI, QUEL CHEMIN TU PRENDS ?", 96, 1810);
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 24px "Courier New", monospace';
  ctx.fillText("Joue et partage ton histoire.", 96, 1860);
}

async function canvasBlob() {
  await drawStory();
  return new Promise(resolve => $("#storyCanvas").toBlob(resolve, "image/png", 1));
}

async function finishGame() {
  state.finalProfile = getProfile();
  showScreen("final");
  $("#resultProfile").textContent = state.finalProfile.name;
  $("#resultCopy").textContent = state.finalProfile.copy;
  $("#resultCrowd").textContent = `${state.crowd} / 500`;
  $("#resultLate").textContent = `${state.lateness} min`;
  $("#resultKnowledge").textContent = `${state.knowledge} pts`;
  $("#resultItems").textContent = `${state.inventory.length} / ${CONFIG.maxItems}`;
  $("#comboCallout").innerHTML = state.combo
    ? `<strong>Combo : ${state.combo}</strong><br>Ton chemin et tes objets ont débloqué une interaction spéciale.`
    : `<strong>Chemin : ${routeLabel().toLowerCase()}</strong><br>Rejoue avec d’autres objets ou un autre détour : les conséquences changent.`;
  await drawStory();
  saveGame();
  void submitResult();
}

async function submitResult() {
  const sync = $("#resultSync");
  if (!CONFIG.endpoint || !state.finalProfile) {
    if (sync) sync.textContent = "Classement non configuré.";
    return;
  }
  if (state.sent === true) {
    if (sync) sync.textContent = "✓ Résultat déjà transmis au Google Sheet Spectr.";
    return;
  }

  state.sent = "pending";
  saveGame();
  if (sync) sync.textContent = "Envoi du résultat au Google Sheet Spectr…";

  const details = [
    `PROFIL: ${state.finalProfile.name}`,
    `AVATAR: ${AVATARS[state.avatar] || "Inconnu"}`,
    `ROUTE: ${state.route || ""}/${state.routeChoice || "direct"}`,
    `OBJETS: ${state.inventory.map(id => ITEMS[id].name).join("+")}`,
    `FINAL: ${state.clubChoice || ""}`,
    state.combo ? `COMBO: ${state.combo}` : ""
  ].filter(Boolean).join(" | ").slice(0, 245);

  const payload = {
    // Champs attendus par le Google Apps Script déjà relié à l’onglet Scores.
    name: state.name || "Anonyme",
    contact: "",
    score: state.crowd,
    total: CONFIG.maxCrowd,
    timeMs: Math.max(0, Date.now() - (state.startedAt || Date.now())),
    hints: state.knowledge,
    penalty: state.lateness,
    userAgent: details,

    // Données détaillées conservées si le script Google est enrichi plus tard.
    timestamp: new Date().toISOString(),
    game: "spectr-karmen-story-v3",
    player: state.name || "Anonyme",
    avatar: AVATARS[state.avatar] || state.avatar + 1,
    items: state.inventory.map(id => ITEMS[id].name).join(", "),
    exterior_guide: state.metGuide ? "oui" : "non",
    entry_choice: state.entryChoice,
    route: state.route,
    route_choice: state.routeChoice,
    club_choice: state.clubChoice,
    profile: state.finalProfile.name,
    crowd: state.crowd,
    lateness: state.lateness,
    knowledge: state.knowledge,
    combo: state.combo || ""
  };
  try {
    await fetch(CONFIG.endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      keepalive: true
    });
    state.sent = true;
    saveGame();
    if (sync) sync.textContent = "✓ Résultat transmis au Google Sheet Spectr.";
  } catch (_) {
    state.sent = false;
    saveGame();
    if (sync) sync.textContent = "Envoi impossible pour le moment. Le résultat sera retenté à la prochaine ouverture.";
  }
}

async function downloadStory() {
  const blob = await canvasBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "spectr-quete-karmen-story.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareStory() {
  try {
    const blob = await canvasBlob();
    const file = new File([blob], "spectr-quete-karmen.png", { type: "image/png" });
    const shareData = {
      title: "Mon histoire Spectr",
      text: `J’ai obtenu « ${state.finalProfile.name} » après ${state.lateness} min de détour au Karmen Camina. À toi de jouer !`,
      files: [file]
    };
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share(shareData);
      showToast("Carte prête à être partagée.");
    } else {
      await downloadStory();
      showToast("Image téléchargée : ajoute-la à ta Story Instagram.");
    }
  } catch (error) {
    if (error && error.name !== "AbortError") {
      await downloadStory();
      showToast("Image téléchargée : ajoute-la à ta Story Instagram.");
    }
  }
}

function setupMusicPlayer() {
  const dock = $("#musicDock");
  const player = $("#musicPlayer");
  const button = $("#musicPlayBtn");
  if (!dock || !player || !button || !CONFIG.music.src) {
    if (dock) dock.hidden = true;
    return;
  }

  dock.hidden = false;
  player.src = CONFIG.music.src;
  player.volume = Number($("#musicVolume").value || .65);
  $("#musicTitle").textContent = CONFIG.music.title || "Spectr Radio";
  $("#musicArtist").textContent = CONFIG.music.artist || "Morceau de la soirée";

  player.addEventListener("play", () => {
    button.textContent = "Ⅱ";
    button.setAttribute("aria-label", "Mettre la musique en pause");
    dock.classList.add("playing");
  });
  player.addEventListener("pause", () => {
    button.textContent = "▶";
    button.setAttribute("aria-label", "Lancer la musique");
    dock.classList.remove("playing");
  });
  player.addEventListener("error", () => {
    button.disabled = true;
    $("#musicArtist").textContent = "Fichier audio introuvable";
  });
}

async function toggleMusic() {
  const player = $("#musicPlayer");
  if (!player || !CONFIG.music.src) return;
  if (player.paused) {
    try { await player.play(); }
    catch (_) { showToast("Appuie de nouveau sur lecture pour lancer la musique."); }
  } else {
    player.pause();
  }
}

function newGame() {
  state = DEFAULT_STATE();
  state.startedAt = Date.now();
  clearGame();
  buildAvatarGrid();
  renderAll();
  showScreen("creator");
  playTone("great");
}

function restartGame() {
  if (!window.confirm("Recommencer depuis le début ? Ta partie actuelle sera effacée.")) return;
  state = DEFAULT_STATE();
  clearGame();
  buildAvatarGrid();
  renderAll();
  showScreen("intro", false);
  showToast("Nouvelle nuit, nouvelle histoire.");
}

$("#startBtn").addEventListener("click", newGame);
$("#resumeBtn").addEventListener("click", () => {
  if (!loadGame()) { newGame(); return; }
  buildAvatarGrid();
  renderAll();
  if (state.screen === "final" && state.finalProfile) finishGame();
  else {
    showScreen(state.screen || "creator");
    if (state.screen === "club") startClub();
  }
  playTone("good");
});

$("#avatarGrid").addEventListener("click", event => {
  const button = event.target.closest("[data-avatar-choice]");
  if (!button) return;
  state.avatar = Number(button.dataset.avatarChoice);
  renderAvatarState();
  saveGame();
  playTone("tap");
});

$("#confirmAvatarBtn").addEventListener("click", () => {
  state.name = $("#playerName").value.trim().slice(0, 16);
  addStat("vibe", 1);
  showScreen("exterior");
  playTone("great");
  setTimeout(() => {
    showDialog({
      kicker: "Chapitre 1 · Dehors",
      title: `Bienvenue${state.name ? `, ${state.name}` : ""}`,
      text: "Tu es devant le Karmen, mais rien n’indique clairement l’entrée. Clique sur les petits marqueurs — pas sur de grandes zones invisibles.",
      choices: [{ label: "Chercher l’entrée", sub: "Le PNJ pixelisé peut donner un indice.", icon: "⌕", onClick: closeDialog }]
    });
  }, 180);
});

$("#playerName").addEventListener("input", event => {
  state.name = event.target.value.trim().slice(0, 16);
  saveGame();
});

$$('[data-exterior-action]').forEach(button => button.addEventListener("click", () => handleExterior(button.dataset.exteriorAction)));
$$('[data-entrance-action]').forEach(button => button.addEventListener("click", () => handleEntrance(button.dataset.entranceAction)));
$$('[data-bar-action]').forEach(button => button.addEventListener("click", () => handleBar(button.dataset.barAction)));
$$('[data-stairs-action]').forEach(button => button.addEventListener("click", () => chooseRoute(button.dataset.stairsAction)));
$$('[data-route-action]').forEach(button => button.addEventListener("click", () => handleRoute(button.dataset.routeAction)));
$$('[data-club-action]').forEach(button => button.addEventListener("click", () => resolveClub(button.dataset.clubAction)));

$("#dialogClose").addEventListener("click", closeDialog);
$("#dialogLayer").addEventListener("click", event => {
  if (event.target === $("#dialogLayer") && !$("#dialogClose").hidden) closeDialog();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("#dialogLayer").hidden && !$("#dialogClose").hidden) closeDialog();
});

$("#soundBtn").addEventListener("click", () => {
  soundOn = !soundOn;
  $("#soundBtn").textContent = soundOn ? "♪" : "×";
  $("#soundBtn").setAttribute("aria-label", soundOn ? "Couper le son" : "Activer le son");
  if (soundOn) playTone("good");
});

$("#musicPlayBtn").addEventListener("click", toggleMusic);
$("#musicVolume").addEventListener("input", event => {
  $("#musicPlayer").volume = Number(event.target.value);
});

$("#restartBtn").addEventListener("click", restartGame);
$("#shareBtn").addEventListener("click", shareStory);
$("#downloadBtn").addEventListener("click", downloadStory);
$("#replayBtn").addEventListener("click", newGame);

buildAvatarGrid();
updateResumeButton();
renderAll();
setupMusicPlayer();
