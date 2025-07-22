const API_BASE_URL = 'https://project-nexus-c0v8.onrender.com';

// --- Get elements from the HTML ---
const notesListContainer = document.getElementById('notes-list-container');
const rohanTodayEl = document.getElementById('rohan-today');
const malharTodayEl = document.getElementById('malhar-today');
const modal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('preview-title');
const modalBody = document.getElementById('preview-body');
const closeButton = document.querySelector('.close-button');

// --- Create a Markdown converter ---
const markdownConverter = new showdown.Converter();

// --- Main function to run when the page loads ---
document.addEventListener('DOMContentLoaded', fetchAndDisplayNotes);

// --- Handle clicks on the modal ---
closeButton.onclick = () => { modal.style.display = "none"; };
window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

// --- Core Functions ---

/**
 * Fetches notes from our API and displays them.
 */
async function fetchAndDisplayNotes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/notes`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const notes = await response.json();
        updateStats(notes);
        displayNotes(notes);
    } catch (error) {
        console.error("Failed to fetch notes:", error);
        notesListContainer.innerHTML = `<p class="loading">❌ Could not load notes. Check the API URL.</p>`;
    }
}

/**
 * Updates the 'Rohan' and 'Malhar' daily stats.
 */
function updateStats(notes) {
    let rohanCount = 0;
    let malharCount = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const note of notes) {
        if (note.timestamp.slice(0, 10) === today) {
            if (note.shared_by.toLowerCase() === 'rohan') rohanCount++;
            else if (note.shared_by.toLowerCase() === 'malhar') malharCount++;
        }
    }
    rohanTodayEl.textContent = rohanCount;
    malharTodayEl.textContent = malharCount;
}

/**
 * Groups notes by date and shows them on the page.
 */
function displayNotes(notes) {
    notesListContainer.innerHTML = '';
    if (notes.length === 0) {
        notesListContainer.innerHTML = `<p class="loading">No notes shared yet. Try uploading one!</p>`;
        return;
    }

    const groupedByDate = notes.reduce((acc, note) => {
        const date = new Date(note.timestamp).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
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

/**
 * Creates the HTML for a single note item.
 */
function createNoteElement(note) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'note-item';
    const formattedTime = new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    itemDiv.innerHTML = `
        <div class="note-info">
            <p class="filename">${note.filename}</p>
            <p class="meta">Shared by <strong>${note.shared_by}</strong> at ${formattedTime}</p>
        </div>
        <div class="note-actions">
            <button class="preview-btn">Preview</button>
            <a href="${API_BASE_URL}/api/download/${note.filename}" target="_blank">
                <button>Download</button>
            </a>
        </div>
    `;

    itemDiv.querySelector('.preview-btn').addEventListener('click', () => showPreview(note));
    return itemDiv;
}

/**

 * Shows the preview modal with the note's content.
 */
async function showPreview(note) {
    modalTitle.textContent = note.filename;
    modalBody.innerHTML = '<p class="loading">Loading preview...</p>';
    modal.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE_URL}/api/download/${note.filename}`);
        const markdownText = await response.text();
        const htmlContent = markdownConverter.makeHtml(markdownText);
        modalBody.innerHTML = htmlContent;
    } catch (error) {
        modalBody.innerHTML = '<p>Could not load preview.</p>';
    }
}