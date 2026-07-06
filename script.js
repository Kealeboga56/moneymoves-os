// MoneyMovesOS - Core Application Logic V3 (Supabase Cloud Edition)
const SUPABASE_URL = 'https://opuefoqzglhynnfxzaey.supabase.co'; // REPLACE THIS
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdWVmb3F6Z2xoeW5uZnh6YWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc0NTUsImV4cCI6MjA5ODkzMzQ1NX0.UcqVbB5ZGMEI0JVtNYXeVADCe4r_t9_dIdupy9IjtbA'; // REPLACE THIS

// Initialize Supabase Client
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
    tasks: [],
    currentView: 'dashboard',
    filters: { search: '', status: '', priority: '' },
    selectedTaskId: null,
    taskToDelete: null,
    currentCalendarDate: new Date()
};

// --- Initialization ---
async function initApp() {
    try {
        // 1. Fetch all tasks from Supabase
        const { data, error } = await db.from('tasks').select('data');
        if (error) throw error;
        
        // Extract the JSON objects from the 'data' column
        state.tasks = data.map(row => row.data);
        
        attachEventListeners();
        setupRealtimeSync(); // Listen for live changes
        renderApp();
    } catch (error) {
        console.error('Initialization Error:', error);
        document.getElementById('content-area').innerHTML = `<div style="color: var(--danger-red); padding: 20px;">Failed to connect to the database. Check your Supabase keys and internet connection.</div>`;
    }
}

// --- Real-Time Sync ---
function setupRealtimeSync() {
    db.channel('public:tasks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, payload => {
          state.tasks.push(payload.new.data);
          renderApp();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, payload => {
          const index = state.tasks.findIndex(t => t.id === payload.new.id);
          if (index !== -1) state.tasks[index] = payload.new.data;
          renderApp();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, payload => {
          state.tasks = state.tasks.filter(t => t.id !== payload.old.id);
          renderApp();
      })
      .subscribe();
}

// --- Event Listeners ---
function attachEventListeners() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.currentView = e.currentTarget.dataset.view;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderApp();
            closeMobileSidebar(); // Close menu on navigation
        });
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const html = document.documentElement;
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('mm-theme', newTheme);
    });

    document.getElementById('global-search').addEventListener('input', (e) => {
        state.filters.search = e.target.value.toLowerCase();
        if (state.currentView !== 'dashboard' && state.currentView !== 'stats') renderApp();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => { state.filters.status = e.target.value; renderApp(); });
    document.getElementById('filter-priority').addEventListener('change', (e) => { state.filters.priority = e.target.value; renderApp(); });

    document.getElementById('new-task-btn').addEventListener('click', () => openTaskModal(null));
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('task-modal-overlay').addEventListener('click', closeTaskModal);

    // Mobile Sidebar Logic
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('active');
    });
    document.getElementById('sidebar-overlay').addEventListener('click', closeMobileSidebar);

    document.getElementById('modal-cancel').addEventListener('click', () => closeCustomModal());
    document.getElementById('modal-confirm').addEventListener('click', async () => {
        if (state.taskToDelete) {
            await db.from('tasks').delete().eq('id', state.taskToDelete);
            state.taskToDelete = null;
            closeCustomModal();
            closeTaskModal();
        }
    });
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

// --- Filtering Logic ---
function getFilteredTasks() {
    return state.tasks.filter(task => {
        const searchMatch = !state.filters.search || 
                            task.title.toLowerCase().includes(state.filters.search) || 
                            task.description.toLowerCase().includes(state.filters.search) ||
                            (task.project && task.project.toLowerCase().includes(state.filters.search));
        const statusMatch = !state.filters.status || task.status === state.filters.status;
        const priorityMatch = !state.filters.priority || task.priority === state.filters.priority;
        return searchMatch && statusMatch && priorityMatch;
    });
}

// --- Rendering Router ---
function renderApp() {
    const contentArea = document.getElementById('content-area');
    const tasks = getFilteredTasks();

    switch(state.currentView) {
        case 'dashboard': renderDashboard(tasks); break;
        case 'kanban': renderKanban(tasks); break;
        case 'table': renderTable(tasks); break;
        case 'list': renderList(tasks); break;
        case 'calendar': renderCalendar(tasks); break;
        case 'timeline': renderTimeline(tasks); break;
        case 'stats': renderStats(tasks); break;
    }
}

