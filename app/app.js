const SAMPLE_INQUIRIES = [
  {
    customer_name: "株式会社ネクストコマース 山本",
    email: "yamamoto@next-commerce.example.jp",
    content: "カート画面でWeb接客バナーが画面全体を覆ってしまい、購入ボタンが押せないというクレームが複数来ています。緊急で表示停止または修正をお願いします！"
  },
  {
    customer_name: "大濠クラウドサービス 伊藤",
    email: "ito@://example.com",
    content: "来期から部署全体で導入したく、30アカウント分の年間契約見積書を発行していただけますでしょうか？"
  },
  {
    customer_name: "株式会社サンライズ 小林",
    email: "kobayashi@sunrise.example.co.jp",
    content: "管理画面のダッシュボードをダークモードに切り替えられる機能があると夜間作業時に助かります。ぜひご検討ください。"
  }
];

let sampleIndex = 0;
let allInquiriesCache = [];
let matchedPastItem = null;

document.addEventListener("DOMContentLoaded", async () => {
  const savedUrl = localStorage.getItem("smartsupport_webhook_url");
  if (savedUrl) document.getElementById("webhook-url").value = savedUrl;
  ["email", "passcode"].forEach(id => {
    document.getElementById(id).addEventListener("input", checkPastInquiries);
  });
  await fetchConfig();
  await fetchInquiries();
});

async function testWebhook() {
  const url = document.getElementById("webhook-url").value.trim();
  const statusEl = document.getElementById("webhook-status");
  if (!url) { statusEl.textContent = "⚠️ Webhook URLを入力してください"; return; }
  localStorage.setItem("smartsupport_webhook_url", url);
  statusEl.textContent = "⏳ テスト通知を送信中...";
  const res = await fetch("/api/webhook/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webhook_url: url })
  });
  statusEl.textContent = res.ok ? "✅ テスト送信に成功しました！Discord/Slackをご確認ください。" : "❌ 送信失敗：URLを確認してください。";
}

async function fetchConfig() {
  const res = await fetch("/api/config");
  const data = await res.json();
  document.getElementById("ai-mode-badge").textContent = "🤖 " + data.ai_mode;
}

function fillSampleInquiry() {
  const sample = SAMPLE_INQUIRIES[sampleIndex % SAMPLE_INQUIRIES.length];
  sampleIndex++;
  document.getElementById("customer_name").value = sample.customer_name;
  document.getElementById("email").value = sample.email;
  document.getElementById("content").value = sample.content;
  checkPastInquiries();
}

document.getElementById("inquiry-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "AI解析中...";

  const rel = document.querySelector('input[name="inquiry-relation"]:checked')?.value;
  const prefix = (rel === "followup" && matchedPastItem) ? `【🔁 前回(ID:#${matchedPastItem.id} / ${matchedPastItem.category})の継続・再発】\n` : "";
  const pass = document.getElementById("passcode").value.trim();
  const passTag = pass ? `\n[[PASS_HASH]]${btoa(encodeURIComponent(pass))}` : "";
  const rawContent = prefix + document.getElementById("content").value + passTag;
  const content = selectedImageBase64 ? `${rawContent}\n[[IMG_DATA]]${selectedImageBase64}` : rawContent;
  const payload = {
    customer_name: document.getElementById("customer_name").value,
    email: document.getElementById("email").value,
    content
  };

  try {
    const webhookUrl = document.getElementById("webhook-url").value.trim();
    if (webhookUrl) localStorage.setItem("smartsupport_webhook_url", webhookUrl);
    const apiUrl = webhookUrl ? `/api/inquiries?webhook_url=${encodeURIComponent(webhookUrl)}` : "/api/inquiries";
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById("inquiry-form").reset();
      clearSelectedImage();
      checkPastInquiries();
      await fetchInquiries();
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ AI解析して登録する";
  }
});

async function fetchInquiries() {
  const status = document.getElementById("filter-status").value;
  const priority = document.getElementById("filter-priority").value;
  const q = document.getElementById("search-input").value;

  const params = new URLSearchParams();
  if (status !== "すべて") params.append("status", status);
  if (priority !== "すべて") params.append("priority", priority);
  if (q.trim()) params.append("q", q.trim());

  const res = await fetch("/api/inquiries?" + params.toString());
  const items = await res.json();
  if (status === "すべて" && priority === "すべて" && !q.trim()) allInquiriesCache = items;

  updateKPIs(items);
  renderList(items);
}

function updateKPIs(items) {
  document.getElementById("kpi-total").textContent = items.length + " 件";
  document.getElementById("kpi-unanswered").textContent = items.filter(i => i.status === "未対応").length + " 件";
  document.getElementById("kpi-high").textContent = items.filter(i => i.priority === "高").length + " 件";
}

