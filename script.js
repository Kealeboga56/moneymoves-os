// MoneyMovesOS - Core Application Logic
// Architected for easy migration to React/Vue or Backend integration.

const state = {
    tasks: [],
    currentView: 'dashboard',
    filters: { search: '', status: '', priority: '' },
    selectedTaskId: null
};

// --- Initialization ---
async function initApp() {
    try {
        // In production, replace this with Supabase/Firebase fetch
        const response = await fetch('data/tasks.json');
        if (!response.ok) throw new Error('Failed to load data');
        state.tasks = (await response.json()).tasks;
        
        // Load any localStorage overrides (simulating backend persistence for V1)
        loadLocalStorage();
        
        attachEventListeners();
        renderApp();
    } catch (error) {
        console.error('Initialization Error:', error);
        document.getElementById('content-area').innerHTML = `<div class="error">Failed to load task data. Ensure you are running via a local server (e.g., Live Server).</div>`;
    }
}

// --- Event Listeners ---
function attachEventListeners() {
    // Sidebar Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.currentView = e.currentTarget.dataset.view;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderApp();
        });
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const html = document.documentElement;
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('mm-theme', newTheme);
    });

    // Filters & Search
    document.getElementById('global-search').addEventListener('input', (e) => {
        state.filters.search = e.target.value.toLowerCase();
        if (state.currentView !== 'dashboard' && state.currentView !== 'stats') renderApp();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => {
        state.filters.status = e.target.value;
        renderApp();
    });
    document.getElementById('filter-priority').addEventListener('change', (e) => {
        state.filters.priority = e.target.value;
        renderApp();
    });

    // New Task Button
    document.getElementById('new-task-btn').addEventListener('click', () => openTaskDrawer(null));

    // Drawer Close
    document.getElementById('task-drawer-overlay').addEventListener('click', closeTaskDrawer);
}

