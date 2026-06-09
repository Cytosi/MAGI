const STORAGE_KEY = "eva-magi-runtime-config";
const HISTORY_KEY = "eva-magi-history";
const PILOT_NAME_KEY = "eva-magi-pilot-name";
const SLOT_ORDER = ["melchior", "balthasar", "casper"];
const SLOT_TITLES = {
  melchior: "MELCHIOR",
  balthasar: "BALTHASAR",
  casper: "CASPER",
};
const DEFAULT_DOUBAO_MODEL = "doubao-seed-2-0-lite-260215";
const LEGACY_DOUBAO_MODELS = new Set(["doubao-seed-1-6-thinking-250715"]);

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
const temperatureInput = document.querySelector("#temperature");
const temperatureValue = document.querySelector("#temperatureValue");
const configForm = document.querySelector("#configForm");
const useRecommendedButton = document.querySelector("#useRecommended");
const inferenceView = document.querySelector("#inferenceView");
const configView = document.querySelector("#configView");
const historyList = document.querySelector("#historyList");
const serverSetupNotice = document.querySelector("#serverSetupNotice");
const pilotNameInput = document.querySelector("#pilotName");
const pilotNameDisplay = document.querySelector("#pilotNameDisplay");
const musicPanel = document.querySelector("#musicPanel");
const musicStatus = document.querySelector("#musicStatus");
const themeAudio = document.querySelector("#themeAudio");

let catalog = null;
let runtimeConfig = null;
let memoryHistory = [];
let musicLibrary = [];
let activeTrackId = null;
let activeTrackButton = null;

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

function migrateConfig(config) {
  if (!Array.isArray(config)) {
    return null;
  }

  let changed = false;
  const migrated = config.map((item) => {
    const next = { ...item };
    if ("api_key" in next) {
      delete next.api_key;
      changed = true;
    }
    if (next?.provider_key === "doubao" && next?.model && LEGACY_DOUBAO_MODELS.has(next.model)) {
      next.model = DEFAULT_DOUBAO_MODEL;
      changed = true;
    }
    return next;
  });

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }

  return migrated;
}

function getSavedConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function getSavedHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getSavedPilotName() {
  try {
    return localStorage.getItem(PILOT_NAME_KEY) || "Shinji Ikari";
  } catch {
    return "Shinji Ikari";
  }
}

function savePilotName(name) {
  localStorage.setItem(PILOT_NAME_KEY, name);
}

function renderPilotName(name) {
  const safeName = (name || "Shinji Ikari").trim() || "Shinji Ikari";
  pilotNameDisplay.textContent = safeName.toUpperCase();
  pilotNameInput.value = safeName;
}

function setMusicButtonState(button, isPlaying) {
  if (!button) {
    return;
  }
  button.classList.toggle("is-playing", isPlaying);
  button.textContent = isPlaying ? "\u275A\u275A" : "\u25B6";
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
  if (title === "残酷な天使のテーゼ") {
    return "music-title cruel-angel";
  }
  if (title === "残酷な天使のテーゼ") {
    return "music-title cruel-angel";
  }
  if (title === "残酷な天使のテーゼ") {
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
            ▶
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

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(memoryHistory.slice(0, 20)));
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  runtimeConfig = config;
}

