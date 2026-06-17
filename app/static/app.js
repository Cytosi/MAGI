const USER_TOKEN_KEY = "eva-magi-user-token";
const SLOT_ORDER = ["melchior", "balthasar", "casper"];
const SLOT_TITLES = {
  melchior: "MELCHIOR",
  balthasar: "BALTHASAR",
  casper: "CASPER",
};
const CRUEL_ANGELS_TITLE = "残酷な天使のテーゼ";

const authGate = document.querySelector("#authGate");
const authForm = document.querySelector("#authForm");
const authUsernameInput = document.querySelector("#authUsername");
const authPasswordInput = document.querySelector("#authPassword");
const authSubmitButton = document.querySelector("#authSubmitButton");
const authStatus = document.querySelector("#authStatus");
const showLoginButton = document.querySelector("#showLoginButton");
const showRegisterButton = document.querySelector("#showRegisterButton");
const currentUserLabel = document.querySelector("#currentUserLabel");
const configUserLabel = document.querySelector("#configUserLabel");
const pilotNameDisplay = document.querySelector("#pilotNameDisplay");
const pilotStatusDisplay = document.querySelector("#pilotStatusDisplay");
const casperSlot = document.querySelector("#casperSlot");
const balthasarSlot = document.querySelector("#balthasarSlot");
const melchiorSlot = document.querySelector("#melchiorSlot");
const consensusOutput = document.querySelector("#consensusOutput");
const evaluationMeta = document.querySelector("#evaluationMeta");
const systemStatus = document.querySelector("#systemStatus");
const activeViewLabel = document.querySelector("#activeViewLabel");
const chatForm = document.querySelector("#chatForm");
const submitButton = document.querySelector("#submitButton");
const openConfigButton = document.querySelector("#openConfigButton");
const backToInferenceButton = document.querySelector("#backToInferenceButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const toggleCouncilArchiveButton = document.querySelector("#toggleCouncilArchiveButton");
const temperatureInput = document.querySelector("#temperature");
const temperatureValue = document.querySelector("#temperatureValue");
const configForm = document.querySelector("#configForm");
const useRecommendedButton = document.querySelector("#useRecommended");
const validateProvidersButton = document.querySelector("#validateProvidersButton");
const configValidationStatus = document.querySelector("#configValidationStatus");
const inferenceView = document.querySelector("#inferenceView");
const configView = document.querySelector("#configView");
const historyList = document.querySelector("#historyList");
const councilArchivePanel = document.querySelector("#councilArchivePanel");
const councilArchiveGrid = document.querySelector("#councilArchiveGrid");
const councilArchiveStatus = document.querySelector("#councilArchiveStatus");
const serverSetupNotice = document.querySelector("#serverSetupNotice");
const musicPanel = document.querySelector("#musicPanel");
const musicStatus = document.querySelector("#musicStatus");
const themeAudio = document.querySelector("#themeAudio");
const systemPromptInput = document.querySelector("#systemPrompt");
const maxTokensInput = document.querySelector("#maxTokens");
const accountStatus = document.querySelector("#accountStatus");

let authMode = "login";
let userToken = "";
let currentUsername = "";
let catalog = null;
let runtimeConfig = [];
let runtimeSettings = null;
let memoryHistory = [];
let latestCouncilReplies = [];
let musicLibrary = [];
let activeTrackId = null;
let activeTrackButton = null;

function renderBirthdayNotice() {
  const today = new Date();
  const isCherryBirthdayWindow = today.getMonth() === 5 && [17, 18].includes(today.getDate());
  if (!isCherryBirthdayWindow || document.querySelector("#cherryBirthdayNotice")) {
    return;
  }

  const notice = document.createElement("aside");
  notice.id = "cherryBirthdayNotice";
  notice.className = "birthday-notice";
  notice.setAttribute("aria-label", "Birthday notice");
  notice.textContent = "Happy birthday, Cherry🥰";
  document.body.appendChild(notice);
}

function clearCouncilArchive() {
  latestCouncilReplies = [];
  if (typeof councilArchiveGrid?.innerHTML === "string") {
    renderCouncilArchive();
  }
}

function allProvidersReady(config) {
  return Array.isArray(config) && config.length === 3 && config.every((item) => item.server_ready);
}

temperatureInput.addEventListener("input", () => {
  temperatureValue.textContent = temperatureInput.value;
});

function switchView(view) {
  const isInference = view === "inference";
  inferenceView.classList.toggle("hidden", !isInference);
  configView.classList.toggle("hidden", isInference);
  activeViewLabel.textContent = isInference ? "INFERENCE DECK" : "CONFIG DECK";
}

openConfigButton.addEventListener("click", () => switchView("config"));
backToInferenceButton.addEventListener("click", () => switchView("inference"));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function readErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string") {
        return payload.detail;
      }
      if (Array.isArray(payload?.detail) && payload.detail.length) {
        const first = payload.detail[0];
        if (typeof first?.msg === "string") {
          return first.msg;
        }
      }
      return JSON.stringify(payload);
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  const text = await response.text();
  return text || `HTTP ${response.status}`;
}

