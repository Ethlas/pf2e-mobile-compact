/**
 * Completely removes/hides chat input controls, forms, textareas ("Enter Message"),
 * and option dropdowns within the mobile chat view, dedicating the tab strictly
 * to roll card reviews and damage calculation buttons.
 * @param {HTMLElement} [chatEl]
 * @param {object} [sheet]
 */
export function disableChatInputs(chatEl, sheet) {
  const root = chatEl ?? sheet?.element?.querySelector(".mobile-chat-mount");
  if (!root) return;

  const targets = root.querySelectorAll(
    "#chat-controls, #chat-form, form, textarea, select, .chat-controls, .chat-form, .control-tools, header.chat-header, footer"
  );
  for (const el of targets) {
    if (el.closest("#chat-log, .chat-log, .message")) continue;

    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("height", "0px", "important");
    el.style.setProperty("min-height", "0px", "important");
    el.style.setProperty("max-height", "0px", "important");
    el.style.setProperty("margin", "0px", "important");
    el.style.setProperty("padding", "0px", "important");
    el.style.setProperty("border", "none", "important");
    el.style.setProperty("overflow", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT") {
      el.disabled = true;
      el.tabIndex = -1;
    }
  }

  const chatScroll = root.querySelector(".chat-scroll");
  if (chatScroll) {
    chatScroll.style.setProperty("flex", "1 1 100%", "important");
    chatScroll.style.setProperty("height", "100%", "important");
    chatScroll.style.setProperty("min-height", "0", "important");
    chatScroll.style.setProperty("max-height", "100%", "important");
    chatScroll.style.setProperty("width", "100%", "important");
    chatScroll.style.setProperty("overflow-y", "auto", "important");
    chatScroll.style.setProperty("overflow-x", "hidden", "important");
    chatScroll.style.setProperty("-webkit-overflow-scrolling", "touch", "important");
    chatScroll.style.setProperty("position", "relative", "important");
  }

  const chatLog = root.querySelector("#chat-log, .chat-log");
  if (chatLog) {
    chatLog.style.setProperty("display", "flex", "important");
    chatLog.style.setProperty("flex-direction", "column", "important");
    chatLog.style.setProperty("flex-wrap", "nowrap", "important");
    chatLog.style.setProperty("width", "100%", "important");
    chatLog.style.setProperty("max-width", "100%", "important");

    if (chatScroll) {
      chatLog.style.setProperty("flex", "1 1 auto", "important");
      chatLog.style.setProperty("height", "auto", "important");
      chatLog.style.setProperty("min-height", "100%", "important");
      chatLog.style.removeProperty("max-height");
      chatLog.style.setProperty("overflow-y", "visible", "important");
      chatLog.style.setProperty("overflow-x", "hidden", "important");
    } else {
      chatLog.style.setProperty("flex", "1 1 100%", "important");
      chatLog.style.setProperty("height", "100%", "important");
      chatLog.style.setProperty("max-height", "100%", "important");
      chatLog.style.setProperty("overflow-y", "auto", "important");
      chatLog.style.setProperty("overflow-x", "hidden", "important");
    }

    for (const msg of chatLog.children) {
      msg.style.setProperty("display", "flex", "important");
      msg.style.setProperty("flex-direction", "column", "important");
      msg.style.setProperty("width", "100%", "important");
      msg.style.setProperty("min-width", "100%", "important");
      msg.style.setProperty("max-width", "100%", "important");
      msg.style.setProperty("box-sizing", "border-box", "important");
      msg.style.setProperty("flex-shrink", "0", "important");
    }
  }
}

/**
 * Docks Foundry's ui.chat.element into the mobile sheet's chat mount point.
 * @param {object} sheet
 */
export function dockChatElement(sheet) {
  try {
    const mount = sheet.element?.querySelector(".mobile-chat-mount");
    const chatEl = (ui.chat?.element instanceof HTMLElement ? ui.chat.element : ui.chat?.element?.[0]) ?? document.getElementById("chat");
    if (!mount || !chatEl) return;

    if (!mount.contains(chatEl)) {
      if (!sheet._chatOriginalParent && chatEl.parentElement) {
        sheet._chatOriginalParent = chatEl.parentElement;
        sheet._chatOriginalNextSibling = chatEl.nextSibling;
      }
      mount.appendChild(chatEl);
    }

    disableChatInputs(chatEl, sheet);

    if (!chatEl._pf2eMobileInputObserver) {
      const observer = new MutationObserver(() => {
        disableChatInputs(chatEl, sheet);
      });
      observer.observe(chatEl, { childList: true, subtree: true });
      chatEl._pf2eMobileInputObserver = observer;
    }

    if (!mount._pf2eChatEventShield) {
      mount.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      mount._pf2eChatEventShield = true;
    }

    if (!chatEl._pf2eMobileDamageCapture) {
      chatEl.addEventListener("click", (event) => {
        const btn = event.target?.closest?.("button[data-action]");
        if (btn) {
          const action = btn.dataset.action;
          if (["apply-damage", "half-damage", "double-damage", "triple-damage", "apply-healing", "shield-block"].includes(action)) {
            sheet._ensureTokenControlled();
          }
        }
      }, { capture: true });
      chatEl._pf2eMobileDamageCapture = true;
    }
  } catch (err) {
    console.warn("pf2e-mobile-compact | Error docking chat element:", err);
  }
}

/**
 * Restores ui.chat.element back to its original parent upon sheet closure.
 * @param {object} sheet
 */
