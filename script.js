// 設定：4桁の暗証番号ごとのごほうび画像
const PIN_REWARDS = {
  "1111": "IMG_9411.jpg",
  "2323": "IMG_9412 2.jpg",
  "4545": "IMG_9413.jpg",
  "1919": "IMG_9414 2.jpg",
  "2929": "IMG_9415.jpg",
  "2233": "IMG_9416.jpg",
  "7777": "IMG_9417.jpg",
  "1788": "IMG_9420 2.jpg",
};
const STORAGE_KEY_USED = "neru_reward_scratch_used";

const startScratchBtn = document.getElementById("start-scratch-btn");
const alreadyUsedMessage = document.getElementById("already-used-message");

const confirmModal = document.getElementById("confirm-modal");
const confirmYesBtn = document.getElementById("confirm-yes-btn");
const confirmLaterBtn = document.getElementById("confirm-later-btn");

const passwordModal = document.getElementById("password-modal");
const passwordForm = document.getElementById("password-form");
const pinInput = document.getElementById("pin-input");
const pinError = document.getElementById("pin-error");
const passwordCancelBtn = document.getElementById("password-cancel-btn");

const introSection = document.getElementById("intro-section");
const scratchSection = document.getElementById("scratch-section");

const scratchCardArea = document.getElementById("scratch-card-area");
const scratchOverlay = document.getElementById("scratch-overlay");
const scratchCanvas = document.getElementById("scratch-canvas");
const scratchCoin = document.getElementById("scratch-coin");
const afterScratchMessage = document.getElementById("after-scratch-message");
const rewardImage = document.getElementById("reward-image");

// -------------------------------
// ユーティリティ
// -------------------------------
function openModal(modalEl) {
  modalEl.classList.add("is-visible");
  modalEl.setAttribute("aria-hidden", "false");
}

function closeModal(modalEl) {
  modalEl.classList.remove("is-visible");
  modalEl.setAttribute("aria-hidden", "true");
}

function markScratchUsed() {
  // 何回でも遊べる仕様にしたため、ここでは特別な処理を行いません。
}

function checkScratchUsedOnLoad() {
  // 何回でも遊べる仕様：常にボタンを有効にしてメッセージは隠す
  if (startScratchBtn) {
    startScratchBtn.disabled = false;
  }
  if (alreadyUsedMessage) {
    alreadyUsedMessage.hidden = true;
  }
}

// -------------------------------
// 初期状態
// -------------------------------
checkScratchUsedOnLoad();

// -------------------------------
// スクラッチ用 Canvas セットアップ
// -------------------------------
let scratchCtx = null;
let isScratching = false;
let hasRevealed = false;
let lastCheckTime = 0;
let hasStartedScratch = false;

function resizeScratchCanvas() {
  if (!scratchCanvas || !scratchOverlay) return;

  const rect = scratchOverlay.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  scratchCanvas.width = rect.width;
  scratchCanvas.height = rect.height;

  scratchCtx = scratchCanvas.getContext("2d");
  // スクラッチ面を塗りつぶし（ピンクストライプ風）
  const gradient = scratchCtx.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, "#ffeaf6");
  gradient.addColorStop(0.5, "#ffd2e6");
  gradient.addColorStop(1, "#ffeaf6");

  scratchCtx.fillStyle = gradient;
  scratchCtx.fillRect(0, 0, rect.width, rect.height);

  // 斜めストライプ
  scratchCtx.strokeStyle = "rgba(255, 192, 224, 0.9)";
  scratchCtx.lineWidth = 18;
  const step = 32;
  for (let i = -rect.height; i < rect.width * 2; i += step) {
    scratchCtx.beginPath();
    scratchCtx.moveTo(i, 0);
    scratchCtx.lineTo(i - rect.height, rect.height);
    scratchCtx.stroke();
  }

  scratchCtx.globalCompositeOperation = "destination-out";
}

function getScratchPos(event) {
  const rect = scratchCanvas.getBoundingClientRect();
  const point =
    event.touches && event.touches[0]
      ? event.touches[0]
      : event.changedTouches && event.changedTouches[0]
      ? event.changedTouches[0]
      : event;
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

function scratchAt(event) {
  if (!scratchCtx || hasRevealed) return;
  const { x, y } = getScratchPos(event);
  const radius = 36; // 少し太めにして、削った場所が分かりやすいようにする

  scratchCtx.beginPath();
  scratchCtx.arc(x, y, radius, 0, Math.PI * 2);
  scratchCtx.fill();

  // コイン画像を指の位置に追従させる
  if (scratchCoin) {
    const coinOffset = 45; // 画像サイズの半分くらい
    scratchCoin.style.transform = `translate(${x - coinOffset}px, ${y - coinOffset}px)`;
  }
}

function checkRevealProgress() {
  if (!scratchCtx || hasRevealed) return;
  const now = Date.now();
  // 計算が重いので 300ms に一度だけチェック
  if (now - lastCheckTime < 300) return;
  lastCheckTime = now;

  const width = scratchCanvas.width;
  const height = scratchCanvas.height;
  if (!width || !height) return;

  const imageData = scratchCtx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let transparentCount = 0;
  const total = width * height;

  // 何ピクセルか間引きしながらチェック（4ピクセルごと）
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] === 0) {
      transparentCount++;
    }
  }

  const sampleTotal = total / 4; // 4ピクセルに1回数えているので
  const ratio = transparentCount / sampleTotal;

  if (ratio >= 0.3) {
    hasRevealed = true;
    scratchOverlay.classList.add("scratched");
    afterScratchMessage.hidden = false;
    markScratchUsed();
  }
}