function renderList(items) {
  const container = document.getElementById("inquiry-list");
  if (items.length === 0) {
    container.innerHTML = '<div class="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">該当するお問い合わせがありません。</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const priorityBadge = {
      "高": "bg-rose-100",
      "中": "bg-amber-100",
      "低": "bg-emerald-100"
    }[item.priority] || "bg-indigo-50";

    const dateStr = new Date(item.created_at).toLocaleString("ja-JP");

    return `
      <div class="bg-white">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
            <span class="${priorityBadge}">緊急度: ${item.priority}</span>
            <span class="bg-indigo-50">${item.category}</span>
            <strong>${escapeHtml(item.customer_name)}</strong>
            <span style="font-size:0.8rem; color:#64748b;">(${escapeHtml(item.email)})</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.8rem; color:#64748b;">${dateStr}</span>
            <select onchange="updateStatus(${item.id}, this.value)">
              <option value="未対応" ${item.status === "未対応" ? "selected" : ""}>🔴 未対応</option>
              <option value="対応中" ${item.status === "対応中" ? "selected" : ""}>🟡 対応中</option>
              <option value="完了" ${item.status === "完了" ? "selected" : ""}>🟢 完了</option>
            </select>
            <button onclick="deleteInquiry(${item.id})">削除</button>
          </div>
        </div>

        ${(() => {
          const [rawTxt, img] = (item.content || "").split("\n[[IMG_DATA]]");
          const [noAuditTxt, audit] = rawTxt.split("\n[[AUDIT_LOG]]");
          const txt = noAuditTxt.split("\n[[PASS_HASH]]")[0];
          return `<p style="white-space:pre-wrap;">${escapeHtml(txt)}</p>` +
            (img ? `<div style="margin:8px 0;"><a href="${img}" target="_blank"><img src="${img}" alt="添付スクリーンショット" style="max-height:180px; border-radius:8px; border:1px solid #cbd5e1;"></a></div>` : "") +
            (audit ? `<div style="background:#f1f5f9; border-left:3px solid #64748b; padding:6px 10px; font-size:0.78rem; color:#334155; margin:6px 0; white-space:pre-wrap;">🕒 <strong>対応履歴ログ：</strong>\n${escapeHtml(audit)}</div>` : "");
        })()}


        <details>
          <summary>🤖 AI生成の一次回答案を確認・編集する</summary>
          <div style="margin-top:8px;">
            <textarea id="reply-${item.id}" rows="5">${escapeHtml(item.ai_reply_draft)}</textarea>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button onclick="copyReply(${item.id})" style="background:#e2e8f0; color:#1e293b;">📋 コピー</button>
              <button onclick="saveReply(${item.id})">💾 回答案を保存</button>
              <button onclick="openSimModal(${item.id}, '${escapeHtml(item.email)}')" style="background:#059669;">
                ✉️ 自動返信シミュレーション
              </button>

            </div>
          </div>
        </details>
      </div>
    `;
  }).join("");
}

async function updateStatus(id, status) {
  const updatedContent = appendAuditLog(id, `ステータスを「${status}」に変更`);
  await fetch("/api/inquiries/" + id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, content: updatedContent })
  });
  await fetchInquiries();
}

async function saveReply(id) {
  const ai_reply_draft = document.getElementById("reply-" + id).value;
  const res = await fetch("/api/inquiries/" + id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ai_reply_draft })
  });
  if (res.ok) {
    alert("回答案を保存しました！");
  }
}

function copyReply(id) {
  const text = document.getElementById("reply-" + id).value;
  navigator.clipboard.writeText(text);
  alert("回答案をクリップボードにコピーしました！");
}

let lastDeletedItem = null;

async function deleteInquiry(id) {
  if (!confirm("このお問い合わせを削除しますか？")) return;
  lastDeletedItem = allInquiriesCache.find(i => i.id === id) || null;
  await fetch("/api/inquiries/" + id, { method: "DELETE" });
  await fetchInquiries();
  if (lastDeletedItem) showUndoToast();
}

