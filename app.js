// app.js - HABIT TRACKER PRO (CATALÁN)

// ==== ESTADO GLOBAL ====
let currentUser = null;
let habits = [];
let habitLogs = [];
let habitTypes = ['higiene', 'personal', 'dieta', 'dormir', 'deporte', 'crecimiento'];
const LS_KEY = "habit-tracker-pro-data-v1";

// ==== REFERENCIAS AL DOM ====
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailSpan = document.getElementById("userEmail");

const manageHabitsBtn = document.getElementById("manageHabitsBtn");
const habitModal = document.getElementById("habitModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const habitForm = document.getElementById("habitForm");
const habitIdInput = document.getElementById("habitId");
const habitNameInput = document.getElementById("habitName");
const habitTypeSelect = document.getElementById("habitType");
const habitFrequencySelect = document.getElementById("habitFrequency");
const habitActiveCheckbox = document.getElementById("habitActive");
const cancelHabitBtn = document.getElementById("cancelHabitBtn");
const habitsList = document.getElementById("habitsList");

const newTypeNameInput = document.getElementById("newTypeName");
const addTypeBtn = document.getElementById("addTypeBtn");
const typesList = document.getElementById("typesList");

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
    const activeBtn = Array.from(tabButtons).find((b) => b.dataset.tab === targetId);
    const activeContent = document.getElementById(targetId);
    if (activeBtn) activeBtn.classList.add("active");
    if (activeContent) activeContent.classList.add("active");
    
    // Renderizar contenido según pestaña
    if (targetId === "historicTab") {
        renderHistoric();
    } else {
        renderTabByFrequency(targetId);
    }
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
                    habitTypes = data.habitTypes || habitTypes;
                    saveToLocal();
                } else {
                    habits = [];
                    habitLogs = [];
                    saveToLocal();
                }
                renderAllTabs();
            })
            .catch((err) => {
                console.error("Error cargando de Firestore:", err);
                loadFromLocal();
            });
    }

    function saveToCloud() {
        if (!currentUser) return;
        const payload = { habits, habitLogs, habitTypes };
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
        habitTypes = data.habitTypes || habitTypes;
    } catch (e) {
        console.error("Error leyendo localStorage:", e);
        habits = [];
        habitLogs = [];
    } finally {
        renderAllTabs();
    }
}

function saveToLocal() {
    const data = { habits, habitLogs, habitTypes };
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

// ==== GESTIÓN DE HÁBITOS ====
manageHabitsBtn.addEventListener("click", () => {
    openHabitModal();
});

closeModalBtn.addEventListener("click", () => {
    closeHabitModal();
});

cancelHabitBtn.addEventListener("click", () => {
    closeHabitModal();
});

habitForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = habitIdInput.value || generateId();
    const name = habitNameInput.value.trim();
    if (!name) return;

    const habitData = {
        id,
        name,
        type: habitTypeSelect.value,
        frequency: habitFrequencySelect.value,
        active: habitActiveCheckbox.checked,
    };

    const existingIndex = habits.findIndex((h) => h.id === id);
    if (existingIndex >= 0) {
        habits[existingIndex] = habitData;
    } else {
        habits.push(habitData);
    }

    saveData();
    renderAllTabs();
    closeHabitModal();
});

function openHabitModal(habit = null) {
    habitModal.classList.remove("hidden");
    if (habit) {
        habitIdInput.value = habit.id;
        habitNameInput.value = habit.name;
        habitTypeSelect.value = habit.type || "personal";
        habitFrequencySelect.value = habit.frequency || "allday";
        habitActiveCheckbox.checked = habit.active;
    } else {
        habitIdInput.value = "";
        habitNameInput.value = "";
        habitTypeSelect.value = "personal";
        habitFrequencySelect.value = "allday";
        habitActiveCheckbox.checked = true;
    }
    renderHabitsList();
    renderTypesList();
}

function closeHabitModal() {
    habitModal.classList.add("hidden");
    habitForm.reset();
}

function renderHabitsList() {
    habitsList.innerHTML = "";
    if (!habits.length) {
        habitsList.innerHTML = '<li class="empty-message">No hi ha hàbits</li>';
        return;
    }

    habits.forEach((habit) => {
        const li = document.createElement("li");
        li.className = "habit-item";
        li.innerHTML = `
            <div class="habit-info">
                <strong>${habit.name}</strong>
                <small>${habit.frequency} • ${habit.active ? 'Actiu' : 'Inactiu'}</small>
            </div>
            <div class="habit-actions">
                <button class="edit-habit-btn" data-id="${habit.id}">Editar</button>
                <button class="delete-habit-btn" data-id="${habit.id}">Borrar</button>
            </div>
        `;
        habitsList.appendChild(li);
    });

    document.querySelectorAll(".edit-habit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const habit = habits.find((h) => h.id === btn.dataset.id);
            if (habit) openHabitModal(habit);
        });
    });

    document.querySelectorAll(".delete-habit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (confirm("¿Borrar este hàbit?")) {
                habits = habits.filter((h) => h.id !== btn.dataset.id);
                saveData();
                renderAllTabs();
                renderHabitsList();
            }
        });
    });
}