function setupScratchEvents() {
  if (!scratchCanvas) return;

  const targets = [scratchCanvas, scratchOverlay].filter(Boolean);

  const startScratch = (event) => {
    isScratching = true;
    if (!hasStartedScratch) {
      hasStartedScratch = true;
      scratchOverlay.classList.add("scratching-started");
    }
    if (scratchCoin) {
      scratchCoin.style.opacity = "1";
    }
    scratchAt(event);
  };

  const moveScratch = (event) => {
    if (!isScratching) return;
    // スクロールを止めて、スムーズにこすれるようにする
    if (event.cancelable) {
      event.preventDefault();
    }
    scratchAt(event);
    checkRevealProgress();
  };

  const endScratch = (event) => {
    if (!isScratching) return;
    isScratching = false;
    if (scratchCoin) {
      scratchCoin.style.opacity = "0";
    }
    checkRevealProgress();
  };

  // PC（マウス）
  targets.forEach((el) => el.addEventListener("mousedown", startScratch));
  window.addEventListener("mousemove", moveScratch);
  window.addEventListener("mouseup", endScratch);

  // スマホ・タブレット（タッチ）
  targets.forEach((el) => el.addEventListener("touchstart", startScratch, { passive: false }));
  window.addEventListener("touchmove", moveScratch, { passive: false });
  window.addEventListener("touchend", endScratch);
  window.addEventListener("touchcancel", endScratch);
}

function initScratch() {
  hasRevealed = false;
  hasStartedScratch = false;
  afterScratchMessage.hidden = true;
  scratchOverlay.classList.remove("scratched");
  scratchOverlay.classList.remove("scratching-started");
  if (scratchCoin) {
    scratchCoin.style.opacity = "0";
    scratchCoin.style.transform = "translate(-9999px, -9999px)";
  }
  resizeScratchCanvas();
}

// -------------------------------
// 「さっそくスクラッチをけずる」
// -------------------------------
if (startScratchBtn) {
  startScratchBtn.addEventListener("click", () => {
    if (startScratchBtn.disabled) return;
    openModal(confirmModal);
  });
}

// -------------------------------
// 確認モーダル
// -------------------------------
if (confirmYesBtn) {
  confirmYesBtn.addEventListener("click", () => {
    closeModal(confirmModal);
    pinInput.value = "";
    pinError.textContent = "";
    openModal(passwordModal);
    setTimeout(() => {
      pinInput.focus();
    }, 100);
  });
}

if (confirmLaterBtn) {
  confirmLaterBtn.addEventListener("click", () => {
    closeModal(confirmModal);
  });
}

// モーダルの背景クリックで閉じる（確認モーダルのみ）
confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal || event.target.classList.contains("modal-backdrop")) {
    closeModal(confirmModal);
  }
});

// -------------------------------
// パスワードモーダル
// -------------------------------
passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = pinInput.value.trim();

  if (value.length !== 4) {
    pinError.textContent = "4桁の数字を入力してください。";
    return;
  }

  const rewardSrc = PIN_REWARDS[value];

  if (rewardSrc) {
    // 対応するごほうび画像に差し替え
    if (rewardImage) {
      rewardImage.src = rewardSrc;
    }
    pinError.textContent = "";
    closeModal(passwordModal);
    // スクラッチ画面を表示
    introSection.style.display = "none";
    scratchSection.hidden = false;
    initScratch();
    scratchSection.scrollIntoView({ behavior: "smooth" });
  } else {
    pinError.textContent = "暗証番号がちがいます。";
  }
});

passwordCancelBtn.addEventListener("click", () => {
  closeModal(passwordModal);
});

passwordModal.addEventListener("click", (event) => {
  if (event.target === passwordModal || event.target.classList.contains("modal-backdrop")) {
    closeModal(passwordModal);
  }
});

// -------------------------------
// スクラッチ表示（こすって削る）
// -------------------------------
setupScratchEvents();
window.addEventListener("resize", () => {
  if (!scratchSection.hidden) {
    initScratch();
  }
});


