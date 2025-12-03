class KeywordGenerator {
  constructor() {
    this.currentSite = this.detectSite();
    this.isBatchProcessing = false;
    this.isSingleProcessing = false;
    this.modal = null;
    this.progressBar = null;
    this.observer = null;
    this.init();
  }

  detectSite() {
    const hostname = window.location.hostname;
    if (hostname.includes("adobe.com")) return "adobe";
    if (hostname.includes("shutterstock.com")) return "shutterstock";
    return "unknown";
  }

  init() {
    console.log(`StockBuddy 2.0 (Fixed) khởi động trên: ${this.currentSite}`);
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

  // --- UPDATED: Sửa vị trí nút Inline cho Shutterstock ---
  injectInlineButton() {
    if (this.currentSite !== "shutterstock") return;

    // Selector chuẩn xác dựa trên HTML bạn cung cấp
    const descContainer = document.querySelector(
      'div[data-testid="description"]'
    );

    // Chỉ chèn nếu chưa có nút
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
        // Truyền null để hàm findActiveImage tự đi tìm ảnh gốc
        this.processSingleImage(null, btn);
      };

      // Chèn nút vào SAU container description để giao diện đẹp hơn
      descContainer.parentNode.insertBefore(btn, descContainer.nextSibling);
    }
  }

  injectStyles() {
    const style = document.createElement('style');
    
    // Theme màu cho StockBuddy AI Button (Electric Style)
    let mainGradient, glowColor;
    if (this.currentSite === 'adobe') {
        // Adobe: Electric Blue -> Neon Purple
        mainGradient = 'linear-gradient(120deg, #2563EB, #7C3AED, #2563EB)';
        glowColor = 'rgba(37, 99, 235, 0.5)';
    } else {
        // SS: Electric Red -> Hot Pink -> Orange
        mainGradient = 'linear-gradient(120deg, #E11D48, #db2777, #f59e0b, #E11D48)';
        glowColor = 'rgba(225, 29, 72, 0.5)';
    }
    
    style.textContent = `
      :root {
        --sb-font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      /* --- ANIMATIONS --- */
      @keyframes sb-stream {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; } /* Chạy mượt mà liên tục */
      }
      @keyframes sb-float { 
        0%, 100% { transform: translateX(-50%) translateY(0); } 
        50% { transform: translateX(-50%) translateY(-5px); } 
      }

      /* --- FLOATING BUTTON (Electric Stream) --- */
      .sb-floating-btn {
        position: fixed; 
        bottom: 30px; left: 50%; transform: translateX(-50%);
        z-index: 10000;
        
        /* Gradient đa sắc chạy liên tục */
        background: ${mainGradient};
        background-size: 200% auto;
        animation: sb-stream 4s linear infinite, sb-float 5s ease-in-out infinite;
        
        color: white;
        padding: 10px 24px 10px 14px;
        display: flex; align-items: center; gap: 12px;
        
        /* Viền sáng nhẹ */
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50px;
        
        /* Shadow Glow lan tỏa */
        box-shadow: 0 10px 25px -5px ${glowColor}, 0 0 10px rgba(255,255,255,0.2) inset;
            
        cursor: pointer;
        font-family: var(--sb-font); font-weight: 700; font-size: 15px;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        user-select: none;
      }

      /* Hover: Sáng rực & Nổi lên */
      .sb-floating-btn:hover {
        transform: translateX(-50%) translateY(-6px) scale(1.05);
        box-shadow: 0 20px 40px -10px ${glowColor}, 0 0 0 3px rgba(255,255,255,0.3);
        filter: brightness(1.1);
      }
      
      .sb-floating-btn:active { transform: translateX(-50%) scale(0.96); }

      /* Drag Handle */
      .sb-drag-handle {
        padding: 4px 10px 4px 2px;
        border-right: 1px solid rgba(255, 255, 255, 0.4);
        display: flex; align-items: center;
        color: rgba(255, 255, 255, 0.9);
        cursor: grab;
      }
      .sb-drag-handle:hover { color: white; }
      .sb-drag-handle:active { cursor: grabbing; }

      .sb-btn-content { display: flex; align-items: center; gap: 8px; }
      .sb-logo-text { text-shadow: 0 1px 3px rgba(0,0,0,0.2); }


      /* --- MODAL (Clean Light) --- */
      .sb-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(5px); z-index: 10001; display: none; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.2s; }
      .sb-modal-overlay.active { display: flex; opacity: 1; }
      
      .sb-modal { 
        background: #fff; width: 440px; border-radius: 24px; 
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); 
        font-family: var(--sb-font); transform: scale(0.95); transition: transform 0.2s; 
        overflow: hidden;
      }
      .sb-modal-overlay.active .sb-modal { transform: scale(1); }
      
      .sb-header { padding: 20px 28px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; background: #fff; }
      .sb-title { font-size: 18px; font-weight: 800; color: #111; margin: 0; display: flex; align-items: center; gap: 8px; }
      .sb-close { cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #999; background: #f3f4f6; transition: all 0.2s; }
      .sb-close:hover { background: #e5e7eb; color: #111; }
      
      .sb-body { padding: 28px; }
      
      /* Input style */
      .sb-label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #4b5563; margin-bottom: 8px; letter-spacing: 0.5px; }
      .sb-input-wrapper { position: relative; }
      .sb-input { width: 100%; padding: 14px 14px 14px 40px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 14px; color: #1f2937; transition: all 0.2s; box-sizing: border-box; }
      .sb-input:focus { background: #fff; border-color: #2563EB; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); outline: none; }
      .sb-icon-key { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9CA3AF; font-size: 16px; }
      
      /* --- SAVE BUTTON (NEW MODERN STYLE) --- */
      .sb-btn-save { 
        width: 100%; padding: 14px; border: none; border-radius: 12px; 
        /* Gradient Xanh Mint hiện đại */
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        color: white; cursor: pointer; margin-top: 16px; 
        font-size: 14px; font-weight: 700; letter-spacing: 0.5px;
        transition: all 0.2s; 
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        display: flex; justify-content: center; align-items: center; gap: 8px;
      }
      .sb-btn-save:hover { 
        transform: translateY(-2px); 
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35); 
        filter: brightness(1.05);
      }
      .sb-btn-save:active { transform: scale(0.98); }

      /* --- CHECKBOX GROUP (Cải thiện layout) --- */
      .sb-checkbox-group { 
        display: flex; align-items: center; gap: 12px; 
        margin-top: 24px; /* Tăng khoảng cách với nút Save */
        margin-bottom: 24px; 
        padding: 16px; border-radius: 12px; 
        background: #f9fafb; border: 1px solid #e5e7eb; 
        cursor: pointer; transition: all 0.2s; 
      }
      .sb-checkbox-group:hover { background: #fff; border-color: #d1d5db; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
      .sb-checkbox-group input { width: 18px; height: 18px; accent-color: #2563EB; cursor: pointer; }
      .sb-checkbox-text { font-size: 14px; font-weight: 600; color: #374151; }

      .sb-divider { 
        height: 1px; background: #e5e7eb; margin: 28px 0; position: relative; 
      }
      .sb-divider::after { 
        content: 'BẮT ĐẦU XỬ LÝ'; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); 
        background: #fff; padding: 0 12px; color: #9ca3af; font-size: 11px; font-weight: 800; letter-spacing: 1px; 
      }

      /* Buttons Grid (Card Style Light) */
      .sb-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px; }

      .sb-btn-big {
        background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
        padding: 20px; cursor: pointer; text-align: left;
        display: flex; flex-direction: column; gap: 12px;
        transition: all 0.25s; position: relative; overflow: hidden;
        box-shadow: 0 4px 6px rgba(0,0,0,0.02);
      }
      .sb-btn-big:hover { transform: translateY(-4px); box-shadow: 0 15px 30px -5px rgba(0,0,0,0.08); border-color: transparent; }

      .sb-big-icon-wrap {
        width: 42px; height: 42px; border-radius: 12px; background: #f3f4f6;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; transition: all 0.2s; color: #666;
      }
      .sb-big-title { color: #111; font-size: 15px; font-weight: 700; }
      .sb-big-desc { color: #6b7280; font-size: 12px; margin-top: 2px; }

      /* Single Button Hover */
      .sb-btn-single:hover .sb-big-icon-wrap { background: #2563EB; color: white; transform: rotate(-5deg) scale(1.1); box-shadow: 0 5px 15px -5px rgba(37, 99, 235, 0.5); }
      
      /* Batch Button Hover */
      .sb-btn-batch:hover .sb-big-icon-wrap { background: #F59E0B; color: white; transform: rotate(5deg) scale(1.1); box-shadow: 0 5px 15px -5px rgba(245, 158, 11, 0.5); }
      
      .sb-btn-stop { width: 100%; padding: 14px; border-radius: 12px; border:none; background: #EF4444; color: white; cursor:pointer; font-weight:700; margin-top:10px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
      .sb-btn-stop:hover { background: #DC2626; transform: translateY(-2px); }

      /* Progress & Toast */
      .sb-progress-container { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(20px); width: 340px; background: rgba(255, 255, 255, 0.95); border: 1px solid white; padding: 16px 24px; border-radius: 20px; box-shadow: 0 20px 50px -10px rgba(0,0,0,0.15); z-index: 10002; display: none; opacity: 0; transition: all 0.3s; color: #333; text-align: center; backdrop-filter: blur(10px); }
      .sb-progress-container.active { display: block; opacity: 1; transform: translateX(-50%) translateY(0); }
      .sb-progress-info { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #555; font-weight: 600; }
      .sb-progress-bar-bg { width: 100%; height: 6px; background: #e5e7eb; border-radius: 10px; overflow: hidden; }
      .sb-progress-bar-fill { height: 100%; background: linear-gradient(90deg, #2563EB, #7C3AED); width: 0%; transition: width 0.3s ease; border-radius: 10px; }

      .sb-toast { position: fixed; top: 24px; right: 24px; z-index: 10005; padding: 14px 20px; border-radius: 12px; color: #fff; font-weight: 600; font-family: var(--sb-font); animation: sbSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 10px 30px -5px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px; font-size: 14px; border: 1px solid rgba(255,255,255,0.2); }
      .sb-toast.success { background: #10B981; }
      .sb-toast.error { background: #EF4444; }
      .sb-toast.info { background: #3B82F6; }
      @keyframes sbSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .sb-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: sbSpin 0.8s linear infinite; }
      @keyframes sbSpin { to { transform: rotate(360deg); } }
      .sb-highlight-img { outline: 4px solid #2563EB !important; outline-offset: -4px; transition: outline 0.3s; box-shadow: 0 0 0 4px rgba(255,255,255,0.5) inset; }
      .sb-inline-btn { margin-top: 12px; width: 100%; padding: 10px; background: #fff; color: #E11D48; border: 1px solid #FECDD3; border-radius: 8px; font-family: var(--sb-font); font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
      .sb-inline-btn:hover { background: #E11D48; color: white; transform: translateY(-1px); box-shadow: 0 5px 15px rgba(225, 29, 72, 0.25); }
    `;
    
    document.head.appendChild(style);
  }

  createFloatingButton() {
    const btn = document.createElement('div');
    btn.className = 'sb-floating-btn';
    
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

    btn.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = btn.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      
      btn.style.bottom = 'auto'; 
      btn.style.right = 'auto';
      btn.style.left = `${initialLeft}px`;
      btn.style.top = `${initialTop}px`;
      btn.style.transform = 'none'; // Tắt animation float và center khi kéo
      btn.style.animation = 'none';
      
      btn.style.transition = 'none'; 
      btn.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      btn.style.left = `${initialLeft + dx}px`;
      btn.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      if(isDragging) {
        isDragging = false;
        btn.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'; 
        btn.style.cursor = 'pointer';
        // Khôi phục animation float nhẹ khi thả ra (optional, nhưng cần cẩn thận với transform)
        // Ở đây ta không khôi phục animation để tránh nút bị nhảy vị trí
      }
    });

    btn.addEventListener('click', (e) => {
      if (e.target.closest('.sb-drag-handle')) return;
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

  createMainModal() {
    const overlay = document.createElement('div');
    overlay.className = 'sb-modal-overlay';
    
    overlay.innerHTML = `
      <div class="sb-modal">
        <div class="sb-header">
          <h3 class="sb-title">
            <span>✨</span> StockBuddy <span style="font-weight:400; color:#888; font-size:14px; margin-left:5px;">AI v2.0.0</span>
          </h3>
          <div class="sb-close">&times;</div>
        </div>
        
        <div class="sb-body">
          <div class="sb-form-group">
            <label class="sb-label">Gemini API Key</label>
            <div class="sb-input-wrapper">
              <span class="sb-icon-key">🔑</span>
              <input type="password" id="sb-api-key" class="sb-input" placeholder="Nhập khóa API của bạn...">
            </div>
            <button id="sb-save-settings" class="sb-btn-save">
              <span>💾</span> Lưu thiết lập
            </button>
          </div>

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
        </div>
      </div>
    `;
    
    const closeBtn = overlay.querySelector('.sb-close');
    closeBtn.onclick = () => overlay.classList.remove('active');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('active'); };

    overlay.querySelector('#sb-save-settings').onclick = () => this.saveSettings();
    overlay.querySelector('#sb-run-single').onclick = () => { overlay.classList.remove('active'); this.processSingleImage(); };
    overlay.querySelector('#sb-run-batch').onclick = () => { overlay.classList.remove('active'); this.startBatchProcessing(); };
    overlay.querySelector('#sb-stop-batch').onclick = () => { this.isBatchProcessing = false; this.updateBatchButtonUI(false); };

    document.body.appendChild(overlay);
    this.modal = overlay;
  }

  async openModal() {
    const { apiKey } = await chrome.storage.sync.get(["apiKey"]);
    if (apiKey) document.getElementById("sb-api-key").value = apiKey;
    this.updateBatchButtonUI(this.isBatchProcessing);
    this.modal.classList.add("active");
  }

  async saveSettings() {
    const apiKey = document.getElementById("sb-api-key").value.trim();
    if (!apiKey) {
      this.showToast("Vui lòng nhập API Key!", "error");
      return;
    }
    await chrome.storage.sync.set({ apiKey });

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
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    else throw new Error("Invalid JSON response");
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
    element.dispatchEvent(new Event("change", { bubbles: true })); // Thêm event change
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

      const keywordSelectors = [
        "textarea[name=keywordsUITextArea]",
        "textarea.keywords-input",
        'input[name="keywords"]',
      ];
      const keysInput = this.findElementBySelectors(keywordSelectors);

      const hasTitle = titleInput && titleInput.value.trim().length > 3;
      const hasKeys = keysInput && keysInput.value.trim().length > 3;
      return hasTitle || hasKeys;
    } else if (this.currentSite === "shutterstock") {
      const descInput = document.querySelector('textarea[name="description"]');
      if (descInput && descInput.value.trim().length > 5) return true;
      return false;
    }
    return false;
  }

  // --- UPDATED: Sửa logic tìm ảnh (Quan trọng) ---
  findActiveImage() {
    if (this.currentSite === "adobe") {
      return (
        document.querySelector(".infer-preview-image img") ||
        document.querySelector(".upload-tile__wrapper.active img")
      );
    }

    if (this.currentSite === "shutterstock") {
      // 1. Ưu tiên tìm ảnh trong sidebar editor (dựa trên HTML bạn đưa)
      const sidebarImg = document.querySelector(
        'img[src*="pending_photos"][style*="max-height"]'
      );
      if (sidebarImg) return sidebarImg;

      // 2. Tìm trong grid item đang checked
      const activeCardImg = document.querySelector(
        'div[aria-checked="true"] img[data-testid^="card-media-"]'
      );
      if (activeCardImg) return activeCardImg;

      // 3. Tìm grid item đang focus
      const focusedWrapper = document.querySelector(
        'div[tabindex="0"] img[data-testid^="card-media-"]'
      );
      if (focusedWrapper) return focusedWrapper;

      // 4. Nếu đang Single mode, có thể lấy ảnh đầu tiên trong danh sách grid làm fallback
      if (this.isSingleProcessing) {
        const firstImg = document.querySelector(
          'img[data-testid^="card-media-"]'
        );
        if (firstImg) return firstImg;
      }
    }
    return null;
  }

  // --- PROCESS SINGLE IMAGE ---
  async processSingleImage(specificImgSrc = null, btnElement = null) {
    console.log("🚀 [START] Bắt đầu hàm processSingleImage");

    // FORCE RESET: Đặt lại trạng thái để tránh bị kẹt nếu lần trước lỗi
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
      this.showToast("Gemini đang phân tích ảnh...", "info");

      // 1. Gọi hàm tải ảnh (đã thêm log ở trên)
      const base64 = await this.urlToBase64(imgSrc);

      // 2. Kiểm tra API Key
      const { apiKey } = await chrome.storage.sync.get(["apiKey"]);
      if (!apiKey) {
        console.error("🔑 Thiếu API Key");
        this.showToast("Thiếu API Key!", "error");
        this.openModal();
        this.resetSingleState(btnElement, originalBtnText);
        return;
      }

      // console.log("🤖 [4] Đang gửi ảnh lên Gemini API...");
      const result = await this.callGeminiAPI(base64, apiKey);
      // console.log("✨ [5] Gemini trả về kết quả:", result);

      await this.fillForms(result);
      this.showToast("Đã điền xong!", "success");
    } catch (e) {
      console.error("💥 [CRITICAL ERROR]:", e);
      this.showToast(`Lỗi: ${e.message}`, "error");
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
    // console.log(`📡 [1] Đang gọi Background để tải ảnh: ${url.substring(0, 50)}...`);

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: "fetchImageBase64", url: url },
          (response) => {
            // Kiểm tra lỗi kết nối extension
            if (chrome.runtime.lastError) {
              console.error(
                "🔥 [Lỗi Kết Nối] Không gọi được Background. Bạn đã Reload Extension chưa?",
                chrome.runtime.lastError
              );
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response && response.success) {
              // console.log(`✅ [2] Background đã trả về ảnh (Độ dài Base64: ${response.data.length})`);
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
    // console.log("🤖 StockBuddy Debug - Data nhận được:", data);

    const desc = data.title;
    const keys = data.keywords; // Chuỗi "key1, key2, key3"

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

      // 1. Điền Description
      const descInput =
        document.querySelector('textarea[name="description"]') ||
        document.querySelector('textarea[data-testid="description-input"]');

      if (descInput) {
        console.log("✅ Tìm thấy ô Description");
        descInput.focus();
        descInput.value = ""; // Reset
        this.simulateInput(descInput, desc, true);
      } else {
        console.error(
          "❌ Không tìm thấy ô Description (Kiểm tra lại Selector)"
        );
      }

      // 2. Điền Keywords (Quan trọng: Phải nhập từng từ)
      const keyInputSelectors = [
        'input[aria-label="Keywords"]',
        'input[placeholder*="keyword"]',
        'div[data-testid="tag-input"] input',
        'input[id*="chip-input"]',
      ];
      const keysInput = this.findElementBySelectors(keyInputSelectors);

      if (keysInput) {
        console.log("✅ Tìm thấy ô Keywords");
        keysInput.focus();

        // Tách chuỗi keyword thành mảng: "dog, cat" -> ["dog", "cat"]
        const keywordList = keys
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0);

        // Nhập từng từ một
        for (const key of keywordList) {
          // 1. Gõ từ khóa vào
          this.simulateInput(keysInput, key, false);

          // 2. Chờ xíu cho UI phản hồi (Rất quan trọng)
          await new Promise((r) => setTimeout(r, 50));

          // 3. Nhấn Enter để tạo thẻ tag
          this.simulateEnter(keysInput);

          // 4. Chờ thẻ tag được tạo xong mới nhập từ tiếp theo
          await new Promise((r) => setTimeout(r, 100));
        }
      } else {
        console.error("❌ Không tìm thấy ô Keywords");
      }
    }
  }

  async startBatchProcessing() {
    const skipFilled = document.getElementById("sb-skip-filled").checked;
    let items = [];

    // Batch trên SS: Lấy các card ảnh trong grid
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
        // Shutterstock: Click vào box chứa ảnh để mở edit sidebar
        const clickable = item.closest("div[tabindex]") || item.parentElement;
        if (clickable) clickable.click();
        thumbnailSrc = item.src;
      }

      await new Promise((r) => setTimeout(r, 2000)); // Đợi sidebar mở

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

  // --- UPDATED: Save Shutterstock (Sử dụng selector data-testid mới) ---
  async saveShutterstock() {
    // Selector mới dựa trên edit-dialog-save-button
    const selector = 'button[data-testid="edit-dialog-save-button"]';

    let saveBtn = null;
    for (let k = 0; k < 5; k++) {
      saveBtn = document.querySelector(selector);
      // Kiểm tra nút có tồn tại và KHÔNG bị disable
      if (saveBtn && !saveBtn.disabled) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (saveBtn && !saveBtn.disabled) {
      saveBtn.click();
    } else {
      // Fallback: Tìm nút có chữ "Save"
      const allBtns = Array.from(document.querySelectorAll("button"));
      const fallbackBtn = allBtns.find(
        (b) => b.textContent.trim() === "Save" && !b.disabled
      );
      if (fallbackBtn) fallbackBtn.click();
      else console.warn("Không tìm thấy nút Save hoặc nút đang bị khóa");
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
