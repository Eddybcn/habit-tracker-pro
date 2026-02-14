// app.js

// ==== ESTADO GLOBAL ====
let currentUser = null;
let habits = [];
let habitLogs = [];

const LS_KEY = "habit-tracker-pro-data-v1";

// ==== REFERENCIAS AL DOM ====
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailSpan = document.getElementById("userEmail");

const addHabitBtn = document.getElementById("addHabitBtn");
const habitForm = document.getElementById("habitForm");
const habitIdInput = document.getElementById("habitId");
const habitNameInput = document.getElementById("habitName");
const habitTypeSelect = document.getElementById("habitType");
const habitFrequencySelect = document.getElementById("habitFrequency");
const habitMonthlyDayInput = document.getElementById("habitMonthlyDay");
const monthlyDayLabel = document.getElementById("monthlyDayLabel");

// checkboxes de bloques del día para cada hábito
const habitTimeBlockCheckboxes = document.querySelectorAll(".habitTimeBlock");
const habitAllDayCheckbox = document.getElementById("habitAllDay");

const habitActiveCheckbox = document.getElementById("habitActive");
const cancelHabitBtn = document.getElementById("cancelHabitBtn");
const habitsList = document.getElementById("habitsList");

// mostrar/ocultar el campo "Día del mes" según la frecuencia seleccionada
habitFrequencySelect.addEventListener("change", () => {
  if (habitFrequencySelect.value === "monthly") {
    monthlyDayLabel.classList.remove("hidden");
  } else {
    monthlyDayLabel.classList.add("hidden");
  }
});
// Lógica de "Todo el día": si está marcado, marca los otros 4 y los deshabilita
if (habitAllDayCheckbox) {
  habitAllDayCheckbox.addEventListener("change", () => {
    const otherCheckboxes = Array.from(habitTimeBlockCheckboxes).filter(
      (cb) => cb.value !== "allday"
    );
    
    if (habitAllDayCheckbox.checked) {
      // Marcar y deshabilitar todos los demás
      otherCheckboxes.forEach((cb) => {
        cb.checked = true;
        cb.disabled = true;
      });
    } else {
      // Desmarcar y habilitar todos los demás
      otherCheckboxes.forEach((cb) => {
        cb.checked = false;
        cb.disabled = false;
      });
    }
  });

  // Si alguno de los otros se desmarca, desmarca "Todo el día"
  habitTimeBlockCheckboxes.forEach((cb) => {
    if (cb.value !== "allday") {
      cb.addEventListener("change", () => {
        const anyUnchecked = Array.from(habitTimeBlockCheckboxes).some(
          (checkbox) => checkbox.value !== "allday" && !checkbox.checked
        );
        if (anyUnchecked) {
          habitAllDayCheckbox.checked = false;
        }
      });
    }
  });
}


// ==== NAVEGACIÓN ENTRE TABS ====
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.tab;
    switchTab(targetId);
  });
});

function switchTab(targetId) {
  tabButtons.forEach((b) => b.classList.remove("active"));
  tabContents.forEach((c) => c.classList.remove("active"));

  const activeBtn = Array.from(tabButtons).find(
    (b) => b.dataset.tab === targetId
  );
  const activeContent = document.getElementById(targetId);

  if (activeBtn) activeBtn.classList.add("active");
  if (activeContent) activeContent.classList.add("active");
}

// ==== LOGIN / LOGOUT ====
if (typeof firebase !== "undefined") {
  const auth = firebase.auth();
  const db = firebase.firestore();

loginBtn.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => {
    console.error("Error login:", err.code, err.message);
  });
});



  logoutBtn.addEventListener("click", () => {
    auth.signOut().catch((err) => {
      console.error("Error logout:", err);
    });
  });

  auth.onAuthStateChanged((user) => {
    currentUser = user || null;
    updateUserUI();
    if (currentUser) {
      loadFromCloud();
    } else {
      loadFromLocal();
    }
  });

  // ==== SINCRONIZACIÓN CON FIRESTORE ====
  function loadFromCloud() {
    db.collection("habitTrackerPro")
      .doc(currentUser.uid)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data();
          habits = data.habits || [];
          habitLogs = data.habitLogs || [];
          saveToLocal();
        } else {
          habits = [];
          habitLogs = [];
          saveToLocal();
        }
        renderHabits();
      })
      .catch((err) => {
        console.error("Error cargando de Firestore:", err);
        loadFromLocal();
      });
  }

  function saveToCloud() {
    if (!currentUser) return;
    const payload = { habits, habitLogs };
    db.collection("habitTrackerPro")
      .doc(currentUser.uid)
      .set(payload)
      .catch((err) => console.error("Error guardando en Firestore:", err));
  }
}

