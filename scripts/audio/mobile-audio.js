/**
 * PF2e Mobile Compact - Mobile Audio Management & Suppression Adapter.
 *
 * Implements strict, mobile-only audio suppression to prevent battery and cellular data drain,
 * and eliminate accidental audio playback during in-person sessions on mobile devices.
 * Completely isolates desktop clients so desktop playlist music, ambient sounds, dice rolls,
 * and volume sliders remain 100% unaffected.
 */
import { isMobileDevice } from "../utils/sheet-utils.js";

/**
 * Returns whether the current environment should activate mobile audio mode.
 * Respects the user's client-side "mobileActivationMode" setting.
 * @returns {boolean}
 */
export function shouldActivateMobileAudio() {
  try {
    if (typeof game !== "undefined" && game.settings) {
      const mode = game.settings.get("pf2e-mobile-compact", "mobileActivationMode");
      if (mode === "always") return true;
      if (mode === "never") return false;
    }
    return isMobileDevice();
  } catch {
    return isMobileDevice();
  }
}

/**
 * Returns whether the user has opted to mute audio on mobile devices.
 * Defaults to true (Audio Muted / Battery Saver) and persists across mobile sessions
 * via localStorage and Foundry client settings.
 * @returns {boolean}
 */
export function isMobileAudioDisabled() {
  try {
    const stored = localStorage.getItem("pf2e-mobile-compact.muteAudioMobile");
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("pf2e-mobile-compact.muteAudioMobile")) {
      return Boolean(game.settings.get("pf2e-mobile-compact", "muteAudioMobile"));
    }
  } catch {}
  return true;
}

/**
 * Returns whether audio should be suppressed right now for this client.
 * Returns true ONLY if the client is actively running in mobile mode AND the setting is enabled.
 * Returns false immediately for all desktop sessions.
 * @returns {boolean}
 */
export function isMobileAudioSuppressed() {
  if (!shouldActivateMobileAudio()) return false;
  return isMobileAudioDisabled();
}

/**
 * Updates and persists the user's mobile audio mute preference across sessions.
 * @param {boolean} disabled
 * @returns {Promise<boolean>}
 */
export async function setMobileAudioDisabled(disabled) {
  const nextState = Boolean(disabled);
  try {
    localStorage.setItem("pf2e-mobile-compact.muteAudioMobile", nextState ? "true" : "false");
  } catch {}
  try {
    if (game?.settings?.settings?.has?.("pf2e-mobile-compact.muteAudioMobile")) {
      await game.settings.set("pf2e-mobile-compact", "muteAudioMobile", nextState);
    }
  } catch {}
  if (shouldActivateMobileAudio()) {
    if (nextState) {
      applyMobileAudioSuppression();
    } else {
      restoreMobileAudioPlayback();
    }
  }
  return nextState;
}

/**
 * Helper to safely resolve the PlaylistSound document class across Foundry versions.
 * @returns {Function|null}
 */
function getPlaylistSoundClass() {
  return CONFIG.PlaylistSound?.documentClass
    ?? (typeof PlaylistSound !== "undefined" ? PlaylistSound : null)
    ?? foundry.documents?.BasePlaylistSound
    ?? null;
}

/**
 * Helper to safely resolve the AmbientSound object class across Foundry versions.
 * @returns {Function|null}
 */
function getAmbientSoundClass() {
  return CONFIG.AmbientSound?.objectClass
    ?? (typeof AmbientSound !== "undefined" ? AmbientSound : null);
}

/**
 * Helper to safely resolve the Sound class across Foundry versions.
 * @returns {Function|null}
 */
function getSoundClass() {
  return foundry.audio?.Sound
    ?? (typeof Sound !== "undefined" ? Sound : null);
}

/**
 * Helper to safely resolve the AudioHelper class across Foundry versions.
 * @returns {Function|null}
 */
