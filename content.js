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
    if (hostname.includes('adobe.com')) return 'adobe';
    if (hostname.includes('shutterstock.com')) return 'shutterstock';
    return 'unknown';
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
      subtree: true
    });
  }

  // --- UPDATED: Sửa vị trí nút Inline cho Shutterstock ---
  injectInlineButton() {
    if (this.currentSite !== 'shutterstock') return;

    // Selector chuẩn xác dựa trên HTML bạn cung cấp
    const descContainer = document.querySelector('div[data-testid="description"]');

    // Chỉ chèn nếu chưa có nút
    if (descContainer && !descContainer.parentNode.querySelector('.sb-inline-btn')) {
      const btn = document.createElement('button');
      btn.className = 'sb-inline-btn';
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
    const primaryColor = this.currentSite === 'adobe' ? '#0061FE' : '#E11D48';
    const shadowSoft = '0 10px 40px -10px rgba(0,0,0,0.15)';
    
    style.textContent = `
      :root {
        --sb-primary: ${primaryColor};
        --sb-bg: #ffffff;
        --sb-text: #1f2937;
        --sb-text-light: #6b7280;
        --sb-border: #e5e7eb;
        --sb-input-bg: #f3f4f6;
        --sb-radius: 12px;
        --sb-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      /* --- FLOATING BUTTON --- */
      .sb-floating-btn {
        position: fixed; bottom: 30px; left: 30px; z-index: 10000;
        background: var(--sb-bg); color: var(--sb-text);
        padding: 10px 16px; border-radius: 50px; cursor: pointer;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        font-family: var(--sb-font); font-weight: 600; font-size: 14px;
        display: flex; align-items: center; gap: 10px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(0,0,0,0.05); user-select: none;
      }
      .sb-floating-btn span { font-size: 18px; }
      .sb-floating-btn:hover { 
        transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        border-color: var(--sb-primary); color: var(--sb-primary);
      }
      .sb-floating-btn:active { transform: scale(0.96); }

      /* --- INLINE BUTTON --- */
      .sb-inline-btn {
        margin-top: 12px; width: 100%; padding: 10px;
        background: #FFF1F2; color: #E11D48; 
        border: 1px solid #FECDD3; border-radius: 8px;
        font-family: var(--sb-font); font-weight: 600; font-size: 13px;
        cursor: pointer; transition: all 0.2s;
        display: flex; justify-content: center; align-items: center; gap: 8px;
      }
      .sb-inline-btn:hover { background: #E11D48; color: white; border-color: #E11D48; }
      .sb-inline-btn:disabled { opacity: 0.7; cursor: wait; }

      /* --- MODAL --- */
      .sb-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
        z-index: 10001; display: none; justify-content: center; align-items: center;
        opacity: 0; transition: opacity 0.2s;
      }
      .sb-modal-overlay.active { display: flex; opacity: 1; }
      
      .sb-modal {
        background: var(--sb-bg); width: 400px; border-radius: 20px;
        box-shadow: ${shadowSoft}; font-family: var(--sb-font);
        transform: scale(0.95); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        overflow: hidden; border: 1px solid rgba(255,255,255,0.5);
      }
      .sb-modal-overlay.active .sb-modal { transform: scale(1); }
      
      .sb-header { 
        padding: 20px 24px; border-bottom: 1px solid var(--sb-border);
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(249,250,251, 0.5);
      }
      .sb-title { font-size: 18px; font-weight: 700; color: #111; margin: 0; display: flex; align-items: center; gap: 8px; }
      .sb-close { 
        cursor: pointer; width: 32px; height: 32px; border-radius: 50%; 
        display: flex; align-items: center; justify-content: center;
        color: #999; transition: all 0.2s; background: transparent;
      }
      .sb-close:hover { background: #f3f4f6; color: #333; }
      
      .sb-body { padding: 24px; }

      /* --- FORMS --- */
      .sb-form-group { margin-bottom: 20px; position: relative; }
      .sb-label { 
        display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; 
        color: var(--sb-text-light); margin-bottom: 8px; letter-spacing: 0.5px;
      }
      .sb-input-wrapper { position: relative; }
      .sb-input { 
        width: 100%; padding: 12px 12px 12px 40px; background: var(--sb-input-bg);
        border: 2px solid transparent; border-radius: 10px; 
        font-size: 14px; color: var(--sb-text);
        transition: all 0.2s; box-sizing: border-box;
      }
      .sb-input:focus { 
        background: #fff; border-color: var(--sb-primary); 
        box-shadow: 0 0 0 4px rgba(225, 29, 72, 0.1); outline: none; 
      }
      .sb-icon-key {
        position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
        color: #9CA3AF; pointer-events: none;
      }

      .sb-checkbox-group { 
        display: flex; align-items: center; gap: 12px; margin-bottom: 24px; 
        padding: 12px; border-radius: 10px; border: 1px solid var(--sb-border);
        cursor: pointer; transition: background 0.2s;
      }
      .sb-checkbox-group:hover { background: #f9fafb; }
      .sb-checkbox-group input { width: 18px; height: 18px; accent-color: var(--sb-primary); }
      .sb-checkbox-text { font-size: 14px; font-weight: 500; color: var(--sb-text); }

      /* --- ACTIONS --- */
      .sb-btn { 
        width: 100%; padding: 14px; border: none; border-radius: 12px; cursor: pointer; 
        font-weight: 600; font-size: 14px;
        transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px;
      }
      .sb-btn:active { transform: scale(0.98); }
      
      .sb-btn-save { 
        background: #fff; color: var(--sb-text); border: 1px solid var(--sb-border); margin-top: 8px;
        font-size: 13px; padding: 10px;
      }
      .sb-btn-save:hover { background: #f9fafb; border-color: #d1d5db; }

      .sb-divider { 
        height: 1px; background: var(--sb-border); margin: 24px 0; position: relative; 
      }
      .sb-divider::after {
        content: 'ACTIONS'; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        background: white; padding: 0 10px; color: #9CA3AF; font-size: 11px; font-weight: 600;
      }

      .sb-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

      .sb-btn-primary { 
        background: var(--sb-primary); color: white; 
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25);
      }
      .sb-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 6px 16px rgba(225, 29, 72, 0.35); }

      .sb-btn-dark { 
        background: #111827; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      .sb-btn-dark:hover { background: #000; }
      
      .sb-btn-stop { background: #F59E0B; color: white; width: 100%; }

      /* --- PROGRESS BAR --- */
      .sb-progress-container {
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(20px);
        width: 320px; background: rgba(30, 30, 30, 0.9); backdrop-filter: blur(10px);
        padding: 16px 20px; border-radius: 50px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 10002;
        display: none; opacity: 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: white; text-align: center;
      }
      .sb-progress-container.active { display: block; opacity: 1; transform: translateX(-50%) translateY(0); }
      .sb-progress-info { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: #ccc; }
      .sb-progress-bar-bg { width: 100%; height: 6px; background: rgba(255,255,255,0.2); border-radius: 10px; overflow: hidden; }
      .sb-progress-bar-fill { height: 100%; background: #10B981; width: 0%; transition: width 0.3s ease; box-shadow: 0 0 10px #10B981; }

      /* --- TOAST --- */
      .sb-toast { 
        position: fixed; top: 24px; right: 24px; z-index: 10005; 
        padding: 14px 20px; border-radius: 12px; color: #fff; font-weight: 500;
        font-family: var(--sb-font); animation: sbSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 10px 30px -5px rgba(0,0,0,0.2);
        display: flex; align-items: center; gap: 10px; font-size: 14px;
      }
      .sb-toast.success { background: #10B981; }
      .sb-toast.error { background: #EF4444; }
      .sb-toast.info { background: #3B82F6; }
      .sb-toast.warning { background: #F59E0B; }
      
      @keyframes sbSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .sb-spinner {
        width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%; border-top-color: white; animation: sbSpin 0.8s linear infinite;
      }
      @keyframes sbSpin { to { transform: rotate(360deg); } }
      .sb-highlight-img { outline: 4px solid var(--sb-primary) !important; outline-offset: -4px; transition: outline 0.3s; }
    `;
    
    if (this.currentSite === 'adobe') {
       style.textContent = style.textContent.replace('--sb-primary: #E11D48;', '--sb-primary: #0061FE;').replace('rgba(225, 29, 72', 'rgba(0, 97, 254');
    }
    document.head.appendChild(style);
  }

  createFloatingButton() {
    const btn = document.createElement('div');
    btn.className = 'sb-floating-btn';
    btn.innerHTML = '<span>⚡</span> AI Tools';
    
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    btn.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = btn.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      btn.style.bottom = 'auto'; 
      btn.style.right = 'auto';
      btn.style.transition = 'none'; 
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      btn.style.left = `${initialLeft + dx}px`;
      btn.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      if(isDragging) {
        isDragging = false;
        btn.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'; 
      }
    });

    btn.addEventListener('click', (e) => {
      if (!isDragging) this.openModal();
    });

    document.body.appendChild(btn);
  }

  createProgressUI() {
    const div = document.createElement('div');
    div.className = 'sb-progress-container';
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
    this.progressBar.classList.add('active');
    
    const textEl = document.getElementById('sb-progress-text');
    const percentEl = document.getElementById('sb-progress-percent');
    
    if (message) textEl.textContent = message;
    else textEl.textContent = `Processing image ${current} of ${total}`;

    const percent = Math.round((current / total) * 100);
    const fillEl = document.getElementById('sb-progress-fill');
    
    fillEl.style.width = `${percent}%`;
    percentEl.textContent = `${percent}%`;
  }

  hideProgress() {
    if (this.progressBar) {
        this.progressBar.classList.remove('active');
    }
  }

  createMainModal() {
    const overlay = document.createElement('div');
    overlay.className = 'sb-modal-overlay';
    
    overlay.innerHTML = `
      <div class="sb-modal">
        <div class="sb-header">
          <h3 class="sb-title">
            <span style="font-size: 20px;">🤖</span> StockBuddy <span style="font-weight:400; color:#999; font-size:14px; margin-left:5px;">v2.0 Fixed</span>
          </h3>
          <div class="sb-close">&times;</div>
        </div>
        
        <div class="sb-body">
          <div class="sb-form-group">
            <label class="sb-label">Gemini API Key</label>
            <div class="sb-input-wrapper">
              <span class="sb-icon-key">🔑</span>
              <input type="password" id="sb-api-key" class="sb-input" placeholder="Paste your API key here...">
            </div>
            <button id="sb-save-settings" class="sb-btn sb-btn-save">Lưu cấu hình</button>
          </div>

          <label class="sb-checkbox-group" for="sb-skip-filled">
            <input type="checkbox" id="sb-skip-filled" checked>
            <span class="sb-checkbox-text">Bỏ qua ảnh đã điền (Skip filled)</span>
          </label>

          <div class="sb-divider"></div>

          <div class="sb-actions-grid" id="sb-start-actions">
            <button id="sb-run-single" class="sb-btn sb-btn-primary">
              ⚡ Single
            </button>
            <button id="sb-run-batch" class="sb-btn sb-btn-dark">
              📦 Batch All
            </button>
          </div>
          
          <button id="sb-stop-batch" class="sb-btn sb-btn-stop" style="display:none">
            🛑 Dừng Batch (Stop)
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
    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    if (apiKey) document.getElementById('sb-api-key').value = apiKey;
    this.updateBatchButtonUI(this.isBatchProcessing);
    this.modal.classList.add('active');
  }

  async saveSettings() {
    const apiKey = document.getElementById('sb-api-key').value.trim();
    if (!apiKey) { this.showToast("Vui lòng nhập API Key!", "error"); return; }
    await chrome.storage.sync.set({ apiKey });
    
    const btn = document.getElementById('sb-save-settings');
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
      const actionsGrid = document.getElementById('sb-start-actions');
      const stopBtn = document.getElementById('sb-stop-batch');
      
      if (isRunning) { 
          actionsGrid.style.display = 'none'; 
          stopBtn.style.display = 'flex'; 
      } else { 
          actionsGrid.style.display = 'grid'; 
          stopBtn.style.display = 'none'; 
      }
  }

  showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `sb-toast ${type}`;
    toast.innerHTML = `<span style="font-size:18px">${icons[type] || ''}</span> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async callGeminiAPI(base64, apiKey) {
    const prompt = `Analyze this stock photo and generate:
            1. A compelling title (max 200 chars, suitable for stock photography).
               IMPORTANT: Do NOT include any personal names, photographer names, or "By [Name]".
               IMPORTANT: Do NOT use special characters like "&", "|", or single quotes (') in the title. Keep it clean text.
            2. 30-50 relevant keywords separated by commas.
            Make it SEO-friendly and descriptive. Format as JSON:
            {
              "title": "Title here",
              "keywords": "keyword1, keyword2, ..."
            }`;
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }] })
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
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

    if (element.tagName.toLowerCase() === 'textarea' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
    } else {
        element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true })); // Thêm event change
    if (shouldBlur) element.blur();
  }

  simulateEnter(element) {
    if (!element) return;
    element.focus();
    const options = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
    element.dispatchEvent(new KeyboardEvent('keydown', options));
    element.dispatchEvent(new KeyboardEvent('keypress', options));
    element.dispatchEvent(new KeyboardEvent('keyup', options));
  }

  findElementBySelectors(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  hasExistingData() {
    if (this.currentSite === 'adobe') {
       const titleSelectors = ["textarea.title-input", 'input[data-testid="title"]', 'textarea[data-testid="title"]', 'input[name="title"]', '[placeholder*="title" i]'];
       const titleInput = this.findElementBySelectors(titleSelectors);
       
       const keywordSelectors = ["textarea[name=keywordsUITextArea]", 'textarea.keywords-input', 'input[name="keywords"]'];
       const keysInput = this.findElementBySelectors(keywordSelectors);

       const hasTitle = titleInput && titleInput.value.trim().length > 3;
       const hasKeys = keysInput && keysInput.value.trim().length > 3;
       return hasTitle || hasKeys;
    } 
    else if (this.currentSite === 'shutterstock') {
       const descInput = document.querySelector('textarea[name="description"]');
       if (descInput && descInput.value.trim().length > 5) return true;
       return false;
    }
    return false;
  }

  // --- UPDATED: Sửa logic tìm ảnh (Quan trọng) ---
  findActiveImage() {
    if (this.currentSite === 'adobe') {
      return document.querySelector('.infer-preview-image img') || 
             document.querySelector('.upload-tile__wrapper.active img');
    } 
    
    if (this.currentSite === 'shutterstock') {
      // 1. Ưu tiên tìm ảnh trong sidebar editor (dựa trên HTML bạn đưa)
      const sidebarImg = document.querySelector('img[src*="pending_photos"][style*="max-height"]');
      if (sidebarImg) return sidebarImg;

      // 2. Tìm trong grid item đang checked
      const activeCardImg = document.querySelector('div[aria-checked="true"] img[data-testid^="card-media-"]');
      if (activeCardImg) return activeCardImg;
      
      // 3. Tìm grid item đang focus
      const focusedWrapper = document.querySelector('div[tabindex="0"] img[data-testid^="card-media-"]');
      if (focusedWrapper) return focusedWrapper;

      // 4. Nếu đang Single mode, có thể lấy ảnh đầu tiên trong danh sách grid làm fallback
      if (this.isSingleProcessing) {
          const firstImg = document.querySelector('img[data-testid^="card-media-"]');
          if (firstImg) return firstImg;
      }
    }
    return null;
  }

  // --- PROCESS SINGLE IMAGE ---
  async processSingleImage(specificImgSrc = null, btnElement = null) {
    if (this.isSingleProcessing) return;
    this.isSingleProcessing = true;

    let originalBtnText = '';
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
            this.showToast("Không tìm thấy ảnh đang chọn!", "error"); 
            this.resetSingleState(btnElement, originalBtnText);
            return; 
        }
        imgSrc = imgElement.src;
        if (imgElement) {
            imgElement.classList.add('sb-highlight-img');
            setTimeout(() => imgElement.classList.remove('sb-highlight-img'), 1000);
        }
    }

    try {
      this.showToast("Gemini đang phân tích ảnh...", "info");
      const base64 = await this.urlToBase64(imgSrc);
      const { apiKey } = await chrome.storage.sync.get(['apiKey']);
      if (!apiKey) { 
          this.showToast("Thiếu API Key!", "error"); 
          this.openModal(); 
          this.resetSingleState(btnElement, originalBtnText);
          return; 
      }

      const result = await this.callGeminiAPI(base64, apiKey);
      await this.fillForms(result);
      this.showToast("Đã điền xong!", "success");
    } catch (e) {
      console.error(e);
      this.showToast(`Lỗi: ${e.message}`, "error");
    } finally {
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
    // Xử lý vấn đề CORS nếu cần hoặc dùng fetch mode no-cors (tùy ngữ cảnh extension)
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  // --- UPDATED: Sửa logic điền form cho SS ---
  async fillForms(data) {
    const desc = data.title; 
    const keys = data.keywords;

    if (this.currentSite === 'adobe') {
      const titleSelectors = ["textarea.title-input", 'input[data-testid="title"]', 'textarea[data-testid="title"]', 'input[name="title"]'];
      const titleInput = this.findElementBySelectors(titleSelectors);

      const keywordSelectors = ["textarea[name=keywordsUITextArea]", 'textarea.keywords-input', 'input[name="keywords"]'];
      const keysInput = this.findElementBySelectors(keywordSelectors);

      if (titleInput) this.simulateInput(titleInput, desc, true);
      if (keysInput) { this.simulateInput(keysInput, keys, true); this.simulateEnter(keysInput); }
    } 
    else if (this.currentSite === 'shutterstock') {
      // 1. Điền Description (Textarea)
      const descInput = document.querySelector('textarea[name="description"]');
      if (descInput) {
          descInput.focus();
          // Xóa nội dung cũ để tránh bị nối tiếp
          descInput.value = ''; 
          this.simulateInput(descInput, desc, true);
      }

      // 2. Điền Keyword (Input tags)
      const keyInputSelectors = [
          'input[id*="chip-input"]', 
          'input[placeholder*="keyword"]', 
          'input[aria-label*="Keywords"]',
          'div[data-testid="tag-input"] input'
      ];
      const keysInput = this.findElementBySelectors(keyInputSelectors);
      
      if (keysInput) {
        keysInput.focus();
        this.simulateInput(keysInput, keys, false);
        // Đợi một chút để React nhận state
        await new Promise(r => setTimeout(r, 200)); 
        this.simulateEnter(keysInput);
      } else {
        console.warn("Không tìm thấy ô nhập keyword Shutterstock");
      }
    }
  }

  async startBatchProcessing() {
    const skipFilled = document.getElementById('sb-skip-filled').checked;
    let items = [];
    
    // Batch trên SS: Lấy các card ảnh trong grid
    if (this.currentSite === 'adobe') items = document.querySelectorAll('.upload-tile__wrapper');
    else items = document.querySelectorAll('img[data-testid^="card-media-"]'); 

    if (!items.length) { this.showToast("Không tìm thấy ảnh nào!", "error"); return; }
    
    this.isBatchProcessing = true;
    this.updateBatchButtonUI(true);
    this.updateProgress(0, items.length, "Đang khởi động...");

    for (let i = 0; i < items.length; i++) {
      if (!this.isBatchProcessing) break;
      const item = items[i];
      let thumbnailSrc = "";

      this.updateProgress(i + 1, items.length);

      if (this.currentSite === 'adobe') { 
          item.click(); 
          thumbnailSrc = item.querySelector('img').src; 
      } 
      else { 
          // Shutterstock: Click vào box chứa ảnh để mở edit sidebar
          const clickable = item.closest('div[tabindex]') || item.parentElement;
          if (clickable) clickable.click(); 
          thumbnailSrc = item.src; 
      }

      await new Promise(r => setTimeout(r, 2000)); // Đợi sidebar mở

      if (skipFilled && this.hasExistingData()) {
          this.updateProgress(i + 1, items.length, `Ảnh ${i+1}: Đã có dữ liệu. Bỏ qua...`);
          await new Promise(r => setTimeout(r, 500));
          continue;
      }

      this.updateProgress(i + 1, items.length, `Ảnh ${i+1}: Đang gọi AI...`);
      await this.processSingleImage(thumbnailSrc);

      if (this.currentSite === 'shutterstock') {
          await new Promise(r => setTimeout(r, 1500));
          this.updateProgress(i + 1, items.length, `Ảnh ${i+1}: Đang lưu...`);
          await this.saveShutterstock(); 
          
          for (let s = 3; s > 0; s--) {
             this.updateProgress(i + 1, items.length, `Ảnh ${i+1}: Đợi ${s}s...`);
             await new Promise(r => setTimeout(r, 1000));
          }
      } else {
          await this.autoSaveAdobe();
          await new Promise(r => setTimeout(r, 1000));
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
    for(let k=0; k<5; k++) {
        saveBtn = document.querySelector(selector);
        // Kiểm tra nút có tồn tại và KHÔNG bị disable
        if(saveBtn && !saveBtn.disabled) break;
        await new Promise(r => setTimeout(r, 500));
    }

    if (saveBtn && !saveBtn.disabled) {
        saveBtn.click();
    } else {
        // Fallback: Tìm nút có chữ "Save"
        const allBtns = Array.from(document.querySelectorAll('button'));
        const fallbackBtn = allBtns.find(b => b.textContent.trim() === 'Save' && !b.disabled);
        if (fallbackBtn) fallbackBtn.click();
        else console.warn("Không tìm thấy nút Save hoặc nút đang bị khóa");
    }
  }

  async autoSaveAdobe() {
      const saveBtn = document.querySelector('button[data-t="save-work"]');
      if (saveBtn) { saveBtn.click(); }
  }
}

new KeywordGenerator();