function showUndoToast() {
  let toast = document.getElementById("undo-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "undo-toast";
    toast.style.cssText = "position:fixed; bottom:20px; right:20px; background:#1e293b; color:#fff; padding:12px 16px; border-radius:8px; display:flex; align-items:center; gap:12px; z-index:60; box-shadow:0 10px 15px rgba(0,0,0,0.2); font-size:0.85rem;";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>🗑️ 削除しました</span><button onclick="undoDelete()" style="background:#4f46e5; color:#fff; padding:4px 10px; border-radius:6px; font-weight:bold;">↩️ 元に戻す</button>`;
  toast.style.display = "flex";
}

async function undoDelete() {
  if (!lastDeletedItem) return;
  const { customer_name, email, content, status, ai_reply_draft } = lastDeletedItem;
  const res = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_name, email, content }) });
  if (res.ok) { const created = await res.json(); await fetch("/api/inquiries/" + created.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ai_reply_draft }) }); }
  lastDeletedItem = null;
  document.getElementById("undo-toast").style.display = "none";
  await fetchInquiries();
}

async function resetDemoData() {
  if (!confirm("すべてのデータを初期サンプル状態にリセットしますか？")) return;
  localStorage.removeItem("smartsupport_webhook_url");
  document.getElementById("webhook-url").value = "";
  document.getElementById("webhook-status").textContent = "";
  document.getElementById("inquiry-form").reset();
  clearSelectedImage();
  await fetch("/api/demo/reset", { method: "POST" });
  await fetchInquiries();
  checkPastInquiries();
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
let currentSimId = null;

function openSimModal(id, email) {
  currentSimId = id;
  document.getElementById("sim-to").textContent = email;
  document.getElementById("sim-body").textContent = document.getElementById("reply-" + id).value;
  document.getElementById("sim-modal").style.display = "flex";
}

function closeSimModal() {
  document.getElementById("sim-modal").style.display = "none";
  currentSimId = null;
}

async function confirmSimulateReply() {
  if (!currentSimId) return;
  const ai_reply_draft = document.getElementById("reply-" + currentSimId).value;
  const updatedContent = appendAuditLog(currentSimId, "自動返信シミュレーション実行・対応中に更新");
  await fetch("/api/inquiries/" + currentSimId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ai_reply_draft, status: "対応中", content: updatedContent })
  });
  closeSimModal();
  await fetchInquiries();
  alert("✅ 自動返信シミュレーションを完了し、ステータスを「対応中」に更新しました！");
}
let selectedImageBase64 = "";

function previewSelectedImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 800 / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      selectedImageBase64 = canvas.toDataURL("image/jpeg", 0.8);
      document.getElementById("image-preview").src = selectedImageBase64;
      document.getElementById("image-preview-box").style.display = "block";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  selectedImageBase64 = "";
  const input = document.getElementById("image-input");
  if (input) input.value = "";
  const box = document.getElementById("image-preview-box");
  if (box) box.style.display = "none";
}
function checkPastInquiries() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pass = document.getElementById("passcode").value.trim();
  const box = document.getElementById("past-inquiry-box");
  if (!email || !pass) { box.style.display = "none"; matchedPastItem = null; return; }

  const targetHash = btoa(encodeURIComponent(pass));
  const past = allInquiriesCache.filter(i => {
    if (i.email.toLowerCase() !== email) return false;
    const savedHash = ((i.content || "").split("\n[[PASS_HASH]]")[1] || "").split("\n")[0].trim();
    return savedHash !== "" && savedHash === targetHash;
  });
  if (past.length === 0) { box.style.display = "none"; matchedPastItem = null; return; }

  matchedPastItem = past[0];
  const dt = new Date(matchedPastItem.created_at).toLocaleString("ja-JP");
  document.getElementById("past-inquiry-summary").textContent =
    `直近：${dt} に「${matchedPastItem.category}（ステータス：${matchedPastItem.status}）」のお問い合わせが計${past.length}件あります。前回の件の継続・再発ですか？それとも別件ですか？`;
  box.style.display = "block";
}

function switchViewMode(mode) {
  const isCust = mode === "customer";
  document.getElementById("tab-admin").style.background = isCust ? "#e2e8f0" : "#4f46e5";
  document.getElementById("tab-admin").style.color = isCust ? "#1e293b" : "#fff";
  document.getElementById("tab-customer").style.background = isCust ? "#4f46e5" : "#e2e8f0";
  document.getElementById("tab-customer").style.color = isCust ? "#fff" : "#1e293b";
  document.getElementById("kpi-total")?.closest(".grid")?.style.setProperty("display", isCust ? "none" : "");
  document.getElementById("webhook-url")?.closest("section")?.style.setProperty("display", isCust ? "none" : "");
  document.getElementById("filter-status")?.parentElement?.parentElement?.style.setProperty("display", isCust ? "none" : "");
  document.getElementById("inquiry-list").style.display = isCust ? "none" : "";
  const opWrap = document.getElementById("operator-name")?.parentElement;
  if (opWrap) opWrap.style.cssText = isCust ? "display:none !important;" : "margin-left:auto; display:flex; align-items:center; gap:6px; font-size:0.85rem;";
  document.querySelector('button[onclick="fillSampleInquiry()"]')?.style.setProperty("display", isCust ? "none" : "");
}
document.addEventListener("DOMContentLoaded", () => {
  const tabBar = document.getElementById("tab-admin")?.parentElement;
  if (!tabBar) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-left:auto; display:flex; align-items:center; gap:6px; font-size:0.85rem;";
  wrap.innerHTML = `<label style="font-weight:bold; color:#334155;">👤 対応担当者:</label><input type="text" id="operator-name" value="${localStorage.getItem("smartsupport_op") || "酒井（CS担当）"}" onchange="localStorage.setItem('smartsupport_op', this.value)" style="width:140px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:6px;">`;
  tabBar.appendChild(wrap);
});

function appendAuditLog(id, actionText) {
  const item = allInquiriesCache.find(i => i.id === id);
  if (!item) return "";
  const op = (document.getElementById("operator-name")?.value || "未設定").trim();
  const line = `・${new Date().toLocaleString("ja-JP")} [${op}] ${actionText}`;
  const [rawTxt, img] = (item.content || "").split("\n[[IMG_DATA]]");
  const baseTxt = rawTxt.includes("\n[[AUDIT_LOG]]") ? `${rawTxt}\n${line}` : `${rawTxt}\n[[AUDIT_LOG]]${line}`;
  return img ? `${baseTxt}\n[[IMG_DATA]]${img}` : baseTxt;
}
