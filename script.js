// ===================================
// 4月目標管理アプリ - PBL Tracker
// ===================================

// --- Supabase接続設定 ---
const SUPABASE_URL = "https://liitvaopboonilnpbfyl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpaXR2YW9wYm9vbmlsbnBiZnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMDMxMDksImV4cCI6MjA5MDU3OTEwOX0.XRkV2kANasbHBPi27bgcgCkS3_Hle5lJj1sRU7WLxJs";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ステータスの定義 ---
const STATUS_CYCLE = ["not-started", "in-progress", "done"];
const STATUS_LABELS = {
  "not-started": "未着手",
  "in-progress": "進行中",
  "done": "完了",
};

// --- テーマカラー ---
const GOAL_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#27ae60",
  "#3498db", "#9b59b6", "#1abc9c", "#e84393",
  "#fd79a8", "#636e72",
];

// --- HTML要素の取得 ---
const goalsContainer = document.getElementById("goals-container");
const overallPercent = document.getElementById("overall-percent");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const actionTextInput = document.getElementById("action-text-input");
const actionMemoInput = document.getElementById("action-memo-input");
const saveActionBtn = document.getElementById("save-action-btn");
const cancelActionBtn = document.getElementById("cancel-action-btn");

const goalModalOverlay = document.getElementById("goal-modal-overlay");
const goalTitleInput = document.getElementById("goal-title-input");
const goalEmojiInput = document.getElementById("goal-emoji-input");
const saveGoalBtn = document.getElementById("save-goal-btn");
const cancelGoalBtn = document.getElementById("cancel-goal-btn");
const addGoalBtn = document.getElementById("add-goal-btn");

let editingGoalId = null;
let editingActionId = null;

// メモリ上にキャッシュしたデータ（毎回Supabaseに問い合わせなくて済むように）
let cachedGoals = null;

// ===================================
// 初期データ
// ===================================

function getInitialData() {
  return [
    {
      id: 1,
      title: "コーヒー屋を巡って、お気に入りの豆を見つける",
      emoji: "☕",
      actions: [
        { id: 101, text: "行きたいコーヒー屋をリストアップする", status: "not-started", memo: "" },
        { id: 102, text: "週末やSG旅行中に最低3店舗は回る", status: "not-started", memo: "" },
        { id: 103, text: "気に入った豆をメモしておく（産地・焙煎度・店名）", status: "not-started", memo: "" },
      ],
    },
    {
      id: 2,
      title: "自宅のコーヒー器具を一通りそろえる",
      emoji: "🫖",
      actions: [
        { id: 201, text: "サーバーを選んで購入する", status: "not-started", memo: "" },
        { id: 202, text: "大きめのドリッパーを選んで購入する", status: "not-started", memo: "" },
      ],
    },
    {
      id: 3,
      title: "キャリアの方向性を言語化する",
      emoji: "🧭",
      actions: [
        { id: 301, text: "「どんな仕事をしていたいか」を書き出す", status: "not-started", memo: "" },
        { id: 302, text: "マネージャーや他のキャリアパスで求められる素養を調べて整理する", status: "not-started", memo: "" },
        { id: 303, text: "必要なインプット（書籍・研修・経験）を言語化する", status: "not-started", memo: "" },
        { id: 304, text: "理想像と現状のギャップを整理する", status: "not-started", memo: "" },
      ],
    },
    {
      id: 4,
      title: "Claude Codeでアプリを完成させる",
      emoji: "💻",
      actions: [
        { id: 401, text: "VSCodeや他の媒体からもClaude Codeを触ってみる", status: "not-started", memo: "" },
        { id: 402, text: "各アプリの要求事項をきちんと言語化する", status: "not-started", memo: "" },
        { id: 403, text: "要求事項をもとに1つずつ作り、動くものを完成させる", status: "not-started", memo: "" },
        { id: 404, text: "作る過程でオブジェクト指向・クラスの概念を意識する", status: "not-started", memo: "" },
      ],
    },
    {
      id: 5,
      title: "AI × Agile でアジャイルがどう変わるかを理解する",
      emoji: "🤖",
      actions: [
        { id: 501, text: "関連書籍をリサーチして1冊読む", status: "not-started", memo: "" },
        { id: 502, text: "動画やWeb記事で補完する", status: "not-started", memo: "" },
        { id: 503, text: "4/28 Product Management Summit で関連セッションに参加する", status: "not-started", memo: "" },
      ],
    },
    {
      id: 6,
      title: "小説を2冊以上読む",
      emoji: "📚",
      actions: [
        { id: 601, text: "読みたい本を決める", status: "not-started", memo: "" },
        { id: 602, text: "通勤や移動時間を読書タイムにあてる", status: "not-started", memo: "" },
      ],
    },
  ];
}

// ===================================
// データの読み書き（Supabase）
// ===================================

/**
 * Supabaseからデータを読み込む
 * データがなければ初期データを保存してから返す
 */