// ==== LOCALSTORAGE ====
function loadFromLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      habits = [];
      habitLogs = [];
      return;
    }
    const data = JSON.parse(raw);
    habits = data.habits || [];
    habitLogs = data.habitLogs || [];
  } catch (e) {
    console.error("Error leyendo localStorage:", e);
    habits = [];
    habitLogs = [];
  } finally {
    renderHabits();
  }
}

function saveToLocal() {
  const data = { habits, habitLogs };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function saveData() {
  saveToLocal();
  if (typeof saveToCloud === "function") {
    saveToCloud();
  }
}

// ==== UI DE USUARIO ====
function updateUserUI() {
  if (currentUser) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userEmailSpan.textContent = currentUser.email || "";
  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userEmailSpan.textContent = "";
  }
}

// ==== GESTIÓN DE HÁBITOS (CRUD) ====

// abrir formulario para nuevo hábito
addHabitBtn.addEventListener("click", () => {
  openHabitForm();
});

cancelHabitBtn.addEventListener("click", () => {
  closeHabitForm();
});

habitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = habitIdInput.value || generateId();
  const name = habitNameInput.value.trim();
  if (!name) return;

  // bloques del día seleccionados para este hábito
  const selectedBlocks = Array.from(habitTimeBlockCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  // freq = frecuencia seleccionada (diaria, semanal, mensual)
  const freq = habitFrequencySelect.value;

  // monthlyDay = día del mes si la frecuencia es mensual
  const monthlyDay =
    freq === "monthly"
      ? Math.min(
          31,
          Math.max(1, parseInt(habitMonthlyDayInput.value || "1", 10))
        )
      : null;

  const habitData = {
  id,
  name,
  type: habitTypeSelect.value,
  frequency: freq,
  timeBlocks: selectedBlocks.length ? selectedBlocks : ["morning"],
  monthlyDay,
  active: habitActiveCheckbox.checked,
};

  const existingIndex = habits.findIndex((h) => h.id === id);
  if (existingIndex >= 0) {
    habits[existingIndex] = habitData;
  } else {
    habits.push(habitData);
  }

  saveData();
  renderHabits();
  closeHabitForm();
});


function openHabitForm(habit = null) {
habitForm.classList.add("visible");
  habitNameInput.focus();

  if (habit) {
    habitIdInput.value = habit.id;
    habitNameInput.value = habit.name;
    habitFrequencySelect.value = habit.frequency;
    habitTypeSelect.value = habit.type || "personal";

      // marcar los bloques guardados para este hábito
    const blocks = habit.timeBlocks || ["morning"];
    const hasAllDay = blocks.includes("allday");
    
    habitTimeBlockCheckboxes.forEach((cb) => {
      cb.checked = blocks.includes(cb.value);
      // Si "Todo el día" está en los bloques, deshabilita los otros
      if (hasAllDay && cb.value !== "allday") {
        cb.disabled = true;
      } else {
        cb.disabled = false;
      }
    });

    // Marcar "Todo el día" si está en los bloques
    if (habitAllDayCheckbox) {
      habitAllDayCheckbox.checked = hasAllDay;
    }


    // si es mensual, mostramos el día; si no, lo ocultamos
    if (habit.frequency === "monthly") {
      monthlyDayLabel.classList.remove("hidden");
      habitMonthlyDayInput.value = habit.monthlyDay || 1;
    } else {
      monthlyDayLabel.classList.add("hidden");
      habitMonthlyDayInput.value = "";
    }

    habitActiveCheckbox.checked = habit.active;
  } else {
    habitIdInput.value = "";
    habitNameInput.value = "";
    habitFrequencySelect.value = "daily";

        // por defecto, solo "mañana" marcado para un hábito nuevo
    habitTimeBlockCheckboxes.forEach((cb) => {
      cb.checked = cb.value === "morning";
      cb.disabled = false; // Habilitar todos
    });

    // Desmarcar "Todo el día" para nuevos hábitos
    if (habitAllDayCheckbox) {
      habitAllDayCheckbox.checked = false;
    }


    // en hábitos nuevos, ocultamos el día del mes
    monthlyDayLabel.classList.add("hidden");
    habitMonthlyDayInput.value = "";

    habitActiveCheckbox.checked = true;
  }
}


