# MovieHub API Challenge

An educational browser game for Assignment 3 in Web Application Development. Build and send **real HTTP requests** to a movie catalog API, learning REST through 12 challenges. The application uses Node.js, Express, EJS, vanilla JavaScript, HTML, CSS and AJAX with `fetch()`.

## Features

- Twelve sequential challenges covering collections, route parameters, combined query filters, search, related resources, POST, PATCH, PUT, DELETE and HTTP errors.
- Server-side validation of the stage header, method, resolved path, query parameters and JSON body. Answer configuration stays on the server.
- EJS server-rendered playground and resource schemas, with external CSS and JavaScript.
- Request builder with removable route/query rows, safe placeholder substitution, URLSearchParams encoding and JSON input.
- Response inspector with actual URL, status, elapsed time and formatted body. A correct request in the error lesson completes with a genuine **404**.
- Responsive, keyboard-accessible interface, completed-stage navigation, points, attempt counts and localStorage persistence.
- Reset restores both local progress and server seed data. Completed stages can be reviewed; their Send button is disabled to prevent repeating destructive actions.
- Input validation, JSON error responses, request size limit, escaped templates, text-only response rendering and a restrictive Content Security Policy.
- Automated HTTP integration tests using Node’s built-in test runner; no test framework or database.

## Requirements and installation

Use **Node.js 22 or newer** (tested with Node.js 24). From the repository directory:

```sh
npm install
npm start
```

Open **http://localhost:3000** to play, and **http://localhost:3000/schemas** for the schema tables and general API reference.

For automatic restarts during development:

```sh
npm run dev
```

Stop the server with `Ctrl+C`. The default port is 3000; set `PORT` to override it. For example, in PowerShell: `$env:PORT = '3001'`, then `npm start`. If PowerShell blocks the `npm.ps1` launcher, use `npm.cmd install`, `npm.cmd start`, and `npm.cmd test` instead.

## Verification

```sh
npm run check
npm test
```

`check` runs JavaScript syntax checks. `test` starts an isolated Express application on an available loopback port, sends real HTTP requests and closes it afterward. It requires no separately running server. Tests cover all 12 stage solutions, mutations, combined filters, nested relationships, normalization, rejected solutions, malformed JSON, invalid IDs/fields/ranges, missing resources, reset, safe error handling, rendered schemas and answer exposure.

For manual verification, start the server, open the playground, submit an incorrect request, then work through all 12 challenges using the schemas as a reference. Confirm stage 11 shows both **404 Not Found** and **Stage complete**. Refresh to verify progress persists. Revisit a completed stage, then use Reset game and confirm the catalog and progress return to their initial state. At a narrow window width, the stage list becomes a horizontal reel and the builder stacks its fields.

## Project structure

```text
app.js                       Express application factory and middleware
server.js                    HTTP listener and shutdown handling
config/
  stages.js                  Private answers; explicit public metadata allowlist
  schemas.js                 Resource definitions passed to EJS
controllers/                 Movie, review and page handlers
data/                        Deterministic movie and review JSON seeds
middleware/                  Stage validation, input validation, error handling
routes/                      Movie, review, page and game-control routers
services/dataStore.js        Per-application in-memory data and numeric IDs
views/                       EJS game, schemas, error page and shared partials
public/css/styles.css        Responsive application styles
public/js/game.js            Request builder, response display and local progress
public/favicon.svg           Local icon
test/api.test.js             HTTP integration and exposure checks
scripts/check.js             JavaScript syntax verification
```

Only `public/` is served as static content. Runtime dependencies are **Express** and **EJS**; the lockfile records exact installed versions. No frontend framework, CSS framework, jQuery, TypeScript or database is used. `node_modules/` is excluded from Git.

## How the game works

1. Read the challenge and consult Schemas for field types and general resource operations.
2. Choose a method and enter a local `/api/` path. A path such as `/api/resource/:id` can use a Route Parameters row named `id`.
3. Add query rows as needed. Parameters may also be entered directly in the path; duplicate keys are rejected. Use a JSON body for POST, PATCH or PUT.
4. Send the request. The client adds `X-Stage-Id` automatically. Only the server checks whether the request satisfies the challenge.
5. An incorrect construction returns 422 with `stageCorrect: false` before any mutation. A matching construction reaches the real REST handler and receives `X-Stage-Correct: true`. The actual resource status and body are retained.
6. The response header drives completion, including the intentional 404 lesson. Select Next stage after success. Completed challenges remain available through Previous stage and the stage reel.