function getSavedToken() {
  try {
    return localStorage.getItem(USER_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(token) {
  userToken = token;
  localStorage.setItem(USER_TOKEN_KEY, token);
}

function clearToken() {
  userToken = "";
  localStorage.removeItem(USER_TOKEN_KEY);
}

function setAuthMode(mode) {
  authMode = mode;
  showLoginButton.classList.toggle("is-active", mode === "login");
  showRegisterButton.classList.toggle("is-active", mode === "register");
  authSubmitButton.textContent = mode === "login" ? "LOGIN" : "REGISTER";
  authStatus.textContent =
    mode === "login"
      ? "Authenticate to restore your NERV pilot profile."
      : "Register a new pilot clearance.";
}

showLoginButton.addEventListener("click", () => setAuthMode("login"));
showRegisterButton.addEventListener("click", () => setAuthMode("register"));

function setUserIdentity(username) {
  const previousUsername = currentUsername;
  currentUsername = username || "";
  const display = currentUsername ? currentUsername.toUpperCase() : "ANONYMOUS";
  currentUserLabel.textContent = display;
  configUserLabel.textContent = display;
  pilotNameDisplay.textContent = display;
  pilotStatusDisplay.textContent = currentUsername ? "ENTRY PLUG LINKED" : "ENTRY PLUG STANDBY";
  accountStatus.textContent = currentUsername
    ? `Pilot ${currentUsername} authenticated. MAGI keys and command records are isolated under this profile.`
    : "Authenticate to access your pilot-side MAGI council.";
  if (!currentUsername || (previousUsername && previousUsername !== currentUsername)) {
    clearCouncilArchive();
  }
}

function showAuthGate(visible) {
  authGate.classList.toggle("hidden", !visible);
}

function setMusicButtonState(button, isPlaying) {
  if (!button) {
    return;
  }
  button.classList.toggle("is-playing", isPlaying);
  button.innerHTML = isPlaying
    ? '<span class="icon-pause" aria-hidden="true"></span>'
    : '<span class="icon-play" aria-hidden="true"></span>';
  button.setAttribute("aria-pressed", isPlaying ? "true" : "false");
}

function resetMusicPlaybackState() {
  setMusicButtonState(activeTrackButton, false);
  activeTrackId = null;
  activeTrackButton = null;
}

function musicTitleClass(title) {
  if (title === "One Last Kiss") {
    return "music-title one-last-kiss";
  }
  if (title === "Beautiful World") {
    return "music-title beautiful-world";
  }
  if (title === CRUEL_ANGELS_TITLE) {
    return "music-title cruel-angel";
  }
  return "music-title";
}

function renderMusicLibrary() {
  if (!musicLibrary.length) {
    musicPanel.innerHTML = `<div class="music-empty">No EVA tracks found in the local music directory.</div>`;
    musicStatus.textContent = "No local theme tracks detected.";
    return;
  }

  musicPanel.innerHTML = musicLibrary
    .map(
      (track) => `
        <article class="music-track ${track.available ? "is-playable" : "is-blocked"}">
          <button
            type="button"
            class="music-play-button"
            data-track-id="${track.id}"
            ${track.available ? "" : "disabled"}
            title="${escapeHtml(track.available ? `Play ${track.title}` : track.reason || "Unavailable")}"
            aria-pressed="false"
          >
            <span class="icon-play" aria-hidden="true"></span>
          </button>
          <div class="music-copy">
            <div class="${musicTitleClass(track.title)}">${escapeHtml(track.title)}</div>
            <div class="music-meta">${escapeHtml(track.artist)}</div>
            <div class="music-file">${escapeHtml(track.filename)}</div>
            ${track.reason ? `<div class="music-reason">${escapeHtml(track.reason)}</div>` : ""}
          </div>
        </article>
      `,
    )
    .join("");

  musicPanel.querySelectorAll(".music-play-button").forEach((button) => {
    setMusicButtonState(button, false);
    button.addEventListener("click", async () => {
      const track = musicLibrary.find((item) => item.id === button.dataset.trackId);
      if (!track || !track.available) {
        return;
      }

      if (activeTrackButton && activeTrackButton !== button) {
        setMusicButtonState(activeTrackButton, false);
      }

      if (activeTrackId === track.id && !themeAudio.paused) {
        themeAudio.pause();
        setMusicButtonState(button, false);
        musicStatus.textContent = `Paused: ${track.title}`;
        activeTrackId = track.id;
        activeTrackButton = button;
        return;
      }

      const nextSrc = `${window.location.origin}/api/music/track/${track.id}`;
      if (themeAudio.src !== nextSrc) {
        themeAudio.src = `/api/music/track/${track.id}`;
      }

      try {
        await themeAudio.play();
        activeTrackId = track.id;
        activeTrackButton = button;
        setMusicButtonState(button, true);
        musicStatus.textContent = `Now playing: ${track.title}`;
      } catch (error) {
        resetMusicPlaybackState();
        musicStatus.textContent = `Playback blocked: ${error.message}`;
      }
    });
  });
}

themeAudio.addEventListener("ended", () => {
  resetMusicPlaybackState();
  musicStatus.textContent = "Playback finished.";
});

themeAudio.addEventListener("pause", () => {
  if (!themeAudio.ended && activeTrackButton) {
    setMusicButtonState(activeTrackButton, false);
  }
});

function applyRuntimeSettings(settings) {
  runtimeSettings = settings;
  systemPromptInput.value = settings.system_prompt;
  temperatureInput.value = String(settings.temperature);
  temperatureValue.textContent = String(settings.temperature);
  maxTokensInput.value = String(settings.max_tokens);
}

function buildHintText(providerKey) {
  const preset = catalog.presets.find((item) => item.key === providerKey);
  if (!preset) {
    return "Assign three independent node buses. This pilot profile will store its own sealed access keys.";
  }
  if (providerKey === "custom") {
    return "Custom mode requires a MAGI-compatible chat/completions command interface and its own access key.";
  }
  if (!preset.server_ready) {
    return `${preset.label} is not sealed in the central NERV environment. Store a pilot-specific access key.`;
  }
  return `${preset.label} can use either the central NERV fallback key or this pilot's sealed key.`;
}

function buildDocsLink(providerKey) {
  const preset = catalog.presets.find((item) => item.key === providerKey);
  if (!preset?.docs_url) {
    return "";
  }

  return `
    <a class="provider-doc-link" href="${escapeHtml(preset.docs_url)}" target="_blank" rel="noreferrer">
      OPEN NODE SETUP GUIDE
    </a>
  `;
}

function buildSlotForm(slot, config) {
  const current = config.find((item) => item.slot === slot) || {
    slot,
    provider_key: "",
    label: "",
    model: "",
    base_url: "",
    api_key: "",
    has_api_key: false,
    server_ready: false,
  };
  const providerKey = current.provider_key || "";
  const ready = Boolean(current.has_api_key || current.server_ready);

  return `
    <section class="slot-card" data-slot="${slot}">
      <div class="slot-card-head">
        <h3>${SLOT_TITLES[slot]}</h3>
        <span class="server-badge ${ready ? "is-ready" : "is-missing"}">${ready ? "KEY STORED" : "NO KEY"}</span>
      </div>
      <div>
        <label for="${slot}-provider">Node Bus</label>
        <select id="${slot}-provider" data-role="provider">
          <option value="">Select node bus</option>
          ${catalog.presets
            .map(
              (item) => `
                <option value="${item.key}" ${item.key === providerKey ? "selected" : ""}>${item.label}</option>
              `,
            )
            .join("")}
        </select>
      </div>
      <div>
        <label for="${slot}-label">Display Name</label>
        <input id="${slot}-label" data-role="label" type="text" value="${escapeHtml(current.label || "")}" />
      </div>
      <div>
        <label for="${slot}-model">Model</label>
        <input id="${slot}-model" data-role="model" type="text" value="${escapeHtml(current.model || "")}" />
      </div>
      <div>
        <label for="${slot}-url">Base URL</label>
        <input id="${slot}-url" data-role="base_url" type="text" value="${escapeHtml(current.base_url || "")}" />
      </div>
      <div>
        <label for="${slot}-api-key">Access Key</label>
        <input
          id="${slot}-api-key"
          data-role="api_key"
          type="password"
          value=""
          placeholder="${ready ? "Leave blank to keep sealed key" : "Enter access key"}"
        />
      </div>
      <div class="provider-doc-shell" data-role="docs-link">${buildDocsLink(providerKey)}</div>
      <p class="config-hint" data-role="hint">${buildHintText(providerKey)}</p>
    </section>
  `;
}

function buildConfigForm(config) {
  configForm.innerHTML = `
    <div class="config-grid">
      ${SLOT_ORDER.map((slot) => buildSlotForm(slot, config)).join("")}
    </div>
  `;
  wireSlotEvents();
  syncDuplicateOptions();
}

function wireSlotEvents() {
  document.querySelectorAll("[data-role='provider']").forEach((select) => {
    select.addEventListener("change", handleProviderChange);
  });
}

function handleProviderChange(event) {
  const slotCard = event.target.closest(".slot-card");
  const providerKey = event.target.value;
  const preset = catalog.presets.find((item) => item.key === providerKey);
  const labelInput = slotCard.querySelector("[data-role='label']");
  const modelInput = slotCard.querySelector("[data-role='model']");
  const urlInput = slotCard.querySelector("[data-role='base_url']");
  const hint = slotCard.querySelector("[data-role='hint']");
  const docsLink = slotCard.querySelector("[data-role='docs-link']");
  const badge = slotCard.querySelector(".server-badge");

  if (preset) {
    labelInput.value = labelInput.value.trim() || preset.label;
    modelInput.value = modelInput.value.trim() || preset.default_model;
    urlInput.value = urlInput.value.trim() || preset.base_url;
    if (!slotCard.querySelector("[data-role='api_key']").value.trim()) {
      badge.className = `server-badge ${preset.server_ready ? "is-ready" : "is-missing"}`;
      badge.textContent = preset.server_ready ? "KEY STORED" : "NO KEY";
    }
  }

  hint.textContent = buildHintText(providerKey);
  docsLink.innerHTML = buildDocsLink(providerKey);
  syncDuplicateOptions();
}

function syncDuplicateOptions() {
  const currentValues = Array.from(document.querySelectorAll("[data-role='provider']"))
    .map((select) => select.value)
    .filter(Boolean);

  document.querySelectorAll("[data-role='provider']").forEach((select) => {
    Array.from(select.options).forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }
      option.disabled = currentValues.includes(option.value) && option.value !== select.value;
    });
  });
}