function defaultSelectionFor(slot) {
  const recommended = catalog.recommended.find((item) => item.slot === slot);
  return recommended ?? {
    slot,
    provider_key: "",
    label: "",
    model: "",
    base_url: "",
    server_ready: false,
  };
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

function buildSlotForm(slot, config) {
  const current = config.find((item) => item.slot === slot) ?? defaultSelectionFor(slot);
  const providerKey = current.provider_key || "";
  const isCustom = providerKey === "custom";
  const preset = catalog.presets.find((item) => item.key === providerKey);
  const isReady = Boolean(preset?.server_ready);
  return `
    <section class="slot-card" data-slot="${slot}">
      <div class="slot-card-head">
        <h3>${SLOT_TITLES[slot]}</h3>
        <span class="server-badge ${isReady ? "is-ready" : "is-missing"}">${isReady ? "SERVER READY" : "MISSING SERVER KEY"}</span>
      </div>
      <div>
        <label for="${slot}-provider">Provider</label>
        <select id="${slot}-provider" data-role="provider">
          <option value="">Select a provider</option>
          ${catalog.presets
            .map(
              (preset) => `
                <option value="${preset.key}" ${preset.key === providerKey ? "selected" : ""}>${preset.label}</option>
              `,
            )
            .join("")}
        </select>
      </div>
      <div>
        <label for="${slot}-model">Model</label>
        <input id="${slot}-model" data-role="model" type="text" value="${escapeHtml(current.model || "")}" placeholder="Example: gpt-4o-mini" />
      </div>
      <div class="custom-fields ${isCustom ? "" : "hidden"}" data-role="custom-fields">
        <div>
          <label for="${slot}-label">Display Name</label>
          <input id="${slot}-label" data-role="label" type="text" value="${escapeHtml(current.label || "")}" placeholder="Example: Mission Gateway" />
        </div>
        <div>
          <label for="${slot}-url">Base URL</label>
          <input id="${slot}-url" data-role="base_url" type="text" value="${escapeHtml(current.base_url || "")}" placeholder="https://your-provider.example.com/v1" />
        </div>
      </div>
      <p class="config-hint" data-role="hint">${buildHintText(providerKey)}</p>
    </section>
  `;
}

function buildHintText(providerKey) {
  const preset = catalog.presets.find((item) => item.key === providerKey);
  if (!preset) {
    return "Choose three providers. Real API keys are configured in the server .env file, never in the browser.";
  }
  if (providerKey === "custom") {
    return "Custom mode requires a server-side integration. Public deployment should use preconfigured providers only.";
  }
  if (!preset.server_ready) {
    return `${preset.label} is selected, but its server API key is not loaded yet. Add it to the server .env file, then restart the app.`;
  }
  return `${preset.label} uses server-managed credentials. Endpoint: ${preset.base_url}`;
}

function wireSlotEvents() {
  document.querySelectorAll("[data-role='provider']").forEach((select) => {
    select.addEventListener("change", handleProviderChange);
  });
}

function handleProviderChange(event) {
  const slotCard = event.target.closest(".slot-card");
  const slot = slotCard.dataset.slot;
  const providerKey = event.target.value;
  const preset = catalog.presets.find((item) => item.key === providerKey);
  const modelInput = slotCard.querySelector("[data-role='model']");
  const labelInput = slotCard.querySelector("[data-role='label']");
  const urlInput = slotCard.querySelector("[data-role='base_url']");
  const customFields = slotCard.querySelector("[data-role='custom-fields']");
  const hint = slotCard.querySelector("[data-role='hint']");
  const badge = slotCard.querySelector(".server-badge");

  if (preset) {
    modelInput.value = preset.default_model;
    hint.textContent = buildHintText(providerKey);
    if (badge) {
      badge.className = `server-badge ${preset.server_ready ? "is-ready" : "is-missing"}`;
      badge.textContent = preset.server_ready ? "SERVER READY" : "MISSING SERVER KEY";
    }
  }

  if (providerKey === "custom") {
    customFields.classList.remove("hidden");
    labelInput.value = labelInput.value || "Custom";
    urlInput.value = urlInput.value || preset.base_url;
  } else {
    customFields.classList.add("hidden");
    labelInput.value = preset ? preset.label : "";
    urlInput.value = preset ? preset.base_url : "";
  }

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
    const providerKey = slotCard.querySelector("[data-role='provider']").value.trim();
    const model = slotCard.querySelector("[data-role='model']").value.trim();
    const labelInput = slotCard.querySelector("[data-role='label']");
    const urlInput = slotCard.querySelector("[data-role='base_url']");
    const preset = catalog.presets.find((item) => item.key === providerKey);
    const label = providerKey === "custom" ? labelInput.value.trim() : preset?.label || "";
    const baseUrl = providerKey === "custom" ? urlInput.value.trim() : preset?.base_url || "";
    return {
      slot,
      provider_key: providerKey,
      label,
      model,
      base_url: baseUrl,
    };
  });
}

function validateConfig(config) {
  const providerKeys = config.map((item) => item.provider_key);
  if (providerKeys.some((key) => !key)) {
    throw new Error("Select a provider for all three MAGI nodes.");
  }
  if (new Set(providerKeys).size !== 3) {
    throw new Error("All three MAGI providers must be unique.");
  }
  for (const item of config) {
    if (!item.model || !item.base_url || !item.label) {
      throw new Error(`Complete the model, endpoint, and label fields for ${SLOT_TITLES[item.slot]}.`);
    }
  }
}

