// app.js - HABIT TRACKER PRO (CATALÁN) - VERSIÓN FINAL

let currentUser = null;
let habits = [];
let habitLogs = [];
let habitTypes = ['higiene', 'personal', 'dieta', 'dormir', 'deporte', 'crecimiento'];
const LS_KEY = "habit-tracker-pro-data-v1";

let selectedDate = getTodayISO();
let selectedWeekStart = getWeekStart(new Date());
let selectedMonth = new Date();

// ==== UTILIDADES DE FECHA ====
function getTodayISO() {
    const d = new Date();
    return d.toISOString().split("T")[0];
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

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

// Controles de fecha
const dateControls = document.getElementById("dateControls");
const todayBtn = document.getElementById("todayBtn");
const dateSelector = document.getElementById("dateSelector");
const selectedDateDisplay = document.getElementById("selectedDateDisplay");

// Controles de semana
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");
const weekDisplay = document.getElementById("weekDisplay");

// Controles de mes
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const monthDisplay = document.getElementById("monthDisplay");

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

    const isFiveFirstTabs = ['totElDiaTab', 'matiTab', 'migDiaTab', 'tardaTab', 'nitTab'].includes(targetId);
    if (dateControls) {
        dateControls.style.display = isFiveFirstTabs ? 'flex' : 'none';
    }

    if (targetId === "historicTab") {
        renderHistoric();
    } else if (targetId === "setmanatTab") {
        updateWeekDisplay();
        renderTabByFrequency(targetId);
    } else if (targetId === "mensualTab") {
        updateMonthDisplay();
        renderTabByFrequency(targetId);
    } else {
        renderTabByFrequency(targetId);
    }
}

// ==== CONTROLES DE FECHA ====
if (todayBtn) {
    todayBtn.addEventListener("click", () => {
        selectedDate = getTodayISO();
        dateSelector.value = selectedDate;
        updateDateDisplay();
        renderAllDayTabs();
    });
}

if (dateSelector) {
    dateSelector.addEventListener("change", () => {
        selectedDate = dateSelector.value;
        updateDateDisplay();
        renderAllDayTabs();
    });
}

function updateDateDisplay() {
    if (!selectedDateDisplay) return;
    const date = new Date(selectedDate + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    selectedDateDisplay.textContent = date.toLocaleDateString('ca-ES', options);
}

// ==== CONTROLES DE SEMANA ====
if (prevWeekBtn) {
    prevWeekBtn.addEventListener("click", () => {
        selectedWeekStart.setDate(selectedWeekStart.getDate() - 7);
        updateWeekDisplay();
        renderTabByFrequency("setmanatTab");
    });
}

if (nextWeekBtn) {
    nextWeekBtn.addEventListener("click", () => {
        selectedWeekStart.setDate(selectedWeekStart.getDate() + 7);
        updateWeekDisplay();
        renderTabByFrequency("setmanatTab");
    });
}

function updateWeekDisplay() {
    if (!weekDisplay) return;
    const weekEnd = new Date(selectedWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const options = { day: 'numeric', month: 'short' };
    const startStr = selectedWeekStart.toLocaleDateString('ca-ES', options);
    const endStr = weekEnd.toLocaleDateString('ca-ES', options);
    weekDisplay.textContent = `${startStr} - ${endStr}`;
}

// ==== CONTROLES DE MES ====
if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
        selectedMonth.setMonth(selectedMonth.getMonth() - 1);
        updateMonthDisplay();
        renderTabByFrequency("mensualTab");
    });
}

if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
        selectedMonth.setMonth(selectedMonth.getMonth() + 1);
        updateMonthDisplay();
        renderTabByFrequency("mensualTab");
    });
}

