(() => {
  'use strict';
  const STORAGE_KEY = 'moviehub-progress-v1';
  const $ = id => document.getElementById(id);
  const bodyMethods = new Set(['POST', 'PATCH', 'PUT']);
  let stages = [];
  let state;
  let busy = false;
  let rowId = 0;
  const drafts = new Map();
  const responses = new Map();

  function freshState() {
    return { version: 1, currentStage: 1, completedStageIds: [], stageAttempts: {}, incorrectAttempts: {}, earnedPoints: {}, score: 0 };
  }

  function showMessage(message, kind = '') {
    $('app-message').textContent = message;
    $('app-message').className = `notice ${kind}`;
    $('app-message').hidden = !message;
  }

  function storageWarning() {
    $('storage-notice').textContent = 'Browser storage is unavailable. You can still play, but progress will last only for this page visit.';
    $('storage-notice').hidden = false;
  }

  function readState() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch { storageWarning(); return freshState(); }
    if (!saved || saved.version !== 1) return freshState();
    const clean = freshState();
    // Sanitize local storage. It tracks UI progress; it never validates a request.
    for (const stage of stages) {
      const attempts = saved.stageAttempts?.[stage.id];
      const incorrect = saved.incorrectAttempts?.[stage.id];
      clean.stageAttempts[stage.id] = Number.isSafeInteger(attempts) && attempts >= 0 ? attempts : 0;
      clean.incorrectAttempts[stage.id] = Number.isSafeInteger(incorrect) && incorrect >= 0 ? Math.min(incorrect, clean.stageAttempts[stage.id]) : 0;
    }
    for (const stage of stages) {
      if (!Array.isArray(saved.completedStageIds) || !saved.completedStageIds.includes(stage.id)) break;
      clean.completedStageIds.push(stage.id);
      clean.earnedPoints[stage.id] = Math.max(50, 100 - 10 * clean.incorrectAttempts[stage.id]);
    }
    clean.score = Object.values(clean.earnedPoints).reduce((sum, points) => sum + points, 0);
    const unlocked = Math.min(stages.length, clean.completedStageIds.length + 1);
    clean.currentStage = Number.isInteger(saved.currentStage) && saved.currentStage >= 1 && saved.currentStage <= unlocked ? saved.currentStage : unlocked;
    return clean;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { storageWarning(); }
  }

  function isComplete(id = state.currentStage) { return state.completedStageIds.includes(id); }
  function pointsAvailable() { return Math.max(50, 100 - 10 * (state.incorrectAttempts[state.currentStage] || 0)); }

  function renderProgress() {
    const complete = isComplete();
    const count = state.completedStageIds.length;
    $('stage-label').replaceChildren(document.createTextNode(`Stage ${state.currentStage} `));
    const total = document.createElement('span');
    total.textContent = `of ${stages.length}`;
    $('stage-label').append(total);
    $('progress-bar').max = stages.length;
    $('progress-bar').value = count;
    $('completed-count').textContent = `${count} of ${stages.length} completed`;
    $('score').textContent = state.score;
    $('total-attempts').textContent = Object.values(state.stageAttempts).reduce((sum, attempts) => sum + attempts, 0);
    const attempts = state.stageAttempts[state.currentStage] || 0;
    $('stage-attempts').textContent = `${attempts} attempt${attempts === 1 ? '' : 's'} this stage`;
    $('points-available').textContent = complete ? `${state.earnedPoints[state.currentStage]} points earned` : `${pointsAvailable()} points available`;
    $('challenge-state').textContent = complete ? '✓ Completed' : 'Ready when you are';
    $('challenge-state').className = `pill${complete ? ' success' : ''}`;
    $('request-fields').disabled = busy || complete;
    $('request-body').disabled = !bodyMethods.has($('method').value);
    $('reset-button').disabled = busy;
    $('previous-button').disabled = busy || state.currentStage <= 1 || !isComplete(state.currentStage - 1);
    $('next-button').disabled = busy || !complete || state.currentStage === stages.length;
    $('send-button').textContent = busy ? 'Sending…' : complete ? 'Stage completed ✓' : 'Send request →';
    $('navigation-note').textContent = complete ? 'Challenge complete. Keep the reel rolling.' : 'Complete this challenge to continue.';
    $('completion').hidden = count !== stages.length;
    $('final-score').textContent = `${state.score} / ${stages.length * 100}`;
    $('stage-list').replaceChildren();
    for (const stage of stages) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `stage-item${isComplete(stage.id) ? ' complete' : ''}`;
      button.disabled = busy || stage.id > count + 1;
      button.setAttribute('aria-label', `Stage ${stage.id}: ${stage.title}${isComplete(stage.id) ? ', completed' : ''}`);
      if (stage.id === state.currentStage) button.setAttribute('aria-current', 'step');
      const number = document.createElement('span');
      number.className = 'stage-number';
      number.textContent = isComplete(stage.id) ? '✓' : String(stage.id).padStart(2, '0');
      const title = document.createElement('span');
      title.className = 'stage-name';
      title.textContent = stage.title;
      button.append(number, title);
      if (stage.id === state.currentStage) {
        const arrow = document.createElement('span');
        arrow.className = 'stage-arrow';
        arrow.textContent = '›';
        button.append(arrow);
      }
      button.addEventListener('click', () => goToStage(stage.id));
      li.append(button);
      $('stage-list').append(li);
    }
  }

  function addRow(kind, key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'parameter-row';
    const identifier = ++rowId;
    for (const [name, initial] of [['key', key], ['value', value]]) {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = `${kind}-${name}-${identifier}`;
      input.setAttribute('aria-label', `${kind === 'route' ? 'Route' : 'Query'} parameter ${name}`);
      input.placeholder = name === 'key' ? 'Key' : 'Value';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.maxLength = 500;
      input.value = initial;
      row.append(input);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-row';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${kind} parameter row`);
    remove.addEventListener('click', () => { row.remove(); $(`add-${kind}`).focus(); });
    row.append(remove);
    $(`${kind}-rows`).append(row);
    return row;
  }

  function rawRows(kind) {
    return [...$(`${kind}-rows`).children].map(row => [...row.querySelectorAll('input')].map(input => input.value));
  }

  function readRows(kind) {
    const params = new Map();
    for (const [rawKey, value] of rawRows(kind)) {
      const key = rawKey.trim();
      if (!key && !value) continue;
      if (!key || !value.trim()) throw new Error(`Each ${kind} parameter needs both a key and a value.`);
      if (params.has(key)) throw new Error(`The ${kind} parameter “${key}” is repeated.`);
      params.set(key, value);
    }
    return params;
  }

  function captureDraft() {
    drafts.set(state.currentStage, { method: $('method').value, path: $('path').value, body: $('request-body').value, route: rawRows('route'), query: rawRows('query') });
  }

  function renderStage() {
    const stage = stages.find(item => item.id === state.currentStage);
    $('challenge-number').textContent = `CHALLENGE ${String(stage.id).padStart(2, '0')}`;
    $('challenge-title').textContent = stage.title;
    $('challenge-description').textContent = stage.description;
    const draft = drafts.get(stage.id) || { method: 'GET', path: '', body: '', route: [['', '']], query: [['', '']] };
    $('method').value = draft.method;
    $('path').value = draft.path;
    $('request-body').value = draft.body;
    for (const kind of ['route', 'query']) {
      $(`${kind}-rows`).replaceChildren();
      for (const [key, value] of draft[kind]) addRow(kind, key, value);
    }
    const response = responses.get(stage.id);
    if (response) renderResponse(response);
    else {
      $('response-empty').hidden = false;
      $('response-detail').hidden = true;
      $('response-status').textContent = isComplete() ? 'Completed stage' : 'Awaiting request';
      $('response-status').className = 'pill neutral';
    }
    renderProgress();
  }

  function goToStage(id) {
    if (busy || id < 1 || id > stages.length || id > state.completedStageIds.length + 1 || id === state.currentStage) return;
    captureDraft();
    state.currentStage = id;
    saveState();
    showMessage('');
    renderStage();
  }

  function constructRequest() {
    const method = $('method').value;
    let path = $('path').value.trim();
    if (!path.startsWith('/api/') || /[\\#\s]/.test(path)) throw new Error('Use a local path starting with /api/, without spaces, backslashes or a fragment.');
    if (path.split('?')[0].startsWith('/api/game')) throw new Error('Use the movie or review resources in the request builder.');
    const route = readRows('route');
    const used = new Set();
    const [pathname, ...queryParts] = path.split('?');
    const resolvedPath = pathname.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => {
      if (!route.has(key)) throw new Error(`Add a value for the route parameter “${key}”.`);
      used.add(key);
      return encodeURIComponent(route.get(key));
    });
    if ([...route.keys()].some(key => !used.has(key))) throw new Error('A route parameter does not have a matching placeholder in the path.');
    if (resolvedPath.includes(':')) throw new Error('Route placeholders must have a name, such as :id.');
    const url = new URL(resolvedPath, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/game')) throw new Error('The request must target this application’s movie or review API.');
    const query = new URLSearchParams(queryParts.join('?'));
    const seen = new Set();
    for (const key of query.keys()) {
      if (seen.has(key)) throw new Error(`The query parameter “${key}” is repeated.`);
      seen.add(key);
    }
    for (const [key, value] of readRows('query')) {
      if (query.has(key)) throw new Error(`The query parameter “${key}” is already in the path.`);
      query.append(key, value);
    }
    url.search = query.toString();
    const options = { method, headers: { 'X-Stage-Id': String(state.currentStage), Accept: 'application/json' } };
    if (bodyMethods.has(method)) {
      let body;
      try { body = JSON.parse($('request-body').value); }
      catch { throw new Error('The request body is not valid JSON. Check quotes, commas and brackets.'); }
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return { url, options };
  }

  function renderResponse(result) {
    $('response-empty').hidden = true;
    $('response-detail').hidden = false;
    $('response-url').textContent = result.url;
    $('response-time').textContent = result.time;
    $('response-status').textContent = result.status;
    $('response-status').className = `pill ${result.kind}`;
    $('response-feedback').textContent = result.feedback;
    $('response-feedback').className = `response-feedback ${result.kind}`;
    $('response-body').textContent = result.body;
  }

  async function sendRequest(event) {
    event.preventDefault();
    if (busy || !state || isComplete()) return;
    showMessage('');
    let request;
    try { request = constructRequest(); }
    catch (error) { showMessage(`${error.message} No request was sent; your score is unchanged.`, 'error'); return; }
    busy = true;
    captureDraft();
    const stageId = state.currentStage;
    const start = performance.now();
    state.stageAttempts[stageId] = (state.stageAttempts[stageId] || 0) + 1;
    saveState();
    renderProgress();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let result;
    try {
      const response = await fetch(request.url, { ...request.options, signal: controller.signal });
      const raw = await response.text();
      let body = raw || '(No response body)';
      if (raw) {
        try { body = JSON.stringify(JSON.parse(raw), null, 2); }
        catch { body = `Non-JSON response:\n${raw}`; }
      }
      // Only the server decides correctness, including for intentional HTTP errors.
      const correct = response.headers.get('X-Stage-Correct') === 'true';
      if (correct) {
        state.completedStageIds.push(stageId);
        state.earnedPoints[stageId] = pointsAvailable();
        state.score += state.earnedPoints[stageId];
      } else if (response.status < 500) {
        state.incorrectAttempts[stageId] = (state.incorrectAttempts[stageId] || 0) + 1;
      }
      result = {
        url: `${request.options.method} ${request.url.href}`,
        time: `${Math.round(performance.now() - start)} ms`,
        status: `${response.status} ${response.statusText}`.trim(),
        body,
        kind: correct ? 'success' : response.status >= 500 ? 'warning' : 'error',
        feedback: correct
          ? `Stage complete! +${state.earnedPoints[stageId]} points.${response.ok ? ' The server confirmed your request.' : ' The server confirmed your request; the HTTP error is the API’s actual response.'}`
          : response.status >= 500
            ? 'The server could not process the request. No score penalty; try again shortly.'
            : 'The server did not accept this as a solution. Review the challenge and try again.'
      };
    } catch (error) {
      result = {
        url: `${request.options.method} ${request.url.href}`, time: `${Math.round(performance.now() - start)} ms`, status: 'No HTTP response', kind: 'warning',
        feedback: 'Could not receive a response. Your score is unchanged. Check that the server is running.',
        body: error.name === 'AbortError' ? 'The request timed out after 15 seconds. A write may have reached the server; inspect the catalog before retrying.' : 'Network connection failed. A write may have reached the server; inspect the catalog before retrying.'
      };
    } finally {
      clearTimeout(timeout);
      busy = false;
      saveState();
      renderProgress();
    }
    responses.set(stageId, result);
    renderResponse(result);
    if (state.completedStageIds.length === stages.length) $('completion').focus();
  }

  async function resetGame() {
    if (busy) return;
    busy = true;
    renderProgress();
    showMessage('');
    try {
      const response = await fetch('/api/game/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('The server could not reset the catalog. Your saved progress was kept.');
      try { localStorage.removeItem(STORAGE_KEY); } catch { storageWarning(); }
      state = freshState();
      drafts.clear();
      responses.clear();
      showMessage('Fresh catalog, fresh start. Your progress and all resource changes have been reset.');
    } catch (error) {
      showMessage(error.name === 'TimeoutError' || error instanceof TypeError ? 'Could not confirm the reset. Check your connection. Your local progress was kept.' : error.message, 'error');
    } finally {
      busy = false;
      renderStage();
    }
  }

  $('request-form').addEventListener('submit', sendRequest);
  $('method').addEventListener('change', () => { $('request-body').disabled = !bodyMethods.has($('method').value); });
  for (const kind of ['route', 'query']) $(`add-${kind}`).addEventListener('click', () => addRow(kind).querySelector('input').focus());
  $('previous-button').addEventListener('click', () => goToStage(state.currentStage - 1));
  $('next-button').addEventListener('click', () => goToStage(state.currentStage + 1));
  $('reset-button').addEventListener('click', () => { $('reset-dialog').returnValue = ''; $('reset-dialog').showModal(); });
  $('reset-dialog').addEventListener('close', () => { if ($('reset-dialog').returnValue === 'reset') resetGame(); });

  async function initialize() {
    try {
      const response = await fetch('/api/game/stages', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Challenge loading failed.');
      stages = await response.json();
      if (!Array.isArray(stages) || stages.length !== 12 || stages.some((stage, index) => stage.id !== index + 1 || typeof stage.title !== 'string' || typeof stage.description !== 'string')) throw new Error('Invalid challenge data.');
      state = readState();
      renderStage();
    } catch {
      $('challenge-title').textContent = 'We couldn’t load the challenges.';
      $('challenge-description').textContent = 'Check that the server is running, then refresh this page to reconnect.';
      $('stage-list').replaceChildren();
      showMessage('The game could not connect to the server. Refresh the page to try again.', 'error');
    }
  }
  initialize();
})();
