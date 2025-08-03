// Background script (Service Worker) để xử lý các tác vụ nền
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.sync.set({
      language: 'en',
      autoDetect: true
    });
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'AI Keywords Generator',
      message: 'Extension đã được cài đặt! Vui lòng thiết lập API key trong popup.'
    });
  }
});

// Handle context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeImage') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'analyzeSpecificImage',
      imageUrl: info.srcUrl
    });
  }
});

// Create context menu for images
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

function createContextMenu() {
  chrome.contextMenus.create({
    id: 'analyzeImage',
    title: 'Phân tích ảnh với AI Keywords Generator',
    contexts: ['image'],
    documentUrlPatterns: [
      'https://stock.adobe.com/*',
      'https://www.shutterstock.com/*',
      'https://submit.shutterstock.com/*'
    ]
  });
}

// Handle API rate limiting
class RateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequests = 60; // 60 requests per minute for Gemini API
    this.timeWindow = 60000; // 1 minute in milliseconds
  }

  canMakeRequest() {
    const now = Date.now();
    // Remove requests older than time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    return this.requests.length < this.maxRequests;
  }

  addRequest() {
    this.requests.push(Date.now());
  }

  getWaitTime() {
    if (this.requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...this.requests);
    const waitTime = this.timeWindow - (Date.now() - oldestRequest);
    
    return Math.max(0, waitTime);
  }
}

const rateLimiter = new RateLimiter();

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
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
      return true; // Keep message channel open for async response
      
    case 'setBadgeText':
      chrome.action.setBadgeText({
        tabId: sender.tab.id,
        text: request.text
      });
      chrome.action.setBadgeBackgroundColor({
        tabId: sender.tab.id,
        color: request.color || '#4CAF50'
      });
      sendResponse({ success: true });
      break;
  }
});

// Monitor tab updates to reset badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const url = tab.url;
    if (url && (url.includes('stock.adobe.com') || url.includes('shutterstock.com'))) {
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
    }
  }
});

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up any tab-specific data
  chrome.storage.local.remove(`tab_${tabId}_data`);
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.apiKey) {
    // Notify all tabs about API key change
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.includes('stock.adobe.com') || tab.url.includes('shutterstock.com'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'apiKeyUpdated',
            newApiKey: changes.apiKey.newValue
          }).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        }
      });
    });
  }
});

// Error handling and logging
function logError(error, context) {
  console.error(`AI Keywords Generator Error (${context}):`, error);
  
  // Store error for debugging
  chrome.storage.local.get(['errorLog'], (result) => {
    const errorLog = result.errorLog || [];
    errorLog.push({
      timestamp: new Date().toISOString(),
      context: context,
      error: error.toString(),
      stack: error.stack
    });
    
    // Keep only last 50 errors
    if (errorLog.length > 50) {
      errorLog.splice(0, errorLog.length - 50);
    }
    
    chrome.storage.local.set({ errorLog: errorLog });
  });
}

// Health check for API connectivity
async function healthCheck() {
  try {
    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    
    if (!apiKey) return { status: 'no_api_key' };
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "test" }] }]
      })
    });
    
    return {
      status: response.ok ? 'healthy' : 'api_error',
      statusCode: response.status
    };
  } catch (error) {
    logError(error, 'healthCheck');
    return { status: 'network_error', error: error.message };
  }
}

// Periodic health check (every 30 minutes)
setInterval(healthCheck, 30 * 60 * 1000);

// Handle extension update
chrome.runtime.onUpdateAvailable.addListener((details) => {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'AI Keywords Generator Update',
    message: 'Phiên bản mới đã sẵn sàng. Extension sẽ được cập nhật khi khởi động lại trình duyệt.'
  });
});

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
  }

  recordAPICall(success, responseTime) {
    this.metrics.apiCalls++;
    
    if (success) {
      this.metrics.successfulCalls++;
    } else {
      this.metrics.failedCalls++;
    }
    
    this.metrics.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift();
    }
    
    // Calculate average
    this.metrics.averageResponseTime = 
      this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
    
    // Store metrics
    chrome.storage.local.set({ performanceMetrics: this.metrics });
  }

  getMetrics() {
    return this.metrics;
  }
}

const performanceMonitor = new PerformanceMonitor();

// Load existing metrics on startup
chrome.storage.local.get(['performanceMetrics'], (result) => {
  if (result.performanceMetrics) {
    Object.assign(performanceMonitor.metrics, result.performanceMetrics);
  }
});

// Expose performance monitoring to content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'recordPerformance') {
    performanceMonitor.recordAPICall(request.success, request.responseTime);
    sendResponse({ success: true });
  } else if (request.action === 'getPerformanceMetrics') {
    sendResponse(performanceMonitor.getMetrics());
  }
});