function updateMonthDisplay() {
    if (!monthDisplay) return;
    const options = { month: 'long', year: 'numeric' };
    monthDisplay.textContent = selectedMonth.toLocaleDateString('ca-ES', options);
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
                initializeApp();
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
        initializeApp();
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

function initializeApp() {
    renderAllTabs();
    updateDateDisplay();
    updateWeekDisplay();
    updateMonthDisplay();
    updateTypeSelect();
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

// ==== MODAL ====
if (manageHabitsBtn) {
    manageHabitsBtn.addEventListener("click", () => {
        openHabitModal();
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
        closeHabitModal();
    });
}

if (habitModal) {
    habitModal.addEventListener("click", (e) => {
        if (e.target === habitModal) {
            closeHabitModal();
        }
    });
}

if (cancelHabitBtn) {
    cancelHabitBtn.addEventListener("click", () => {
        closeHabitModal();
    });
}

function openHabitModal(habit = null) {
    if (!habitModal) return;
    habitModal.classList.remove("hidden");
    renderHabitsList();
    renderTypesList();
    
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
    
    if (habitNameInput) habitNameInput.focus();
}

function closeHabitModal() {
    if (!habitModal) return;
    habitModal.classList.add("hidden");
    if (habitForm) habitForm.reset();
}

// ==== FORMULARIO HÁBITO ====
if (habitForm) {
    habitForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = habitIdInput.value || generateId();
        const name = habitNameInput.value.trim();
        if (!name) {
            alert("El nom del hàbit és obligatori");
            return;
        }

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
}

// ==== RENDERIZAR LISTA DE HÁBITOS EN MODAL ====
function renderHabitsList() {
    if (!habitsList) return;
    habitsList.innerHTML = "";
    if (!habits.length) {
        habitsList.innerHTML = '<li class="empty-message">No hi ha hàbits creats</li>';
        return;
    }

    habits.forEach((habit) => {
        const li = document.createElement("li");
        li.className = "habit-item";
        li.innerHTML = `
            <div class="habit-info">
                <strong>${habit.name}</strong>
                <small>${capitalizar(habit.frequency)} • ${habit.active ? 'Actiu' : 'Inactiu'}</small>
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
            if (confirm("¿Borrar aquest hàbit?")) {
                habits = habits.filter((h) => h.id !== btn.dataset.id);
                saveData();
                renderAllTabs();
                renderHabitsList();
            }
        });
    });
}

// ==== GESTIÓN DE TIPOS ====
if (addTypeBtn) {
    addTypeBtn.addEventListener("click", () => {
        const typeName = newTypeNameInput.value.trim().toLowerCase();
        if (typeName && !habitTypes.includes(typeName)) {
            habitTypes.push(typeName);
            habitTypes.sort();
            saveData();
            newTypeNameInput.value = "";
            renderTypesList();
            updateTypeSelect();
        }
    });
}

function renderTypesList() {
    if (!typesList) return;
    typesList.innerHTML = "";
    habitTypes.forEach((type) => {
        const div = document.createElement("div");
        div.className = "type-item";
        div.innerHTML = `
            <span>${capitalizar(type)}</span>
            <button class="delete-type-
btn" data-type="${type}">✕</button>
        `;
        typesList.appendChild(div);
    });

    document.querySelectorAll(".delete-type-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (confirm("¿Borrar aquest tipus?")) {
                habitTypes = habitTypes.filter((t) => t !== btn.dataset.type);
                saveData();
                renderTypesList();
                updateTypeSelect();
            }
        });
    });
}

function updateTypeSelect() {
    if (!habitTypeSelect) return;
    const currentValue = habitTypeSelect.value;
    habitTypeSelect.innerHTML = "";
    habitTypes.forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = capitalizar(type);
        habitTypeSelect.appendChild(option);
    });
    if (habitTypes.includes(currentValue)) {
        habitTypeSelect.value = currentValue;
    }
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

function renderAllDayTabs() {
    renderTabByFrequency("totElDiaTab");
    renderTabByFrequency("matiTab");
    renderTabByFrequency("migDiaTab");
    renderTabByFrequency("tardaTab");
    renderTabByFrequency("nitTab");
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
        listElement.innerHTML = '<li class="empty-message">No hi ha hàbits per a aquesta freqüència</li>';
        return;
    }

    const byType = {};
    habitsInFreq.forEach((h) => {
        const type = h.type || "personal";
        if (!byType[type]) byType[type] = [];
        byType[type].push(h);
    });

    listElement.innerHTML = "";
    Object.keys(byType).sort().forEach((type) => {
        const typeHeader = document.createElement("li");
        typeHeader.className = "type-header";
        typeHeader.textContent = capitalizar(type);
        listElement.appendChild(typeHeader);

        byType[type].forEach((habit) => {
            const li = document.createElement("li");
            li.className = "compact-habit-item";
            
            let isDone = false;
            if (['totElDiaTab', 'matiTab', 'migDiaTab', 'tardaTab', 'nitTab'].includes(tabId)) {
                isDone = isHabitDoneAt(habit.id, selectedDate, frequency);
            }

            li.innerHTML = `
                <div class="habit-name">${habit.name}</div>
                <div class="habit-controls">
                    <button class="mark-habit-btn ${isDone ? 'done' : ''}" data-id="${habit.id}" data-freq="${frequency}">✓</button>
                </div>
            `;
            listElement.appendChild(li);
        });
    });

    document.querySelectorAll(".mark-habit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const habitId = btn.dataset.id;
            const freq = btn.dataset.freq;
            markHabitAsDone(habitId, selectedDate, freq);
            renderTabByFrequency(tabId);
        });
    });
}

function markHabitAsDone(habitId, date, frequency) {
    const key = `${habitId}-${date}-${frequency}`;
    const existingLog = habitLogs.find((log) => log.key === key);
    if (existingLog) {
        existingLog.done = !existingLog.done;
    } else {
        habitLogs.push({ key, habitId, date, frequency, done: true });
    }
    saveData();
}

function isHabitDoneAt(habitId, date, frequency) {
    const key = `${habitId}-${date}-${frequency}`;
    return habitLogs.some((log) => log.key === key && log.done);
}

// ==== HISTORIC ====
function renderHistoric() {
    const historicContent = document.getElementById("historicContent");
    if (!historicContent) return;
    historicContent.innerHTML = "<p style='padding: 1rem; color: #94a3b8;'>Dades històriques - Funcionalitat en desenvolupament</p>";
}

// ==== FUNCIONES AUXILIARES ====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function capitalizar(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// ==== INICIALIZACIÓN ====
document.addEventListener("DOMContentLoaded", () => {
    if (dateSelector) dateSelector.value = getTodayISO();
    updateDateDisplay();
    updateWeekDisplay();
    updateMonthDisplay();
    
    if (!currentUser) {
        loadFromLocal();
    }
    updateTypeSelect();
});
