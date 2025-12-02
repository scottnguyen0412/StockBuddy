// content.js - Update: Clean Title (No Special Chars) & Stable Features

class KeywordGenerator {
  constructor() {
    this.currentSite = this.detectSite();
    this.isBatchProcessing = false;
    this.isSingleProcessing = false;
    this.modal = null;
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
    console.log(`StockBuddy khởi động trên: ${this.currentSite}`);
    this.injectStyles();
    this.createFloatingButton();
    this.createMainModal();
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

  injectInlineButton() {
    if (this.currentSite !== 'shutterstock') return;

    const descContainer = document.querySelector('div[data-testid="description"]') || 
                          document.querySelector('textarea[name="description"]')?.closest('div');

    if (descContainer && !descContainer.parentNode.querySelector('.sb-inline-btn')) {
      const btn = document.createElement('button');
      btn.className = 'sb-inline-btn';
      btn.innerHTML = '✨ Auto Fill with StockBuddy';
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
    const style = document.createElement('style');
    style.textContent = `
      .sb-floating-btn {
        position: fixed; bottom: 20px; left: 20px; z-index: 9998;
        background: linear-gradient(135deg, #da272a 0%, #b31d20 100%);
        color: white; padding: 12px 20px; border-radius: 50px;
        cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        font-family: 'Segoe UI', sans-serif; font-weight: 600;
        transition: transform 0.2s; display: flex; align-items: center; gap: 8px;
      }
      .sb-floating-btn:hover { transform: translateY(-2px); }

      .sb-inline-btn {
        margin-top: 10px; width: 100%; padding: 8px;
        background: linear-gradient(to right, #da272a, #ed1c24);
        color: white; border: none; border-radius: 4px;
        font-family: 'Segoe UI', sans-serif; font-weight: 600; font-size: 13px;
        cursor: pointer; transition: all 0.2s;
        display: flex; justify-content: center; align-items: center; gap: 5px;
      }
      .sb-inline-btn:hover { opacity: 0.9; }
      .sb-inline-btn:disabled { background: #ccc; cursor: not-allowed; transform: none; }
      
      .sb-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 9999;
        display: none; justify-content: center; align-items: center;
        backdrop-filter: blur(2px);
      }
      .sb-modal-overlay.active { display: flex; }
      
      .sb-modal {
        background: white; width: 400px; padding: 25px; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: 'Segoe UI', sans-serif;
        animation: sbFadeIn 0.3s ease;
      }
      .sb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
      .sb-title { font-size: 18px; font-weight: bold; color: #333; margin: 0; }
      .sb-close { cursor: pointer; font-size: 24px; color: #999; line-height: 1; }
      .sb-form-group { margin-bottom: 15px; }
      .sb-label { display: block; font-size: 12px; font-weight: 600; color: #666; margin-bottom: 5px; }
      .sb-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }
      .sb-checkbox-group { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; font-size: 14px; color: #333; }
      .sb-actions { display: grid; gap: 10px; margin-top: 20px; }
      .sb-btn { padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: white; }
      .sb-btn-primary { background: #2196f3; }
      .sb-btn-success { background: #4caf50; }
      .sb-btn-warning { background: #ff9800; }
      .sb-btn-save { background: #607d8b; width: 100%; margin-top: 10px; }
      .sb-toast { position: fixed; top: 20px; right: 20px; z-index: 10000; padding: 12px 24px; border-radius: 8px; color: white; animation: sbFadeIn 0.3s ease; }
      .sb-toast.success { background: #4caf50; }
      .sb-toast.error { background: #f44336; }
      .sb-toast.info { background: #2196f3; }
      .sb-toast.warning { background: #ff9800; }
      @keyframes sbFadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      
      .sb-highlight-img {
        outline: 4px solid #da272a !important;
        outline-offset: -4px;
        transition: outline 0.3s;
      }
    `;
    
    if (this.currentSite === 'adobe') {
        style.textContent = style.textContent.replace('#da272a', '#1473E6').replace('#b31d20', '#0d4f9e');
    }
    document.head.appendChild(style);
  }

  createFloatingButton() {
    const btn = document.createElement('div');
    btn.className = 'sb-floating-btn';
    btn.innerHTML = '<span>🤖</span> StockBuddy AI';
    btn.onclick = () => this.openModal();
    document.body.appendChild(btn);
  }

  createMainModal() {
    const overlay = document.createElement('div');
    overlay.className = 'sb-modal-overlay';
    overlay.innerHTML = `
      <div class="sb-modal">
        <div class="sb-header"><h3 class="sb-title">🤖 StockBuddy Config</h3><span class="sb-close">&times;</span></div>
        <div class="sb-body">
          <div class="sb-form-group">
            <label class="sb-label">Gemini API Key</label>
            <input type="password" id="sb-api-key" class="sb-input" placeholder="Dán API Key vào đây...">
          </div>
          <div class="sb-checkbox-group">
            <input type="checkbox" id="sb-skip-filled" checked>
            <label for="sb-skip-filled">Bỏ qua ảnh đã có dữ liệu (Batch)</label>
          </div>
          <button id="sb-save-settings" class="sb-btn sb-btn-save">💾 Lưu Cài Đặt</button>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
          <div class="sb-actions">
            <button id="sb-run-single" class="sb-btn sb-btn-primary">🚀 Xử lý ảnh đang mở</button>
            <button id="sb-run-batch" class="sb-btn sb-btn-success">📦 Xử lý Hàng Loạt</button>
            <button id="sb-stop-batch" class="sb-btn sb-btn-warning" style="display:none">🛑 Dừng Batch</button>
          </div>
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
    this.showToast("✅ Đã lưu cài đặt!", "success");
  }
  
  updateBatchButtonUI(isRunning) {
      const startBtn = document.getElementById('sb-run-batch');
      const stopBtn = document.getElementById('sb-stop-batch');
      if (isRunning) { startBtn.style.display = 'none'; stopBtn.style.display = 'flex'; } 
      else { startBtn.style.display = 'flex'; stopBtn.style.display = 'none'; }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `sb-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // --- API CALL ---
  async callGeminiAPI(base64, apiKey) {
    // --- PROMPT MỚI: Loại bỏ tên & ký tự đặc biệt ---
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

  // --- HELPERS ---
  simulateInput(element, value, shouldBlur = true) {
    if (!element) return;
    element.focus();
    const lastValue = element.value;
    element.value = value;
    const tracker = element._valueTracker;
    if (tracker) tracker.setValue(lastValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
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

  waitForElement(selector, timeout = 5000) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) return resolve(document.querySelector(selector));
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) { resolve(document.querySelector(selector)); observer.disconnect(); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  hasExistingData() {
    if (this.currentSite === 'adobe') {
        const title = document.querySelector('input[name="title"]');
        return title && title.value.trim().length > 3;
    } 
    else if (this.currentSite === 'shutterstock') {
        const descInput = document.querySelector('textarea[name="description"]');
        if (descInput && descInput.value.trim().length > 5) return true;
        return false;
    }
    return false;
  }

  // --- LOGIC TÌM ẢNH ---
  findActiveImage() {
    if (this.currentSite === 'adobe') {
      return document.querySelector('.infer-preview-image img') || 
             document.querySelector('.upload-tile__wrapper.active img');
    } 
    
    if (this.currentSite === 'shutterstock') {
      // 1. TÌM CARD ĐANG ACTIVE
      const activeCardImg = document.querySelector('div[data-testid="asset-card"][aria-checked="true"] img');
      if (activeCardImg) return activeCardImg;

      // 2. Fallback
      const largePreview = document.querySelector('div[data-automation-id="content-editor-preview"] img');
      if (largePreview) return largePreview;
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
        btnElement.innerHTML = '⏳ Đang phân tích...';
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
      this.showToast("Đang gửi ảnh cho Gemini...", "info");
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
      this.showToast("✅ Đã điền xong!", "success");
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
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  async fillForms(data) {
    const desc = data.title; 
    const keys = data.keywords;

    if (this.currentSite === 'adobe') {
      const titleInput = document.querySelector('input[name="title"]');
      const keysInput = document.querySelector('textarea.keywords-input');
      if (titleInput) this.simulateInput(titleInput, desc, true);
      if (keysInput) { this.simulateInput(keysInput, keys, true); this.simulateEnter(keysInput); }
    } 
    else if (this.currentSite === 'shutterstock') {
      const descInput = await this.waitForElement('div[data-testid="description"] textarea', 2000) ||
                        document.querySelector('textarea[name="description"]');
      if (descInput) this.simulateInput(descInput, desc, true);

      const keysInput = await this.waitForElement('div[data-testid="keyword-input-text"] input', 2000) ||
                        document.querySelector('input[placeholder*="Add keyword"]');
      if (keysInput) {
        this.simulateInput(keysInput, keys, false);
        await new Promise(r => setTimeout(r, 100)); 
        this.simulateEnter(keysInput);
      }
    }
  }

  // --- BATCH PROCESSING ---
  async startBatchProcessing() {
    const skipFilled = document.getElementById('sb-skip-filled').checked;
    let items = [];
    if (this.currentSite === 'adobe') items = document.querySelectorAll('.upload-tile__wrapper');
    else items = document.querySelectorAll('img[data-testid^="card-media-"]');

    if (!items.length) { this.showToast("Không tìm thấy ảnh nào!", "error"); return; }
    this.isBatchProcessing = true;
    this.updateBatchButtonUI(true);
    this.showToast(`🚀 Bắt đầu Batch: ${items.length} ảnh...`);

    for (let i = 0; i < items.length; i++) {
      if (!this.isBatchProcessing) break;
      const item = items[i];
      let thumbnailSrc = "";

      if (this.currentSite === 'adobe') { item.click(); thumbnailSrc = item.querySelector('img').src; } 
      else { 
          item.click(); 
          thumbnailSrc = item.src; 
      }

      await new Promise(r => setTimeout(r, 2000));

      if (skipFilled && this.hasExistingData()) {
          this.showToast(`Ảnh ${i + 1} đã có dữ liệu. Bỏ qua...`, "info");
          continue;
      }

      this.showToast(`Đang xử lý ${i + 1}/${items.length}...`, 'info');
      await this.processSingleImage(thumbnailSrc);

      if (this.currentSite === 'shutterstock') {
          await new Promise(r => setTimeout(r, 1500));
          this.showToast("Đang tìm nút Save...", "warning");
          await this.saveShutterstock(); 
          this.showToast("Đợi 5s...", "info");
          await new Promise(r => setTimeout(r, 5000)); 
      } else {
          await this.autoSaveAdobe();
          await new Promise(r => setTimeout(r, 1000));
      }
    }
    this.isBatchProcessing = false;
    this.updateBatchButtonUI(false);
    this.showToast("🎉 Hoàn tất!", "success");
  }

  async saveShutterstock() {
    const selector = 'button[data-testid="edit-dialog-save-button"]';
    const saveBtn = await this.waitForElement(selector, 3000);
    if (saveBtn) {
        if (saveBtn.disabled) { this.showToast("⚠️ Save bị khóa! Dữ liệu chưa hợp lệ?", "error"); return; }
        saveBtn.click();
    } else {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const fallbackBtn = allBtns.find(b => b.textContent === 'Save' && !b.disabled);
        if (fallbackBtn) fallbackBtn.click();
        else this.showToast("⚠️ Không tìm thấy nút Save!", "error");
    }
  }

  async autoSaveAdobe() {
      const saveBtn = document.querySelector('button[data-t="save-work"]');
      if (saveBtn) { saveBtn.click(); }
  }
}

new KeywordGenerator();