// --- Views ---
function renderDashboard(tasks) {
    const total = tasks.length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const blocked = tasks.filter(t => t.status === 'Blocked').length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const critical = tasks.filter(t => t.priority === 'Critical').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const allActivity = tasks.flatMap(t => t.activity.map(a => ({...a, taskTitle: t.title, taskId: t.id})))
                             .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
                             .slice(0, 8);

    document.getElementById('content-area').innerHTML = `
        <div class="dash-grid">
            <div class="dash-card"><div class="dash-label">Total Tasks</div><div class="dash-value">${total}</div></div>
            <div class="dash-card"><div class="dash-label">In Progress</div><div class="dash-value" style="color:var(--accent-blue)">${inProgress}</div></div>
            <div class="dash-card"><div class="dash-label">Blocked</div><div class="dash-value" style="color:var(--danger-red)">${blocked}</div></div>
            <div class="dash-card"><div class="dash-label">Critical</div><div class="dash-value" style="color:var(--danger-red)">${critical}</div></div>
            <div class="dash-card">
                <div class="dash-label">Completion</div>
                <div class="dash-value">${completionRate}%</div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${completionRate}%"></div></div>
            </div>
        </div>
        <div>
            <div class="section-title">Recent Activity</div>
            <div class="activity-list">
                ${allActivity.map(a => `
                    <div class="activity-item" onclick="openTaskModal('${a.taskId}')">
                        <b>${a.userId}</b> ${a.action} <br>
                        <span style="font-size:0.8rem; color:var(--text-secondary)">${a.taskTitle} - ${new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                `).join('') || '<div class="activity-item">No recent activity.</div>'}
            </div>
        </div>
    `;
}

function renderKanban(tasks) {
    const statuses = ["Idea", "Backlog", "Planning", "Ready", "In Progress", "Blocked", "Waiting", "Review", "Testing", "Completed", "Cancelled", "Archived"];
    document.getElementById('content-area').innerHTML = `
        <div class="kanban-board">
            ${statuses.map(status => {
                const colTasks = tasks.filter(t => t.status === status);
                return `
                    <div class="kanban-col">
                        <div class="kanban-col-header">
                            <span>${status}</span>
                            <span class="kanban-col-count">${colTasks.length}</span>
                        </div>
                        <div class="kanban-cards">
                            ${colTasks.map(t => `
                                <div class="kanban-card priority-${t.priority}" onclick="openTaskModal('${t.id}')">
                                    <div class="card-title">${t.title}</div>
                                    <div class="card-meta">
                                        <span>${t.project || 'General'}</span>
                                        <span>${t.owner}</span>
                                    </div>
                                    <div class="progress-bar" style="margin-top:10px"><div class="progress-fill" style="width: ${t.progress}%"></div></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderTable(tasks) {
    document.getElementById('content-area').innerHTML = `
        <div style="overflow-x: auto;">
        <table class="task-table">
            <thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Owner</th><th>Project</th><th>Due Date</th><th>Progress</th></tr></thead>
            <tbody>
                ${tasks.map(t => `
                    <tr onclick="openTaskModal('${t.id}')">
                        <td>${t.title}</td>
                        <td><span class="tag">${t.status}</span></td>
                        <td>${t.priority}</td>
                        <td>${t.owner}</td>
                        <td>${t.project || 'N/A'}</td>
                        <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}</td>
                        <td><div style="display:flex; align-items:center; gap:10px;"><div class="progress-bar" style="flex:1"><div class="progress-fill" style="width: ${t.progress}%"></div></div><span>${t.progress}%</span></div></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;
}

function renderList(tasks) {
    document.getElementById('content-area').innerHTML = `
        <div class="list-view">
            ${tasks.map(t => `
                <div class="kanban-card priority-${t.priority}" style="margin-bottom:12px" onclick="openTaskModal('${t.id}')">
                    <div class="card-title">${t.title}</div>
                    <div class="card-meta"><span>${t.status} • ${t.project || 'General'}</span><span>${t.owner}</span></div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderCalendar(tasks) {
    const date = state.currentCalendarDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleString('default', { month: 'long' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let daysHtml = '';
    for (let i = 0; i < firstDay; i++) daysHtml += `<div class="calendar-day empty"></div>`;
    
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayTasks = tasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === dayStr);
        
        daysHtml += `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-date-num">${i}</div>
                ${dayTasks.map(t => `<div class="calendar-event priority-${t.priority}" onclick="openTaskModal('${t.id}')">${t.title}</div>`).join('')}
            </div>
        `;
    }

    document.getElementById('content-area').innerHTML = `
        <div class="calendar-header">
            <div class="calendar-month-title">${monthName} ${year}</div>
            <div style="display: flex; gap: 8px;">
                <button class="calendar-nav-btn" onclick="changeCalendarMonth(-1)">←</button>
                <button class="calendar-nav-btn" onclick="changeCalendarMonth(0)">Today</button>
                <button class="calendar-nav-btn" onclick="changeCalendarMonth(1)">→</button>
            </div>
        </div>
        <div style="overflow-x: auto;">
        <div class="calendar-grid" style="min-width: 700px;">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
            ${daysHtml}
        </div>
        </div>
    `;
}

function changeCalendarMonth(direction) {
    if (direction === 0) state.currentCalendarDate = new Date();
    else {
        const date = new Date(state.currentCalendarDate);
        date.setMonth(date.getMonth() + direction);
        state.currentCalendarDate = date;
    }
    renderCalendar(getFilteredTasks());
}

function renderTimeline(tasks) {
    const validTasks = tasks.filter(t => t.dateCreated);
    if (validTasks.length === 0) {
        document.getElementById('content-area').innerHTML = `<div class="activity-list"><div class="activity-item">No tasks with dates to display.</div></div>`;
        return;
    }

    const dates = validTasks.flatMap(t => [new Date(t.dateCreated), t.dueDate ? new Date(t.dueDate) : new Date(t.dateCreated)]);
    let minDate = new Date(Math.min(...dates));
    let maxDate = new Date(Math.max(...dates));
    
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 2);

    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    const today = new Date();
    const todayOffset = Math.ceil((today - minDate) / (1000 * 60 * 60 * 24));

    let headerHtml = '';
    for (let i = 0; i <= totalDays; i++) {
        const currDate = new Date(minDate);
        currDate.setDate(currDate.getDate() + i);
        headerHtml += `<div class="timeline-day-col">${currDate.getDate()}/${currDate.getMonth() + 1}</div>`;
    }

    let rowsHtml = validTasks.map(t => {
        const start = new Date(t.dateCreated);
        const end = t.dueDate ? new Date(t.dueDate) : new Date(t.dateCreated);
        let offsetDays = Math.ceil((start - minDate) / (1000 * 60 * 60 * 24));
        let durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const leftPercent = (offsetDays / totalDays) * 100;
        const widthPercent = (durationDays / totalDays) * 100;
        return `<div class="timeline-row"><div class="gantt-bar priority-${t.priority}" style="left: ${leftPercent}%; width: ${widthPercent}%;" onclick="openTaskModal('${t.id}')">${t.title}</div></div>`;
    }).join('');

    document.getElementById('content-area').innerHTML = `
        <div class="timeline-container">
            <div class="timeline-header">
                <div class="timeline-task-label-header">Task</div>
                <div class="timeline-days-header" style="overflow: hidden;">${headerHtml}</div>
            </div>
            <div class="timeline-body">
                <div class="timeline-task-labels">${validTasks.map(t => `<div class="timeline-task-label" onclick="openTaskModal('${t.id}')">${t.title}</div>`).join('')}</div>
                <div class="timeline-chart">
                    ${todayOffset >= 0 && todayOffset <= totalDays ? `<div class="timeline-today-line" style="left: ${(todayOffset / totalDays) * 100}%;"></div>` : ''}
                    ${rowsHtml}
                </div>
            </div>
        </div>
    `;
}

function renderStats(tasks) {
    document.getElementById('content-area').innerHTML = `
        <div class="dash-grid" style="grid-template-columns: 1fr; gap: 32px;">
            <div><div class="section-title">Tasks by Status</div><canvas id="chartStatus"></canvas></div>
            <div><div class="section-title">Tasks by Priority</div><canvas id="chartPriority"></canvas></div>
        </div>
    `;
    const statusCounts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    const priorityCounts = tasks.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});

    new Chart(document.getElementById('chartStatus'), { type: 'doughnut', data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff'] }] } });
    new Chart(document.getElementById('chartPriority'), { type: 'bar', data: { labels: Object.keys(priorityCounts), datasets: [{ data: Object.values(priorityCounts), backgroundColor: '#58a6ff' }] } });
}

// --- Task Modal ---
function openTaskModal(taskId) {
    state.selectedTaskId = taskId;
    const isNew = taskId === null;
    const task = isNew ? createNewTaskTemplate() : state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const modalContainer = document.getElementById('task-modal-container');
    
    modalContainer.innerHTML = `
        <div class="modal-header">
            <h3>${isNew ? '✨ Create New Task' : '✏️ Edit Task'}</h3>
            <button onclick="closeTaskModal()" class="btn-close">&times;</button>
        </div>
        <div class="modal-content">
            <div class="modal-main">
                <div class="modal-section">
                    <input type="text" id="modal-title" class="modal-input" value="${task.title}" placeholder="Task Title" style="font-size:1.2rem; font-weight:700;">
                    <textarea id="modal-desc" class="modal-input" placeholder="Add a clear description..." rows="4">${task.description}</textarea>
                </div>

                <div class="modal-section">
                    <h4>Definition of Success (Anti-Scope Creep)</h4>
                    <input type="text" id="modal-deliverable" class="modal-input" value="${task.definitionOfSuccess.expectedDeliverable}" placeholder="🎯 Expected Deliverable">
                    <input type="text" id="modal-metric" class="modal-input" value="${task.definitionOfSuccess.successMetric}" placeholder="📊 Success Metric">
                    <input type="text" id="modal-scope" class="modal-input" value="${task.definitionOfSuccess.outOfScope.join(', ')}" placeholder="🚫 Out of Scope (comma separated)">
                </div>

                <div class="modal-section">
                    <h4>Notes & Activity</h4>
                    <div class="activity-list" style="margin-bottom: 16px; max-height: 200px;">
                        ${task.notes.map(n => `<div class="activity-item"><b>${n.userId}</b>: ${n.content}</div>`).join('')}
                        ${task.activity.map(a => `<div class="activity-item"><b>${a.userId}</b> ${a.action}</div>`).join('')}
                    </div>
                    <input type="text" id="modal-new-note" class="modal-input" placeholder="Add a note and press Enter">
                </div>
            </div>

            <div class="modal-sidebar">
                <div class="modal-section">
                    <h4>Properties</h4>
                    <label style="font-size:0.85rem; color:var(--text-secondary);">Status</label>
                    <select id="modal-status" class="modal-input">
                        ${["Idea", "Backlog", "Planning", "Ready", "Assigned", "In Progress", "Waiting", "Blocked", "Review", "Testing", "Completed", "Cancelled", "Archived"].map(s => `<option ${task.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    
                    <label style="font-size:0.85rem; color:var(--text-secondary);">Priority</label>
                    <select id="modal-priority" class="modal-input">
                        ${["Critical", "High", "Medium", "Low"].map(p => `<option ${task.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>

                    <label style="font-size:0.85rem; color:var(--text-secondary);">Owner</label>
                    <input type="text" id="modal-owner" class="modal-input" value="${task.owner}" placeholder="Unassigned">

                    <label style="font-size:0.85rem; color:var(--text-secondary);">Project</label>
                    <input type="text" id="modal-project" class="modal-input" value="${task.project}" placeholder="General">
                </div>

                <div class="modal-section">
                    <h4>Dates & Progress</h4>
                    <label style="font-size:0.85rem; color:var(--text-secondary);">Due Date</label>
                    <input type="date" id="modal-due" class="modal-input" value="${task.dueDate ? task.dueDate.split('T')[0] : ''}">
                    
                    <label style="font-size:0.85rem; color:var(--text-secondary);">Progress: <span id="progress-display">${task.progress}%</span></label>
                    <input type="range" id="modal-progress" class="modal-input" value="${task.progress}" min="0" max="100" step="5" style="padding: 0; height: 40px;" oninput="document.getElementById('progress-display').innerText = this.value + '%'">
                </div>
            </div>
        </div>
        
        <div class="modal-footer">
            ${!isNew ? `<button onclick="requestDelete('${task.id}')" class="btn-danger">Delete</button>` : `<div></div>`}
            <div style="display: flex; gap: 12px;">
                <button onclick="closeTaskModal()" class="btn-secondary">Cancel</button>
                <button onclick="saveTask()" class="btn-primary">Save Task</button>
            </div>
        </div>
    `;
    
    document.getElementById('task-modal-overlay').classList.add('active');
    modalContainer.classList.add('active');
    
    document.getElementById('modal-new-note').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            task.notes.push({ id: 'n-' + Date.now(), userId: 'CurrentUser', timestamp: new Date().toISOString(), content: e.target.value });
            e.target.value = '';
            saveTask(true); 
        }
    });
}

function closeTaskModal() {
    document.getElementById('task-modal-overlay').classList.remove('active');
    document.getElementById('task-modal-container').classList.remove('active');
    state.selectedTaskId = null;
    renderApp();
}

function createNewTaskTemplate() {
    return {
        id: 'task-' + Date.now(), title: '', description: '', category: 'General', project: '', owner: 'Unassigned',
        createdBy: 'CurrentUser', dateCreated: new Date().toISOString(), dueDate: '', lastUpdated: new Date().toISOString(),
        status: 'Backlog', priority: 'Medium', difficulty: 'Medium', estimatedTime: '', actualTimeSpent: '',
        progress: 0, subtasks: [], definitionOfSuccess: { expectedDeliverable: '', successMetric: '', outOfScope: [] },
        dependencies: { blockedBy: [], blocks: [] }, notes: [], activity: [{ id: 'a-' + Date.now(), timestamp: new Date().toISOString(), userId: 'CurrentUser', action: 'created the task.' }], attachments: []
    };
}

// --- Cloud Save Logic ---
async function saveTask(silent = false) {
    const isNew = !state.tasks.find(t => t.id === state.selectedTaskId);
    const task = isNew ? createNewTaskTemplate() : state.tasks.find(t => t.id === state.selectedTaskId);
    
    task.title = document.getElementById('modal-title').value;
    task.description = document.getElementById('modal-desc').value;
    task.status = document.getElementById('modal-status').value;
    task.priority = document.getElementById('modal-priority').value;
    task.owner = document.getElementById('modal-owner').value;
    task.project = document.getElementById('modal-project').value;
    task.dueDate = document.getElementById('modal-due').value ? new Date(document.getElementById('modal-due').value).toISOString() : '';
    task.progress = parseInt(document.getElementById('modal-progress').value) || 0;
    task.definitionOfSuccess.expectedDeliverable = document.getElementById('modal-deliverable').value;
    task.definitionOfSuccess.successMetric = document.getElementById('modal-metric').value;
    task.definitionOfSuccess.outOfScope = document.getElementById('modal-scope').value.split(',').map(s => s.trim()).filter(Boolean);
    task.lastUpdated = new Date().toISOString();

    const { error } = await db.from('tasks').upsert({ id: task.id, data: task });
    if (error) console.error("Cloud Save Error:", error);

    if (isNew) {
        state.tasks.push(task);
    } else {
        const index = state.tasks.findIndex(t => t.id === task.id);
        if (index !== -1) state.tasks[index] = task;
    }
    
    if (silent) {
        openTaskModal(task.id); 
    } else {
        closeTaskModal();
        renderApp();
    }
}

// --- Delete Logic & Custom Modal ---
function requestDelete(taskId) {
    state.taskToDelete = taskId;
    const task = state.tasks.find(t => t.id === taskId);
    document.getElementById('modal-title').innerText = "Delete Task?";
    document.getElementById('modal-text').innerHTML = `Are you sure you want to delete <b>"${task.title}"</b>? This action cannot be undone.`;
    document.getElementById('custom-modal-overlay').classList.add('active');
}

function closeCustomModal() {
    document.getElementById('custom-modal-overlay').classList.remove('active');
    state.taskToDelete = null;
}

// --- Data Export (Backup) ---
function exportData() {
    const dataStr = JSON.stringify({ tasks: state.tasks }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "tasks-backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Load Theme on Start
const savedTheme = localStorage.getItem('mm-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Start
initApp();