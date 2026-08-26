(function () {
    let isChatOpen = false;
    let isWaitingForResponse = false;
    function getApiBaseUrl() {
        if (typeof window.BASE_URL !== "undefined" && window.BASE_URL) {
            return window.BASE_URL;
        }
        const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
        return isLocal ? "http://localhost:5000" : "";
    }
    window.toggleAloraChat = function () {
        const modal = document.getElementById("alora-chat-modal");
        const iconOpen = document.getElementById("alora-chat-icon-open");
        const iconClose = document.getElementById("alora-chat-icon-close");
        const badge = document.getElementById("alora-chat-badge");
        const input = document.getElementById("alora-chat-input");
        if (!modal) return;
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            modal.classList.remove("hidden");
            setTimeout(() => {
                modal.classList.remove("scale-95", "opacity-0");
                modal.classList.add("scale-100", "opacity-100", "flex");
            }, 10);
            if (iconOpen) iconOpen.classList.add("hidden");
            if (iconClose) iconClose.classList.remove("hidden");
            if (badge) badge.classList.add("hidden");
            if (input) input.focus();
            scrollToBottom();
        } else {
            modal.classList.remove("scale-100", "opacity-100");
            modal.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                modal.classList.add("hidden");
                modal.classList.remove("flex");
            }, 200);
            if (iconOpen) iconOpen.classList.remove("hidden");
            if (iconClose) iconClose.classList.add("hidden");
        }
    };
    function scrollToBottom() {
        const container = document.getElementById("alora-chat-messages");
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    function formatMessageText(text) {
        if (!text) return "";
        let formatted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-amber-100 text-amber-900 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-[#8B4513] font-semibold underline hover:text-amber-800">$1</a>');
        formatted = formatted.replace(/(?:^|\n)[•-]\s*(.*?)(?=\n|$)/g, '<li class="ml-3 list-disc text-slate-700 my-0.5">$1</li>');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }
    function appendUserMessage(text) {
        const container = document.getElementById("alora-chat-messages");
        if (!container) return;
        const msgDiv = document.createElement("div");
        msgDiv.className = "flex items-end justify-end space-x-2 animate-fadeIn";
        msgDiv.innerHTML = `
            <div class="bg-gradient-to-r from-[#8B4513] to-[#A0522D] text-white p-3 rounded-2xl rounded-br-none shadow-sm max-w-[85%] text-xs sm:text-sm">
                ${formatMessageText(text)}
            </div>
        `;
        container.appendChild(msgDiv);
        scrollToBottom();
    }
    function appendAssistantMessage(htmlContent, products = []) {
        const container = document.getElementById("alora-chat-messages");
        if (!container) return;
        const msgDiv = document.createElement("div");
        msgDiv.className = "flex items-start space-x-2.5 animate-fadeIn";
        let productCardsHtml = "";
        if (products && products.length > 0) {
            productCardsHtml = `
                <div class="mt-2.5 space-y-2">
                    ${products.map(p => {
                        const isFile = location.protocol === "file:";
                        const pUrl = isFile ? `./product.html?id=${p.id}` : (p.slug ? `/product/${p.slug}` : `/product.html?id=${p.id}`);
                        const img = p.imagepath || '/static/images/placeholder.jpg';
                        return `
                            <div class="flex items-center space-x-3 bg-white p-2 border border-amber-900/15 rounded-xl shadow-2xs hover:shadow-md transition-all">
                                <img src="${img}" alt="${p.name}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-slate-100">
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-xs font-bold text-slate-800 truncate">${p.name}</h4>
                                    <p class="text-[11px] text-amber-900 font-semibold mt-0.5">₹${p.price} ${p.comparePrice ? `<span class="line-through text-slate-400 font-normal text-[10px] ml-1">₹${p.comparePrice}</span>` : ''}</p>
                                </div>
                                <a href="${pUrl}" class="px-2.5 py-1 text-[11px] bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#70360D] transition-colors flex-shrink-0">
                                    View
                                </a>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        }
        msgDiv.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-[#8B4513] text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                ✨
            </div>
            <div class="bg-white border border-amber-900/10 p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] text-xs sm:text-sm text-slate-800 leading-relaxed">
                <div>${htmlContent}</div>
                ${productCardsHtml}
            </div>
        `;
        container.appendChild(msgDiv);
        scrollToBottom();
    }
    function showTypingIndicator() {
        const container = document.getElementById("alora-chat-messages");
        if (!container) return null;
        const typingDiv = document.createElement("div");
        typingDiv.id = "alora-chat-typing";
        typingDiv.className = "flex items-start space-x-2.5 animate-pulse";
        typingDiv.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-[#8B4513] text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                ✨
            </div>
            <div class="bg-white border border-amber-900/10 px-3.5 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-1.5 text-slate-400">
                <span class="w-1.5 h-1.5 bg-amber-700 rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-amber-700 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span class="w-1.5 h-1.5 bg-amber-700 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
        `;
        container.appendChild(typingDiv);
        scrollToBottom();
        return typingDiv;
    }
    function removeTypingIndicator() {
        const typingDiv = document.getElementById("alora-chat-typing");
        if (typingDiv) typingDiv.remove();
    }
    window.sendAloraQuickQuery = function (queryText) {
        if (isWaitingForResponse) return;
        const input = document.getElementById("alora-chat-input");
        if (input) input.value = queryText;
        window.handleAloraChatSubmit(new Event('submit'));
    };
    window.handleAloraChatSubmit = async function (e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById("alora-chat-input");
        const sendBtn = document.getElementById("alora-chat-send-btn");
        if (!input) return;
        const userMsg = input.value.trim();
        if (!userMsg || isWaitingForResponse) return;
        input.value = "";
        isWaitingForResponse = true;
        if (sendBtn) sendBtn.disabled = true;
        appendUserMessage(userMsg);
        showTypingIndicator();
        try {
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}/api/chatbot/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg })
            });
            removeTypingIndicator();
            if (!response.ok) {
                appendAssistantMessage("⚠️ Sorry, I'm having trouble connecting to the server. Please try again shortly.");
                return;
            }
            const data = await response.json();
            if (data && data.reply) {
                appendAssistantMessage(formatMessageText(data.reply), data.products || []);
            } else {
                appendAssistantMessage("Thank you for your message. How else can I assist you with Alora Radiance?");
            }
        } catch (err) {
            console.error("Alora Chatbot fetch error:", err);
            removeTypingIndicator();
            appendAssistantMessage("⚠️ Network issue detected. Please check your internet connection and try again.");
        } finally {
            isWaitingForResponse = false;
            if (sendBtn) sendBtn.disabled = false;
            if (input) input.focus();
        }
    };
    window.clearAloraChat = function () {
        const container = document.getElementById("alora-chat-messages");
        if (!container) return;
        container.innerHTML = `
            <div class="flex items-start space-x-2.5">
                <div class="w-7 h-7 rounded-full bg-[#8B4513] text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                    ✨
                </div>
                <div class="bg-white border border-amber-900/10 p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] space-y-2">
                    <p class="text-slate-700 leading-relaxed">
                        Chat cleared! 🙏 How can I help you today?
                    </p>
                </div>
            </div>
        `;
    };
})();