function closeHabitForm() {
habitForm.classList.remove("visible");
}

// renderizar lista de hábitos
function renderHabits() {
  habitsList.innerHTML = "";

  if (!habits.length) {
    const li = document.createElement("li");
    li.className = "list-item";
    li.innerHTML =
      '<div class="list-item-main"><span class="list-item-title">Sin hábitos todavía</span><span class="list-item-sub">Pulsa "Añadir hábito" para crear el primero.</span></div>';
    habitsList.appendChild(li);
    return;
  }

  habits.forEach((habit) => {
    const li = document.createElement("li");
    li.className = "list-item";

    const mainDiv = document.createElement("div");
    mainDiv.className = "list-item-main";

    const title = document.createElement("span");
    title.className = "list-item-title";
    title.textContent = habit.name;

    const sub = document.createElement("span");
    sub.className = "list-item-sub";

        // texto de los bloques seleccionados (Mañana, Noche, etc.)
    const blocksText = (habit.timeBlocks || ["morning"])
      .map((b) => formatPreferredTime(b))
      .join(", ");

    // texto "Día X" solo si la frecuencia es mensual
    const monthlyText =
      habit.frequency === "monthly" && habit.monthlyDay
        ? ` · Día ${habit.monthlyDay}`
        : "";

    sub.textContent = `${formatFrequency(habit.frequency)}${monthlyText} · ${blocksText}${
      habit.active ? "" : " · Inactivo"
    }`;

    mainDiv.appendChild(title);
    mainDiv.appendChild(sub);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "list-item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-ghost";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => openHabitForm(habit));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-ghost btn-danger";
    deleteBtn.textContent = "Borrar";
    deleteBtn.addEventListener("click", () => {
      if (!confirm("¿Borrar este hábito?")) return;
      habits = habits.filter((h) => h.id !== habit.id);
      saveData();
      renderHabits();
    });

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(mainDiv);
    li.appendChild(actionsDiv);

    habitsList.appendChild(li);
  });
}

// ==== UTILIDADES ====

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatFrequency(freq) {
  if (freq === "daily") return "Diaria";
  if (freq === "weekly") return "Semanal";
  if (freq === "monthly") return "Mensual";
  return freq;
}

function formatPreferredTime(p) {
  if (p === "morning") return "Mañana";
  if (p === "noon") return "Medio día";
  if (p === "evening") return "Tarde";
  if (p === "night") return "Noche";
  return p;
}
// ==== HOY: BLOQUES HORARIOS Y PORCENTAJES ====

const todayDateInput = document.getElementById("todayDate");
const todayHabitsList = document.getElementById("todayHabitsList");
const todaySummary = document.getElementById("todaySummary");

// fecha por defecto = hoy
function getTodayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

todayDateInput.value = getTodayISO();
todayDateInput.addEventListener("change", () => {
  renderToday();
});

// estructura de bloques horarios
const TIME_BLOCKS = [
  { id: "allday", label: "Todo el día" },
  { id: "morning", label: "Mañana" },
  { id: "noon", label: "Medio día" },
  { id: "evening", label: "Tarde" },
  { id: "night", label: "Noche" },
];