// --- Filtering Logic ---
function getFilteredTasks() {
    return state.tasks.filter(task => {
        const searchMatch = !state.filters.search || 
                            task.title.toLowerCase().includes(state.filters.search) || 
                            task.description.toLowerCase().includes(state.filters.search) ||
                            task.project.toLowerCase().includes(state.filters.search);
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
        case 'stats': renderStats(tasks); break;
        case 'calendar': 
        case 'timeline':
            contentArea.innerHTML = `<div class="placeholder-view"><h2>${state.currentView.charAt(0).toUpperCase() + state.currentView.slice(1)} View</h2><p>This view is architecturally prepped for V2.</p></div>`;
            break;
    }
}

// --- Views ---

function renderDashboard(tasks) {
    const total = tasks.length;
    const active = tasks.filter(t => !['Completed', 'Archived', 'Cancelled'].includes(t.status)).length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const blocked = tasks.filter(t => t.status === 'Blocked').length;
    const review = tasks.filter(t => t.status === 'Review').length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const critical = tasks.filter(t => t.priority === 'Critical').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Flatten recent activity
    const allActivity = tasks.flatMap(t => t.activity.map(a => ({...a, taskTitle: t.title, taskId: t.id})))
                             .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
                             .slice(0, 10);

    document.getElementById('content-area').innerHTML = `
        <div class="dash-grid">
            <div class="dash-card"><div class="dash-label">Total Tasks</div><div class="dash-value">${total}</div></div>
            <div class="dash-card"><div class="dash-label">In Progress</div><div class="dash-value" style="color:var(--accent-blue)">${inProgress}</div></div>
            <div class="dash-card"><div class="dash-label">Blocked</div><div class="dash-value" style="color:var(--danger-red)">${blocked}</div></div>
            <div class="dash-card"><div class="dash-label">Review</div><div class="dash-value" style="color:var(--warning-amber)">${review}</div></div>
            <div class="dash-card"><div class="dash-label">Critical Priority</div><div class="dash-value" style="color:var(--danger-red)">${critical}</div></div>
            <div class="dash-card">
                <div class="dash-label">Completion Rate</div>
                <div class="dash-value">${completionRate}%</div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${completionRate}%"></div></div>
            </div>
        </div>
        <div>
            <div class="section-title">Recent Activity</div>
            <div class="activity-list">
                ${allActivity.map(a => `
                    <div class="activity-item" onclick="openTaskDrawer('${a.taskId}')">
                        <b>${a.userId}</b> ${a.action} <br>
                        <span style="font-size:0.8rem; color:var(--text-secondary)">${a.taskTitle} - ${new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                `).join('')}
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
                                <div class="kanban-card priority-${t.priority}" onclick="openTaskDrawer('${t.id}')">
                                    <div class="card-title">${t.title}</div>
                                    <div class="card-meta">
                                        <span>${t.project}</span>
                                        <span>${t.owner}</span>
                                    </div>
                                    <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width: ${t.progress}%"></div></div>
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
        <table class="task-table">
            <thead>
                <tr>
                    <th>Title</th><th>Status</th><th>Priority</th><th>Owner</th><th>Project</th><th>Due Date</th><th>Progress</th>
                </tr>
            </thead>
            <tbody>
                ${tasks.map(t => `
                    <tr onclick="openTaskDrawer('${t.id}')">
                        <td>${t.title}</td>
                        <td><span class="tag">${t.status}</span></td>
                        <td>${t.priority}</td>
                        <td>${t.owner}</td>
                        <td>${t.project}</td>
                        <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width: ${t.progress}%"></div></div>
                                <span>${t.progress}%</span>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderList(tasks) {
    document.getElementById('content-area').innerHTML = `
        <div class="list-view">
            ${tasks.map(t => `
                <div class="kanban-card priority-${t.priority}" style="margin-bottom:10px" onclick="openTaskDrawer('${t.id}')">
                    <div class="card-title">${t.title}</div>
                    <div class="card-meta">
                        <span>${t.status} • ${t.project}</span>
                        <span>${t.owner}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderStats(tasks) {
    document.getElementById('content-area').innerHTML = `
        <div class="dash-grid" style="grid-template-columns: 1fr 1fr; gap: 30px;">
            <div><div class="section-title">Tasks by Status</div><canvas id="chartStatus"></canvas></div>
            <div><div class="section-title">Tasks by Priority</div><canvas id="chartPriority"></canvas></div>
        </div>
    `;
    
    const statusCounts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    const priorityCounts = tasks.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});

    new Chart(document.getElementById('chartStatus'), {
        type: 'doughnut',
        data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff'] }] }
    });
    new Chart(document.getElementById('chartPriority'), {
        type: 'bar',
        data: { labels: Object.keys(priorityCounts), datasets: [{ data: Object.values(priorityCounts), backgroundColor: '#58a6ff' }] }
    });
}

// --- Task Drawer (Detail View & Edit) ---
function openTaskDrawer(taskId) {
    state.selectedTaskId = taskId;
    const task = taskId ? state.tasks.find(t => t.id === taskId) : createNewTaskTemplate();
    if (!task) return;

    const drawer = document.getElementById('task-drawer');
    const overlay = document.getElementById('task-drawer-overlay');
    
    drawer.innerHTML = `
        <div class="drawer-header">
            <h3>${taskId ? 'Edit Task' : 'New Task'}</h3>
            <button onclick="closeTaskDrawer()" style="background:none; border:none; color:var(--text-secondary); font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>
        <div class="drawer-content">
            <div class="drawer-section">
                <input type="text" id="drawer-title" class="drawer-input" value="${task.title}" placeholder="Task Title" style="font-size:1.1rem; font-weight:600;">
                <textarea id="drawer-desc" class="drawer-input" placeholder="Description" rows="3">${task.description}</textarea>
            </div>

            <div class="drawer-section">
                <h4>Core Details</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <select id="drawer-status" class="drawer-input">
                        ${["Idea", "Backlog", "Planning", "Ready", "Assigned", "In Progress", "Waiting", "Blocked", "Review", "Testing", "Completed", "Cancelled", "Archived"].map(s => `<option ${task.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <select id="drawer-priority" class="drawer-input">
                        ${["Critical", "High", "Medium", "Low"].map(p => `<option ${task.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                    <input type="text" id="drawer-owner" class="drawer-input" value="${task.owner}" placeholder="Owner">
                    <input type="text" id="drawer-project" class="drawer-input" value="${task.project}" placeholder="Project">
                    <input type="date" id="drawer-due" class="drawer-input" value="${task.dueDate ? task.dueDate.split('T')[0] : ''}">
                    <input type="number" id="drawer-progress" class="drawer-input" value="${task.progress}" min="0" max="100" placeholder="Progress %">
                </div>
            </div>

            <div class="drawer-section">
                <h4>Definition of Success (Anti-Scope Creep)</h4>
                <input type="text" id="drawer-deliverable" class="drawer-input" value="${task.definitionOfSuccess.expectedDeliverable}" placeholder="Expected Deliverable">
                <input type="text" id="drawer-metric" class="drawer-input" value="${task.definitionOfSuccess.successMetric}" placeholder="Success Metric">
                <input type="text" id="drawer-scope" class="drawer-input" value="${task.definitionOfSuccess.outOfScope.join(', ')}" placeholder="Out of Scope (comma separated)">
            </div>

            <div class="drawer-section">
                <h4>Subtasks</h4>
                <div id="subtasks-container">
                    ${task.subtasks.map(st => `
                        <div class="subtask-item">
                            <input type="checkbox" ${st.checked ? 'checked' : ''} onchange="toggleSubtask('${st.id}')">
                            <span>${st.title}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="drawer-section">
                <h4>Notes & Activity</h4>
                <div class="activity-list" style="margin-bottom: 15px;">
                    ${task.notes.map(n => `<div class="activity-item"><b>${n.userId}</b>: ${n.content}</div>`).join('')}
                    ${task.activity.map(a => `<div class="activity-item"><b>${a.userId}</b> ${a.action}</div>`).join('')}
                </div>
                <input type="text" id="drawer-new-note" class="drawer-input" placeholder="Add a note and press Enter">
            </div>

            <button onclick="saveTask()" style="width:100%; padding:12px; background:var(--accent-blue); color:white; border:none; border-radius:var(--radius); cursor:pointer; font-weight:600;">Save Task</button>
        </div>
    `;
    
    overlay.classList.add('active');
    drawer.classList.add('open');
    
    // Handle new note creation
    document.getElementById('drawer-new-note').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            task.notes.push({ id: 'n-' + Date.now(), userId: 'CurrentUser', timestamp: new Date().toISOString(), content: e.target.value });
            e.target.value = '';
            openTaskDrawer(task.id); // Re-render drawer
        }
    });
}

function closeTaskDrawer() {
    document.getElementById('task-drawer-overlay').classList.remove('active');
    document.getElementById('task-drawer').classList.remove('open');
    state.selectedTaskId = null;
    renderApp();
}

function createNewTaskTemplate() {
    return {
        id: 'task-' + Date.now(),
        title: '', description: '', category: 'General', project: '', owner: 'Unassigned',
        createdBy: 'CurrentUser', dateCreated: new Date().toISOString(), dueDate: '', lastUpdated: new Date().toISOString(),
        status: 'Backlog', priority: 'Medium', difficulty: 'Medium', estimatedTime: '', actualTimeSpent: '',
        progress: 0, subtasks: [], definitionOfSuccess: { expectedDeliverable: '', successMetric: '', outOfScope: [] },
        dependencies: { blockedBy: [], blocks: [] }, notes: [], activity: [{ id: 'a-' + Date.now(), timestamp: new Date().toISOString(), userId: 'CurrentUser', action: 'created the task.' }], attachments: []
    };
}

function saveTask() {
    const id = state.selectedTaskId || document.getElementById('drawer-title').dataset.id; // Fallback logic for new
    const isNew = !state.tasks.find(t => t.id === state.selectedTaskId);
    const task = isNew ? createNewTaskTemplate() : state.tasks.find(t => t.id === state.selectedTaskId);
    
    task.title = document.getElementById('drawer-title').value;
    task.description = document.getElementById('drawer-desc').value;
    task.status = document.getElementById('drawer-status').value;
    task.priority = document.getElementById('drawer-priority').value;
    task.owner = document.getElementById('drawer-owner').value;
    task.project = document.getElementById('drawer-project').value;
    task.dueDate = document.getElementById('drawer-due').value ? new Date(document.getElementById('drawer-due').value).toISOString() : '';
    task.progress = parseInt(document.getElementById('drawer-progress').value) || 0;
    task.definitionOfSuccess.expectedDeliverable = document.getElementById('drawer-deliverable').value;
    task.definitionOfSuccess.successMetric = document.getElementById('drawer-metric').value;
    task.definitionOfSuccess.outOfScope = document.getElementById('drawer-scope').value.split(',').map(s => s.trim()).filter(Boolean);
    task.lastUpdated = new Date().toISOString();

    if (isNew) {
        state.tasks.push(task);
    }

    saveToLocalStorage();
    closeTaskDrawer();
}

function toggleSubtask(subtaskId) {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    const st = task.subtasks.find(s => s.id === subtaskId);
    st.checked = !st.checked;
    st.status = st.checked ? 'Completed' : 'In Progress';
    
    // Auto-calc progress
    const completed = task.subtasks.filter(s => s.checked).length;
    task.progress = Math.round((completed / task.subtasks.length) * 100);
    
    saveToLocalStorage();
    openTaskDrawer(task.id); // Re-render to show new progress
}

// --- LocalStorage (V1 Persistence) ---
function saveToLocalStorage() {
    localStorage.setItem('mm-tasks', JSON.stringify(state.tasks));
}

function loadLocalStorage() {
    const saved = localStorage.getItem('mm-tasks');
    if (saved) {
        try {
            state.tasks = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse local storage");
        }
    }
}

// Start the app
initApp();