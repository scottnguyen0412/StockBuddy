document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(['apiKey', 'language', 'autoDetect'], (result) => {
    if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
    if (result.language) document.getElementById('language').value = result.language;
    if (result.autoDetect !== undefined) document.getElementById('autoDetect').checked = result.autoDetect;
  });

  // Save settings button
  document.getElementById('saveSettings').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value;
    const language = document.getElementById('language').value;
    const autoDetect = document.getElementById('autoDetect').checked;

    // Kiểm tra kết nối trước khi lưu
    showStatus('Đang kiểm tra kết nối...', 'loading');
    const connectionStatus = await checkConnection(apiKey);
    
    if (!connectionStatus.success) {
      showStatus('Lỗi kết nối API: ' + connectionStatus.error, 'error');
      return;
    }

    // Lưu settings nếu kết nối thành công
    chrome.storage.sync.set({
      apiKey,
      language,
      autoDetect
    }, () => {
      showStatus('✅ Đã kết nối và lưu API key thành công!', 'success');
    });
  });
});

async function checkConnection(apiKey) {
  try {
    showStatus('Đang kết nối với Gemini...', 'loading');
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Test connection" }]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `API Error (${response.status}): ${error}`
      };
    }

    return { 
      success: true,
      message: 'Kết nối Gemini API thành công!'
    };
  } catch (error) {
    return {
      success: false,
      error: 'Network error: ' + error.message
    };
  }
}


function getPrompt(language) {
  const prompts = {
    en: `Analyze this stock photo and generate:
    1. A compelling title (max 200 chars)
    2. 30-50 relevant keywords separated by commas
    Focus on: subject, colors, mood, style, composition, uses
    
    Format as JSON:
    {
      "title": "Title here",
      "keywords": "keyword1, keyword2, ..."
    }`,
    
    vi: `Phân tích ảnh stock này và tạo:
    1. Tiêu đề hấp dẫn (tối đa 200 ký tự)
    2. 30-50 từ khóa liên quan, phân cách bằng dấu phẩy
    Tập trung: chủ thể, màu sắc, cảm xúc, phong cách, bố cục, công dụng
    
    Định dạng JSON:
    {
      "title": "Tiêu đề",
      "keywords": "từkhóa1, từkhóa2, ..."
    }`,
    
    both: `Analyze this stock photo and generate in both English & Vietnamese:
    1. Titles in both languages (max 200 chars each)
    2. 30-50 keywords in both languages
    
    Format as JSON:
    {
      "title_en": "English title",
      "title_vi": "Tiêu đề tiếng Việt", 
      "keywords_en": "keyword1, keyword2...",
      "keywords_vi": "từkhóa1, từkhóa2..."
    }`
  };
  
  return prompts[language] || prompts.en;
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  
  if (type === 'loading') {
    statusEl.innerHTML = `
      <div class="loading-spinner"></div>
      <span>${message}</span>
    `;
  } else {
    statusEl.textContent = message;
  }
  
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  if (type !== 'loading') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}
