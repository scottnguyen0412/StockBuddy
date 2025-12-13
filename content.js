class KeywordGenerator {
  constructor() {
    this.currentSite = this.detectSite();
    this.isBatchProcessing = false;
    this.isSingleProcessing = false;
    this.modal = null;
    this.progressBar = null;
    this.observer = null;

    // Cấu hình mặc định
    this.currentProvider = "gemini";
    this.modelName = "google/gemini-2.5-flash-lite";

    this.init();
  }

  detectSite() {
    const hostname = window.location.hostname;
    if (hostname.includes("adobe.com")) return "adobe";
    if (hostname.includes("shutterstock.com")) return "shutterstock";
    return "unknown";
  }

  init() {
    console.log(
      `StockBuddy 2.3 (Custom Scrollbar & UI Fix) khởi động trên: ${this.currentSite}`
    );
    this.injectStyles();
    this.createFloatingButton();
    this.createMainModal();
    this.createProgressUI();
    this.observeDOM();
  }

  observeDOM() {
    this.observer = new MutationObserver((mutations) => {
      this.injectInlineButton();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  injectInlineButton() {
    if (this.currentSite !== "shutterstock") return;

    const descContainer = document.querySelector(
      'div[data-testid="description"]'
    );

    if (
      descContainer &&
      !descContainer.parentNode.querySelector(".sb-inline-btn")
    ) {
      const btn = document.createElement("button");
      btn.className = "sb-inline-btn";
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7m4 0h6m-3-3v6"/>
        </svg>
        Auto Fill
      `;
      btn.title = "Tự động điền Description & Keywords";

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isSingleProcessing) return;
        this.processSingleImage(null, btn);
      };

      descContainer.parentNode.insertBefore(btn, descContainer.nextSibling);
    }
  }

  injectStyles() {
    const style = document.createElement("style");

    let btnGradient, btnShadow, themeColor;
    if (this.currentSite === "adobe") {
      themeColor = "#0061FE";
      btnGradient = "linear-gradient(135deg, #0061FE 0%, #00C6FF 100%)";
      btnShadow = "rgba(0, 97, 254, 0.4)";
    } else {
      themeColor = "#E11D48";
      btnGradient = "linear-gradient(135deg, #E11D48 0%, #C026D3 100%)";
      btnShadow = "rgba(225, 29, 72, 0.4)";
    }

    style.textContent = `
      :root {
        --sb-theme: ${themeColor};
        --sb-font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      @keyframes sb-float { 
        0%, 100% { transform: translateX(-50%) translateY(0); } 
        50% { transform: translateX(-50%) translateY(-6px); } 
      }
      
      .sb-floating-btn {
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 10000;
        background: ${btnGradient}; color: white; padding: 10px 24px 10px 14px;
        display: flex; align-items: center; gap: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 50px;
        box-shadow: 0 10px 25px -5px ${btnShadow};
        cursor: pointer; font-family: var(--sb-font); font-weight: 700; font-size: 15px;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); user-select: none;
        animation: sb-float 4s ease-in-out infinite;
      }
      .sb-floating-btn:hover { transform: translateX(-50%) translateY(-6px) scale(1.05); filter: brightness(1.1); }
      .sb-floating-btn:active { transform: translateX(-50%) scale(0.96); }
      
      .sb-drag-handle { padding: 4px 10px 4px 2px; border-right: 1px solid rgba(255, 255, 255, 0.3); display: flex; align-items: center; color: rgba(255, 255, 255, 0.8); cursor: grab; }
      .sb-btn-content { display: flex; align-items: center; gap: 8px; }
      .sb-logo-text { text-shadow: 0 1px 2px rgba(0,0,0,0.1); }

      /* --- MODAL STYLES --- */
      .sb-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.4); backdrop-filter: blur(8px); z-index: 10001; display: none; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.2s; }
      .sb-modal-overlay.active { display: flex; opacity: 1; }
      
      .sb-modal { 
        background: rgba(255, 255, 255, 0.98); 
        width: 480px; 
        border-radius: 24px; 
        box-shadow: 0 20px 60px -15px rgba(0,0,0,0.2); 
        font-family: var(--sb-font); 
        transform: scale(0.95); transition: transform 0.2s; 
        border: 1px solid #fff; 
        color: #1f2937; 
        overflow: hidden; /* Bo góc đẹp hơn */
      }
      .sb-modal-overlay.active .sb-modal { transform: scale(1); }
      
      .sb-header { padding: 18px 24px; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center; background: #fff; }
      .sb-title { font-size: 18px; font-weight: 700; color: #111; margin: 0; display: flex; align-items: center; gap: 8px; }
      .sb-close { cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #666; background: #f3f4f6; transition: all 0.2s; font-size: 20px; line-height: 1; }
      .sb-close:hover { background: #e5e7eb; color: #000; }
      
      /* --- CUSTOM SCROLLBAR & BODY --- */
      .sb-body { 
        padding: 24px; 
        max-height: 75vh; 
        overflow-y: auto; 
        overflow-x: hidden;
      }

      /* Thanh cuộn đẹp */
      .sb-body::-webkit-scrollbar { width: 6px; }
      .sb-body::-webkit-scrollbar-track { background: transparent; }
      .sb-body::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.15); border-radius: 10px; }
      .sb-body::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.25); }

      /* Form Elements */
      .sb-form-group { margin-bottom: 20px; }
      .sb-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px; }
      .sb-input-wrapper { position: relative; }
      
      .sb-input { 
        width: 100%; padding: 12px 12px 12px 40px; 
        background: #fff !important; 
        border: 2px solid #e5e7eb; border-radius: 12px; 
        font-size: 14px; color: #111 !important; 
        transition: all 0.2s; box-sizing: border-box; 
      }
      
      /* Fix Select Box Styles */
      .sb-select { 
        width: 100%; padding: 12px; 
        background-color: #fff !important; 
        color: #1f2937 !important; 
        border: 2px solid #e5e7eb; border-radius: 12px; 
        font-size: 14px; box-sizing: border-box; cursor: pointer; 
        font-family: var(--sb-font); 
        appearance: none; -webkit-appearance: none; -moz-appearance: none;
        opacity: 1 !important; 
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); 
        background-repeat: no-repeat; background-position: right 1rem center; background-size: 1em; 
      }
      .sb-select option { color: #1f2937; background: #fff; padding: 10px; }
      
      .sb-select:focus, .sb-input:focus { border-color: var(--sb-theme); box-shadow: 0 0 0 4px rgba(0,0,0,0.05); outline: none; }
      .sb-icon-key { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9CA3AF; font-size: 16px; }
      
      .sb-btn-save { width: 100%; padding: 14px; border: none; border-radius: 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; cursor: pointer; margin-top: 10px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); display: flex; justify-content: center; align-items: center; gap: 8px; transition: all 0.2s; }
      .sb-btn-save:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35); }
      
      .sb-checkbox-group { display: flex; align-items: center; gap: 12px; margin-top: 20px; margin-bottom: 20px; padding: 14px; border-radius: 12px; background: #f9fafb; border: 1px solid #e5e7eb; cursor: pointer; transition: all 0.2s; }
      .sb-checkbox-group:hover { background: #fff; border-color: #d1d5db; }
      .sb-checkbox-group input { width: 18px; height: 18px; accent-color: var(--sb-theme); cursor: pointer; }
      .sb-checkbox-text { font-size: 14px; font-weight: 600; color: #374151; }
      
      .sb-divider { height: 1px; background: #e5e7eb; margin: 24px 0; position: relative; }
      .sb-divider::after { content: 'ACTIONS'; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #fff; padding: 0 10px; color: #9ca3af; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
      
      .sb-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px; }
      .sb-btn-big { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 8px; transition: all 0.25s; position: relative; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
      .sb-btn-big:hover { transform: translateY(-4px); box-shadow: 0 15px 30px -5px rgba(0,0,0,0.08); border-color: transparent; }
      .sb-big-icon-wrap { width: 38px; height: 38px; border-radius: 10px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: all 0.2s; color: #666; }
      .sb-big-title { color: #111; font-size: 14px; font-weight: 700; }
      .sb-big-desc { color: #6b7280; font-size: 11px; margin-top: 0px; }
      .sb-btn-single:hover .sb-big-icon-wrap { background: var(--sb-theme); color: white; transform: rotate(-5deg) scale(1.1); box-shadow: 0 5px 15px -5px var(--sb-theme); }
      .sb-btn-batch:hover .sb-big-icon-wrap { background: #F59E0B; color: white; transform: rotate(5deg) scale(1.1); box-shadow: 0 5px 15px -5px #F59E0B; }
      .sb-btn-stop { width: 100%; padding: 14px; border-radius: 12px; border:none; background: #EF4444; color: white; cursor:pointer; font-weight:700; margin-top:10px; }

      .sb-footer { margin-top: 24px; text-align: center; font-size: 11px; color: #9ca3af; font-weight: 500; letter-spacing: 0.5px; opacity: 0.8; transition: opacity 0.2s; }
      .sb-footer:hover { opacity: 1; color: var(--sb-theme); }

      /* Toast & Progress */
      .sb-toast { position: fixed; top: 24px; right: 24px; z-index: 10005; padding: 14px 20px; border-radius: 12px; color: #fff; font-weight: 600; font-family: var(--sb-font); animation: sbSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 10px 30px -5px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px; font-size: 14px; }
      .sb-toast.success { background: #10B981; } .sb-toast.error { background: #EF4444; } .sb-toast.info { background: #3B82F6; }
      @keyframes sbSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .sb-progress-container { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(20px); width: 340px; background: rgba(255, 255, 255, 0.95); border: 1px solid white; padding: 16px 24px; border-radius: 20px; box-shadow: 0 20px 50px -10px rgba(0,0,0,0.15); z-index: 10002; display: none; opacity: 0; transition: all 0.3s; color: #333; text-align: center; backdrop-filter: blur(10px); }
      .sb-progress-container.active { display: block; opacity: 1; transform: translateX(-50%) translateY(0); }
      .sb-progress-info { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #555; font-weight: 600; }
      .sb-progress-bar-bg { width: 100%; height: 6px; background: #e5e7eb; border-radius: 10px; overflow: hidden; }
      .sb-progress-bar-fill { height: 100%; background: var(--sb-theme); width: 0%; transition: width 0.3s ease; border-radius: 10px; }
      .sb-highlight-img { outline: 4px solid var(--sb-theme) !important; outline-offset: -4px; transition: outline 0.3s; }
      .sb-inline-btn { margin-top: 12px; width: 100%; padding: 10px; background: #fff; color: #E11D48; border: 1px solid #FECDD3; border-radius: 8px; font-family: var(--sb-font); font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
      .sb-inline-btn:hover { background: #E11D48; color: white; transform: translateY(-1px); }
      
      .sb-hidden { display: none !important; }
    `;

    document.head.appendChild(style);
  }

  createFloatingButton() {
    const btn = document.createElement("div");
    btn.className = "sb-floating-btn";

    btn.innerHTML = `
      <div class="sb-drag-handle" title="Kéo để di chuyển">
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor">
          <circle cx="2" cy="2" r="1.5" opacity="0.4"/> <circle cx="8" cy="2" r="1.5" opacity="0.4"/>
          <circle cx="2" cy="8" r="1.5" opacity="0.4"/> <circle cx="8" cy="8" r="1.5" opacity="0.4"/>
          <circle cx="2" cy="14" r="1.5" opacity="0.4"/> <circle cx="8" cy="14" r="1.5" opacity="0.4"/>
        </svg>
      </div>
      <div class="sb-btn-content">
        <span style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🤖</span> 
        <span class="sb-logo-text">StockBuddy AI</span>
      </div>
    `;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    btn.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = btn.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      btn.style.bottom = "auto";
      btn.style.right = "auto";
      btn.style.left = `${initialLeft}px`;
      btn.style.top = `${initialTop}px`;
      btn.style.transform = "none";
      btn.style.animation = "none";
      btn.style.transition = "none";
      btn.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      btn.style.left = `${initialLeft + dx}px`;
      btn.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        btn.style.transition = "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        btn.style.cursor = "pointer";
      }
    });

    btn.addEventListener("click", (e) => {
      if (e.target.closest(".sb-drag-handle")) return;
      if (!isDragging) this.openModal();
    });

    document.body.appendChild(btn);
  }

  createProgressUI() {
    const div = document.createElement("div");
    div.className = "sb-progress-container";
    div.innerHTML = `
      <div class="sb-progress-info">
        <span id="sb-progress-text">Đang xử lý...</span>
        <span id="sb-progress-percent">0%</span>
      </div>
      <div class="sb-progress-bar-bg">
        <div class="sb-progress-bar-fill" id="sb-progress-fill"></div>
      </div>
    `;
    document.body.appendChild(div);
    this.progressBar = div;
  }

  updateProgress(current, total, message = null) {
    if (!this.progressBar) return;
    this.progressBar.classList.add("active");

    const textEl = document.getElementById("sb-progress-text");
    const percentEl = document.getElementById("sb-progress-percent");

    if (message) textEl.textContent = message;
    else textEl.textContent = `Processing image ${current} of ${total}`;

    const percent = Math.round((current / total) * 100);
    const fillEl = document.getElementById("sb-progress-fill");

    fillEl.style.width = `${percent}%`;
    percentEl.textContent = `${percent}%`;
  }

  hideProgress() {
    if (this.progressBar) {
      this.progressBar.classList.remove("active");
    }
  }

  // --- MAIN MODAL ---
  createMainModal() {
    const overlay = document.createElement("div");
    overlay.className = "sb-modal-overlay";

    overlay.innerHTML = `
      <div class="sb-modal">
        <div class="sb-header">
          <h3 class="sb-title">
            <span>✨</span> StockBuddy <span style="font-weight:400; color:#888; font-size:14px; margin-left:5px;">AI v2.3</span>
          </h3>
          <div class="sb-close">&times;</div>
        </div>
        
        <div class="sb-body">
          
          <div class="sb-form-group">
            <label class="sb-label">AI Provider</label>
            <select id="sb-provider-select" class="sb-select">
              <option value="gemini">Google Gemini (Free)</option>
              <option value="openrouter">OpenRouter (Nhiều Model)</option>
            </select>
          </div>

          <div id="sb-group-gemini" class="sb-form-group">
            <label class="sb-label">Gemini API Key</label>
            <div class="sb-input-wrapper">
              <span class="sb-icon-key">🔑</span>
              <input type="password" id="sb-api-key" class="sb-input" placeholder="Nhập khóa API của bạn...">
            </div>
          </div>

          <div id="sb-group-openrouter" class="sb-form-group sb-hidden">
            <label class="sb-label" style="margin-top: 16px;">OpenRouter API Key</label>
            <div class="sb-input-wrapper" style="margin-bottom:16px;">
              <span class="sb-icon-key">🔑</span>
              <input type="password" id="sb-or-key" class="sb-input" placeholder="sk-or-v1-...">
            </div>

            <label  class="sb-label">Chọn Model</label>
            <select id="sb-or-model-select" class="sb-select">
              <option value="google/gemini-2.5-flash-lite">Google: Gemini 2.5 Flash-lite (Khuyên dùng)</option>
              <option value="google/gemini-pro-1.5">Google: Gemini 1.5 Pro</option>
              <option value="openai/gpt-4o-mini">OpenAI: GPT-4o Mini</option>
              <option value="openai/gpt-4o">OpenAI: GPT-4o</option>
              <option value="anthropic/claude-3.5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
              <option value="custom">-- Tự nhập Model ID khác --</option>
            </select>
            
            <div id="sb-or-custom-model-wrapper" class="sb-input-wrapper sb-hidden" style="margin-top:10px;">
                <input type="text" id="sb-or-custom-model" class="sb-input" placeholder="Ví dụ: google/gemma-7b-it">
            </div>
          </div>

          <button id="sb-save-settings" class="sb-btn-save">
            <span>💾</span> Lưu thiết lập
          </button>

          <label class="sb-checkbox-group" for="sb-skip-filled">
            <input type="checkbox" id="sb-skip-filled" checked>
            <span class="sb-checkbox-text">Bỏ qua các ảnh đã có nội dung</span>
          </label>

          <div class="sb-divider"></div>

          <div class="sb-actions-grid" id="sb-start-actions">
            <button id="sb-run-single" class="sb-btn-big sb-btn-single">
              <div class="sb-big-icon-wrap">⚡</div>
              <div>
                <div class="sb-big-title">Xử lý 1 ảnh</div>
                <div class="sb-big-desc">Phân tích ảnh đang chọn</div>
              </div>
            </button>
            
            <button id="sb-run-batch" class="sb-btn-big sb-btn-batch">
              <div class="sb-big-icon-wrap">📦</div>
              <div>
                <div class="sb-big-title">Chạy hàng loạt</div>
                <div class="sb-big-desc">Tự động xử lý tất cả</div>
              </div>
            </button>
          </div>
          
          <button id="sb-stop-batch" class="sb-btn-stop" style="display:none">
            🛑 Dừng xử lý
          </button>

          <div class="sb-footer">
            Made with ❤️ by Khoi Nguyen
          </div>
        </div>
      </div>
    `;

    // --- SỰ KIỆN ---
    const closeBtn = overlay.querySelector(".sb-close");
    closeBtn.onclick = () => overlay.classList.remove("active");
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.classList.remove("active");
    };

    // Toggle logic
    const providerSelect = overlay.querySelector("#sb-provider-select");
    const groupGemini = overlay.querySelector("#sb-group-gemini");
    const groupOR = overlay.querySelector("#sb-group-openrouter");

    providerSelect.onchange = () => {
      if (providerSelect.value === "gemini") {
        groupGemini.classList.remove("sb-hidden");
        groupOR.classList.add("sb-hidden");
      } else {
        groupGemini.classList.add("sb-hidden");
        groupOR.classList.remove("sb-hidden");
      }
    };

    const modelSelect = overlay.querySelector("#sb-or-model-select");
    const customModelWrapper = overlay.querySelector(
      "#sb-or-custom-model-wrapper"
    );

    modelSelect.onchange = () => {
      if (modelSelect.value === "custom") {
        customModelWrapper.classList.remove("sb-hidden");
      } else {
        customModelWrapper.classList.add("sb-hidden");
      }
    };

    overlay.querySelector("#sb-save-settings").onclick = () =>
      this.saveSettings();
    overlay.querySelector("#sb-run-single").onclick = () => {
      overlay.classList.remove("active");
      this.processSingleImage();
    };
    overlay.querySelector("#sb-run-batch").onclick = () => {
      overlay.classList.remove("active");
      this.startBatchProcessing();
    };
    overlay.querySelector("#sb-stop-batch").onclick = () => {
      this.isBatchProcessing = false;
      this.updateBatchButtonUI(false);
    };

    document.body.appendChild(overlay);
    this.modal = overlay;
  }

  async openModal() {
    const data = await chrome.storage.sync.get([
      "apiKey",
      "provider",
      "openRouterKey",
      "modelName",
    ]);

    // Fill Gemini
    if (data.apiKey) document.getElementById("sb-api-key").value = data.apiKey;

    // Fill OpenRouter
    if (data.openRouterKey)
      document.getElementById("sb-or-key").value = data.openRouterKey;

    // Fill Model Logic
    const savedModel = data.modelName || "google/gemini-2.5-flash-lite";
    const modelSelect = document.getElementById("sb-or-model-select");
    const customInput = document.getElementById("sb-or-custom-model");

    const options = Array.from(modelSelect.options).map((o) => o.value);
    if (options.includes(savedModel)) {
      modelSelect.value = savedModel;
      customInput.value = "";
    } else {
      modelSelect.value = "custom";
      customInput.value = savedModel;
    }

    // Provider
    const providerSelect = document.getElementById("sb-provider-select");
    providerSelect.value = data.provider || "gemini";

    // Trigger UI events (quan trọng để cập nhật UI)
    providerSelect.dispatchEvent(new Event("change"));
    modelSelect.dispatchEvent(new Event("change"));

    this.updateBatchButtonUI(this.isBatchProcessing);
    this.modal.classList.add("active");
  }

  async saveSettings() {
    const provider = document.getElementById("sb-provider-select").value;
    const apiKey = document.getElementById("sb-api-key").value.trim();
    const openRouterKey = document.getElementById("sb-or-key").value.trim();

    let modelName = document.getElementById("sb-or-model-select").value;
    if (modelName === "custom") {
      modelName = document.getElementById("sb-or-custom-model").value.trim();
    }

    if (provider === "gemini" && !apiKey) {
      this.showToast("Vui lòng nhập Gemini API Key!", "error");
      return;
    }
    if (provider === "openrouter") {
      if (!openRouterKey) {
        this.showToast("Vui lòng nhập OpenRouter API Key!", "error");
        return;
      }
      if (!modelName) {
        this.showToast("Vui lòng chọn hoặc nhập tên Model!", "error");
        return;
      }
    }

    await chrome.storage.sync.set({
      apiKey,
      provider,
      openRouterKey,
      modelName,
    });

    const btn = document.getElementById("sb-save-settings");
    const oldText = btn.textContent;
    btn.textContent = "✅ Đã lưu!";
    btn.style.color = "green";
    btn.style.borderColor = "green";
    setTimeout(() => {
      btn.textContent = oldText;
      btn.style.color = "";
      btn.style.borderColor = "";
    }, 2000);
  }

  updateBatchButtonUI(isRunning) {
    const actionsGrid = document.getElementById("sb-start-actions");
    const stopBtn = document.getElementById("sb-stop-batch");

    if (isRunning) {
      actionsGrid.style.display = "none";
      stopBtn.style.display = "flex";
    } else {
      actionsGrid.style.display = "grid";
      stopBtn.style.display = "none";
    }
  }

  showToast(message, type = "info") {
    const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
    const toast = document.createElement("div");
    toast.className = `sb-toast ${type}`;
    toast.innerHTML = `<span style="font-size:18px">${
      icons[type] || ""
    }</span> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- API HANDLERS ---

  async callGeminiAPI(base64, apiKey) {
    const prompt = `Analyze this stock photo and generate:
            1. A compelling title (max 200 chars, suitable for stock photography).
               IMPORTANT: Do NOT include any personal names, photographer names, or "By [Name]".
               IMPORTANT: Do NOT use special characters like "&", "|", or single quotes (') in the title. Keep it clean text.
            2. 30-45 relevant keywords separated by commas.
            Make it SEO-friendly and descriptive. Format as JSON:
            {
              "title": "Title here",
              "keywords": "keyword1, keyword2, ..."
            }`;
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: base64 } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    else throw new Error("Invalid JSON response");
  }

  // --- UPDATED: Sửa Prompt OpenRouter ---
  async callOpenRouterAPI(base64, apiKey, model) {
    // Thêm yêu cầu "minimum 6 words" vào prompt
    const prompt = `Analyze this stock photo and generate:
            1. A compelling title (minimum 6 words, max 200 chars, suitable for stock photography).
               IMPORTANT: Do NOT include any personal names, photographer names, or "By [Name]".
               IMPORTANT: Do NOT use special characters like "&", "|", or single quotes (') in the title. Keep it clean text.
            2. 30-45 relevant keywords separated by commas.
            Make it SEO-friendly and descriptive. Format as JSON:
            {
              "title": "Title here",
              "keywords": "keyword1, keyword2, ..."
            }
            ONLY RETURN THE JSON.`;

    const url = "https://openrouter.ai/api/v1/chat/completions";
    const body = {
      model: model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
              },
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://stockbuddy-extension.com",
        "X-Title": "StockBuddy Extension",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error("Invalid JSON response from OpenRouter");
    }
  }

  // --- HELPERS (Hack React Input) ---
  simulateInput(element, value, shouldBlur = true) {
    if (!element) return;
    element.focus();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;

    if (
      element.tagName.toLowerCase() === "textarea" &&
      nativeTextAreaValueSetter
    ) {
      nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    if (shouldBlur) element.blur();
  }

  simulateEnter(element) {
    if (!element) return;
    element.focus();
    const options = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
    };
    element.dispatchEvent(new KeyboardEvent("keydown", options));
    element.dispatchEvent(new KeyboardEvent("keypress", options));
    element.dispatchEvent(new KeyboardEvent("keyup", options));
  }

  findElementBySelectors(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  hasExistingData() {
    if (this.currentSite === "adobe") {
      const titleSelectors = [
        "textarea.title-input",
        'input[data-testid="title"]',
        'textarea[data-testid="title"]',
        'input[name="title"]',
        '[placeholder*="title" i]',
      ];
      const titleInput = this.findElementBySelectors(titleSelectors);
      const hasTitle = titleInput && titleInput.value.trim().length > 3;

      const keywordInput =
        document.querySelector('textarea[name="keywordsUITextArea"]') ||
        document.getElementById("content-keywords-ui-textarea");
      let keywordCount = 0;
      if (keywordInput && keywordInput.value) {
        keywordCount = keywordInput.value
          .split(",")
          .filter((kw) => kw.trim().length > 0).length;
      }
      const hasKeys = keywordCount >= 5;

      return hasTitle && hasKeys;
    } else if (this.currentSite === "shutterstock") {
      const descInput = document.querySelector('textarea[name="description"]');
      const hasDesc = descInput && descInput.value.trim().length > 5;
      const existingKeywords = document.querySelectorAll(
        '[data-testid="keyword-chip"], .MuiChip-root, button[aria-label^="Remove"]'
      );
      const hasKeys = existingKeywords.length >= 3;
      return hasDesc && hasKeys;
    }
    return false;
  }

  findActiveImage() {
    if (this.currentSite === "adobe") {
      return (
        document.querySelector(".infer-preview-image img") ||
        document.querySelector(".upload-tile__wrapper.active img")
      );
    }

    if (this.currentSite === "shutterstock") {
      const sidebarImg = document.querySelector(
        'img[src*="pending_photos"][style*="max-height"]'
      );
      if (sidebarImg) return sidebarImg;

      const activeCardImg = document.querySelector(
        'div[aria-checked="true"] img[data-testid^="card-media-"]'
      );
      if (activeCardImg) return activeCardImg;

      const focusedWrapper = document.querySelector(
        'div[tabindex="0"] img[data-testid^="card-media-"]'
      );
      if (focusedWrapper) return focusedWrapper;

      if (this.isSingleProcessing) {
        const firstImg = document.querySelector(
          'img[data-testid^="card-media-"]'
        );
        if (firstImg) return firstImg;
      }
    }
    return null;
  }

  async processSingleImage(specificImgSrc = null, btnElement = null) {
    console.log("🚀 [START] Bắt đầu hàm processSingleImage");

    this.isSingleProcessing = false;
    this.isSingleProcessing = true;

    let originalBtnText = "";
    if (btnElement) {
      originalBtnText = btnElement.innerHTML;
      btnElement.innerHTML = '<div class="sb-spinner"></div>';
      btnElement.disabled = true;
    }

    let imgElement = null;
    let imgSrc = specificImgSrc;

    if (!imgSrc) {
      imgElement = this.findActiveImage();
      if (!imgElement) {
        console.warn("⚠️ Không tìm thấy element ảnh nào active/checked");
        this.showToast("Không tìm thấy ảnh đang chọn!", "error");
        this.resetSingleState(btnElement, originalBtnText);
        return;
      }
      imgSrc = imgElement.src;
      console.log("📷 Tìm thấy ảnh gốc:", imgSrc);

      if (imgElement) {
        imgElement.classList.add("sb-highlight-img");
        setTimeout(() => imgElement.classList.remove("sb-highlight-img"), 1000);
      }
    } else {
      console.log("📷 Dùng ảnh từ tham số truyền vào:", imgSrc);
    }

    try {
      const settings = await chrome.storage.sync.get([
        "apiKey",
        "provider",
        "openRouterKey",
        "modelName",
      ]);
      const provider = settings.provider || "gemini";

      this.showToast(
        `${
          provider === "openrouter" ? "OpenRouter" : "Gemini"
        } đang phân tích...`,
        "info"
      );

      const base64 = await this.urlToBase64(imgSrc);

      let result;
      if (provider === "openrouter") {
        if (!settings.openRouterKey)
          throw new Error("Chưa nhập OpenRouter API Key!");
        const model = settings.modelName || "google/gemini-2.5-flash-lite";
        result = await this.callOpenRouterAPI(
          base64,
          settings.openRouterKey,
          model
        );
      } else {
        if (!settings.apiKey) throw new Error("Chưa nhập Gemini API Key!");
        result = await this.callGeminiAPI(base64, settings.apiKey);
      }

      await this.fillForms(result);
      this.showToast("Đã điền xong!", "success");
    } catch (e) {
      console.error("💥 [CRITICAL ERROR]:", e);
      this.showToast(`Lỗi: ${e.message}`, "error");
      if (e.message.includes("Key")) this.openModal();
    } finally {
      console.log("🏁 [END] Kết thúc quy trình");
      this.resetSingleState(btnElement, originalBtnText);
    }
  }

  resetSingleState(btn, originalText) {
    this.isSingleProcessing = false;
    if (btn && originalText) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  async urlToBase64(url) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: "fetchImageBase64", url: url },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "🔥 [Lỗi Kết Nối] Không gọi được Background.",
                chrome.runtime.lastError
              );
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response && response.success) {
              resolve(response.data);
            } else {
              console.error("❌ [3] Background báo lỗi tải ảnh:", response);
              reject(
                new Error(
                  response ? response.error : "Unknown error fetching image"
                )
              );
            }
          }
        );
      } catch (e) {
        console.error("💥 Lỗi khi gửi message:", e);
        reject(e);
      }
    });
  }

  async fillForms(data) {
    const desc = data.title;
    const keys = data.keywords;

    // --- ADOBE STOCK ---
    if (this.currentSite === "adobe") {
      const titleSelectors = [
        "textarea.title-input",
        'input[data-testid="title"]',
        'textarea[data-testid="title"]',
        'input[name="title"]',
      ];
      const titleInput = this.findElementBySelectors(titleSelectors);

      const keywordSelectors = [
        "textarea[name=keywordsUITextArea]",
        "textarea.keywords-input",
        'input[name="keywords"]',
      ];
      const keysInput = this.findElementBySelectors(keywordSelectors);

      if (titleInput) this.simulateInput(titleInput, desc, true);
      if (keysInput) {
        this.simulateInput(keysInput, keys, true);
        this.simulateEnter(keysInput);
      }
    }

    // --- SHUTTERSTOCK ---
    else if (this.currentSite === "shutterstock") {
      console.log("📍 Đang xử lý Shutterstock...");

      const descInput =
        document.querySelector('textarea[name="description"]') ||
        document.querySelector('textarea[data-testid="description-input"]');

      if (descInput) {
        descInput.focus();
        descInput.value = "";
        this.simulateInput(descInput, desc, true);
      }

      const keyInputSelectors = [
        'input[aria-label="Keywords"]',
        'input[placeholder*="keyword"]',
        'div[data-testid="tag-input"] input',
        'input[id*="chip-input"]',
      ];
      const keysInput = this.findElementBySelectors(keyInputSelectors);

      if (keysInput) {
        keysInput.focus();
        const keywordList = keys
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0);

        for (const key of keywordList) {
          this.simulateInput(keysInput, key, false);
          await new Promise((r) => setTimeout(r, 50));
          this.simulateEnter(keysInput);
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }
  }

  async startBatchProcessing() {
    const skipFilled = document.getElementById("sb-skip-filled").checked;
    let items = [];

    if (this.currentSite === "adobe")
      items = document.querySelectorAll(".upload-tile__wrapper");
    else items = document.querySelectorAll('img[data-testid^="card-media-"]');

    if (!items.length) {
      this.showToast("Không tìm thấy ảnh nào!", "error");
      return;
    }

    this.isBatchProcessing = true;
    this.updateBatchButtonUI(true);
    this.updateProgress(0, items.length, "Đang khởi động...");

    for (let i = 0; i < items.length; i++) {
      if (!this.isBatchProcessing) break;
      const item = items[i];
      let thumbnailSrc = "";

      this.updateProgress(i + 1, items.length);

      if (this.currentSite === "adobe") {
        item.click();
        thumbnailSrc = item.querySelector("img").src;
      } else {
        const clickable = item.closest("div[tabindex]") || item.parentElement;
        if (clickable) clickable.click();
        thumbnailSrc = item.src;
      }

      await new Promise((r) => setTimeout(r, 2000));

      if (skipFilled && this.hasExistingData()) {
        this.updateProgress(
          i + 1,
          items.length,
          `Ảnh ${i + 1}: Đã có dữ liệu. Bỏ qua...`
        );
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      this.updateProgress(i + 1, items.length, `Ảnh ${i + 1}: Đang gọi AI...`);
      await this.processSingleImage(thumbnailSrc);

      if (this.currentSite === "shutterstock") {
        await new Promise((r) => setTimeout(r, 1500));
        this.updateProgress(i + 1, items.length, `Ảnh ${i + 1}: Đang lưu...`);
        await this.saveShutterstock();

        for (let s = 3; s > 0; s--) {
          this.updateProgress(
            i + 1,
            items.length,
            `Ảnh ${i + 1}: Đợi ${s}s...`
          );
          await new Promise((r) => setTimeout(r, 1000));
        }
      } else {
        await this.autoSaveAdobe();
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    this.isBatchProcessing = false;
    this.updateBatchButtonUI(false);
    this.hideProgress();
    this.showToast("Hoàn tất xử lý Batch!", "success");
  }

  async saveShutterstock() {
    const selector = 'button[data-testid="edit-dialog-save-button"]';
    let saveBtn = null;
    for (let k = 0; k < 5; k++) {
      saveBtn = document.querySelector(selector);
      if (saveBtn && !saveBtn.disabled) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (saveBtn && !saveBtn.disabled) {
      saveBtn.click();
    } else {
      const allBtns = Array.from(document.querySelectorAll("button"));
      const fallbackBtn = allBtns.find(
        (b) => b.textContent.trim() === "Save" && !b.disabled
      );
      if (fallbackBtn) fallbackBtn.click();
    }
  }

  async autoSaveAdobe() {
    const saveBtn = document.querySelector('button[data-t="save-work"]');
    if (saveBtn) {
      saveBtn.click();
    }
  }
}

new KeywordGenerator();