function collectConfigFromForm() {
  return SLOT_ORDER.map((slot) => {
    const slotCard = document.querySelector(`.slot-card[data-slot="${slot}"]`);
    const badge = slotCard.querySelector(".server-badge");
    return {
      slot,
      provider_key: slotCard.querySelector("[data-role='provider']").value.trim(),
      label: slotCard.querySelector("[data-role='label']").value.trim(),
      model: slotCard.querySelector("[data-role='model']").value.trim(),
      base_url: slotCard.querySelector("[data-role='base_url']").value.trim(),
      api_key: slotCard.querySelector("[data-role='api_key']").value.trim(),
      has_api_key: badge.textContent === "KEY STORED",
      server_ready: badge.textContent === "KEY STORED",
    };
  });
}

function validateConfig(config) {
  const providerKeys = config.map((item) => item.provider_key);
  if (providerKeys.some((key) => !key)) {
    throw new Error("Select a node bus for all three MAGI nodes.");
  }
  if (new Set(providerKeys).size !== 3) {
    throw new Error("Melchior, Balthasar, and Casper must use distinct node buses.");
  }
  for (const item of config) {
    if (!item.label || !item.model || !item.base_url) {
      throw new Error(`Complete all fields for ${SLOT_TITLES[item.slot]}.`);
    }
  }
}