function getAudioHelperClass() {
  return foundry.audio?.AudioHelper
    ?? (typeof AudioHelper !== "undefined" ? AudioHelper : null);
}

/**
 * Gathers all active Foundry AudioContext instances (main context and v12+ channels).
 * @returns {AudioContext[]}
 */
export function getAudioContexts() {
  const contexts = new Set();
  try {
    if (typeof game !== "undefined" && game?.audio) {
      if (game.audio.context) contexts.add(game.audio.context);
      if (game.audio.music) contexts.add(game.audio.music);
      if (game.audio.environment) contexts.add(game.audio.environment);
      if (game.audio.interface) contexts.add(game.audio.interface);
    }
    const helperClass = getAudioHelperClass();
    if (helperClass?.context) contexts.add(helperClass.context);
  } catch (err) {
    console.warn("PF2e Mobile Compact | getAudioContexts error:", err);
  }
  return Array.from(contexts).filter(c => c && typeof c.suspend === "function");
}

/**
 * Suspends Web Audio hardware contexts on mobile to power down device DACs and save battery.
 */
export function suspendAudioContexts() {
  for (const ctx of getAudioContexts()) {
    try {
      if (ctx.state === "running") {
        ctx.suspend().catch(() => {});
      }
    } catch {}
  }
}

/**
 * Resumes Web Audio hardware contexts when audio is unmuted or returning to desktop.
 */