// pintar la pantalla "Hoy"
// pintar la pantalla "Hoy" CON 2 VISTAS (Mac = 4 columnas, iPhone = 4 tabs)
function renderToday() {
  const date = todayDateInput.value || getTodayISO();
  
  // Obtener hábitos del día (filtro por frecuencia/tipo)
  const todaysHabits = habits.filter((h) => {
    if (!h.active) return false;
    if (h.frequency === "monthly" && h.monthlyDay) {
      const day = parseInt(date.slice(8, 10), 10);
      return day === h.monthlyDay;
    }
    return true;
  });

  // Renderizar resumen de estadísticas
  renderTodaySummary(date);

  // Renderizar vista MAC (4 columnas)
  renderTodayMacView(todaysHabits, date);

  // Renderizar vista iPhone (tabs)
  renderTodayIPhoneView(todaysHabits, date);
}

// Vista MAC: 4 columnas por bloque horario, agrupadas por tipo
function renderTodayMacView(habits, date) {
  const blocks = [
    { id: "allday", label: "Todo el día" },
    { id: "morning", label: "Mañana" },
    { id: "noon", label: "Medio día" },
    { id: "evening", label: "Tarde" },
    { id: "night", label: "Noche" }
  ];

  blocks.forEach((block) => {
    const listId = `habitsList${block.id.charAt(0).toUpperCase() + block.id.slice(1)}`;
    const listElement = document.getElementById(listId);
    if (!listElement) return;

    listElement.innerHTML = "";

    // Filtrar hábitos por este bloque horario
    const habitsInBlock = habits.filter((h) =>
      (h.timeBlocks || ["morning"]).includes(block.id)
    );

    if (!habitsInBlock.length) {
      listElement.innerHTML = '<li class="list-item"><span class="list-item-sub">Sin hábitos</span></li>';
      return;
    }

    // Agrupar por tipo
    const byType = {};
    habitsInBlock.forEach((h) => {
      const type = h.type || "personal";
      if (!byType[type]) byType[type] = [];
      byType[type].push(h);
    });

    // Renderizar cada grupo de tipo
    Object.keys(byType).forEach((type) => {
      const groupTitle = document.createElement("div");
      groupTitle.className = "habit-section-title";
      groupTitle.textContent = formatHabitType(type);
      listElement.appendChild(groupTitle);

      byType[type].forEach((habit) => {
        const li = createTodayHabitItem(habit, date, block.id);
        listElement.appendChild(li);
      });
    });
  });
}

// Vista iPhone: tabs para seleccionar bloque, lista de hábitos
function renderTodayIPhoneView(habits, date) {
  const todayHabitsListEl = document.getElementById("todayHabitsList");
  if (!todayHabitsListEl) return;

  // Obtener bloque seleccionado (por defecto "morning")
  const activeTab = document.querySelector(".time-tab-btn.active");
  const selectedBlock = activeTab ? activeTab.dataset.block : "morning";

  todayHabitsListEl.innerHTML = "";

  // Filtrar hábitos por bloque seleccionado
  const habitsInBlock = habits.filter((h) =>
    (h.timeBlocks || ["morning"]).includes(selectedBlock)
  );

  if (!habitsInBlock.length) {
    todayHabitsListEl.innerHTML = '<li class="list-item"><span class="list-item-sub">Sin hábitos en este bloque</span></li>';
    return;
  }

  // Agrupar por tipo
  const byType = {};
  habitsInBlock.forEach((h) => {
    const type = h.type || "personal";
    if (!byType[type]) byType[type] = [];
    byType[type].push(h);
  });

  // Renderizar cada grupo
  Object.keys(byType).forEach((type) => {
    const groupTitle = document.createElement("div");
    groupTitle.className = "habit-section-title";
    groupTitle.textContent = formatHabitType(type);
    todayHabitsListEl.appendChild(groupTitle);

    byType[type].forEach((habit) => {
      const li = createTodayHabitItem(habit, date, selectedBlock);
      todayHabitsListEl.appendChild(li);
    });
  });
}

