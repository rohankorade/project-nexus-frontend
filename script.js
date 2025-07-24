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
const modalCloseButton = document.getElementById('modal-close-button');
const modalCopyButton = document.getElementById('modal-copy-button');
const markdownConverter = new showdown.Converter();

// Global state for the explorer
let fileTree = {};
let currentPath = [];
let uploadsChart = null;
let rawTextForCopy = '';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', checkLoginStatus);
loginButton.addEventListener('click', handleLogin);
keyInput.addEventListener('keyup', (event) => {
    if (event.key === "Enter") handleLogin();
});
modalCloseButton.addEventListener('click', () => { modal.style.display = "none"; });
window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = "none"; });
modalCopyButton.addEventListener('click', handleModalCopy);

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
        renderUploadsChart(notes);

    } catch (error) {
        console.error("Failed to fetch notes:", error);
        explorerContent.innerHTML = `<p class="loading">❌ Could not load notes.</p>`;
        recentNotesContent.innerHTML = `<p class="loading">❌ Could not load notes.</p>`;
    }
}

function renderUploadsChart(notes) {
    // 1. Prepare the data for the last 7 days
    const labels = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }));
    }

    // Initialize data arrays with 7 zeros
    const rohanData = new Array(7).fill(0);
    const malharData = new Array(7).fill(0);
    const totalData = new Array(7).fill(0);

    // 2. Process the notes to populate the data arrays
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    notes.forEach(note => {
        const noteDate = new Date(note.timestamp);
        if (noteDate >= sevenDaysAgo) {
            const diffDays = Math.floor((noteDate - sevenDaysAgo) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
                if (note.shared_by.toLowerCase() === 'rohan') {
                    rohanData[diffDays]++;
                } else if (note.shared_by.toLowerCase() === 'malhar') {
                    malharData[diffDays]++;
                }
                totalData[diffDays]++;
            }
        }
    });

    // 3. Render the chart
    const ctx = document.getElementById('uploads-chart').getContext('2d');

    // Destroy the old chart instance if it exists, to prevent bugs on refresh
    if (uploadsChart) {
        uploadsChart.destroy();
    }

    uploadsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Rohan',
                    data: rohanData,
                    borderColor: 'rgba(52, 152, 219, 0.8)', // Calm Blue
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Malhar',
                    data: malharData,
                    borderColor: 'rgba(46, 204, 113, 0.8)', // Calm Green
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Total',
                    data: totalData,
                    borderColor: 'rgba(127, 140, 141, 0.5)', // Calm Gray
                    backgroundColor: 'rgba(127, 140, 141, 0.05)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Only show whole numbers on Y-axis
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)' // Barely visible grid lines
                    }
                },
                x: {
                    grid: {
                        display: false // Hide vertical grid lines
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

function updateStats(notes) {
    // --- Daily & Total Stats Logic ---
    let rohanToday = 0, malharToday = 0, rohanTotal = 0, malharTotal = 0;
    
    // Get today's date components in the user's local timezone
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

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

        // --- CORRECTED "TODAY" CHECK ---
        // Convert the note's UTC timestamp into the user's local timezone
        const noteDate = new Date(note.timestamp);
        // Compare the year, month, and day of the note to today's date
        if (noteDate.getFullYear() === todayYear &&
            noteDate.getMonth() === todayMonth &&
            noteDate.getDate() === todayDay) {
            
            // If they match, increment the 'Today' counter
            if (note.shared_by.toLowerCase() === 'rohan') rohanToday++;
            else if (note.shared_by.toLowerCase() === 'malhar') malharToday++;
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
    itemDiv.className = 'note-item';

    if (note.shared_by.toLowerCase() === 'rohan') {
        itemDiv.classList.add('note-by-rohan');
    } else if (note.shared_by.toLowerCase() === 'malhar') {
        itemDiv.classList.add('note-by-malhar');
    }

    const formattedTime = new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // This part correctly calculates the path info
    let pathInfoHtml = '';
    if (note.filepath) {
        const pathParts = note.filepath.split('/');
        if (pathParts.length >= 4) {
            const paper = pathParts[0];
            const subject = pathParts[1];
            const microtheme = pathParts[3];
            pathInfoHtml = `
                <p class="path-info">
                    <span class="path-subject">${paper}</span>
                    <span class="path-arrow">→</span>
                    <span class="path-subject">${subject}</span>
                    <span class="path-arrow">→</span>
                    <span class="path-microtheme">${microtheme}</span>
                </p>
            `;
        }
    }
    
    // The corrected innerHTML now includes the pathInfoHtml variable
    itemDiv.innerHTML = `
        <div class="note-info">
            <p class="filename" title="${note.filename}">${note.filename}</p>
            ${pathInfoHtml}
            <p class="meta">By <strong>${note.shared_by}</strong> at ${formattedTime}</p>
        </div>
        <div class="note-actions">
            <button class="copy-btn" title="Copy">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span class="button-text">Copy</span>
            </button>
            <button class="preview-btn" title="Preview">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                <span class="button-text">Preview</span>
            </button>
            <button class="delete-btn" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                <span class="button-text">Delete</span>
            </button>
        </div>
    `;

    itemDiv.querySelector('.preview-btn').addEventListener('click', () => showPreview(note));
    itemDiv.querySelector('.copy-btn').addEventListener('click', (event) => copyNoteContent(note, event.target));
    itemDiv.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note));
    
    return itemDiv;
}

// Replace the old showPreview function with this one
async function showPreview(note) {
    modalTitle.textContent = 'Loading...'; // Use a temporary title
    modalBody.innerHTML = '<p class="loading">Loading and formatting note...</p>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`${API_BASE_URL}/download/${note.id}`);
        const markdownText = await response.text();

        rawTextForCopy = markdownText; // Save raw text for the copy button

        // --- NEW: Multi-part Regex Extraction ---

        // Helper function to extract a section between two headings or to the end
        const extractSection = (text, startHeading) => {
            const regex = new RegExp(`^##\\s*${startHeading}[\\s\\S]*?(?=\\n##\\s|\\n---\\n|\\z)`, 'gm');
            const match = text.match(regex);
            return match ? match[0] : null;
        };

        // 1. Extract Title (H1)
        const titleMatch = markdownText.match(/^#\s*(.*)/);
        const title = titleMatch ? titleMatch[1] : note.filename;
        modalTitle.textContent = title; // Update the modal title directly

        // 2. Extract Core Concept
        const coreConceptMatch = markdownText.match(/>\s*\[!quote\]\s*Core Concept\s*([\s\S]*?)(?=\n> \[!|##|\n---\n|\z)/);
        const coreConceptText = coreConceptMatch ? coreConceptMatch[1].trim() : null;

        // 3. Extract Previous Year Questions
        const pyqMatch = markdownText.match(/>\s*\[!question\]\s*Previous Year Questions\s*([\s\S]*?)(?=\n##|\n---\n|\z)/);
        const pyqText = pyqMatch ? pyqMatch[1].trim() : null;

        // 4. Extract Dimensions
        const dimensionsMatch = markdownText.match(/(^##\s*Dimensions[\s\S]*?)(?=\n---)/m);
        const dimensionsText = dimensionsMatch ? dimensionsMatch[1].trim() : null;

        // 5. Extract Answer Writing Toolkit and its subsections
        const introsMatch = markdownText.match(/###\s*>\s*Model Introductions\s*([\s\S]*?)(?=\n###\s*>\s*Model Conclusions)/);
        const introsText = introsMatch ? introsMatch[1].trim() : null;
    
        // 6. Extract Model Conclusions
        const conclusionsMatch = markdownText.match(/###\s*>\s*Model Conclusions\s*([\s\S]*?)(?=\n---)/);
        const conclusionsText = conclusionsMatch ? conclusionsMatch[1].trim() : null;

        // --- Build Custom HTML from Extracted Parts ---
        let finalHtml = '';

        if (coreConceptText) {
            finalHtml += `
                <div class="summary-section">
                    <h4 class="summary-section-title">💡 Core Concept</h4>
                    <div class="summary-callout">${markdownConverter.makeHtml(coreConceptText)}</div>
                </div>
            `;
        }
        if (pyqText) {
            finalHtml += `
                <div class="summary-section">
                    <h4 class="summary-section-title">❓ Previous Year Questions</h4>
                    <div class="summary-callout">${markdownConverter.makeHtml(pyqText)}</div>
                </div>
            `;
        }
        if (dimensionsText) {
            finalHtml += `
                <div class="summary-section">
                    ${markdownConverter.makeHtml(dimensionsText)}
                </div>
            `;
        }
        if (introsText || conclusionsText) {
            finalHtml += `
                <div class="summary-section">
                    <h4 class="summary-section-title">✍️ Answer Writing Toolkit</h4>
                    <div class="toolkit-container">
                        ${introsText ? `<div class="toolkit-column">${markdownConverter.makeHtml("### Introductions\n" + introsText)}</div>` : ''}
                        ${conclusionsText ? `<div class="toolkit-column">${markdownConverter.makeHtml("### Conclusions\n" + conclusionsText)}</div>` : ''}
                    </div>
                </div>
            `;
        }

        modalBody.innerHTML = finalHtml;

    } catch (error) {
        console.error("Preview failed:", error);
        modalBody.innerHTML = '<p class="loading">❌ Could not load or format preview.</p>';
    }
}

function handleModalCopy() {
    if (!rawTextForCopy) return;

    const button = modalCopyButton;
    const originalButtonHTML = button.innerHTML;

    // Use the robust copy logic
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(rawTextForCopy).then(() => {
            button.innerHTML = 'Copied!';
            setTimeout(() => { button.innerHTML = originalButtonHTML; }, 2000);
        }).catch(err => {
            console.error('Modern copy failed', err);
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = rawTextForCopy;
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.prepend(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            button.innerHTML = 'Copied!';
            setTimeout(() => { button.innerHTML = originalButtonHTML; }, 2000);
        } catch (err) {
            console.error('Fallback copy failed', err);
        } finally {
            textArea.remove();
        }
    }
}

// This function now uses note.id to build the URL
// Replace your old copyNoteContent function with this one
async function copyNoteContent(note, buttonElement) {
    const originalButtonHTML = buttonElement.innerHTML; // Save original state

    try {
        const response = await fetch(`${API_BASE_URL}/download/${note.id}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const markdownText = await response.text();

        // --- NEW: Bulletproof Copy Logic ---
        // Try the modern, secure way first
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(markdownText);
        } else {
            // Fallback for older browsers or insecure contexts (like on some mobile devices)
            const textArea = document.createElement('textarea');
            textArea.value = markdownText;
            
            // Make the textarea invisible
            textArea.style.position = 'absolute';
            textArea.style.left = '-9999px';
            
            document.body.prepend(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback copy failed', err);
                throw new Error('Copy command failed.');
            } finally {
                textArea.remove();
            }
        }

        // Provide visual feedback to the user
        buttonElement.innerHTML = 'Copied!';
        setTimeout(() => {
            buttonElement.innerHTML = originalButtonHTML;
        }, 2000);

    } catch (err) {
        console.error('Failed to copy content: ', err);
        // Provide error feedback
        buttonElement.innerHTML = 'Error!';
        buttonElement.style.backgroundColor = '#e74c3c';
        setTimeout(() => {
            buttonElement.innerHTML = originalButtonHTML;
            buttonElement.style.backgroundColor = '';
        }, 2000);
    }
}

// This function now uses note.id to delete
async function deleteNote(note) {
    if (!confirm(`Are you sure you want to permanently delete "${note.filename}"?`)) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/notes`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: note.id }) // Send the note's ID
        });
        if (!response.ok) throw new Error('Server responded with an error.');
        fetchAndDisplayNotes();
    } catch (err) {
        console.error('Failed to delete note: ', err);
        alert('Could not delete the note. Please try again.');
    }
}