function renderConfiguredProviders(config) {
  runtimeConfig = config.map((provider) => ({
    slot: provider.slot,
    provider_key: provider.provider_key,
    label: provider.label,
    model: provider.model,
    base_url: provider.base_url,
    server_ready: Boolean(provider.server_ready || provider.has_api_key),
  }));

  renderNodeSlots(
    runtimeConfig.map((provider) => ({
      code: provider.slot,
      name: `${SLOT_TITLES[provider.slot]} / ${provider.label}`,
      provider_key: provider.provider_key,
      status: provider.server_ready ? "ready" : "missing_config",
      content: provider.server_ready
        ? "Pilot profile linked. Awaiting NERV directive."
        : "No sealed access key for this pilot and node. Open settings and store one.",
      model: provider.model,
      base_url: provider.base_url,
      latency_ms: 0,
      error: provider.server_ready ? null : "missing_api_key",
    })),
  );
  renderCouncilArchive();
  evaluationMeta.textContent = "Awaiting MAGI resolution.";
  if (!currentUsername) {
    setValidationStatus("Authenticate to seal and synchronize your MAGI node keys.", "pending");
    return;
  }
  if (allProvidersReady(runtimeConfig)) {
    setValidationStatus("All three MAGI nodes are synchronized and ready for command judgment.", "success");
  } else {
    setValidationStatus("Three sealed node keys are required before the command bridge can unlock.", "error");
  }
}

function renderServerSetupNotice() {
  const available = runtimeConfig.filter((item) => item.server_ready).map((item) => item.label);
  if (!currentUsername) {
    serverSetupNotice.innerHTML = "<strong>PILOT STATUS:</strong> Authenticate to access your classified MAGI configuration.";
    serverSetupNotice.className = "server-setup-notice missing";
    return;
  }
  if (!available.length) {
    serverSetupNotice.innerHTML = `<strong>PILOT STATUS:</strong> ${escapeHtml(currentUsername)} has no sealed MAGI access key yet.`;
    serverSetupNotice.className = "server-setup-notice missing";
    return;
  }
  serverSetupNotice.innerHTML = `<strong>PILOT STATUS:</strong> ${escapeHtml(currentUsername)} has sealed keys for ${escapeHtml(available.join(", "))}.`;
  serverSetupNotice.className = "server-setup-notice ready";
}