async function loadGoals() {
  // キャッシュがあればそれを返す（高速化）
  if (cachedGoals) return cachedGoals;

  const { data, error } = await supabase
    .from("goals")
    .select("data")
    .eq("id", "default")
    .single();

  if (error || !data) {
    // Supabaseにデータがない → 初期データを保存
    const initial = getInitialData();
    await saveGoals(initial);
    return initial;
  }

  cachedGoals = data.data;
  return cachedGoals;
}

/**
 * Supabaseにデータを保存する
 * upsert = データがあれば更新、なければ新規作成
 */
async function saveGoals(goals) {
  cachedGoals = goals; // キャッシュも更新

  await supabase
    .from("goals")
    .upsert({
      id: "default",
      data: goals,
      updated_at: new Date().toISOString(),
    });
}

// ===================================
// 描画
// ===================================

async function render() {
  const goals = await loadGoals();
  const filterValue = document.querySelector(".filter-btn.active").dataset.filter;

  goalsContainer.innerHTML = "";

  let totalActions = 0;
  let totalDone = 0;

  goals.forEach(function (goal, index) {
    goal.actions.forEach(function (a) {
      totalActions++;
      if (a.status === "done") totalDone++;
    });

    if (filterValue !== "all") {
      const hasMatchingAction = goal.actions.some(function (a) {
        return a.status === filterValue;
      });
      if (!hasMatchingAction) return;
    }

    const color = GOAL_COLORS[index % GOAL_COLORS.length];
    const card = createGoalCard(goal, filterValue, index + 1, color);
    goalsContainer.appendChild(card);
  });

  const percent = totalActions > 0 ? Math.round((totalDone / totalActions) * 100) : 0;
  overallPercent.textContent = percent + "%";
}

/**
 * 目標カードを1つ作成する
 */
function createGoalCard(goal, filterValue, displayNumber, color) {
  const total = goal.actions.length;
  const doneCount = goal.actions.filter(function (a) { return a.status === "done"; }).length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const card = document.createElement("div");
  card.classList.add("goal-card");
  card.dataset.goal = goal.id;
  card.style.borderLeftColor = color;

  const expandedGoals = JSON.parse(localStorage.getItem("expanded-goals") || "[]");
  if (expandedGoals.includes(goal.id)) {
    card.classList.add("expanded");
  }

  const header = document.createElement("div");
  header.classList.add("goal-header");

  const titleRow = document.createElement("div");
  titleRow.classList.add("goal-title-row");

  const titleDiv = document.createElement("div");
  titleDiv.classList.add("goal-title");

  const badge = document.createElement("span");
  badge.classList.add("priority-badge");
  badge.style.backgroundColor = color;
  if (color === "#f1c40f") badge.style.color = "#333";
  badge.textContent = displayNumber;

  const titleText = document.createElement("span");
  titleText.textContent = goal.emoji + " " + goal.title;

  titleDiv.appendChild(badge);
  titleDiv.appendChild(titleText);

  const progressInfo = document.createElement("div");
  progressInfo.classList.add("goal-progress-info");

  const percentSpan = document.createElement("span");
  percentSpan.classList.add("goal-percent");
  percentSpan.textContent = percent + "%";

  const countSpan = document.createElement("span");
  countSpan.textContent = doneCount + "/" + total;

  const toggleIcon = document.createElement("span");
  toggleIcon.classList.add("toggle-icon");
  toggleIcon.textContent = "▶";

  progressInfo.appendChild(percentSpan);
  progressInfo.appendChild(countSpan);
  progressInfo.appendChild(toggleIcon);

  titleRow.appendChild(titleDiv);
  titleRow.appendChild(progressInfo);
  header.appendChild(titleRow);

  header.addEventListener("click", function () {
    card.classList.toggle("expanded");
    saveExpandedState();
  });

  const progressBarContainer = document.createElement("div");
  progressBarContainer.classList.add("progress-bar-container");

  const progressBar = document.createElement("div");
  progressBar.classList.add("progress-bar");
  progressBar.style.width = percent + "%";
  progressBar.style.backgroundColor = color;
  progressBarContainer.appendChild(progressBar);

  const actionsDiv = document.createElement("div");
  actionsDiv.classList.add("goal-actions");

  goal.actions.forEach(function (action) {
    if (filterValue !== "all" && action.status !== filterValue) return;
    const actionItem = createActionItem(goal.id, action);
    actionsDiv.appendChild(actionItem);
  });

  const addBtn = document.createElement("button");
  addBtn.classList.add("add-action-btn");
  addBtn.textContent = "＋ アクションを追加";
  addBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    addNewAction(goal.id);
  });
  actionsDiv.appendChild(addBtn);

  card.appendChild(header);
  card.appendChild(progressBarContainer);
  card.appendChild(actionsDiv);

  return card;
}

/**
 * アクションアイテムを1つ作成する
 */
