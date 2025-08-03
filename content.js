// Content script để tương tác với DOM của Adobe Stock và Shutterstock
class KeywordGenerator {
  constructor() {
    this.currentSite = this.detectSite();
    this.init();
  }

  detectSite() {
    const hostname = window.location.hostname;
    if (hostname.includes('contributor.stock.adobe.com')) return 'adobe';
    if (hostname.includes('shutterstock.com')) return 'shutterstock';
    return 'unknown';
  }

  init() {
    this.createFloatingButton();
    this.observeImages();
    this.setupMessageListener();
  }

  createFloatingButton() {
    const button = document.createElement('div');
    button.id = 'ai-keywords-btn';
    button.innerHTML = `
      <div class="ai-btn-content">
        <span class="ai-btn-icon">🎨</span>
        <span class="ai-btn-text">AI Keywords</span>
      </div>
    `;
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 25px;
      padding: 12px 20px;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      font-family: 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    });

    button.addEventListener('click', () => {
      this.analyzeCurrentPage();
    });

    document.body.appendChild(button);
  }

  observeImages() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNewImages(node);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processNewImages(element) {
    const images = element.querySelectorAll('img');
    images.forEach(img => {
      if (img.src && !img.dataset.aiProcessed) {
        img.dataset.aiProcessed = 'true';
        this.addImageOverlay(img);
      }
    });
  }

  addImageOverlay(img) {
    const overlay = document.createElement('div');
    overlay.className = 'ai-image-overlay';
    overlay.innerHTML = `
      <div class="ai-overlay-btn" data-action="analyze">
        ✨ Analyze
      </div>
    `;
    
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: none;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    `;

    const btn = overlay.querySelector('.ai-overlay-btn');
    btn.style.cssText = `
      background: linear-gradient(45deg, #ff6b6b, #ee5a52);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      transition: all 0.3s ease;
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.analyzeImage(img);
    });

    img.parentElement.style.position = 'relative';
    img.parentElement.appendChild(overlay);

    img.parentElement.addEventListener('mouseenter', () => {
      overlay.style.display = 'flex';
    });

    img.parentElement.addEventListener('mouseleave', () => {
      overlay.style.display = 'none';
    });
  }

  async analyzeImage(img) {
    try {
      this.showStatus('Đang phân tích hình ảnh...', 'loading');
      
      // Convert image to base64
      const base64 = await this.imageToBase64(img);
      
      // Get API settings
      const settings = await chrome.storage.sync.get(['apiKey', 'language']);
      
      if (!settings.apiKey) {
        this.showStatus('Vui lòng cài đặt API key trong popup', 'error');
        return;
      }

      // Call Gemini API
      const result = await this.callGeminiAPI(base64, settings);
      
      // Fill forms with generated content
      this.fillFormsWithData(result);
      
      this.showStatus('Đã tạo keywords thành công!', 'success');
      
    } catch (error) {
      console.error('Error analyzing image:', error);
      this.showStatus('Lỗi khi phân tích hình ảnh: ' + error.message, 'error');
    }
  }

  async imageToBase64(img) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      ctx.drawImage(img, 0, 0);
      
      try {
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64.split(',')[1]); // Remove data URL prefix
      } catch (error) {
        reject(error);
      }
    });
  }

  async callGeminiAPI(base64Image, settings) {
    const prompt = this.generatePrompt(settings.language);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${settings.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseGeminiResponse(data);
  }

  generatePrompt(language) {
    const prompts = {
      en: `Analyze this image and generate SEO-optimized keywords and title for stock photography.
      
      Please provide:
      1. A compelling title (max 200 characters)
      2. 30-50 relevant keywords separated by commas
      3. Focus on: main subject, colors, mood, style, composition, potential uses
      
      Format your response as JSON:
      {
        "title": "Your title here",
        "keywords": "keyword1, keyword2, keyword3, ..."
      }`,
      
      vi: `Phân tích hình ảnh này và tạo keywords và tiêu đề tối ưu SEO cho ảnh stock.
      
      Vui lòng cung cấp:
      1. Tiêu đề hấp dẫn (tối đa 200 ký tự)
      2. 30-50 từ khóa liên quan, phân cách bằng dấu phẩy
      3. Tập trung vào: chủ đề chính, màu sắc, tâm trạng, phong cách, bố cục, ứng dụng tiềm năng
      
      Định dạng phản hồi dưới dạng JSON:
      {
        "title": "Tiêu đề của bạn ở đây",
        "keywords": "từkhóa1, từkhóa2, từkhóa3, ..."
      }`,
      
      both: `Analyze this image and generate SEO-optimized keywords and title for stock photography in both English and Vietnamese.
      
      Please provide:
      1. Title in English and Vietnamese (max 200 characters each)
      2. 30-50 keywords in both languages, separated by commas
      
      Format your response as JSON:
      {
        "title_en": "English title here",
        "title_vi": "Tiêu đề tiếng Việt ở đây",
        "keywords_en": "english keywords here...",
        "keywords_vi": "từ khóa tiếng việt ở đây..."
      }`
    };
    
    return prompts[language] || prompts.en;
  }

  parseGeminiResponse(data) {
    try {
      const text = data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from API');
      }
    } catch (error) {
      throw new Error('Failed to parse API response: ' + error.message);
    }
  }

  fillFormsWithData(data) {
    if (this.currentSite === 'adobe') {
      this.fillAdobeStockForms(data);
    } else if (this.currentSite === 'shutterstock') {
      this.fillShutterstockForms(data);
    }
  }

  fillAdobeStockForms(data) {
    // Adobe Stock form selectors
    const titleField = document.querySelector('input[name="title"], #title, [data-testid="title-input"]');
    const keywordsField = document.querySelector('input[name="keywords"], #keywords, [data-testid="keywords-input"], textarea[name="keywords"]');
    
    if (titleField && (data.title || data.title_en)) {
      titleField.value = data.title || data.title_en;
      titleField.dispatchEvent(new Event('input', { bubbles: true }));
      titleField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    if (keywordsField && (data.keywords || data.keywords_en)) {
      keywordsField.value = data.keywords || data.keywords_en;
      keywordsField.dispatchEvent(new Event('input', { bubbles: true }));
      keywordsField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  fillShutterstockForms(data) {
    // Shutterstock form selectors
    const titleField = document.querySelector('input[name="description"], #description, [data-automation-id="description"]');
    const keywordsField = document.querySelector('input[name="keywords"], #keywords-input, [data-automation-id="keywords"]');
    
    if (titleField && (data.title || data.title_en)) {
      titleField.value = data.title || data.title_en;
      titleField.dispatchEvent(new Event('input', { bubbles: true }));
      titleField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    if (keywordsField && (data.keywords || data.keywords_en)) {
      keywordsField.value = data.keywords || data.keywords_en;
      keywordsField.dispatchEvent(new Event('input', { bubbles: true }));
      keywordsField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  analyzeCurrentPage() {
    const images = document.querySelectorAll('img');
    let analysisCount = 0;
    
    images.forEach(async (img, index) => {
      if (img.src && img.naturalWidth > 200 && img.naturalHeight > 200) {
        setTimeout(() => {
          this.analyzeImage(img);
        }, index * 1000); // Delay to avoid rate limiting
        analysisCount++;
      }
    });
    
    if (analysisCount === 0) {
      this.showStatus('Không tìm thấy hình ảnh phù hợp để phân tích', 'error');
    } else {
      this.showStatus(`Đang phân tích ${analysisCount} hình ảnh...`, 'loading');
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'generateKeywords') {
        this.analyzeCurrentPage();
        sendResponse({ success: true });
      } else if (request.action === 'fillForms') {
        this.fillExistingForms();
        sendResponse({ success: true });
      }
    });
  }

  fillExistingForms() {
    // Logic to fill forms with previously generated data
    chrome.storage.local.get(['lastGeneratedData'], (result) => {
      if (result.lastGeneratedData) {
        this.fillFormsWithData(result.lastGeneratedData);
        this.showStatus('Đã điền form với dữ liệu đã tạo!', 'success');
      } else {
        this.showStatus('Chưa có dữ liệu để điền. Vui lòng tạo keywords trước.', 'error');
      }
    });
  }

  showStatus(message, type) {
    let statusEl = document.getElementById('ai-status');
    
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'ai-status';
      statusEl.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10001;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        word-wrap: break-word;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = message;
    statusEl.className = `ai-status ${type}`;
    
    const colors = {
      success: { bg: '#4caf50', color: 'white' },
      error: { bg: '#f44336', color: 'white' },
      loading: { bg: '#ff9800', color: 'white' }
    };
    
    const color = colors[type] || colors.loading;
    statusEl.style.backgroundColor = color.bg;
    statusEl.style.color = color.color;
    statusEl.style.display = 'block';
    
    // Auto hide after 3 seconds for non-loading messages
    if (type !== 'loading') {
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 3000);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new KeywordGenerator();
  });
} else {
  new KeywordGenerator();
}