// Función auxiliar: crear un item de hábito para "Hoy"
function createTodayHabitItem(habit, date, blockId) {
  const li = document.createElement("li");
  li.className = "list-item";

  const mainDiv = document.createElement("div");
  mainDiv.className = "list-item-main";

  const title = document.createElement("span");
  title.className = "list-item-title";
  title.textContent = habit.name;

  const sub = document.createElement("span");
  sub.className = "list-item-sub";
  sub.textContent = formatHabitType(habit.type || "personal");

  mainDiv.appendChild(title);
  mainDiv.appendChild(sub);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "list-item-actions";

  const btn = document.createElement("button");
  btn.className = "time-btn";
  btn.textContent = formatPreferredTime(blockId);

  const done = isHabitDoneAt(habit.id, date, blockId);
  if (done) btn.classList.add("done");

  btn.addEventListener("click", () => {
    toggleHabitDone(habit.id, date, blockId);
    renderToday();
  });

  actionsDiv.appendChild(btn);
  li.appendChild(mainDiv);
  li.appendChild(actionsDiv);

  return li;
}

// Formatear nombre del tipo
function formatHabitType(type) {
  const types = {
    higiene: "Higiene",
    personal: "Personal",
    dieta: "Dieta",
    dormir: "Dormir",
    deporte: "Deporte",
    crecimiento: "Crecimiento Personal"
  };
  return types[type] || type;
}

function renderTodaySummary(date) {
  const { percentDay, byBlock } = getStatsForDate(date);

  let html = "";
  html += `<div class="stats-row">
    <strong>Hoy (${formatDateHuman(date)}): ${percentDay}% completado</strong>
    <div class="stats-bar"><div class="stats-bar-fill" style="width:${percentDay}%;"></div></div>
  </div>`;

  html += `<div class="stats-row" style="margin-top:6px;">`;
  byBlock.forEach((b) => {
    html += `<div>${b.label}: ${b.percent}%</div>`;
  });
  html += `</div>`;

  todaySummary.innerHTML = html;
}

// cálculo de % para un día concreto
function getStatsForDate(date) {
  const activeHabits = habits.filter((h) => h.active);
  const totalSlots = activeHabits.length * TIME_BLOCKS.length;
  if (!totalSlots) {
    return { percentDay: 0, byBlock: TIME_BLOCKS.map((b) => ({ ...b, percent: 0 })) };
  }

  let doneCount = 0;
  const blockStats = TIME_BLOCKS.map((b) => ({ id: b.id, label: b.label, done: 0, total: 0 }));

  activeHabits.forEach((habit) => {
    TIME_BLOCKS.forEach((block) => {
      blockStats.find((b) => b.id === block.id).total += 1;
      if (isHabitDoneAt(habit.id, date, block.id)) {
        doneCount += 1;
        blockStats.find((b) => b.id === block.id).done += 1;
      }
    });
  });

  const percentDay = Math.round((doneCount / totalSlots) * 100);

  const byBlock = blockStats.map((b) => ({
    id: b.id,
    label: b.label,
    percent: b.total ? Math.round((b.done / b.total) * 100) : 0,
  }));

  return { percentDay, byBlock };
}

function formatDateHuman(dateISO) {
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

// ==== REGISTRO DE HÁBITOS COMPLETADOS ====

// Obtener clave única para un hábito en un día/bloque
function getHabitLogKey(habitId, date, blockId) {
  return `${habitId}-${date}-${blockId}`;
}

// Verificar si un hábito fue completado en un día/bloque específico
function isHabitDoneAt(habitId, date, blockId) {
  const key = getHabitLogKey(habitId, date, blockId);
  return habitLogs.some((log) => log.key === key && log.done);
}

// Marcar/desmarcar un hábito como completado
function toggleHabitDone(habitId, date, blockId) {
  const key = getHabitLogKey(habitId, date, blockId);
  const existingLog = habitLogs.find((log) => log.key === key);

  if (existingLog) {
    existingLog.done = !existingLog.done;
  } else {
    habitLogs.push({ key, habitId, date, blockId, done: true });
  }

  saveData();
}


// ==== INICIO ====
document.addEventListener("DOMContentLoaded", () => {
  if (!currentUser) {
    loadFromLocal();
  }
  renderToday();
});

// Manejador de tabs de bloques horarios (iPhone)
document.addEventListener("DOMContentLoaded", () => {
  const timeTabBtns = document.querySelectorAll(".time-tab-btn");
  timeTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      timeTabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderToday();
    });
  });
});

