// Thông báo khi script được khởi tạo
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, content script ready");
});

function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.custom-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'custom-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `custom-toast ${type}`;
  
  // THÊM MỚI: Sử dụng innerHTML để thêm cả nút đóng
  toast.innerHTML = `
    <span class="custom-toast-message">${message}</span>
    <span class="custom-toast-close">×</span>
  `;

  container.appendChild(toast);

  const closeButton = toast.querySelector('.custom-toast-close');
  
  // THÊM MỚI: Hàm để đóng toast, tránh lặp code
  const dismiss = () => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  };

  // THÊM MỚI: Hẹn giờ tự động đóng
  const timeoutId = setTimeout(dismiss, duration);

  // THÊM MỚI: Xử lý khi click nút "X"
  closeButton.onclick = () => {
    clearTimeout(timeoutId); // Hủy hẹn giờ tự động đóng
    dismiss(); // Đóng ngay lập tức
  };

  // Thêm class để kích hoạt animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
}

/**
 * Hiển thị một hộp thoại xác nhận và trả về một Promise.
 * @param {string} title - Tiêu đề của hộp thoại.
 * @param {string} text - Nội dung của hộp thoại.
 * @returns {Promise<boolean>} - Promise sẽ resolve thành `true` nếu người dùng xác nhận, `false` nếu hủy.
 */
function showConfirmation(title, text) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-confirm-overlay";

    overlay.innerHTML = `
      <div class="custom-confirm-modal">
        <h3>${title}</h3>
        <p>${text}</p>
        <div class="custom-confirm-buttons">
          <button class="custom-confirm-button cancel">Hủy</button>
          <button class="custom-confirm-button confirm">Xác nhận</button>
        </div>
      </div>
    `;

    const btnConfirm = overlay.querySelector(".confirm");
    const btnCancel = overlay.querySelector(".cancel");

    const close = (value) => {
      overlay.classList.remove("show");
      overlay.addEventListener("transitionend", () => {
        overlay.remove();
        resolve(value);
      });
    };

    btnConfirm.onclick = () => close(true);
    btnCancel.onclick = () => close(false);

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);
  });
}