export function restoreChatElement(sheet) {
  try {
    const chatEl = (ui.chat?.element instanceof HTMLElement ? ui.chat.element : ui.chat?.element?.[0]) ?? document.getElementById("chat");
    if (!chatEl) return;
    if (chatEl._pf2eMobileInputObserver) {
      chatEl._pf2eMobileInputObserver.disconnect();
      chatEl._pf2eMobileInputObserver = null;
    }
    const scrollEl = chatEl.querySelector(".chat-scroll") ?? chatEl.querySelector("#chat-log, .chat-log");
    if (scrollEl?._pf2eScrollBottomHandler) {
      scrollEl.removeEventListener("scroll", scrollEl._pf2eScrollBottomHandler);
      scrollEl._pf2eScrollBottomHandler = null;
    }
    if (sheet._chatOriginalParent && sheet._chatOriginalParent.isConnected) {
      if (sheet._chatOriginalNextSibling && sheet._chatOriginalParent.contains(sheet._chatOriginalNextSibling)) {
        sheet._chatOriginalParent.insertBefore(chatEl, sheet._chatOriginalNextSibling);
      } else {
        sheet._chatOriginalParent.appendChild(chatEl);
      }
    }
  } catch (err) {
    console.warn("pf2e-mobile-compact | Error restoring chat element:", err);
  }
}

/**
 * Scrolls the mobile chat container to the newest/latest message.
 * @param {object} sheet
 * @param {boolean} [smooth=false]
 */
export function scrollChatToBottom(sheet, smooth = false) {
  const doScroll = (isSmooth) => {
    const mount = sheet.element?.querySelector(".mobile-chat-mount");
    if (!mount) return;

    const chatScroll = mount.querySelector(".chat-scroll");
    const chatLog = mount.querySelector("#chat-log, .chat-log");
    const lastMsg = chatLog?.lastElementChild;
    const behavior = isSmooth ? "smooth" : "instant";

    if (chatScroll) {
      chatScroll.scrollTo({
        top: chatScroll.scrollHeight + 10000,
        behavior
      });
    }

    if (chatLog && chatLog !== chatScroll) {
      chatLog.scrollTo({
        top: chatLog.scrollHeight + 10000,
        behavior
      });
    }

    if (lastMsg && typeof lastMsg.scrollIntoView === "function") {
      try {
        lastMsg.scrollIntoView({ block: "end", inline: "nearest", behavior });
      } catch {
        try {
          lastMsg.scrollIntoView(false);
        } catch {}
      }
    }

    try {
      ui.chat?.scrollBottom?.({ popout: false });
    } catch {}
  };

  doScroll(smooth);
  requestAnimationFrame(() => {
    doScroll(smooth);
    setTimeout(() => doScroll(false), 60);
    setTimeout(() => doScroll(false), 160);
  });
}

/**
 * Sets up a passive scroll listener on the chat container to toggle visibility
 * of the floating "Latest" jump button when scrolled away from bottom.
 * @param {object} sheet
 */
export function setupScrollBottomListener(sheet) {
  const mount = sheet.element?.querySelector(".mobile-chat-mount");
  const btn = sheet.element?.querySelector(".btn-scroll-bottom");
  if (!mount || !btn) return;

  const targets = Array.from(new Set([
    mount.querySelector(".chat-scroll"),
    mount.querySelector("#chat-log, .chat-log"),
    mount.querySelector("#chat")
  ].filter(Boolean)));

  if (targets.length === 0) return;

  const updateBtnVisibility = () => {
    const scrollable = targets.find(el => el.scrollHeight > el.clientHeight) ?? targets[0];
    const distanceFromBottom = scrollable.scrollHeight - scrollable.scrollTop - scrollable.clientHeight;
    if (distanceFromBottom > 80) {
      btn.classList.remove("is-hidden");
    } else {
      btn.classList.add("is-hidden");
    }
  };

  for (const target of targets) {
    if (target._pf2eScrollBottomHandler) {
      target.removeEventListener("scroll", target._pf2eScrollBottomHandler);
    }
    target._pf2eScrollBottomHandler = updateBtnVisibility;
    target.addEventListener("scroll", updateBtnVisibility, { passive: true });
  }

  if (!btn._pf2eScrollClickBound) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      scrollChatToBottom(sheet, true);
    });
    btn._pf2eScrollClickBound = true;
  }

  updateBtnVisibility();
  setTimeout(updateBtnVisibility, 100);
  setTimeout(updateBtnVisibility, 300);
}

/**
 * Listens for new chat messages to update unread badge or auto-scroll to bottom.
 * @param {object} sheet
 */
export function registerChatListener(sheet) {
  if (sheet._chatHookId !== null) return;
  sheet._chatHookId = Hooks.on("createChatMessage", () => {
    if (sheet.rendered) {
      if (sheet._activeTab !== "chat") {
        sheet._unreadChatCount++;
        updateChatBadge(sheet);
      } else {
        scrollChatToBottom(sheet, false);
      }
    }
  });
}

/**
 * Unregisters chat message hook.
 * @param {object} sheet
 */
export function unregisterChatListener(sheet) {
  if (sheet._chatHookId !== null) {
    Hooks.off("createChatMessage", sheet._chatHookId);
    sheet._chatHookId = null;
  }
}

/**
 * Synchronizes unread badge DOM in bottom navigation bar.
 * @param {object} sheet
 */
export function updateChatBadge(sheet) {
  const badge = sheet.element?.querySelector(".chat-badge");
  if (!badge) return;
  if (sheet._unreadChatCount > 0) {
    badge.textContent = sheet._unreadChatCount > 99 ? "99+" : String(sheet._unreadChatCount);
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "0";
    badge.classList.add("hidden");
  }
}

