// Thông báo khi script được khởi tạo
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, content script ready');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Received message:', msg);
  
  if (msg.action === 'getAllThumbnails') {
    console.log('Đang tìm ảnh trong DOM...');
    
    // Thử nhiều selector khác nhau
    let activeImg = document.querySelector('.upload-tile__wrapper.active img')
    
    console.log('Tìm thấy element:', activeImg);
    
    if (!activeImg) {
      console.log('DOM hiện tại:', document.body.innerHTML);
      sendResponse({
        thumbnails: [],
        success: false,
        error: 'Không tìm thấy element ảnh trong DOM'
      });
      return;
    }

    if (!activeImg.src) {
      console.log('Element không có thuộc tính src:', activeImg);
      sendResponse({
        thumbnails: [],
        success: false,
        error: 'Ảnh không có URL'
      });
      return;
    }

    console.log('Đang tải ảnh từ:', activeImg.src);
    
    fetch(activeImg.src)
      .then(res => {
        console.log('Fetch response:', res.status, res.statusText);
        return res.blob();
      })
      .then(blob => {
        console.log('Đã nhận blob:', blob.type, blob.size, 'bytes');
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          console.log('Đã chuyển đổi thành base64, độ dài:', base64.length);
          
          // Debug: Log selectors
          console.log('Tìm input fields...');
          const titleInput = document.querySelector('input[data-testid="title"]');
          const keywordInput = document.querySelector('textarea[data-testid="keywords"]');
          console.log('Title input:', titleInput);
          console.log('Keyword input:', keywordInput);
          
          // Lưu lại reference để điền sau khi có kết quả từ Gemini
          chrome.storage.local.set({
            'adobeFields': {
              titleSelector: 'input[data-testid="title"]',
              keywordSelector: 'textarea[data-testid="keywords"]'
            }
          });
          
          sendResponse({
            thumbnails: [base64],
            success: true
          });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('Chi tiết lỗi:', error);
        sendResponse({
          thumbnails: [], 
          success: false,
          error: error.message
        });
      });
    return true;
  } else {
    console.error('Không tìm thấy ảnh hoặc không có thuộc tính src');
    sendResponse({
      thumbnails: [], 
      success: false,
      error: 'Không tìm thấy ảnh hợp lệ'
    });
  }
  
  // Xử lý điền form khi nhận được kết quả từ Gemini
  if (msg.action === 'fillForms' && msg.data) {
    chrome.storage.local.get('adobeFields', (result) => {
      if (result.adobeFields) {
        const titleInput = document.querySelector(result.adobeFields.titleSelector);
        const keywordInput = document.querySelector(result.adobeFields.keywordSelector);
        
        if (titleInput && msg.data.title) {
          titleInput.value = msg.data.title;
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        if (keywordInput && msg.data.keywords) {
          keywordInput.value = msg.data.keywords.join(', ');
          keywordInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        sendResponse({success: true});
      }
    });
    return true;
  }
});

function injectGenerateButton() {
  // Tìm container của title input
  const titleContainer = document.querySelector('div[data-error-message="Missing or invalid title."]');
  if (!titleContainer) return;

  // Tạo button
  const generateBtn = document.createElement('button');
  generateBtn.innerHTML = '✨ Generate với Gemini';
  generateBtn.className = 'gemini-generate-btn';
  generateBtn.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin: 8px 0;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
  `;

  // Thêm hover effect
  generateBtn.onmouseover = () => {
    generateBtn.style.transform = 'translateY(-2px)';
    generateBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  };
  generateBtn.onmouseout = () => {
    generateBtn.style.transform = 'translateY(0)';
    generateBtn.style.boxShadow = 'none';
  };

  // Xử lý click
  generateBtn.onclick = async () => {
    const img = document.querySelector('.upload-tile__wrapper.active img');
    if (!img) {
      alert('Vui lòng chọn một ảnh trước!');
      return;
    }
    
    // Hiển thị loading
    generateBtn.innerHTML = '⌛ Đang xử lý...';
    generateBtn.disabled = true;

    try {
      // Lấy API key từ storage
      const { apiKey } = await chrome.storage.sync.get(['apiKey']);
      if (!apiKey) {
        throw new Error('Vui lòng cài đặt API key trong extension!');
      }

      // Convert ảnh sang base64
      const response = await fetch(img.src);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      // Gọi Gemini API
      const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analyze this stock photo and generate:
                1. A compelling title (max 200 chars)
                2. 30-50 relevant keywords separated by commas
                Format as JSON:
                {
                  "title": "Title here",
                  "keywords": "keyword1, keyword2, ..."
                }`
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64
                }
              }
            ]
          }]
        })
      });

      if (!geminiResponse.ok) {
        throw new Error(`API Error: ${geminiResponse.status}`);
      }

      const data = await geminiResponse.json();
      const text = data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch[0]);

      // Điền kết quả vào form
      const titleInput = document.querySelector('textarea.title-input');
      const keywordInput = document.querySelector('textarea[name=keywordsUITextArea]');

      if (titleInput && result.title) {
        titleInput.value = result.title;
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (keywordInput && result.keywords) {
        keywordInput.value = result.keywords;
        keywordInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Cập nhật trạng thái button
      generateBtn.innerHTML = '✅ Đã tạo xong!';
      setTimeout(() => {
        generateBtn.innerHTML = '✨ Generate với Gemini';
        generateBtn.disabled = false;
      }, 2000);

    } catch (error) {
      generateBtn.innerHTML = '❌ Lỗi';
      generateBtn.disabled = false;
      alert('Có lỗi xảy ra: ' + error.message);
    }
  };

  // Chèn button vào sau title input
  titleContainer.appendChild(generateBtn);
}

// Thêm MutationObserver để theo dõi khi DOM thay đổi
const observer = new MutationObserver(() => {
  if (!document.querySelector('.gemini-generate-btn')) {
    injectGenerateButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Update selector cho title input
chrome.storage.local.set({
  'adobeFields': {
    titleSelector: 'textarea.title-input',
    keywordSelector: 'textarea[data-testid="keywords"]'
  }
});