function setValidationStatus(message, tone = "pending") {
  configValidationStatus.textContent = message;
  configValidationStatus.className = `config-validation-status ${tone}`;
}

function renderHistory() {
  if (!memoryHistory.length) {
    historyList.innerHTML = `<div class="history-empty">No classified NERV decisions archived yet.</div>`;
    return;
  }

  historyList.innerHTML = memoryHistory
    .map(
      (item, index) => `
        <article class="history-item" data-history-index="${index}">
          <div class="history-time">${item.time}</div>
          <div class="history-question">${escapeHtml(item.prompt)}</div>
          <div class="history-answer">${escapeHtml(item.answer)}</div>
        </article>
      `,
    )
    .join("");

  historyList.querySelectorAll(".history-item").forEach((node) => {
    node.addEventListener("click", () => {
      const item = memoryHistory[Number(node.dataset.historyIndex)];
      if (!item) {
        return;
      }
      document.querySelector("#prompt").value = item.prompt;
      consensusOutput.textContent = item.answer;
      switchView("inference");
    });
  });
}

function createSyncingMembers() {
  return runtimeConfig.map((provider) => ({
    code: provider.slot,
    name: `${SLOT_TITLES[provider.slot]} / ${provider.label}`,
    provider_key: provider.provider_key,
    status: "syncing",
    content: "",
    model: provider.model,
    base_url: provider.base_url,
    latency_ms: 0,
    error: null,
  }));
}

function getDecisionTone(member) {
  if (member.status === "syncing") {
    return "tone-neutral";
  }
  if (member.status === "error") {
    return "tone-error";
  }
  if (member.status === "missing_config") {
    return "tone-neutral";
  }
  return "tone-neutral";
}

function getNodeLore(member) {
  const loreMap = {
    melchior: {
      title: "LOGIC FILTER",
      copy: "MELCHIOR monitors doctrine, rules, and operational consistency before authorization is granted.",
    },
    balthasar: {
      title: "TACTICAL CORE",
      copy: "BALTHASAR models response tempo, practical execution, and mission-path viability under pressure.",
    },
    casper: {
      title: "HUMAN FACTOR",
      copy: "CASPER preserves empathy, ambiguity handling, and pilot-centered judgment across the council.",
    },
  };

  if (member.status === "syncing") {
    return {
      title: "SYNC IN PROGRESS",
      copy: "Council synchronization is active. Signal routing, model wakeup, and verdict alignment are underway.",
    };
  }

  if (member.status === "error") {
    return {
      title: "LINK FAILURE",
      copy: "The node rejected the current command bridge request. Inspect the endpoint, access scope, or bus state.",
    };
  }

  if (member.status === "missing_config") {
    return {
      title: "KEY REQUIRED",
      copy: "This node cannot join the MAGI chamber until a valid access key is sealed for the current pilot.",
    };
  }

  return loreMap[member.code] || loreMap.melchior;
}

function renderNodeCard(member) {
  const toneClass = getDecisionTone(member);
  const lore = getNodeLore(member);
  const nodeTitle = SLOT_TITLES[member.code] || member.name || "MAGI NODE";
  const providerLabel = member.provider_key ? member.provider_key.toUpperCase() : "UNASSIGNED";
  const modelLabel = member.model || "NO MODEL";
  const latencyLabel = member.latency_ms ? `${member.latency_ms} MS` : "STANDBY";
  const replyBody = member.error ? `${member.content}\n\nError: ${member.error}` : member.content;
  const hasNodeReply = Boolean(replyBody && (member.latency_ms || member.error));
  const bodyContent =
    member.status === "syncing"
      ? `
        <div class="loading-copy">
          <div class="provider-meta">Node Bus: ${providerLabel}</div>
          <div class="provider-meta">Model Core: ${escapeHtml(modelLabel)}</div>
          <div class="provider-meta">Sync State: LIVE HANDSHAKE</div>
          <div class="loading-line"></div>
          <div class="loading-line mid"></div>
          <div class="loading-line short"></div>
        </div>
      `
      : hasNodeReply
        ? `
        <div class="node-stat-grid">
          <div class="node-stat">
            <span>Node Bus</span>
            <strong>${providerLabel}</strong>
          </div>
          <div class="node-stat">
            <span>Latency</span>
            <strong>${latencyLabel}</strong>
          </div>
        </div>
        <pre class="node-answer-body">${escapeHtml(replyBody)}</pre>
      `
      : `
        <div class="node-lore-block">
          <div class="node-lore-title">${lore.title}</div>
          <div class="node-lore-copy">${lore.copy}</div>
        </div>
        <div class="node-stat-grid">
          <div class="node-stat">
            <span>Node Bus</span>
            <strong>${providerLabel}</strong>
          </div>
          <div class="node-stat">
            <span>Latency</span>
            <strong>${latencyLabel}</strong>
          </div>
        </div>
      `;
  return `
    <article class="provider-card ${toneClass}">
      <div class="provider-card-shell">
        <div class="provider-card-header">
          <div class="provider-card-summary">
            <h3>${nodeTitle}</h3>
          </div>
          <span class="status-pill ${member.status}">${member.status === "syncing" ? "SYNCING" : member.status.toUpperCase()}</span>
        </div>
        <div class="provider-card-body">
          ${bodyContent}
        </div>
      </div>
    </article>
  `;
}