Each stage starts at 100 available points. An incorrect HTTP attempt costs 10 points, with a 50-point minimum; a stage can award points only once. Client-side syntax errors never send a request and incur no attempt or score penalty. Network failures and server 5xx responses count as send attempts but do not reduce points. All 12 stages total a maximum of 1,200 points.

Local storage holds the current stage, completed IDs, attempts, incorrect attempts, awarded points and total score. Request drafts and response bodies are retained only for the current page visit. Local progress is a learning convenience, not a secure leaderboard. The public metadata endpoint exposes only stage ID, title and natural-language description; it exposes no expected-method/path/query/body configuration.

## REST API overview

All API responses are JSON, except successful DELETE responses (204, intentionally empty). Bodies require `Content-Type: application/json` and are limited to 16 KB. Ordinary API requests can omit `X-Stage-Id`; supplying it invokes game validation. Creation returns 201 with a `Location` header. Unknown API routes return JSON 404.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/movies` | List movies; supports `genre`, `minYear`, `search`, `sort` together |
| GET | `/api/movies/:id` | Read a movie |
| POST | `/api/movies` | Create a movie with all editable fields |
| PATCH | `/api/movies/:id` | Update supplied editable fields |
| DELETE | `/api/movies/:id` | Delete a movie and its associated reviews |
| GET | `/api/movies/:id/reviews` | List the movie’s reviews; missing movie returns 404 |
| POST | `/api/movies/:id/reviews` | Create a review; derive `movieId` from the route |
| GET | `/api/reviews` | List reviews; supports `minScore` and `sort` together |
| GET | `/api/reviews/:id` | Read one review |
| PUT | `/api/reviews/:id` | Replace author, score and comment; preserve ID and movieId |
| DELETE | `/api/reviews/:id` | Delete a review |

Movie genre matching and title search are case-insensitive. `minYear` is inclusive. Movie sorting supports `rating_desc`, `rating_asc`, `year_desc`, `year_asc` and `title_asc`. Reviews support inclusive `minScore` (integer 1–5) and `score_desc`/`score_asc`. Unknown, invalid or repeated collection query parameters return 400.

Movie creation requires title, genre, year, rating, director and available. Movie rating is 0–10; year is an integer from 1888–2100. Review creation and replacement require author, score (integer 1–5) and comment. Text fields must be nonblank and meet the documented length limits. IDs must be positive safe integers. Missing resources return 404, invalid field sets/types return 422, malformed JSON and invalid IDs return 400, unsupported body content types return 415, and oversized bodies return 413. Unknown or read-only body fields are rejected.

Game request comparisons ignore JSON property order and query parameter order, handle URL-encoded values and permit a trailing slash. PATCH checks the required challenge changes, while the API validates every submitted field. POST and PUT challenge bodies must match the full editable field set. Incorrect-answer messages do not reveal the solution.

Separate game-control endpoints:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/game/stages` | Safe public challenge metadata |
| POST | `/api/game/reset` | Restore server seeds; send an empty JSON object `{}` |

Reset is a game-control operation, separate from the educational movie/review resources. The UI does not send a stage header for metadata or reset. Reset requires JSON and rejects a foreign Origin header.

## Data lifecycle and scope

**No database is used.** Eight movies and seven reviews are cloned from JSON files when the server starts or resets. All mutations update server memory; seed files are never overwritten. Numeric IDs increase without reuse until reset. Deleting a movie removes its reviews to preserve relationships.

**Changes persist only until server restart or reset.** One server shares its catalog between connected browsers; progress belongs to each browser. Reset affects that shared catalog and clears the initiating browser’s progress. After restarting the server or resetting from another browser, use Reset game in the current browser to start a consistent new run. This is a local educational application, with no accounts, authentication or multi-user isolation.

## Submission checklist

- [x] Node.js / Express / EJS, external vanilla JavaScript and CSS, real fetch requests
- [x] EJS-rendered `/` and `/schemas`, with server-supplied schema definitions
- [x] Two related resources, deterministic seeds and in-memory CRUD
- [x] Twelve distinct game stages and private server-side answer validation
- [x] Intentional 404 challenge completes using the correctness response header
- [x] Dynamic route/query rows, JSON editor and response inspector
- [x] Progress, scoring, attempt counts, completed-stage navigation and reset
- [x] Validation, JSON errors, responsive styles and automated verification
- [x] Lockfile, run instructions and `.gitignore` excluding dependencies
- [ ] Replace the two author placeholders before submission
- [ ] Run the verification commands on the submission computer