function renderConfiguredProviders(config) {
  renderNodeSlots(
    config.map((provider) => ({
      code: provider.slot,
      name: `${SLOT_TITLES[provider.slot]} / ${provider.label}`,
      provider_key: provider.provider_key,
      status: "ready",
      content: "Server-managed credentials armed. Awaiting deliberation.",
      model: provider.model,
      base_url: provider.base_url,
      latency_ms: 0,
      error: null,
    })),
  );
  evaluationMeta.textContent = "Awaiting evaluator output.";
}

function renderServerSetupNotice() {
  const configuredProviders = catalog.presets.filter((item) => item.server_ready);
  const missingProviders = catalog.presets.filter((item) => !item.server_ready && item.key !== "custom");

  if (!missingProviders.length) {
    serverSetupNotice.innerHTML = `
      <strong>SERVER API STATUS:</strong>
      ${configuredProviders.length} provider credentials loaded from server .env.
    `;
    serverSetupNotice.className = "server-setup-notice ready";
    return;
  }

  const missingLabels = missingProviders.map((item) => item.label).join(", ");
  serverSetupNotice.innerHTML = `
    <strong>SERVER API STATUS:</strong>
    Missing credentials for ${escapeHtml(missingLabels)}.
    Add them to the server <code>.env</code> file, then restart the app.
  `;
  serverSetupNotice.className = "server-setup-notice missing";
}

function truncate(value, max = 160) {
  if (!value) {
    return "";
  }
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function renderHistory() {
  if (!memoryHistory.length) {
    historyList.innerHTML = `<div class="history-empty">No archived deliberations yet.</div>`;
    return;
  }

  historyList.innerHTML = memoryHistory
    .map(
      (item, index) => `
        <article class="history-item" data-history-index="${index}">
          <div class="history-time">${item.time}</div>
          <div class="history-question">${escapeHtml(truncate(item.prompt, 80))}</div>
          <div class="history-answer">${escapeHtml(truncate(item.answer, 150))}</div>
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

function buildMemoryPrompt(prompt) {
  if (!memoryHistory.length) {
    return prompt;
  }

  const recent = memoryHistory.slice(0, 5);
  const memoryBlock = recent
    .map((item, index) => `Memory ${index + 1}\nQuestion: ${item.prompt}\nFinal Verdict: ${item.answer}`)
    .join("\n\n");

  return `Conversation Memory:\n${memoryBlock}\n\nCurrent Question:\n${prompt}`;
}

function createSyncingMembers() {
  return (runtimeConfig || []).map((provider) => ({
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

  const content = (member.content || "").trim();
  const normalized = content.toLowerCase();
  const firstWindow = normalized.slice(0, 48);
  const firstLine = normalized.split(/\r?\n/, 1)[0].trim();

  const approveMarkers = ["approve", "approved", "accept", "accepted", "affirm"];
  const rejectMarkers = ["reject", "rejected", "deny", "denied"];

  const hasExplicitApprove =
    approveMarkers.some((marker) => firstWindow.startsWith(marker) || firstLine === marker) ||
    /^(verdict|decision)\s*:\s*(approve|approved|accept|accepted|affirm)/i.test(firstLine);

  const hasExplicitReject =
    rejectMarkers.some((marker) => firstWindow.startsWith(marker) || firstLine === marker) ||
    /^(verdict|decision)\s*:\s*(reject|rejected|deny|denied|negative)/i.test(firstLine);

  if (hasExplicitReject) {
    return "tone-reject";
  }
  if (hasExplicitApprove) {
    return "tone-approve";
  }
  return "tone-neutral";
}

function renderNodeCard(member) {
  const latencyLine = member.latency_ms ? `<div class="provider-meta">Latency: ${member.latency_ms} ms</div>` : "";
  const toneClass = getDecisionTone(member);
  const openAttr = member.status === "syncing" ? "open" : "";
  const bodyContent =
    member.status === "syncing"
      ? `
        <div class="loading-copy">
          <div class="provider-meta">Provider: ${member.provider_key}</div>
          <div class="provider-meta">Model: ${member.model}</div>
          <div class="loading-line"></div>
          <div class="loading-line mid"></div>
          <div class="loading-line short"></div>
        </div>
      `
      : `
        <div class="provider-meta">Provider: ${member.provider_key}</div>
        <div class="provider-meta">Model: ${member.model}</div>
        ${latencyLine}
        <div class="provider-meta">Base URL: ${member.base_url}</div>
        <pre>${escapeHtml(member.content)}${member.error ? `\n\nError: ${escapeHtml(member.error)}` : ""}</pre>
      `;
  return `
    <details class="provider-card ${toneClass}" data-collapsible="true" ${openAttr}>
      <summary class="provider-card-header">
        <div class="provider-card-summary">
          <span class="caret"></span>
          <h3>${member.name}</h3>
        </div>
        <span class="status-pill ${member.status}">${member.status === "syncing" ? "SYNCING" : member.status.toUpperCase()}</span>
      </summary>
      <div class="provider-card-body">
        ${bodyContent}
      </div>
    </details>
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
  renderNodeSlots(council);
  if (evaluation) {
    evaluationMeta.textContent = `${evaluation.name} | ${evaluation.status.toUpperCase()} | ${evaluation.model}`;
  } else {
    evaluationMeta.textContent = "Awaiting evaluator output.";
  }
}

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const config = collectConfigFromForm();
    validateConfig(config);
    const pilotName = pilotNameInput.value.trim() || "Shinji Ikari";
    savePilotName(pilotName);
    renderPilotName(pilotName);
    saveConfig(config);
    renderConfiguredProviders(config);
    consensusOutput.textContent = "Configuration saved. Credentials remain server-side. Return to the bridge and initiate deliberation.";
    systemStatus.textContent = "CONFIG SAVED";
    switchView("inference");
  } catch (error) {
    consensusOutput.textContent = error.message;
    switchView("config");
  }
});

