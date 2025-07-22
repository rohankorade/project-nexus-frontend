// --- CONFIGURATION & DOM ELEMENTS ---
const API_BASE_URL = '/api';
const NEXUS_KEY = '245456'; // Your secret key
const SESSION_DURATION_MS = 180 * 24 * 60 * 60 * 1000; // 6 months in milliseconds

const loginOverlay = document.getElementById('login-overlay');
const dashboardContent = document.getElementById('dashboard-content');
const loginButton = document.getElementById('login-button');
const keyInput = document.getElementById('nexus-key-input');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', checkLoginStatus);
loginButton.addEventListener('click', handleLogin);
keyInput.addEventListener('keyup', (event) => {
    if (event.key === "Enter") {
        handleLogin();
    }
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

const notesListContainer = document.getElementById('notes-list-container');
const rohanTodayEl = document.getElementById('rohan-today');
const malharTodayEl = document.getElementById('malhar-today');
const modal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('preview-title');
const modalBody = document.getElementById('preview-body');
const closeButton = document.querySelector('.close-button');
const markdownConverter = new showdown.Converter();

closeButton.onclick = () => { modal.style.display = "none"; };
window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

async function fetchAndDisplayNotes() {
    notesListContainer.innerHTML = `<p class="loading">Loading notes...</p>`;
    try {
        const response = await fetch(`${API_BASE_URL}/notes`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const notes = await response.json();
        updateStats(notes);
        displayNotes(notes);
    } catch (error) {
        console.error("Failed to fetch notes:", error);
        notesListContainer.innerHTML = `<p class="loading">❌ Could not load notes.</p>`;
    }
}

function updateStats(notes) {
    let rohanCount = 0; let malharCount = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const note of notes) {
        if (note.timestamp.slice(0, 10) === today) {
            if (note.shared_by.toLowerCase() === 'rohan') rohanCount++;
            else if (note.shared_by.toLowerCase() === 'malhar') malharCount++;
        }
    }
    rohanTodayEl.textContent = rohanCount; malharTodayEl.textContent = malharCount;
}

function displayNotes(notes) {
    notesListContainer.innerHTML = '';
    if (notes.length === 0) {
        notesListContainer.innerHTML = `<p class="loading">No notes shared yet.</p>`; return;
    }
    const groupedByDate = notes.reduce((acc, note) => {
        const date = new Date(note.timestamp).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(note);
        return acc;
    }, {});
    for (const date in groupedByDate) {
        const dateGroupDiv = document.createElement('div');
        dateGroupDiv.className = 'date-group';
        const dateHeader = document.createElement('h3');
        dateHeader.className = 'date-header';
        dateHeader.textContent = date;
        dateGroupDiv.appendChild(dateHeader);
        for (const note of groupedByDate[date]) {
            const noteItem = createNoteElement(note);
            dateGroupDiv.appendChild(noteItem);
        }
        notesListContainer.appendChild(dateGroupDiv);
    }
}

function createNoteElement(note) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'note-item';
    const formattedTime = new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Removed the <a href...> download button, added a new delete-btn
    itemDiv.innerHTML = `
        <div class="note-info">
            <p class="filename">${note.filename}</p>
            <p class="meta">Shared by <strong>${note.shared_by}</strong> at ${formattedTime}</p>
        </div>
        <div class="note-actions">
            <button class="copy-btn">Copy</button>
            <button class="preview-btn">Preview</button>
            <button class="delete-btn">Delete</button>
        </div>
    `;

    // Attach event listeners to the buttons
    itemDiv.querySelector('.preview-btn').addEventListener('click', () => showPreview(note));
    itemDiv.querySelector('.copy-btn').addEventListener('click', (event) => copyNoteContent(note, event.target));
    // NEW event listener for the delete button
    itemDiv.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note, itemDiv));
    
    return itemDiv;
}

async function showPreview(note) {
    modalTitle.textContent = note.filename;
    modalBody.innerHTML = '<p class="loading">Loading preview...</p>';
    modal.style.display = 'block';
    try {
        const response = await fetch(`${API_BASE_URL}/download/${note.filename}`);
        const markdownText = await response.text();
        const htmlContent = markdownConverter.makeHtml(markdownText);
        modalBody.innerHTML = htmlContent;
    } catch (error) {
        modalBody.innerHTML = '<p>Could not load preview.</p>';
    }
}

async function copyNoteContent(note, buttonElement) {
    try {
        const response = await fetch(`${API_A_BASE_URL}/download/${note.filename}`);
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

async function deleteNote(note, elementToRemove) {
    // Show a confirmation dialog before deleting
    if (!confirm(`Are you sure you want to permanently delete "${note.filename}"?`)) {
        return; // Stop if the user clicks "Cancel"
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notes/${note.filename}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Server responded with an error.');
        }

        // If successful, remove the note element from the page for instant feedback
        elementToRemove.style.transition = 'opacity 0.5s ease';
        elementToRemove.style.opacity = '0';
        setTimeout(() => elementToRemove.remove(), 500);

    } catch (err) {
        console.error('Failed to delete note: ', err);
        alert('Could not delete the note. Please try again.');
    }
}