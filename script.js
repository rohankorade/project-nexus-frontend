// --- CONFIGURATION & DOM ELEMENTS ---
const API_BASE_URL = '/api';
const NEXUS_KEY = '245456';
const SESSION_DURATION_MS = 180 * 24 * 60 * 60 * 1000;

// Main containers
const loginOverlay = document.getElementById('login-overlay');
const dashboardContent = document.getElementById('dashboard-content');
const loginButton = document.getElementById('login-button');
const keyInput = document.getElementById('nexus-key-input');

// Dashboard elements
const rohanTodayEl = document.getElementById('rohan-today');
const malharTodayEl = document.getElementById('malhar-today');
const explorerContent = document.getElementById('explorer-content');
const recentNotesContent = document.getElementById('recent-notes-content');
const breadcrumbNav = document.getElementById('breadcrumb-nav');

// Modal elements
const modal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('preview-title');
const modalBody = document.getElementById('preview-body');
const closeButton = document.querySelector('.close-button');
const markdownConverter = new showdown.Converter();

// Global state for the explorer
let fileTree = {};
let currentPath = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', checkLoginStatus);
loginButton.addEventListener('click', handleLogin);
keyInput.addEventListener('keyup', (event) => {
    if (event.key === "Enter") handleLogin();
});

// --- AUTHENTICATION LOGIC ---

function checkLoginStatus() {
    const session = localStorage.getItem('nexus_session');
    if (!session) {
        return; // No session, show login screen
    }

    const sessionData = JSON.parse(session);
    const now = new Date().getTime();

    // If session is valid and not expired, show dashboard
    if (sessionData.key === NEXUS_KEY && (now - sessionData.timestamp < SESSION_DURATION_MS)) {
        showDashboard();
    }
}

function handleLogin() {
    if (keyInput.value === NEXUS_KEY) {
        // Key is correct, save the session
        const sessionData = {
            key: NEXUS_KEY,
            timestamp: new Date().getTime()
        };
        localStorage.setItem('nexus_session', JSON.stringify(sessionData));
        showDashboard();
    } else {
        // Key is incorrect, show error feedback
        const loginBox = document.querySelector('.login-box');
        loginBox.classList.add('shake');
        keyInput.value = ''; // Clear input
        setTimeout(() => {
            loginBox.classList.remove('shake');
        }, 500);
    }
}

function showDashboard() {
    loginOverlay.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    fetchAndDisplayNotes(); // Fetch notes only after successful login
}

// --- DASHBOARD & API LOGIC (from previous steps) ---

closeButton.onclick = () => { modal.style.display = "none"; };
window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

