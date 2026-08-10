import BASE_URL from "./config.js";

let pendingCartAction = null;
let leadModalLoadInProgress = false;

async function ensureLeadModalIsLoaded() {
    let modal = document.getElementById('leadModal');
    if (modal) return modal;

    const container = document.getElementById('lead-modal-container');
    if (!container) return null;

    if (leadModalLoadInProgress) return null;

    leadModalLoadInProgress = true;

    try {
        const response = await fetch('/lead.html');
        const html = await response.text();
        container.innerHTML = html;
        modal = document.getElementById('leadModal');
        return modal;
    } catch (err) {
        console.error('Lead modal load failed:', err);
        return null;
    } finally {
        leadModalLoadInProgress = false;
    }
}

// 1. OPEN & CLOSE MODAL FUNCTIONS
window.openLeadModal = async function(actionElement) {
    pendingCartAction = actionElement;
    let modal = document.getElementById('leadModal');

    if (!modal) {
        modal = await ensureLeadModalIsLoaded();
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
};

window.closeLeadModal = function() {
    const modal = document.getElementById('leadModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    pendingCartAction = null;
};

// 2. GLOBAL EVENT DELEGATION
document.addEventListener('click', (event) => {
    const isCloseBtn = event.target.closest('#closeLeadModal') || 
                       event.target.closest('.close-modal-btn') || 
                       event.target.innerText === '×' || 
                       event.target.textContent.trim() === '×';

    if (isCloseBtn) {
        event.preventDefault();
        event.stopPropagation();
        window.closeLeadModal();
        return;
    }

    const modal = document.getElementById('leadModal');
    if (modal && event.target === modal) {
        window.closeLeadModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        window.closeLeadModal();
    }
});

// 3. CART BUTTON HANDLER LOGIC
window.handleCartButtonClick = function(buttonElement) {
    const isLeadFilled = localStorage.getItem('leadFilled');
    
    if (isLeadFilled === 'true') {
        if (typeof window.toggleCartState === 'function') {
            window.toggleCartState(buttonElement);
        } else if (typeof toggleCartState === 'function') {
            toggleCartState(buttonElement);
        } else {
            console.error("Critical: toggleCartState handler missing on this layout viewport.");
        }
    } else {
        window.openLeadModal(buttonElement);
    }
};

// 4. LEAD FORM SUBMISSION (Only Name & Email)
window.handleLeadSubmit = async function(event) {
    event.preventDefault();
    
    const name = document.getElementById('leadName')?.value?.trim();
    const email = document.getElementById('leadEmail')?.value?.trim();

    if (!name || !email) {
        alert("Fill Name aur Email .");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/lead/newlead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('leadFilled', 'true');
            window.closeLeadModal();
            
            alert("Details verified successfully!");
            
            if (pendingCartAction) {
                if (typeof window.toggleCartState === 'function') {
                    window.toggleCartState(pendingCartAction);
                } else if (typeof toggleCartState === 'function') {
                    toggleCartState(pendingCartAction);
                }
            }
        } else {
            alert(data.error || "Please check the form fields.");
        }
    } catch (err) {
        console.error("Lead submission network error:", err);
        alert("Server validation processing failed.");
    }
};