function createActionItem(goalId, action) {
  const item = document.createElement("div");
  item.classList.add("action-item");
  if (action.status === "done") {
    item.classList.add("done");
  }

  const statusBtn = document.createElement("button");
  statusBtn.classList.add("status-btn");
  if (action.status === "in-progress") {
    statusBtn.classList.add("in-progress");
    statusBtn.textContent = "●";
  } else if (action.status === "done") {
    statusBtn.classList.add("done");
    statusBtn.textContent = "✓";
  }

  statusBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    cycleStatus(goalId, action.id);
  });

  const content = document.createElement("div");
  content.classList.add("action-content");

  const textSpan = document.createElement("div");
  textSpan.classList.add("action-text");
  textSpan.textContent = action.text;

  textSpan.addEventListener("click", function (e) {
    e.stopPropagation();
    openEditModal(goalId, action.id);
  });

  content.appendChild(textSpan);

  if (action.memo) {
    const memoDiv = document.createElement("div");
    memoDiv.classList.add("action-memo");
    memoDiv.textContent = "📝 " + action.memo;
    content.appendChild(memoDiv);
  }

  const statusLabel = document.createElement("span");
  statusLabel.classList.add("action-status-label", action.status);
  statusLabel.textContent = STATUS_LABELS[action.status];

  item.appendChild(statusBtn);
  item.appendChild(content);
  item.appendChild(statusLabel);

  return item;
}

// ===================================
// ステータス変更
// ===================================

async function cycleStatus(goalId, actionId) {
  const goals = await loadGoals();
  const goal = goals.find(function (g) { return g.id === goalId; });
  if (!goal) return;

  const action = goal.actions.find(function (a) { return a.id === actionId; });
  if (!action) return;

  const currentIndex = STATUS_CYCLE.indexOf(action.status);
  const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
  action.status = STATUS_CYCLE[nextIndex];

  await saveGoals(goals);
  render();
}

// ===================================
// アクション追加
// ===================================

async function addNewAction(goalId) {
  const text = prompt("新しいアクションを入力してください：");
  if (!text || !text.trim()) return;

  const goals = await loadGoals();
  const goal = goals.find(function (g) { return g.id === goalId; });
  if (!goal) return;

  goal.actions.push({
    id: Date.now(),
    text: text.trim(),
    status: "not-started",
    memo: "",
  });

  await saveGoals(goals);
  render();
}

// ===================================
// モーダル（アクション編集）
// ===================================

async function openEditModal(goalId, actionId) {
  editingGoalId = goalId;
  editingActionId = actionId;

  const goals = await loadGoals();
  const goal = goals.find(function (g) { return g.id === goalId; });
  if (!goal) return;

  const action = goal.actions.find(function (a) { return a.id === actionId; });
  if (!action) return;

  modalTitle.textContent = "アクションを編集";
  actionTextInput.value = action.text;
  actionMemoInput.value = action.memo || "";

  modalOverlay.classList.add("active");
  actionTextInput.focus();
}

function closeModal() {
  modalOverlay.classList.remove("active");
  editingGoalId = null;
  editingActionId = null;
}

async function saveActionEdit() {
  const text = actionTextInput.value.trim();
  if (!text) return;

  const goals = await loadGoals();
  const goal = goals.find(function (g) { return g.id === editingGoalId; });
  if (!goal) return;

  const action = goal.actions.find(function (a) { return a.id === editingActionId; });
  if (!action) return;

  action.text = text;
  action.memo = actionMemoInput.value.trim();

  await saveGoals(goals);
  closeModal();
  render();
}

// ===================================
// 目標追加
// ===================================

function openGoalModal() {
  goalTitleInput.value = "";
  goalEmojiInput.value = "";
  goalModalOverlay.classList.add("active");
  goalTitleInput.focus();
}

function closeGoalModal() {
  goalModalOverlay.classList.remove("active");
}

async function saveNewGoal() {
  const title = goalTitleInput.value.trim();
  if (!title) {
    goalTitleInput.style.borderColor = "#e74c3c";
    setTimeout(function () { goalTitleInput.style.borderColor = "#ddd"; }, 1000);
    return;
  }

  const emoji = goalEmojiInput.value.trim() || "🎯";

  const goals = await loadGoals();
  goals.push({
    id: Date.now(),
    title: title,
    emoji: emoji,
    actions: [],
  });

  await saveGoals(goals);
  closeGoalModal();
  render();
}

// ===================================
// 展開状態の保存/復元（これはUI状態なのでlocalStorageのまま）
// ===================================

function saveExpandedState() {
  const expandedCards = document.querySelectorAll(".goal-card.expanded");
  const ids = [];
  expandedCards.forEach(function (card) {
    ids.push(Number(card.dataset.goal));
  });
  localStorage.setItem("expanded-goals", JSON.stringify(ids));
}

// ===================================
// フィルタ
// ===================================

document.querySelectorAll(".filter-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".filter-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    render();
  });
});

// ===================================
// イベントリスナー
// ===================================

saveActionBtn.addEventListener("click", saveActionEdit);
cancelActionBtn.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", function (e) {
  if (e.target === modalOverlay) closeModal();
});

actionTextInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") saveActionEdit();
});

addGoalBtn.addEventListener("click", openGoalModal);
saveGoalBtn.addEventListener("click", saveNewGoal);
cancelGoalBtn.addEventListener("click", closeGoalModal);

goalModalOverlay.addEventListener("click", function (e) {
  if (e.target === goalModalOverlay) closeGoalModal();
});

goalTitleInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") saveNewGoal();
});

// ===================================
// 初期化
// ===================================
render();
