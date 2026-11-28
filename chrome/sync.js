'use strict';

window.VaayvuSync = (() => {
  const storageKey = 'vaayvu.sync.session.v1';
  const validUsername = (name) => typeof name === 'string' && /^[a-z0-9._-]{3,48}$/.test(name);
  const validToken = (token) => typeof token === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(token);
  let session = null;
  let authRevision = 0;
  let networkEnabled = false;
  const activeRequests = new Set();
  function allowNetwork(enabled) {
    networkEnabled = enabled === true;
    if (!networkEnabled) {
      ++authRevision;
      for (const request of activeRequests) request.abort();
    }
  }
  function loadSession() {
    session = null;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = JSON.parse(raw);
      if (
        saved &&
        typeof saved.origin === 'string' &&
        VaayvuCore.serverOrigin(saved.origin) === saved.origin &&
        saved.origin &&
        validUsername(saved.username) &&
        validToken(saved.token)
      ) {
        session = Object.freeze({ origin: saved.origin, username: saved.username, token: saved.token });
      }
    } catch {
      /* Invalid or unavailable storage starts a local session. */
    }
  }
  loadSession();
  window.addEventListener?.('storage', (event) => {
    if (event.key === storageKey) {
      ++authRevision;
      loadSession();
    }
  });

  async function request(origin, path, body, token, timeout = 20000) {
    if (!networkEnabled) throw Error('Sync is paused in India-only browsing.');
    const controller = new AbortController();
    activeRequests.add(controller);
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    let data;
    try {
      response = await fetch(origin + '/v1/' + path, {
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      data = await response.json();
    } catch {
      if (controller.signal.aborted) throw Error('The server took too long to respond. Try again.');
      if (response) throw Error('The address did not return a Vaayvu Sync response.');
      throw Error('Could not reach the sync server. Check its address and your connection.');
    } finally {
      activeRequests.delete(controller);
      clearTimeout(timer);
    }
    if (!response.ok)
      throw Error(
        typeof data?.error === 'string'
          ? data.error.slice(0, 400)
          : 'The sync server could not complete this request.',
      );
    return data;
  }

  async function authenticate(address, username, password, register = false) {
    const origin = typeof address === 'string' && VaayvuCore.serverOrigin(address);
    if (!origin)
      throw Error(
        'Enter the HTTPS address of your sync server, or a loopback HTTP address for local testing.',
      );
    const revision = ++authRevision;
    const data = await request(origin, register ? 'register' : 'login', { username, password });
    if (!validUsername(data?.username) || !validToken(data?.token))
      throw Error('The server returned an invalid session.');
    const next = Object.freeze({ origin, username: data.username, token: data.token });
    if (revision !== authRevision) {
      await request(origin, 'logout', {}, next.token).catch(() => {});
      throw Error('A newer sign-in replaced this request.');
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      await request(origin, 'logout', {}, next.token).catch(() => {});
      throw Error('Vaayvu could not save the session on this device.');
    }
    const previous = session;
    session = next;
    if (previous) request(previous.origin, 'logout', {}, previous.token).catch(() => {});
    return next;
  }

  async function logout() {
    ++authRevision;
    const previous = session;
    vaayvuStoreRemove('sync.session.v1');
    session = null;
    if (previous) await request(previous.origin, 'logout', {}, previous.token);
  }

  async function signedRequest(path, body, timeout) {
    const current = session;
    if (!current) throw Error('Sign in to your sync server first.');
    const data = await request(current.origin, path, body, current.token, timeout);
    if (session !== current) throw Error('Your sync account changed during the request.');
    return data;
  }

  return {
    get session() {
      return session;
    },
    get profileKey() {
      return session ? session.origin + '/' + session.username : 'local';
    },
    allowNetwork,
    authenticate,
    logout,
    sendPage(from, to, page) {
      if (VaayvuCore.providerQuery(page?.url)) return Promise.reject(Error('Search pages stay on this device.'));
      return signedRequest('send', { from, to, page });
    },
    dismissPage(device, id) {
      return signedRequest('dismiss', { device, id });
    },
    async exchange(bookmarks, device) {
      const data = await signedRequest('sync', { bookmarks, device });
      if (!Array.isArray(data?.bookmarks) || !Array.isArray(data?.devices))
        throw Error('The sync server returned an invalid snapshot.');
      return data;
    },
    async ask(question, text) {
      const data = await signedRequest('ask', { question, text }, 130000);
      if (typeof data?.answer !== 'string' || !data.answer.trim())
        throw Error('The model returned an empty answer.');
      return data.answer;
    },
  };
})();