function renderNodeSlots(members) {
  const slotMap = {
    casper: casperSlot,
    balthasar: balthasarSlot,
    melchior: melchiorSlot,
  };
  Object.values(slotMap).forEach((slot) => {
    slot.innerHTML = "";
  });
  members.forEach((member) => {
    const slot = slotMap[member.code];
    if (slot) {
      slot.innerHTML = renderNodeCard(member);
    }
  });
}

function renderCouncil(council, evaluation) {
  latestCouncilReplies = council.map((member) => ({ ...member }));
  renderNodeSlots(council);
  renderCouncilArchive();
  evaluationMeta.textContent = evaluation
    ? `${evaluation.name} | ${evaluation.status.toUpperCase()} | ${evaluation.model}`
    : "Awaiting MAGI resolution.";
}

function setCouncilArchiveOpen(isOpen) {
  councilArchivePanel.classList.toggle("hidden", !isOpen);
  toggleCouncilArchiveButton.textContent = isOpen ? "HIDE COUNCIL LOG" : "OPEN COUNCIL LOG";
  toggleCouncilArchiveButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function renderCouncilArchive() {
  const sortedReplies = SLOT_ORDER
    .map((slot) => latestCouncilReplies.find((item) => item.code === slot))
    .filter(Boolean);

  toggleCouncilArchiveButton.disabled = sortedReplies.length === 0;

  if (!sortedReplies.length) {
    councilArchiveStatus.textContent = "No classified record yet.";
    councilArchiveGrid.innerHTML = `<div class="history-empty">No MAGI node transmissions archived yet.</div>`;
    setCouncilArchiveOpen(false);
    return;
  }

  councilArchiveStatus.textContent = `${sortedReplies.length}/3 MAGI transmissions archived`;
  councilArchiveGrid.innerHTML = sortedReplies
    .map((reply) => {
      const slotTitle = SLOT_TITLES[reply.code] || reply.code.toUpperCase();
      const statusLabel = reply.status === "ready" ? "VERDICT LOCKED" : reply.status.toUpperCase();
      const latencyLabel = reply.latency_ms ? `${reply.latency_ms} MS` : "STANDBY";
      const body = reply.error ? `${reply.content}\n\nError: ${reply.error}` : reply.content;
      return `
        <article class="council-reply-card tone-${reply.status}">
          <div class="council-reply-head">
            <div>
              <div class="council-reply-node">${slotTitle}</div>
              <div class="council-reply-provider">${escapeHtml(reply.provider_key.toUpperCase())}</div>
            </div>
            <span class="status-pill ${reply.status}">${statusLabel}</span>
          </div>
          <div class="council-reply-meta">
            <span>MODEL CORE: ${escapeHtml(reply.model)}</span>
            <span>LATENCY: ${latencyLabel}</span>
          </div>
          <pre class="council-reply-body">${escapeHtml(body)}</pre>
        </article>
      `;
    })
    .join("");
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (userToken) {
    headers.set("X-User-Token", userToken);
  }
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && userToken) {
    clearToken();
    setUserIdentity("");
    showAuthGate(true);
    authStatus.textContent = "Pilot session expired. Re-authentication required.";
    systemStatus.textContent = "AUTH REQUIRED";
  }
  return response;
}

async function loadUserBundle() {
  const response = await apiFetch("/api/user/config");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = await response.json();
  setUserIdentity(data.username);
  memoryHistory = data.history || [];
  applyRuntimeSettings(data.runtime);
  buildConfigForm(data.providers);
  renderConfiguredProviders(data.providers);
  renderHistory();
  renderServerSetupNotice();
  showAuthGate(false);
  return data;
}