// --- CORE DATA HANDLING ---
async function fetchAndDisplayNotes() {
    explorerContent.innerHTML = `<p class="loading">Loading...</p>`;
    recentNotesContent.innerHTML = `<p class="loading">Loading...</p>`;
    try {
        const response = await fetch(`${API_BASE_URL}/notes`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const notes = await response.json();

        updateStats(notes);
        displayRecentNotes(notes);

        // Initialize the file explorer
        fileTree = buildFileTree(notes);
        currentPath = []; // Reset to root
        renderExplorerView();

    } catch (error) {
        console.error("Failed to fetch notes:", error);
        explorerContent.innerHTML = `<p class="loading">❌ Could not load notes.</p>`;
        recentNotesContent.innerHTML = `<p class="loading">❌ Could not load notes.</p>`;
    }
}

function updateStats(notes) {
    // --- Daily & Total Stats Logic ---
    let rohanToday = 0, malharToday = 0, rohanTotal = 0, malharTotal = 0;
    const today = new Date().toISOString().slice(0, 10);

    // --- Category Totals Setup ---
    const categoryTotals = {
        'GS 1': 0,
        'GS 2': 0,
        'GS 3': 0,
        'GS 4': 0,
        'Optional 1': 0,
        'Optional 2': 0,
    };

    // --- Single Loop for All Calculations ---
    for (const note of notes) {
        // Calculate user totals
        if (note.shared_by.toLowerCase() === 'rohan') {
            rohanTotal++;
            if (note.timestamp.slice(0, 10) === today) rohanToday++;
        } else if (note.shared_by.toLowerCase() === 'malhar') {
            malharTotal++;
            if (note.timestamp.slice(0, 10) === today) malharToday++;
        }

        // Calculate category totals
        for (const category in categoryTotals) {
            if (note.filepath.startsWith(category + '/')) {
                categoryTotals[category]++;
                break; // Stop checking once a category is found for this note
            }
        }
    }
    
    // --- Update HTML ---
    rohanTodayEl.textContent = rohanToday;
    malharTodayEl.textContent = malharToday;
    document.getElementById('rohan-total').textContent = rohanTotal;
    document.getElementById('malhar-total').textContent = malharTotal;

    document.getElementById('total-gs1').textContent = categoryTotals['GS 1'];
    document.getElementById('total-gs2').textContent = categoryTotals['GS 2'];
    document.getElementById('total-gs3').textContent = categoryTotals['GS 3'];
    document.getElementById('total-gs4').textContent = categoryTotals['GS 4'];
    document.getElementById('total-opt1').textContent = categoryTotals['Optional 1'];
    document.getElementById('total-opt2').textContent = categoryTotals['Optional 2'];
}

// --- RIGHT COLUMN: RECENT NOTES ---
function displayRecentNotes(notes) {
    recentNotesContent.innerHTML = '';
    const recentNotes = notes.slice(0, 50); // Get the 50 most recent notes

    if (recentNotes.length === 0) {
        recentNotesContent.innerHTML = `<p class="loading">No notes shared yet.</p>`;
        return;
    }

    recentNotes.forEach(note => {
        const noteItem = createNoteElement(note);
        recentNotesContent.appendChild(noteItem);
    });
}


// --- LEFT COLUMN: WINDOWS-STYLE EXPLORER ---
function renderExplorerView() {
    renderBreadcrumbs();
    explorerContent.innerHTML = '';

    let currentLevel = fileTree;
    // Traverse the tree to the current path
    for (const part of currentPath) {
        currentLevel = currentLevel[part];
    }

    const folders = Object.keys(currentLevel).filter(key => key !== '_files').sort();
    const files = currentLevel._files ? currentLevel._files.sort((a, b) => a.filename.localeCompare(b.filename)) : [];

    if (folders.length === 0 && files.length === 0) {
        explorerContent.innerHTML = `<p class="loading">This folder is empty.</p>`;
    }

    // Render folders
    folders.forEach(folderName => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'explorer-item';
        folderDiv.innerHTML = `<span>📁</span> ${folderName}`;
        folderDiv.addEventListener('click', () => {
            currentPath.push(folderName);
            renderExplorerView();
        });
        explorerContent.appendChild(folderDiv);
    });

    // Render files
    files.forEach(note => {
        const noteElement = createNoteElement(note);
        explorerContent.appendChild(noteElement);
    });
}

function renderBreadcrumbs() {
    breadcrumbNav.innerHTML = '';
    const homeLink = document.createElement('a');
    homeLink.href = '#';
    homeLink.textContent = 'Home';
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        currentPath = [];
        renderExplorerView();
    });
    breadcrumbNav.appendChild(homeLink);

    let pathSoFar = [];
    currentPath.forEach((part, index) => {
        pathSoFar.push(part);
        const separator = document.createElement('span');
        separator.textContent = '>';
        breadcrumbNav.appendChild(separator);

        const partLink = document.createElement('a');
        partLink.href = '#';
        partLink.textContent = part;
        // Create a closure to capture the correct path for the event listener
        const pathToNavigate = [...pathSoFar]; 
        partLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPath = pathToNavigate;
            renderExplorerView();
        });
        breadcrumbNav.appendChild(partLink);
    });
}

function buildFileTree(notes) {
    const tree = {};
    notes.forEach(note => {
        const pathParts = note.filepath.split(/\/|\\/);
        let currentLevel = tree;
        pathParts.forEach((part, index) => {
            if (index === pathParts.length - 1) {
                if (!currentLevel._files) currentLevel._files = [];
                currentLevel._files.push(note);
            } else {
                if (!currentLevel[part]) currentLevel[part] = {};
                currentLevel = currentLevel[part];
            }
        });
    });
    return tree;
}