// ==== GESTIÓN DE TIPOS ====
addTypeBtn.addEventListener("click", () => {
    const typeName = newTypeNameInput.value.trim().toLowerCase();
    if (typeName && !habitTypes.includes(typeName)) {
        habitTypes.push(typeName);
        saveData();
        newTypeNameInput.value = "";
        renderTypesList();
        updateTypeSelect();
    }
});

function renderTypesList() {
    typesList.innerHTML = "";
    habitTypes.forEach((type) => {
        const div = document.createElement("div");
        div.className = "type-item";
        div.innerHTML = `
            <span>${type}</span>
            <button class="delete-type-btn" data-type="${type}">X</button>
        `;
        typesList.appendChild(div);
    });

    document.querySelectorAll(".delete-type-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            habitTypes = habitTypes.filter((t) => t !== btn.dataset.type);
            saveData();
            renderTypesList();
            updateTypeSelect();
        });
    });
}

function updateTypeSelect() {
    const currentValue = habitTypeSelect.value;
    habitTypeSelect.innerHTML = "";
    habitTypes.forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = capitalizar(type);
        habitTypeSelect.appendChild(option);
    });
    habitTypeSelect.value = currentValue;
}

// ==== RENDERIZACIÓN POR PESTAÑAS ====
function renderAllTabs() {
    renderTabByFrequency("totElDiaTab");
    renderTabByFrequency("matiTab");
    renderTabByFrequency("migDiaTab");
    renderTabByFrequency("tardaTab");
    renderTabByFrequency("nitTab");
    renderTabByFrequency("setmanatTab");
    renderTabByFrequency("mensualTab");
}

function renderTabByFrequency(tabId) {
    const frequencyMap = {
        totElDiaTab: "allday",
        matiTab: "morning",
        migDiaTab: "noon",
        tardaTab: "evening",
        nitTab: "night",
        setmanatTab: "weekly",
        mensualTab: "monthly"
    };

    const frequency = frequencyMap[tabId];
    const listId = tabId.replace("Tab", "HabitsList");
    const listElement = document.getElementById(listId);

    if (!listElement) return;

    const habitsInFreq = habits.filter((h) => h.active && h.frequency === frequency);
    
    if (!habitsInFreq.length) {
        listElement.innerHTML = '<li class="empty-message">No hi ha hàbits</li>';
        return;
    }

    // Agrupar por tipo alfabéticamente
    const byType = {};
    habitsInFreq.forEach((h) => {
        const type = h.type || "personal";
        if (!byType[type]) byType[type] = [];
        byType[type].push(h);
    });

    listElement.innerHTML = "";
    Object.keys(byType).sort().forEach((type) => {
        // Mostrar tipo como encabezado
        const typeHeader = document.createElement("li");
        typeHeader.className = "type-header";
        typeHeader.textContent = capitalizar(type);
        listElement.appendChild(typeHeader);

        // Mostrar hábitos sin repetir tipo
        byType[type].forEach((habit) => {
            const li = document.createElement("li");
            li.className = "compact-habit-item";
            li.innerHTML = `
                <div class="habit-name">${habit.name}</div>
                <div class="habit-controls">
                    <button class="mark-habit-btn" data-id="${habit.id}">✓</button>
                </div>
            `;
            listElement.appendChild(li);
        });
    });

    document.querySelectorAll(".mark-habit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const habitId = btn.dataset.id;
            markHabitAsDone(habitId);
            renderTabByFrequency(tabId);
        });
    });
}

function markHabitAsDone(habitId) {
    const today = new Date().toISOString().split("T")[0];
    const key = `${habitId}-${today}`;
    const existingLog = habitLogs.find((log) => log.key === key);
    if (existingLog) {
        existingLog.done = !existingLog.done;
    } else {
        habitLogs.push({ key, habitId, date: today, done: true });
    }
    saveData();
}

// ==== HISTORIC ====
function renderHistoric() {
    const historicContent = document.getElementById("historicContent");
    historicContent.innerHTML = "";

    // Agrupar logs por mes
    const logsByMonth = {};
    habitLogs.forEach((log) => {
        const [year, month] = log.date.split("-");
        const monthKey = `${year}-${month}`;
        if (!logsByMonth[monthKey]) logsByMonth[monthKey] = [];
        logsByMonth[monthKey].push(log);
    });

    Object.keys(logsByMonth).sort().reverse().forEach((monthKey) => {
        const monthDiv = document.createElement("div");
        monthDiv.className = "historic-month";

        const monthTitle = document.createElement("h3");
        monthTitle.textContent = formatMonth(monthKey);
        monthDiv.appendChild(monthTitle);

        // Calcular % del mes
        const monthLogs = logsByMonth[monthKey];
        const monthPercent = calculateMonthPercent(monthKey);
        const monthColor = getColorForPercent(monthPercent);

        const monthSummary = document.createElement("div");
        monthSummary.className = `month-summary ${monthColor}`;
        monthSummary.innerHTML = `<strong>Mensual: ${monthPercent}%</strong>`;
        monthDiv.appendChild(monthSummary);

        // Mostrar días del mes
        const daysDiv = document.createElement("div");
        daysDiv.className = "days-grid";
        const [year, month] = monthKey.split("-