async function runConnectivityValidation(providers, { updateUi = true } = {}) {
  const testResponse = await apiFetch("/api/test-providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providers }),
  });
  if (!testResponse.ok) {
    throw new Error(await readErrorMessage(testResponse));
  }

  const testData = await testResponse.json();
  if (updateUi) {
    renderNodeSlots(testData.results);
    if (testData.ready_count === 3) {
      setValidationStatus("ALL THREE MAGI NODES PASSED LINK SYNCHRONIZATION.", "success");
      evaluationMeta.textContent = "MAGI synchronization complete: 3/3 ready";
      consensusOutput.textContent = "Synchronization complete. Melchior, Balthasar, and Casper are online.";
      systemStatus.textContent = "SYNC READY";
    } else {
      setValidationStatus(`MAGI LINK SYNCHRONIZATION FAILED: ${testData.ready_count}/3 READY.`, "error");
      evaluationMeta.textContent = `MAGI synchronization failed: ${testData.ready_count}/3 ready`;
      consensusOutput.textContent = "One or more MAGI nodes failed link synchronization. Inspect access keys and node bus settings.";
      systemStatus.textContent = "CONFIG FAULT";
    }
  }

  return testData;
}

async function submitAuth(event) {
  event.preventDefault();
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;

  if (!username || !password) {
    authStatus.textContent = "Enter pilot ID and passcode.";
    return;
  }

  authSubmitButton.disabled = true;
  authSubmitButton.textContent = authMode === "login" ? "AUTHENTICATING..." : "REGISTERING...";

  try {
    const response = await fetch(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    saveToken(data.token);
    authPasswordInput.value = "";
    authStatus.textContent = `${authMode === "login" ? "Authentication" : "Registration"} complete. Loading pilot MAGI profile...`;
    await loadUserBundle();
    if (!allProvidersReady(runtimeConfig)) {
      consensusOutput.textContent = `Welcome, ${data.username}. Before entering the command bridge, seal three valid node keys and synchronize MAGI links.`;
      systemStatus.textContent = "CONFIG REQUIRED";
      switchView("config");
    } else {
      consensusOutput.textContent = `Welcome back, ${data.username}. Your pilot MAGI profile is online.`;
      systemStatus.textContent = "STANDBY";
      switchView("inference");
    }
  } catch (error) {
    clearToken();
    setUserIdentity("");
    authStatus.textContent = `Pilot authentication failed: ${error.message}`;
    showAuthGate(true);
  } finally {
    authSubmitButton.disabled = false;
    authSubmitButton.textContent = authMode === "login" ? "LOGIN" : "REGISTER";
  }
}

authForm.addEventListener("submit", submitAuth);

configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!userToken) {
    consensusOutput.textContent = "Authenticate before sealing the MAGI configuration.";
    showAuthGate(true);
    return;
  }

  try {
    const providers = collectConfigFromForm();
    validateConfig(providers);
    const payload = {
      providers,
      runtime: {
        system_prompt: systemPromptInput.value.trim(),
        temperature: Number.parseFloat(temperatureInput.value),
        max_tokens: Number.parseInt(maxTokensInput.value, 10),
      },
    };

    setValidationStatus("Synchronizing MAGI node links before sealing configuration...", "pending");
    const testData = await runConnectivityValidation(providers, { updateUi: true });
    if (testData.ready_count !== 3) {
      switchView("config");
      return;
    }

    const response = await apiFetch("/api/user/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    memoryHistory = data.history || memoryHistory;
    applyRuntimeSettings(data.runtime);
    buildConfigForm(data.providers);
    renderConfiguredProviders(data.providers);
    renderHistory();
    renderServerSetupNotice();
    setValidationStatus("Configuration sealed. All three MAGI nodes are synchronized for this pilot.", "success");
    consensusOutput.textContent = `Configuration sealed for ${data.username}. All three nodes passed synchronization and the command bridge is unlocked.`;
    systemStatus.textContent = "CONFIG SEALED";
    switchView("inference");
  } catch (error) {
    consensusOutput.textContent = `Configuration sealing failed: ${error.message}`;
    systemStatus.textContent = "CONFIG FAULT";
    switchView("config");
  }
});

useRecommendedButton.addEventListener("click", () => {
  const recommended = catalog.recommended.map((item) => ({
    ...item,
    api_key: "",
    has_api_key: item.server_ready,
  }));
  buildConfigForm(recommended);
  setValidationStatus("NERV node preset loaded. Synchronize MAGI links before sealing.", "pending");
});

toggleCouncilArchiveButton.addEventListener("click", () => {
  const isOpen = councilArchivePanel.classList.contains("hidden");
  setCouncilArchiveOpen(isOpen);
});

validateProvidersButton.addEventListener("click", async () => {
  if (!userToken) {
    consensusOutput.textContent = "Authenticate before synchronizing MAGI node keys.";
    showAuthGate(true);
    return;
  }

  try {
    const providers = collectConfigFromForm();
    validateConfig(providers);
    validateProvidersButton.disabled = true;
    validateProvidersButton.textContent = "SYNCING...";
    setValidationStatus("Synchronizing MAGI node links...", "pending");
    await runConnectivityValidation(providers, { updateUi: true });
  } catch (error) {
    setValidationStatus(`MAGI SYNCHRONIZATION FAILED: ${error.message}`, "error");
    consensusOutput.textContent = `MAGI link synchronization failed: ${error.message}`;
    systemStatus.textContent = "CONFIG FAULT";
  } finally {
    validateProvidersButton.disabled = false;
    validateProvidersButton.textContent = "SYNC MAGI LINKS";
  }
});

