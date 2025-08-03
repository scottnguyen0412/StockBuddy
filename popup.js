document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(['apiKey', 'language', 'autoDetect'], (result) => {
    if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
    if (result.language) document.getElementById('language').value = result.language;
    if (result.autoDetect !== undefined) document.getElementById('autoDetect').checked = result.autoDetect;
  });

  // Save settings button
  document.getElementById('saveSettings').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const language = document.getElementById('language').value;
    const autoDetect = document.getElementById('autoDetect').checked;

    chrome.storage.sync.set({
      apiKey,
      language,
      autoDetect
    }, () => {
      showStatus('Đã lưu cài đặt!', 'success');
    });
  });

  // Generate keywords button
  document.getElementById('generateKeywords').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
      showStatus('Vui lòng nhập API key!', 'error');
      return;
    }

    // Check connection first
    showStatus('Đang kiểm tra kết nối...', 'loading');
    const connectionStatus = await checkConnection(apiKey);
    if (!connectionStatus.success) {
      showStatus('Lỗi kết nối: ' + connectionStatus.error, 'error');
      return;
    }

    showStatus('Đang phân tích ảnh...', 'loading');

    // Get active tab and send message to content script
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    chrome.tabs.sendMessage(tab.id, {action: 'getAllThumbnails'}, async (response) => {
      if (!response || !response.success) {
        showStatus('Không thể lấy ảnh: ' + (response?.error || 'Unknown error'), 'error');
        return;
      }

      try {
        for (const base64Image of response.thumbnails) {
          const result = await generateKeywords(apiKey, base64Image);
          
          // Send results back to content script to fill forms
          chrome.tabs.sendMessage(tab.id, {
            action: 'fillForms',
            data: result
          });
        }
        
        showStatus('Đã tạo keywords thành công!', 'success');
      } catch (error) {
        showStatus('Lỗi: ' + error.message, 'error');
      }
    });
  });
});

async function checkConnection(apiKey) {
  try {
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

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'Network error: ' + error.message
    };
  }
}

async function generateKeywords(apiKey, base64Image) {
  const language = document.getElementById('language').value;
  
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: getPrompt(language)
          },
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
  return parseGeminiResponse(data);
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

function parseGeminiResponse(data) {
  try {
    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error('Invalid response format from API');
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  if (type !== 'loading') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}
