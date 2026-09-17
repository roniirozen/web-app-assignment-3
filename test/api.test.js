const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const createApp = require('../app');

let app;
let server;
let base;
before(async () => {
  app = createApp();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => app.locals.store.reset());
after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

async function request(url, { method = 'GET', body, stage, headers = {} } = {}) {
  if (stage !== undefined) headers['X-Stage-Id'] = String(stage);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  return { status: response.status, headers: response.headers, body: raw ? JSON.parse(raw) : null, raw };
}
const arrival = { title: 'Arrival', genre: 'Sci-Fi', year: 2016, rating: 7.9, director: 'Denis Villeneuve', available: true };

test('GET collection, route lookup, case-insensitive search and combined movie filters', async () => {
  const all = await request('/api/movies');
  assert.equal(all.status, 200);
  assert.ok(all.body.length >= 6);
  assert.equal((await request('/api/movies/2')).body.title, 'The Dark Knight');
  const filtered = await request('/api/movies?sort=rating_desc&minYear=2010&genre=action');
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.length > 1 && filtered.body.length < all.body.length);
  assert.ok(filtered.body.every(movie => movie.genre === 'Action' && movie.year >= 2010));
  assert.deepEqual(filtered.body.map(movie => movie.rating), filtered.body.map(movie => movie.rating).sort((a, b) => b - a));
  const search = await request('/api/movies?search=DARK');
  assert.equal(search.body.length, 2);
  assert.ok(search.body.every(movie => movie.title.toLowerCase().includes('dark')));
  assert.deepEqual((await request('/api/movies?genre=Comedy&minYear=2025')).body, []);
});

test('POST and PATCH persist actual in-memory mutations and IDs are never reused', async () => {
  const created = await request('/api/movies', { method: 'POST', body: arrival });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('location'), `/api/movies/${created.body.id}`);
  assert.deepEqual((await request(`/api/movies/${created.body.id}`)).body, created.body);
  const before = (await request('/api/movies/3')).body;
  const changed = await request('/api/movies/3', { method: 'PATCH', body: { rating: 9.1, available: false } });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.body, { ...before, rating: 9.1, available: false });
  assert.deepEqual((await request('/api/movies/3')).body, changed.body);
  assert.equal((await request(`/api/movies/${created.body.id}`, { method: 'DELETE' })).status, 204);
  const next = await request('/api/movies', { method: 'POST', body: arrival });
  assert.ok(next.body.id > created.body.id);
});