clearHistoryButton.addEventListener("click", async () => {
  if (!userToken) {
    showAuthGate(true);
    return;
  }

  try {
    const response = await apiFetch("/api/user/history", { method: "DELETE" });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    memoryHistory = [];
    renderHistory();
    consensusOutput.textContent = "Classified command archive cleared for this pilot.";
  } catch (error) {
    consensusOutput.textContent = `Archive purge failed: ${error.message}`;
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = document.querySelector("#prompt").value.trim();

  if (!userToken) {
    consensusOutput.textContent = "Authenticate before submitting a NERV directive.";
    showAuthGate(true);
    return;
  }
  if (!allProvidersReady(runtimeConfig)) {
    consensusOutput.textContent = "Seal and synchronize all three MAGI node buses before entering command judgment.";
    systemStatus.textContent = "CONFIG REQUIRED";
    switchView("config");
    return;
  }
  if (!runtimeConfig.length) {
    consensusOutput.textContent = "Open the settings deck and assign all three MAGI nodes first.";
    switchView("config");
    return;
  }
  if (!prompt) {
    consensusOutput.textContent = "Enter a NERV directive before initiating MAGI judgment.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "JUDGING...";
  consensusOutput.textContent = "MAGI is synchronizing Melchior, Balthasar, and Casper before issuing a final resolution.";
  systemStatus.textContent = "SYNCING";
  renderNodeSlots(createSyncingMembers());
  evaluationMeta.textContent = "MAGI evaluator synchronizing...";

  try {
    const response = await apiFetch("/api/deliberate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        system_prompt: systemPromptInput.value.trim(),
        temperature: Number.parseFloat(temperatureInput.value),
        max_tokens: Number.parseInt(maxTokensInput.value, 10),
        providers: runtimeConfig,
      }),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    await loadUserBundle();
    consensusOutput.textContent = data.consensus;
    renderCouncil(data.council, data.evaluation);
    systemStatus.textContent = "DECISION READY";
    switchView("inference");
  } catch (error) {
    consensusOutput.textContent = `MAGI judgment failed: ${error.message}`;
    systemStatus.textContent = "FAULT";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "INITIATE DELIBERATION";
  }
});

async function bootstrap() {
  renderBirthdayNotice();
  const [catalogResponse, musicResponse] = await Promise.all([fetch("/api/catalog"), fetch("/api/music/library")]);
  if (!catalogResponse.ok) {
    throw new Error(`Catalog failed with HTTP ${catalogResponse.status}`);
  }
  if (!musicResponse.ok) {
    throw new Error(`Music library failed with HTTP ${musicResponse.status}`);
  }

  catalog = await catalogResponse.json();
  const musicPayload = await musicResponse.json();
  musicLibrary = musicPayload.tracks || [];
  applyRuntimeSettings(catalog.runtime);
  buildConfigForm(
    catalog.recommended.map((item) => ({
      ...item,
      api_key: "",
      has_api_key: item.server_ready,
    })),
  );
  renderConfiguredProviders(
    catalog.recommended.map((item) => ({
      ...item,
      api_key: "",
      has_api_key: item.server_ready,
    })),
  );
  renderMusicLibrary();
  renderHistory();
  renderCouncilArchive();
  renderServerSetupNotice();
  setValidationStatus("Authenticate to seal and synchronize your MAGI node keys.", "pending");
  setAuthMode("login");
  setUserIdentity("");
  switchView("inference");

  userToken = getSavedToken();
  if (userToken) {
    try {
      await loadUserBundle();
      if (!allProvidersReady(runtimeConfig)) {
        consensusOutput.textContent = `Pilot MAGI profile restored for ${currentUsername}, but the bridge remains locked until three valid node buses are sealed.`;
        systemStatus.textContent = "CONFIG REQUIRED";
        switchView("config");
        return;
      }
      consensusOutput.textContent = `Pilot MAGI profile restored for ${currentUsername}.`;
      systemStatus.textContent = "STANDBY";
      return;
    } catch {
      clearToken();
    }
  }

  showAuthGate(true);
  consensusOutput.textContent = "Authenticate to load your pilot MAGI council and classified command archive.";
  systemStatus.textContent = "AUTH REQUIRED";
}

bootstrap().catch((error) => {
  consensusOutput.textContent = `Initialization failed: ${error.message}`;
  systemStatus.textContent = "FAULT";
});