function main() {
  // Biến global để theo dõi quá trình batch
  let isBatchProcessing = false;
  let currentImageIndex = 0;
  let totalImages = 0;
  let processedImages = 0;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Received message:", msg);

    if (msg.action === "getAllThumbnails") {
      console.log("Đang tìm ảnh trong DOM...");

      // Thử nhiều selector khác nhau
      let activeImg = document.querySelector(
        ".upload-tile__wrapper.active img"
      );

      console.log("Tìm thấy element:", activeImg);

      if (!activeImg) {
        console.log("DOM hiện tại:", document.body.innerHTML);
        sendResponse({
          thumbnails: [],
          success: false,
          error: "Không tìm thấy element ảnh trong DOM",
        });
        return;
      }

      if (!activeImg.src) {
        console.log("Element không có thuộc tính src:", activeImg);
        sendResponse({
          thumbnails: [],
          success: false,
          error: "Ảnh không có URL",
        });
        return;
      }

      console.log("Đang tải ảnh từ:", activeImg.src);

      fetch(activeImg.src)
        .then((res) => {
          console.log("Fetch response:", res.status, res.statusText);
          return res.blob();
        })
        .then((blob) => {
          console.log("Đã nhận blob:", blob.type, blob.size, "bytes");
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64 = reader.result.split(",")[1];
            console.log("Đã chuyển đổi thành base64, độ dài:", base64.length);

            // Debug: Log selectors
            console.log("Tìm input fields...");
            const titleInput = document.querySelector(
              'input[data-testid="title"]'
            );
            const keywordInput = document.querySelector(
              'textarea[data-testid="keywords"]'
            );
            console.log("Title input:", titleInput);
            console.log("Keyword input:", keywordInput);

            // Lưu lại reference để điền sau khi có kết quả từ Gemini
            chrome.storage.local.set({
              adobeFields: {
                titleSelector: 'input[data-testid="title"]',
                keywordSelector: 'textarea[data-testid="keywords"]',
              },
            });

            sendResponse({
              thumbnails: [base64],
              success: true,
            });
          };
          reader.readAsDataURL(blob);
        })
        .catch((error) => {
          console.error("Chi tiết lỗi:", error);
          sendResponse({
            thumbnails: [],
            success: false,
            error: error.message,
          });
        });
      return true;
    } else {
      console.error("Không tìm thấy ảnh hoặc không có thuộc tính src");
      sendResponse({
        thumbnails: [],
        success: false,
        error: "Không tìm thấy ảnh hợp lệ",
      });
    }

    // Xử lý điền form khi nhận được kết quả từ Gemini
    if (msg.action === "fillForms" && msg.data) {
      chrome.storage.local.get("adobeFields", (result) => {
        if (result.adobeFields) {
          const titleInput = document.querySelector(
            result.adobeFields.titleSelector
          );
          const keywordInput = document.querySelector(
            result.adobeFields.keywordSelector
          );

          if (titleInput && msg.data.title) {
            titleInput.value = msg.data.title;
            titleInput.dispatchEvent(new Event("input", { bubbles: true }));
          }

          if (keywordInput && msg.data.keywords) {
            keywordInput.value = msg.data.keywords.join(", ");
            keywordInput.dispatchEvent(new Event("input", { bubbles: true }));
          }

          sendResponse({ success: true });
        }
      });
      return true;
    }
  });

  // Hàm lấy tất cả ảnh chưa xử lý
  function getAllUnprocessedImages() {
    // Thử nhiều selector khác nhau để tìm ảnh
    const imageSelectors = [
      ".upload-tile__wrapper img",
      ".upload-tile img",
      ".asset-tile img",
      ".thumbnail img",
      '[class*="upload"] img',
      '[class*="tile"] img',
    ];

    const unprocessedImages = [];

    // Thử từng selector
    for (const selector of imageSelectors) {
      const images = document.querySelectorAll(selector);
      console.log(`Selector "${selector}" tìm thấy ${images.length} ảnh`);

      if (images.length > 0) {
        images.forEach((img, index) => {
          if (img.src && img.src.startsWith("http")) {
            // Tìm container của ảnh
            const tile =
              img.closest('[class*="tile"]') ||
              img.closest('[class*="upload"]') ||
              img.parentElement;

            unprocessedImages.push({
              tile: tile,
              img: img,
              index: index,
              selector: selector,
            });
          }
        });
        break; // Dừng khi tìm thấy ảnh
      }
    }

    console.log(
      `Tổng cộng tìm thấy ${unprocessedImages.length} ảnh chưa xử lý`
    );
    return unprocessedImages;
  }

  // Hàm click vào ảnh để active
  function selectImage(tile) {
    return new Promise((resolve) => {
      tile.click();
      // Đợi một chút để DOM cập nhật
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  // Hàm gọi Gemini API
  async function callGeminiAPI(imageBase64, apiKey) {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this stock photo and generate:
            1. A compelling title (max 200 chars, suitable for stock photography)
            2. 30-50 relevant keywords separated by commas
            Make it SEO-friendly and descriptive. Format as JSON:
            {
              "title": "Title here",
              "keywords": "keyword1, keyword2, ..."
            }`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  }

  // Hàm convert ảnh sang base64
  function imageToBase64(img) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Hàm điền thông tin vào form
  function fillImageForm(title, keywords) {
    // Tìm input fields với nhiều selector khác nhau
    const titleSelectors = [
      "textarea.title-input",
      'input[data-testid="title"]',
      'textarea[data-testid="title"]',
      'input[name="title"]',
      'textarea[name="title"]',
      '[placeholder*="title" i]',
      '[placeholder*="Title" i]',
    ];

    const keywordSelectors = [
      "textarea[name=keywordsUITextArea]",
      'textarea[data-testid="keywords"]',
      'input[data-testid="keywords"]',
      'textarea[name="keywords"]',
      'input[name="keywords"]',
      '[placeholder*="keyword" i]',
      '[placeholder*="Keyword" i]',
      '[placeholder*="tag" i]',
    ];

    let titleInput = null;
    let keywordInput = null;

    // Tìm title input
    for (const selector of titleSelectors) {
      titleInput = document.querySelector(selector);
      if (titleInput) {
        console.log(`Tìm thấy title input với selector: ${selector}`);
        break;
      }
    }

    // Tìm keyword input
    for (const selector of keywordSelectors) {
      keywordInput = document.querySelector(selector);
      if (keywordInput) {
        console.log(`Tìm thấy keyword input với selector: ${selector}`);
        break;
      }
    }

    // Debug: Log tất cả input/textarea nếu không tìm thấy
    if (!titleInput || !keywordInput) {
      console.log("Không tìm thấy input fields. Debug info:");
      const allInputs = document.querySelectorAll("input, textarea");
      allInputs.forEach((input, i) => {
        if (i < 15) {
          // Log 15 field đầu
          console.log(`Input ${i + 1}:`, {
            tag: input.tagName,
            type: input.type,
            name: input.name,
            id: input.id,
            className: input.className,
            placeholder: input.placeholder,
            "data-testid": input.getAttribute("data-testid"),
          });
        }
      });
    }

    // Điền title
    if (titleInput && title) {
      console.log("Điền title:", title);
      titleInput.focus();
      titleInput.value = title;
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      titleInput.dispatchEvent(new Event("change", { bubbles: true }));
      titleInput.dispatchEvent(new Event("blur", { bubbles: true }));
    } else {
      console.log("Không thể điền title:", { titleInput, title });
    }

    // Điền keywords
    if (keywordInput && keywords) {
      console.log("Điền keywords:", keywords);
      keywordInput.focus();
      keywordInput.value = keywords;
      keywordInput.dispatchEvent(new Event("input", { bubbles: true }));
      keywordInput.dispatchEvent(new Event("change", { bubbles: true }));
      keywordInput.dispatchEvent(new Event("blur", { bubbles: true }));
    } else {
      console.log("Không thể điền keywords:", { keywordInput, keywords });
    }
  }

  // Hàm nhấn nút Save
  function clickSaveButton() {
    return new Promise((resolve) => {
      // Tìm nút Save work theo HTML structure cụ thể
      const saveButton =
        document.querySelector('button[data-t="save-work"]') ||
        document.querySelector('button.button--action[data-t="save-work"]') ||
        document.querySelector('button:contains("Save work")') ||
        document.querySelector('button[data-testid="save-button"]') ||
        document.querySelector(".save-button");

      console.log("Tìm thấy Save button:", saveButton);

      if (saveButton && !saveButton.disabled) {
        console.log("Nhấn Save button...");
        saveButton.click();

        // Đợi để save hoàn tất và kiểm tra xem có thông báo thành công không
        setTimeout(() => {
          // Kiểm tra xem có thông báo lỗi hoặc thành công không
          const successMessage = document.querySelector(
            ".alert--success, .notification--success"
          );
          const errorMessage = document.querySelector(
            ".alert--error, .notification--error"
          );

          if (errorMessage) {
            console.log("Có lỗi khi save:", errorMessage.textContent);
          } else if (successMessage) {
            console.log("Save thành công:", successMessage.textContent);
          } else {
            console.log("Save hoàn tất (không có thông báo)");
          }

          resolve();
        }, 3000); // Tăng thời gian chờ lên 3 giây
      } else {
        console.log("Không tìm thấy nút Save hoặc nút bị disabled");

        // Log tất cả button để debug
        const allButtons = document.querySelectorAll("button");
        console.log(`Tìm thấy ${allButtons.length} button trên trang:`);
        allButtons.forEach((btn, i) => {
          if (i < 10) {
            // Chỉ log 10 button đầu
            console.log(
              `Button ${i + 1}:`,
              btn.textContent?.trim(),
              btn.className,
              btn.getAttribute("data-t")
            );
          }
        });

        setTimeout(resolve, 1000);
      }
    });
  }

  // Hàm cập nhật progress
  function updateProgress(current, total, status = "") {
    const progressDiv = document.querySelector(".batch-progress");
    if (progressDiv) {
      const percentage = Math.round((current / total) * 100);
      progressDiv.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
      <div class="progress-text">
        ${status || `Đã xử lý ${current}/${total} ảnh (${percentage}%)`}
      </div>
    `;
    }
  }

  // Hàm xử lý batch tự động
  async function startBatchProcessing() {
    if (isBatchProcessing) {
      alert("Đang xử lý batch, vui lòng đợi!");
      return;
    }

    // Debug: Log DOM để kiểm tra
    console.log("DOM hiện tại:", document.body.innerHTML.substring(0, 1000));

    // Lấy API key
    const { apiKey } = await chrome.storage.sync.get(["apiKey"]);
    if (!apiKey) {
      showToast("Vui lòng cài đặt API key trong phần tùy chọn!", "error", 5000);
      return;
    }

    const unprocessedImages = getAllUnprocessedImages();
    if (unprocessedImages.length === 0) {
      showToast("Không tìm thấy ảnh nào để xử lý!", "info");
      return;
    }

    const confirmed = await showConfirmation(
      "Bắt đầu xử lý hàng loạt?",
      `Tìm thấy ${unprocessedImages.length} ảnh. Bạn có muốn tự động xử lý tất cả?`
    );

    if (!confirmed) {
      showToast("Đã hủy xử lý hàng loạt.", "info");
      return;
    }

    isBatchProcessing = true;
    totalImages = unprocessedImages.length;
    currentImageIndex = 0;
    processedImages = 0;

    const batchButton = document.querySelector(".batch-generate-btn");
    if (batchButton) {
      batchButton.innerHTML = `<span class="btn-spinner"></span> Đang Phân Tích...`;
      batchButton.style.background = "#ff9800";
    }

    // Tạo progress indicator
    createProgressIndicator();

    for (let i = 0; i < unprocessedImages.length; i++) {
      if (!isBatchProcessing) {
        showToast("Đã dừng xử lý hàng loạt.", "info");
        break;
      }

      const imageData = unprocessedImages[i];
      currentImageIndex = i + 1;

      try {
        updateProgress(
          i,
          totalImages,
          `Đang xử lý ảnh ${i + 1}/${totalImages}...`
        );

        // 1. Click để chọn ảnh
        if (imageData.tile) {
          await selectImage(imageData.tile);
        }

        // 2. Convert ảnh sang base64
        updateProgress(i, totalImages, `Đang tải ảnh ${i + 1}...`);
        const base64 = await imageToBase64(imageData.img);

        // 3. Gọi Gemini API
        updateProgress(i, totalImages, `Đang phân tích ảnh ${i + 1} với AI...`);
        const result = await callGeminiAPI(base64, apiKey);

        // 4. Điền thông tin
        updateProgress(i, totalImages, `Đang điền thông tin ảnh ${i + 1}...`);
        fillImageForm(result.title, result.keywords);

        // 5. Save
        updateProgress(i, totalImages, `Đang lưu ảnh ${i + 1}...`);
        await clickSaveButton();

        processedImages++;
        updateProgress(
          i + 1,
          totalImages,
          `Đã hoàn thành ảnh ${i + 1}/${totalImages}`
        );

        // Delay giữa các ảnh để tránh spam API
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(`Lỗi xử lý ảnh ${i + 1}:`, error);
        updateProgress(i, totalImages, `❌ Lỗi ảnh ${i + 1}`);
        const continueConfirmed = await showConfirmation(
          `Lỗi xử lý ảnh ${i + 1}`,
          `${error.message}\n\nBạn có muốn tiếp tục với ảnh tiếp theo?`
        );
        if (!continueConfirmed) {
          isBatchProcessing = false;
        }
      }
    }

    // Hoàn thành
    isBatchProcessing = false;
    updateProgress(
      totalImages,
      totalImages,
      `✅ Hoàn thành! Đã xử lý ${processedImages}/${totalImages} ảnh`
    );

    if (batchButton) {
      batchButton.innerHTML = "🚀 Tự động xử lý tất cả ảnh";
      batchButton.style.background =
        "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)";
    }

    showToast(`Hoàn thành! Đã xử lý ${processedImages}/${totalImages} ảnh.`, 'success', 5000);
  }

  // Hàm tạo progress indicator
  function createProgressIndicator() {
    let progressDiv = document.querySelector(".batch-progress");
    if (!progressDiv) {
      progressDiv = document.createElement("div");
      progressDiv.className = "batch-progress";
      progressDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      min-width: 300px;
    `;

      // Thêm CSS cho progress bar
      const style = document.createElement("style");
      style.textContent = `
      /* Keyframes để tạo hiệu ứng sọc chéo di chuyển */
      @keyframes animate-stripes {
        from {
          background-position: 0 0;
        }
        to {
          background-position: 40px 0;
        }
      }

      .progress-bar {
        width: 100%;
        height: 12px; /* Tăng chiều cao một chút */
        background: #e0e0e0;
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 10px;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2); /* Thêm đổ bóng bên trong cho có chiều sâu */
      }

      .progress-fill {
        height: 100%;
        /* Chuyển từ gradient đơn giản sang gradient sọc chéo */
        background-color: #4CAF50;
        background-image: repeating-linear-gradient(
          45deg,
          #5cb85c,
          #5cb85c 10px,
          #4CAF50 10px,
          #4CAF50 20px
        );
        background-size: 40px 40px; /* Kích thước của pattern sọc */
        
        /* Hiệu ứng chuyển động cho chiều rộng (khi % thay đổi) */
        transition: width 0.5s ease-in-out; /* Làm cho animation mượt và lâu hơn một chút */
        
        /* Áp dụng animation sọc chéo di chuyển */
        animation: animate-stripes 1s linear infinite;
      }

      .progress-text {
        font-size: 14px;
        color: #333;
        text-align: center;
        font-weight: 500; /* Làm chữ đậm hơn một chút */
      }
    `;
      document.head.appendChild(style);

      document.body.appendChild(progressDiv);
    }
    return progressDiv;
  }

  // Hàm tạo button batch processing ngay bên dưới button generate
  function injectBatchButton() {
    // Chỉ tạo khi đã có button generate và chưa có button batch
    const generateBtn = document.querySelector(".gemini-generate-btn");
    const existingBatchBtn = document.querySelector(".batch-generate-btn");

    if (!generateBtn || existingBatchBtn) return;

    // Tạo button batch
    const batchBtn = document.createElement("button");
    batchBtn.innerHTML = "🚀 Tự động xử lý tất cả ảnh";
    batchBtn.className = "batch-generate-btn";
    batchBtn.style.cssText = `
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin: 8px 0;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
    width: 100%;
    display: block;
  `;

    // Hover effects
    batchBtn.onmouseover = () => {
      if (!isBatchProcessing) {
        batchBtn.style.transform = "translateY(-2px)";
        batchBtn.style.boxShadow = "0 4px 12px rgba(76, 175, 80, 0.3)";
      }
    };
    batchBtn.onmouseout = () => {
      batchBtn.style.transform = "translateY(0)";
      batchBtn.style.boxShadow = "none";
    };

    // Click handler
    batchBtn.onclick = () => {
      if (isBatchProcessing) {
        if (confirm("Dừng quá trình xử lý hiện tại?")) {
          isBatchProcessing = false;
          batchBtn.innerHTML = "🚀 Tự động xử lý tất cả ảnh";
          batchBtn.style.background =
            "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)";
        }
      } else {
        startBatchProcessing();
      }
    };

    // Chèn ngay sau button generate
    generateBtn.parentNode.insertBefore(batchBtn, generateBtn.nextSibling);
  }

  // Hàm tạo button generate đơn lẻ (giữ nguyên từ code cũ)
  function injectGenerateButton() {
    // Tìm container của title input
    const titleContainer = document.querySelector(
      'div[data-error-message="Missing or invalid title."]'
    );
    if (!titleContainer || document.querySelector(".gemini-generate-btn"))
      return;

    // Tạo button
    const generateBtn = document.createElement("button");
    generateBtn.innerHTML = "✨ Generate với Gemini";
    generateBtn.className = "gemini-generate-btn";
    generateBtn.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin: 8px 0;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
    width: 100%;
    display: block;
  `;

    // Thêm hover effect
    generateBtn.onmouseover = () => {
      generateBtn.style.transform = "translateY(-2px)";
      generateBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    };
    generateBtn.onmouseout = () => {
      generateBtn.style.transform = "translateY(0)";
      generateBtn.style.boxShadow = "none";
    };

    // Xử lý click cho ảnh đơn lẻ
    generateBtn.onclick = async () => {
      const img = document.querySelector(".upload-tile__wrapper.active img");
      if (!img) {
        alert("Vui lòng chọn một ảnh trước!");
        return;
      }

      // Hiển thị loading
      generateBtn.innerHTML = `<span class="loading-spinner"></span>Đang phân tích...`;
      generateBtn.disabled = true;

      try {
        // Lấy API key từ storage
        const { apiKey } = await chrome.storage.sync.get(["apiKey"]);
        if (!apiKey) {
          throw new Error("Vui lòng cài đặt API key trong extension!");
        }

        // Convert ảnh sang base64
        const base64 = await imageToBase64(img);

        // Gọi Gemini API
        const result = await callGeminiAPI(base64, apiKey);

        // Điền kết quả vào form
        fillImageForm(result.title, result.keywords);

        // Cập nhật trạng thái button
        generateBtn.innerHTML = "✅ Đã tạo xong!";
        setTimeout(() => {
          generateBtn.innerHTML = "✨ Generate với Gemini";
          generateBtn.disabled = false;
        }, 2000);
      } catch (error) {
        generateBtn.innerHTML = "❌ Lỗi - Thử lại";
        generateBtn.disabled = false;
        showToast(`Có lỗi xảy ra: ${error.message}`, "error", 5000);

        setTimeout(() => {
          generateBtn.innerHTML = "✨ Generate với Gemini";
        }, 3000);
      }
    };

    // Chèn button vào sau title input
    titleContainer.appendChild(generateBtn);
  }

  // Thêm MutationObserver để theo dõi khi DOM thay đổi
  const observer = new MutationObserver(() => {
    // Chỉ inject button generate nếu chưa có
    if (!document.querySelector(".gemini-generate-btn")) {
      injectGenerateButton();
    }
    // Chỉ inject button batch nếu đã có button generate và chưa có button batch
    if (
      document.querySelector(".gemini-generate-btn") &&
      !document.querySelector(".batch-generate-btn")
    ) {
      injectBatchButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Khởi tạo khi load trang với delay
  setTimeout(() => {
    console.log("Khởi tạo extension sau 2 giây...");
    injectGenerateButton();

    // Đợi thêm 1 giây để button generate được tạo xong
    setTimeout(() => {
      injectBatchButton();
    }, 1000);
  }, 2000);

  // Debug: Log DOM structure khi load
  setTimeout(() => {
    console.log("=== DEBUG INFO ===");
    console.log("Tất cả ảnh trên trang:");
    const allImages = document.querySelectorAll("img");
    allImages.forEach((img, i) => {
      if (img.src && img.src.startsWith("http")) {
        console.log(`Ảnh ${i + 1}:`, {
          src: img.src.substring(0, 100) + "...",
          className: img.className,
          parentClassName: img.parentElement?.className,
          grandParentClassName: img.parentElement?.parentElement?.className,
        });
      }
    });

    console.log("Tất cả input/textarea:");
    const allInputs = document.querySelectorAll("input, textarea");
    allInputs.forEach((input, i) => {
      if (i < 10) {
        console.log(`Input ${i + 1}:`, {
          tag: input.tagName,
          type: input.type,
          name: input.name,
          className: input.className,
          placeholder: input.placeholder,
        });
      }
    });

    console.log("Tất cả button:");
    const allButtons = document.querySelectorAll("button");
    allButtons.forEach((btn, i) => {
      if (i < 10) {
        console.log(`Button ${i + 1}:`, {
          text: btn.textContent?.trim(),
          className: btn.className,
          dataT: btn.getAttribute("data-t"),
        });
      }
    });
  }, 3000);

  // Update selector cho title input
  chrome.storage.local.set({
    adobeFields: {
      titleSelector: "textarea.title-input",
      keywordSelector: "textarea[name=keywordsUITextArea]",
    },
  });

  // Thêm keyboard shortcut cho batch processing
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + Shift + G để bắt đầu batch processing
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "G") {
      e.preventDefault();
      if (!isBatchProcessing) {
        startBatchProcessing();
      }
    }

    // Escape để dừng batch processing
    if (e.key === "Escape" && isBatchProcessing) {
      isBatchProcessing = false;
      alert("Đã dừng quá trình xử lý tự động!");
    }
  });
}

main();