export function resumeAudioContexts() {
  for (const ctx of getAudioContexts()) {
    try {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch {}
  }
}

/**
 * Stops all currently active sounds locally without updating server documents or affecting other users.
 */
export function stopActiveSounds() {
  // 1. Stop individual Sound instances tracked by game.audio
  try {
    if (game.audio?.playing) {
      const sounds = game.audio.playing instanceof Map || typeof game.audio.playing.values === "function"
        ? Array.from(game.audio.playing.values())
        : (Array.isArray(game.audio.playing) ? game.audio.playing : []);
      for (const sound of sounds) {
        try { sound?.stop?.(); } catch {}
      }
    }
  } catch {}

  // 2. Stop playing sounds on playlists locally (sound.sound.stop() - never playlist.stopSound/stopAll!)
  try {
    for (const playlist of game.playlists ?? []) {
      for (const sound of playlist.sounds ?? []) {
        if (sound.sound?.playing) {
          try { sound.sound.stop(); } catch {}
        }
      }
    }
  } catch {}

  // 3. Stop playing ambient sounds on canvas
  try {
    const placeables = canvas?.sounds?.placeables ?? [];
    for (const ambient of placeables) {
      if (ambient.sound?.playing) {
        try { ambient.sound.stop(); } catch {}
      }
    }
  } catch {}

  // 4. Clear pending sound requests accumulated before user gesture
  try {
    if (Array.isArray(game.audio?.pending)) {
      game.audio.pending.length = 0;
    }
  } catch {}
}

/**
 * Applies full mobile audio suppression: stops running tracks and suspends hardware audio contexts.
 */
export function applyMobileAudioSuppression() {
  if (!isMobileAudioSuppressed()) return;
  console.log("PF2e Mobile Compact | Suppressing mobile audio playback for battery & data preservation.");
  stopActiveSounds();
  suspendAudioContexts();
}

/**
 * Restores audio playback on desktop or when mobile user enables audio.
 */
export function restoreMobileAudioPlayback() {
  console.log("PF2e Mobile Compact | Restoring audio playback.");
  resumeAudioContexts();

  // Re-synchronize currently playing playlists on server
  try {
    for (const playlist of game.playlists ?? []) {
      if (playlist.playing) {
        for (const sound of playlist.sounds ?? []) {
          if (sound.playing && typeof sound.sync === "function") {
            try { sound.sync(); } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | restoreMobileAudioPlayback playlist sync error:", err);
  }

  // Re-synchronize canvas ambient sounds
  try {
    const placeables = canvas?.sounds?.placeables ?? [];
    for (const ambient of placeables) {
      if (typeof ambient.sync === "function") {
        try { ambient.sync(ambient.isAudible, ambient.volume); } catch {}
      }
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | restoreMobileAudioPlayback ambient sync error:", err);
  }
}

/**
 * Patches core Foundry audio methods once with strict mobile-only guards.
 * On desktop (isMobileAudioSuppressed() === false), delegates 100% to native Foundry implementation.
 */
export function patchAudioMethods() {
  // 1. Guard PlaylistSound.prototype.sync to prevent fetching/streaming tracks
  try {
    const PlaylistSoundClass = getPlaylistSoundClass();
    const proto = PlaylistSoundClass?.prototype;
    if (proto && !proto._pf2eMobileAudioPatched && typeof proto.sync === "function") {
      proto._pf2eMobileAudioPatched = true;
      const origSync = proto.sync;
      proto.sync = function (...args) {
        if (isMobileAudioSuppressed()) {
          if (this.sound?.playing) {
            try { this.sound.stop(); } catch {}
          }
          return;
        }
        return origSync.apply(this, args);
      };
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Failed to patch PlaylistSound.sync:", err);
  }

  // 2. Guard AmbientSound.prototype.sync
  try {
    const AmbientSoundClass = getAmbientSoundClass();
    const proto = AmbientSoundClass?.prototype;
    if (proto && !proto._pf2eMobileAudioPatched && typeof proto.sync === "function") {
      proto._pf2eMobileAudioPatched = true;
      const origAmbientSync = proto.sync;
      proto.sync = function (...args) {
        if (isMobileAudioSuppressed()) {
          if (this.sound?.playing) {
            try { this.sound.stop(); } catch {}
          }
          return;
        }
        return origAmbientSync.apply(this, args);
      };
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Failed to patch AmbientSound.sync:", err);
  }

  // 3. Guard foundry.audio.Sound.prototype.play
  try {
    const SoundClass = getSoundClass();
    const proto = SoundClass?.prototype;
    if (proto && !proto._pf2eMobileAudioPatched && typeof proto.play === "function") {
      proto._pf2eMobileAudioPatched = true;
      const origPlay = proto.play;
      proto.play = async function (...args) {
        if (isMobileAudioSuppressed()) {
          return this;
        }
        return origPlay.apply(this, args);
      };
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Failed to patch Sound.prototype.play:", err);
  }

  // 4. Guard AudioHelper.play
  try {
    const AudioHelperClass = getAudioHelperClass();
    if (AudioHelperClass && !AudioHelperClass._pf2eMobileAudioPatched && typeof AudioHelperClass.play === "function") {
      AudioHelperClass._pf2eMobileAudioPatched = true;
      const origHelperPlay = AudioHelperClass.play;
      AudioHelperClass.play = function (data, push, ...rest) {
        if (isMobileAudioSuppressed()) {
          if (push) {
            // GM/user triggered broadcast: keep socket broadcast to other clients, but skip local audio
            return origHelperPlay.call(this, data, push, ...rest);
          }
          return null;
        }
        return origHelperPlay.call(this, data, push, ...rest);
      };
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Failed to patch AudioHelper.play:", err);
  }

  // 5. Guard AudioContext.prototype.resume so click/gesture unlock listeners don't wake mobile DAC
  try {
    if (typeof AudioContext !== "undefined" && AudioContext.prototype && !AudioContext.prototype._pf2eMobileAudioPatched) {
      AudioContext.prototype._pf2eMobileAudioPatched = true;
      const origResume = AudioContext.prototype.resume;
      AudioContext.prototype.resume = async function (...args) {
        if (isMobileAudioSuppressed()) {
          return;
        }
        return origResume.apply(this, args);
      };
    }
  } catch (err) {
    console.warn("PF2e Mobile Compact | Failed to patch AudioContext.prototype.resume:", err);
  }
}