useRecommendedButton.addEventListener("click", () => {
  buildConfigForm(catalog.recommended);
});

clearHistoryButton.addEventListener("click", () => {
  memoryHistory = [];
  saveHistory();
  renderHistory();
  consensusOutput.textContent = "Memory archive cleared.";
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = document.querySelector("#prompt").value.trim();
  const systemPrompt = document.querySelector("#systemPrompt").value.trim();
  const maxTokens = Number.parseInt(document.querySelector("#maxTokens").value, 10);

  if (!runtimeConfig) {
    consensusOutput.textContent = "Open the settings deck and configure all three MAGI nodes first.";
    switchView("config");
    return;
  }

  if (!prompt) {
    consensusOutput.textContent = "Enter a mission prompt before starting deliberation.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "DELIBERATING...";
  consensusOutput.textContent = "MAGI is processing the council response and the evaluator is composing the final verdict.";
  systemStatus.textContent = "SYNCING";
  renderNodeSlots(createSyncingMembers());
  evaluationMeta.textContent = "Evaluator synchronizing...";

  try {
    const response = await fetch("/api/deliberate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: buildMemoryPrompt(prompt),
        system_prompt: systemPrompt,
        temperature: Number.parseFloat(temperatureInput.value),
        max_tokens: maxTokens,
        providers: runtimeConfig,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    consensusOutput.textContent = data.consensus;
    renderCouncil(data.council, data.evaluation);
    systemStatus.textContent = "DECISION READY";
    memoryHistory.unshift({
      prompt,
      answer: data.consensus,
      time: new Date().toLocaleString(),
    });
    memoryHistory = memoryHistory.slice(0, 20);
    saveHistory();
    renderHistory();
    switchView("inference");
  } catch (error) {
    consensusOutput.textContent = `Deliberation failed: ${error.message}`;
    systemStatus.textContent = "FAULT";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "INITIATE MAGI DELIBERATION";
  }
});

async function bootstrap() {
  const [catalogResponse, musicResponse] = await Promise.all([
    fetch("/api/catalog"),
    fetch("/api/music/library"),
  ]);
  catalog = await catalogResponse.json();
  const musicPayload = await musicResponse.json();
  musicLibrary = musicPayload.tracks || [];
  const saved = getSavedConfig();
  memoryHistory = getSavedHistory();
  renderPilotName(getSavedPilotName());
  runtimeConfig = saved;
  buildConfigForm(saved || catalog.recommended);
  renderServerSetupNotice();
  renderMusicLibrary();
  renderHistory();

  if (saved) {
    renderConfiguredProviders(saved);
    consensusOutput.textContent = "Local MAGI configuration restored. Credentials remain server-side.";
    systemStatus.textContent = "STANDBY";
    switchView("inference");
  } else {
    renderConfiguredProviders(catalog.recommended);
    consensusOutput.textContent = "Open the settings deck to configure the MAGI council.";
    systemStatus.textContent = "CONFIG REQUIRED";
    switchView("config");
  }
}

bootstrap().catch((error) => {
  consensusOutput.textContent = `Initialization failed: ${error.message}`;
  systemStatus.textContent = "FAULT";
});