test('nested review creation derives relationship; review PUT fully replaces editable fields', async () => {
  const nested = await request('/api/movies/2/reviews');
  assert.equal(nested.status, 200);
  assert.ok(nested.body.length >= 2 && nested.body.every(review => review.movieId === 2));
  const created = await request('/api/movies/2/reviews', { method: 'POST', body: { author: 'Alex', score: 5, comment: 'Excellent movie' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.movieId, 2);
  assert.equal(created.headers.get('location'), `/api/reviews/${created.body.id}`);
  assert.deepEqual((await request(`/api/reviews/${created.body.id}`)).body, created.body);
  const body = { author: 'Jamie', score: 4, comment: 'Great visuals and soundtrack' };
  const replaced = await request('/api/reviews/2', { method: 'PUT', body });
  assert.equal(replaced.status, 200);
  assert.deepEqual(replaced.body, { id: 2, movieId: 2, ...body });
  assert.deepEqual((await request('/api/reviews/2')).body, replaced.body);
  assert.equal((await request('/api/reviews/2', { method: 'PUT', body: { score: 3 } })).status, 422);
  assert.deepEqual((await request('/api/reviews/2')).body, replaced.body);
});

test('review filters and ordering affect data', async () => {
  const result = await request('/api/reviews?sort=score_desc&minScore=4');
  assert.equal(result.status, 200);
  assert.ok(result.body.every(review => review.score >= 4));
  assert.ok(result.body.length < app.locals.store.reviews.length);
  assert.deepEqual(result.body.map(review => review.score), result.body.map(review => review.score).sort((a, b) => b - a));
});

test('DELETE review returns empty 204; DELETE movie cascades reviews', async () => {
  const deleted = await request('/api/reviews/1', { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.equal(deleted.raw, '');
  assert.equal((await request('/api/reviews/1')).status, 404);
  assert.equal((await request('/api/reviews/1', { method: 'DELETE' })).status, 404);
  assert.equal((await request('/api/movies/2', { method: 'DELETE' })).status, 204);
  assert.equal((await request('/api/movies/2')).status, 404);
  assert.ok((await request('/api/reviews')).body.every(review => review.movieId !== 2));
});

test('all 12 stage solutions execute their real REST behavior, including genuine 404', async () => {
  const scenarios = [
    { url: '/api/movies', status: 200 },
    { url: '/api/movies/2', status: 200 },
    { url: '/api/movies?sort=rating_desc&genre=Action&minYear=2010', status: 200 },
    { url: '/api/movies?search=dark', status: 200 },
    { url: '/api/movies', method: 'POST', body: arrival, status: 201 },
    { url: '/api/movies/3', method: 'PATCH', body: { available: false, rating: 9.1 }, status: 200 },
    { url: '/api/movies/2/reviews', status: 200 },
    { url: '/api/movies/2/reviews', method: 'POST', body: { comment: 'Excellent movie', score: 5, author: 'Alex' }, status: 201 },
    { url: '/api/reviews?sort=score_desc&minScore=4', status: 200 },
    { url: '/api/reviews/1', method: 'DELETE', status: 204 },
    { url: '/api/movies/999', status: 404 },
    { url: '/api/reviews/2', method: 'PUT', body: { comment: 'Great visuals and soundtrack', author: 'Jamie', score: 4 }, status: 200 }
  ];
  for (const [index, scenario] of scenarios.entries()) {
    const result = await request(scenario.url, { ...scenario, stage: index + 1 });
    assert.equal(result.status, scenario.status, `Stage ${index + 1} HTTP status`);
    assert.equal(result.headers.get('x-stage-correct'), 'true', `Stage ${index + 1} server validation`);
    if (index === 10) assert.deepEqual(result.body, { message: 'Movie not found.' });
  }
  assert.equal(app.locals.store.movies.length, 9);
  assert.equal(app.locals.store.movies.find(movie => movie.id === 3).available, false);
  assert.ok(!app.locals.store.reviews.some(review => review.id === 1));
  assert.equal(app.locals.store.reviews.find(review => review.id === 2).author, 'Jamie');
  assert.ok(app.locals.store.reviews.some(review => review.author === 'Alex' && review.movieId === 2));
});

test('stage validation rejects wrong methods, paths, query, bodies and prevents mutations', async () => {
  const invalid = [
    { url: '/api/movies', stage: 1, method: 'DELETE' },
    { url: '/api/movies/1', stage: 2 },
    { url: '/api/movies', stage: 3 },
    { url: '/api/movies?search=dark&extra=true', stage: 4 },
    { url: '/api/movies?search=dark&search=dark', stage: 4 },
    { url: '/api/movies', stage: 5, method: 'POST', body: { ...arrival, year: 2017 } },
    { url: '/api/movies', stage: 5, method: 'POST', body: { ...arrival, id: 11 } },
    { url: '/api/movies/3', stage: 6, method: 'PATCH', body: { rating: 9.1 } },
    { url: '/api/reviews/2', stage: 12, method: 'PUT', body: { author: 'Jamie', score: 4 } },
    { url: '/api/unknown', stage: 1 },
    { url: '/api/game/reset', stage: 1, method: 'POST', body: {} },
    { url: '/api/movies', stage: 1, method: 'POST', body: {} }
  ];
  for (const scenario of invalid) {
    const result = await request(scenario.url, scenario);
    assert.equal(result.status, 422, JSON.stringify(scenario));
    assert.equal(result.body.stageCorrect, false);
    assert.equal(result.headers.get('x-stage-correct'), null);
    assert.deepEqual(Object.keys(result.body).sort(), ['message', 'stageCorrect']);
  }
  assert.equal(app.locals.store.movies.length, 8);
  assert.equal(app.locals.store.movies.find(movie => movie.id === 3).rating, 8.8);
  for (const stage of ['0', '13', 'x', '1,2', '01']) assert.equal((await request('/api/movies', { stage })).status, 400);
});

test('stage comparisons normalize query ordering, encoding, body ordering and trailing slashes', async () => {
  assert.equal((await request('/api/movies/?minYear=2010&sort=rating_desc&genre=%41ction', { stage: 3 })).headers.get('x-stage-correct'), 'true');
  assert.equal((await request('/api/movies/%32/', { stage: 2 })).body.id, 2);
  assert.equal((await request('/api/movies?search=DARK', { stage: 4 })).headers.get('x-stage-correct'), 'true');
  const reversed = Object.fromEntries(Object.entries(arrival).reverse());
  assert.equal((await request('/api/movies/', { stage: 5, method: 'POST', body: reversed })).status, 201);
});

test('encoded separators, encoded static routes and excess slashes cannot falsely complete stages', async () => {
  for (const [url, stage] of [
    ['/api/movies%2F2', 2],
    ['/api/movies/2%2Freviews', 7],
    ['/api/%6dovies/2', 2],
    ['/api/movies/2/%72eviews', 7],
    ['/api/movies/2///', 2]
  ]) {
    const result = await request(url, { stage });
    assert.equal(result.status, 422, url);
    assert.equal(result.headers.get('x-stage-correct'), null, url);
    assert.equal(result.body.stageCorrect, false, url);
  }
});

test('a matching PATCH with invalid extra fields cannot complete a stage or mutate data', async () => {
  const result = await request('/api/movies/3', { stage: 6, method: 'PATCH', body: { rating: 9.1, available: false, year: 'invalid' } });
  assert.equal(result.status, 422);
  assert.equal(result.headers.get('x-stage-correct'), null);
  assert.equal(result.body.stageCorrect, false);
  assert.equal(app.locals.store.movies.find(movie => movie.id === 3).rating, 8.8);
});

test('invalid IDs and missing resources produce JSON errors', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) {
    for (const resource of ['movies', 'reviews']) assert.equal((await request(`/api/${resource}/${id}`)).status, 400);
  }
  for (const url of ['/api/movies/999', '/api/movies/999/reviews', '/api/reviews/999', '/api/no-such-route']) {
    const result = await request(url);
    assert.equal(result.status, 404);
    assert.ok(result.body.message);
    assert.ok(!result.body.stack);
  }
  assert.equal((await request('/api/movies/999', { method: 'PATCH', body: { rating: 3 } })).status, 404);
  assert.equal((await request('/api/movies/999/reviews', { method: 'POST', body: { author: 'A', score: 4, comment: 'B' } })).status, 404);
  assert.equal((await request('/api/reviews/999', { method: 'PUT', body: { author: 'A', score: 4, comment: 'B' } })).status, 404);
});

test('body validation rejects missing fields, wrong types, ranges, read-only and unknown fields', async () => {
  for (const body of [{}, [], { ...arrival, year: '2016' }, { ...arrival, rating: 11 }, { ...arrival, available: 'true' }, { ...arrival, title: ' ' }, { ...arrival, title: 'x'.repeat(201) }, { ...arrival, year: 1800 }, { ...arrival, extra: 1 }]) {
    const result = await request('/api/movies', { method: 'POST', body });
    assert.ok([400, 422].includes(result.status), JSON.stringify(body));
  }
  for (const body of [{ score: 4 }, { author: 'A', score: 0, comment: 'B' }, { author: 'A', score: 4.5, comment: 'B' }, { author: 'A', score: 5, comment: 'B', movieId: 3 }, { author: 'A', score: '5', comment: 'B' }]) {
    assert.equal((await request('/api/movies/2/reviews', { method: 'POST', body })).status, 422);
  }
  assert.equal((await request('/api/movies/2', { method: 'PATCH', body: { id: 99 } })).status, 422);
  assert.equal((await request('/api/movies/2', { method: 'PATCH', body: {} })).status, 422);
  assert.equal((await request('/api/movies', { method: 'POST' })).status, 415);
  assert.equal(app.locals.store.movies.length, 8);
});

test('invalid query input is rejected instead of ignored', async () => {
  for (const url of ['/api/movies?minYear=bad', '/api/movies?sort=nope', '/api/movies?genre=Action&genre=Drama', '/api/movies?wat=1', '/api/movies?search=', '/api/reviews?minScore=6', '/api/reviews?sort=rating_desc', '/api/reviews?minScore=4&minScore=5']) {
    assert.equal((await request(url)).status, 400, url);
  }
});

test('malformed JSON, oversized payloads and broken URL encoding are safe JSON errors', async () => {
  for (const [body, expected] of [['{"title":', 400], [JSON.stringify({ title: 'x'.repeat(17000) }), 413]]) {
    const response = await fetch(base + '/api/movies', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Stage-Id': '5' }, body });
    assert.equal(response.status, expected);
    const data = await response.json();
    assert.equal(data.stageCorrect, false);
    assert.ok(!JSON.stringify(data).includes('SyntaxError'));
  }
  assert.equal((await request('/api/movies/%E0%A4%A')).status, 400);
  assert.equal((await request('/api/movies/%E0%A4%A', { stage: 2 })).status, 400);
});

test('SSR pages render; only safe public stage metadata is browser-accessible', async () => {
  const home = await fetch(base + '/');
  const html = await home.text();
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(html, /id="request-form"/);
  assert.match(html, /\/js\/game.js/);
  const script = await (await fetch(base + '/js/game.js')).text();
  for (const source of [html, script]) {
    for (const forbidden of ['rating_desc', 'Excellent movie', 'Denis Villeneuve', 'Great visuals and soundtrack', '/api/movies/999', 'expectedMethod', 'expectedPath', 'stage.body', 'stage.query']) {
      assert.ok(!source.includes(forbidden), `Browser source leaked ${forbidden}`);
    }
  }
  assert.ok(!script.includes('innerHTML'));
  const metadata = await request('/api/game/stages');
  assert.equal(metadata.body.length, 12);
  for (const stage of metadata.body) assert.deepEqual(Object.keys(stage).sort(), ['description', 'id', 'title']);
  for (const url of ['/config/stages.js', '/data/movies.json', '/test/api.test.js', '/package.json']) assert.equal((await fetch(base + url)).status, 404);
  const schemas = await fetch(base + '/schemas');
  const schemaHtml = await schemas.text();
  assert.equal(schemas.status, 200);
  assert.match(schemaHtml, /movieId/);
  assert.match(schemaHtml, /boolean/);
  assert.match(schemaHtml, /number/);
  assert.match(schemaHtml, /string/);
  const template = readFileSync(path.join(__dirname, '../views/schemas.ejs'), 'utf8');
  assert.match(template, /schemas\.forEach/);
  assert.equal(home.headers.get('x-powered-by'), null);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
});

test('game reset restores deterministic seed data and rejects cross-origin forms', async () => {
  await request('/api/movies', { method: 'POST', body: arrival });
  await request('/api/reviews/1', { method: 'DELETE' });
  await request('/api/movies/3', { method: 'PATCH', body: { rating: 1 } });
  assert.equal((await request('/api/game/reset', { method: 'POST', body: {}, headers: { Origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await request('/api/game/reset', { method: 'POST' })).status, 415);
  assert.equal((await request('/api/game/reset', { method: 'POST', body: { extra: true } })).status, 400);
  assert.equal((await request('/api/game/reset', { method: 'POST', body: {} })).status, 200);
  assert.equal((await request('/api/movies')).body.length, 8);
  assert.equal((await request('/api/reviews/1')).status, 200);
  assert.equal((await request('/api/movies/3')).body.rating, 8.8);
  assert.equal((await request('/api/movies', { method: 'POST', body: arrival })).body.id, 9);
});

test('unexpected server errors return a generic JSON message without stack traces', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    app.locals.store.movies = null;
    const result = await request('/api/movies');
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { message: 'An unexpected server error occurred.' });
    const gameResult = await request('/api/movies', { stage: 1 });
    assert.equal(gameResult.status, 500);
    assert.equal(gameResult.headers.get('x-stage-correct'), null);
  } finally { console.error = original; }
});
