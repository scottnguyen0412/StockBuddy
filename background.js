// Background script (Service Worker)

// 1. Cấu hình & Menu chuột phải
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({ language: 'en', autoDetect: true });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'AI Keywords Generator',
      message: 'Extension đã cài đặt thành công!'
    });
  }
  createContextMenu();
});

chrome.runtime.onStartup.addListener(() => createContextMenu());

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'analyzeImage',
      title: 'Phân tích ảnh này',
      contexts: ['image'],
      documentUrlPatterns: ['*://*.stock.adobe.com/*', '*://*.shutterstock.com/*']
    });
  });
}

// 2. Class xử lý Rate Limit
class RateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequests = 60;
    this.timeWindow = 60000;
  }
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequests;
  }
  addRequest() { this.requests.push(Date.now()); }
  getWaitTime() {
    if (this.requests.length === 0) return 0;
    const oldest = Math.min(...this.requests);
    return Math.max(0, this.timeWindow - (Date.now() - oldest));
  }
}
const rateLimiter = new RateLimiter();

// 3. XỬ LÝ TIN NHẮN (QUAN TRỌNG NHẤT)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log("Background received message:", request.action); // Debug log

  switch (request.action) {
    // --- Logic tải ảnh Bypass CORS ---
    case 'fetchImageBase64':
      fetch(request.url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            sendResponse({ success: true, data: base64data });
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error("Fetch Error:", error);
          sendResponse({ success: false, error: error.toString() });
        });
      return true; // GIỮ KẾT NỐI ĐỂ GỬI RESPONSE ASYNC

    // --- Các logic cũ ---
    case 'checkRateLimit':
      sendResponse({
        canMakeRequest: rateLimiter.canMakeRequest(),
        waitTime: rateLimiter.getWaitTime()
      });
      break;

    case 'recordAPICall':
      rateLimiter.addRequest();
      sendResponse({ success: true });
      break;

    case 'getBadgeText':
      chrome.action.getBadgeText({ tabId: sender.tab.id }, (text) => {
        sendResponse({ badgeText: text });
      });
      return true;

    case 'setBadgeText':
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: request.text });
      if (request.color) {
        chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: request.color });
      }
      sendResponse({ success: true });
      break;
      
    // --- Performance monitor (Optional) ---
    case 'recordPerformance':
    case 'getPerformanceMetrics':
      // Nếu bạn muốn giữ logic performance cũ, thêm vào đây
      sendResponse({ success: true }); 
      break;
  }
});

// 4. Reset Badge khi chuyển tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('stock.adobe.com') || tab.url.includes('shutterstock.com'))) {
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
  }
});

// 5. API Key Sync
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.apiKey) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.includes('adobe') || tab.url.includes('shutterstock'))) {
          chrome.tabs.sendMessage(tab.id, { action: 'apiKeyUpdated', newApiKey: changes.apiKey.newValue }).catch(() => {});
        }
      });
    });
  }
});