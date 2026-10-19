import { shouldActivateMobile } from "../../utils/sheet-utils.js";

/** @type {HTMLElement|null} */
let originalParent = null;

/** @type {Node|null} */
let originalNextSibling = null;

/**
 * Docks Foundry's ui.chat.element into the mobile sheet's chat mount point.
 * Styling and hiding of chat inputs inside `.mobile-chat-mount` are handled by CSS (`styles/pf2e-mobile.css`).
 * @param {object} sheet
 */
export function dockChatElement(sheet) {
  try {
    if (!shouldActivateMobile()) return;

    const mount = sheet.element?.querySelector(".mobile-chat-mount");
    const chatEl = globalThis.ui?.chat?.element?.[0] ?? globalThis.ui?.chat?.element ?? document.getElementById("chat");
    if (!mount || !chatEl) return;

    if (!mount.contains(chatEl)) {
      if (chatEl.parentElement && !chatEl.parentElement.classList?.contains("mobile-chat-mount")) {
        originalParent = chatEl.parentElement;
        originalNextSibling = chatEl.nextSibling;
      }
      mount.appendChild(chatEl);
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
 * Restores ui.chat.element back to its original parent upon sheet closure,
 * or hands it to another open mobile sheet if still in mobile mode.
 * @param {object} [sheet]
 */
export function restoreChatElement(sheet) {
  try {
    const chatEl = globalThis.ui?.chat?.element?.[0] ?? globalThis.ui?.chat?.element ?? document.getElementById("chat");
    if (!chatEl) return;

    if (shouldActivateMobile() && sheet) {
      const otherSheet = Array.from(foundry.applications?.instances?.values?.() ?? [])
        .find(a => a !== sheet && a.rendered && a.element?.querySelector?.(".mobile-chat-mount"));
      if (otherSheet) {
        dockChatElement(otherSheet);
        return;
      }
    }

    const scrollEl = chatEl.querySelector?.(".chat-scroll") ?? chatEl.querySelector?.("#chat-log, .chat-log");
    if (scrollEl?._pf2eScrollBottomHandler) {
      scrollEl.removeEventListener("scroll", scrollEl._pf2eScrollBottomHandler);
      scrollEl._pf2eScrollBottomHandler = null;
    }

    if (originalParent?.isConnected) {
      if (originalNextSibling && originalParent.contains(originalNextSibling)) {
        originalParent.insertBefore(chatEl, originalNextSibling);
      } else {
        originalParent.appendChild(chatEl);
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