function createFileTreeHtml(treeNode) {
    const ul = document.createElement('ul');
    ul.className = 'tree-level';

    // Sort folders first, then files
    const folders = Object.keys(treeNode).filter(key => key !== '_files').sort();
    const files = treeNode._files ? treeNode._files.sort((a, b) => a.filename.localeCompare(b.filename)) : [];

    folders.forEach(folderName => {
        const li = document.createElement('li');
        li.className = 'tree-item collapsed'; // Start collapsed
        
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-item';
        folderDiv.innerHTML = `<span>📁</span> ${folderName}`;
        li.appendChild(folderDiv);
        
        li.appendChild(createFileTreeHtml(treeNode[folderName]));
        ul.appendChild(li);
    });

    files.forEach(note => {
        const li = document.createElement('li');
        li.className = 'tree-item file-container';
        const noteElement = createNoteElement(note);
        li.appendChild(noteElement);
        ul.appendChild(li);
    });

    return ul;
}

// --- SHARED FUNCTIONS (createNoteElement, showPreview, etc.) ---
// createNoteElement is now a shared component for both views
function createNoteElement(note) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'note-item'; // Base class

    // NEW: Add user-specific class for background colors
    if (note.shared_by.toLowerCase() === 'rohan') {
        itemDiv.classList.add('note-by-rohan');
    } else if (note.shared_by.toLowerCase() === 'malhar') {
        itemDiv.classList.add('note-by-malhar');
    }

    const formattedTime = new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    itemDiv.innerHTML = `
        <div class="note-info">
            <p class="filename" title="${note.filename}">${note.filename}</p>
            <p class="meta">By <strong>${note.shared_by}</strong> at ${formattedTime}</p>
        </div>
        <div class="note-actions">
            <button class="copy-btn">📋 Copy</button>
            <button class="preview-btn">👁️ Preview</button>
            <button class="delete-btn">🗑️ Delete</button>
        </div>
    `;

    itemDiv.querySelector('.preview-btn').addEventListener('click', () => showPreview(note));
    itemDiv.querySelector('.copy-btn').addEventListener('click', (event) => copyNoteContent(note, event.target));
    itemDiv.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note));

    return itemDiv;
}

async function showPreview(note) {
    modalTitle.textContent = note.filename;
    modalBody.innerHTML = '<p class="loading">Loading preview...</p>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`${API_BASE_URL}/download/${note.filename}`);
        let markdownText = await response.text();

        // 1. Define a regex to find and remove the YAML frontmatter (---...---)
        const frontmatterRegex = /^---[\s\S]*?---\s*/;
        let contentOnly = markdownText.replace(frontmatterRegex, '');

        // 2. Convert the content-only markdown to HTML
        let htmlContent = markdownConverter.makeHtml(contentOnly);

        // 3. Define a regex to find the <pre><code> blocks that showdown creates
        const codeHtmlRegex = /<pre><code[\s\S]*?<\/code><\/pre>/g;
        const placeholder = `
            <div class="code-placeholder">
                <p><strong>[ 🖥️ Custom Code Block ]</strong></p>
                <p>Content hidden in preview</p>
            </div>
        `;

        // 4. Replace the HTML code blocks with our placeholder
        htmlContent = htmlContent.replace(codeHtmlRegex, placeholder);

        // 5. Set the final, fully processed HTML
        modalBody.innerHTML = htmlContent;

    } catch (error) {
        console.error("Preview error:", error);
        modalBody.innerHTML = '<p>Could not load preview.</p>';
    }
}

async function copyNoteContent(note, buttonElement) {
    try {
        // FIXED THE TYPO HERE: API_A_BASE_URL -> API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/download/${note.filename}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const markdownText = await response.text();
        await navigator.clipboard.writeText(markdownText);
        const originalText = buttonElement.textContent;
        buttonElement.textContent = 'Copied!';
        setTimeout(() => { buttonElement.textContent = originalText; }, 2000);
    } catch (err) {
        console.error('Failed to copy content: ', err);
        const originalText = buttonElement.textContent;
        buttonElement.textContent = 'Error!';
        buttonElement.style.backgroundColor = '#e74c3c';
        setTimeout(() => { buttonElement.textContent = originalText; buttonElement.style.backgroundColor = ''; }, 2000);
    }
}

async function deleteNote(note) {
    if (!confirm(`Are you sure you want to permanently delete "${note.filename}"?`)) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/notes`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: note.filename })
        });
        if (!response.ok) throw new Error('Server responded with an error.');
        fetchAndDisplayNotes(); // This now refreshes both columns
    } catch (err) {
        console.error('Failed to delete note: ', err);
        alert('Could not delete the note. Please try again.');
    }
}