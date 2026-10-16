# DA40 D Flight Bag

Training flight bag for a DA40 D school flying 24 Greek aerodromes. Map with openAIP chart layers, airport pages, circuit counter and landing log, navlog, briefing, calculators and risk assessment.

Planning and situational-awareness aid only. Not certified. Not for navigation. Always use the current AIP Greece and an official briefing.

## Put it online (GitHub Pages, free)
1. Sign in at github.com and create a new **public** repository, e.g. `flightbag`.
2. On the repository page choose **Add file → Upload files**, drag in every file from this folder, and commit.
3. Go to **Settings → Pages**. Under *Build and deployment* pick **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute the app is at `https://<your-username>.github.io/flightbag/`.
5. On the iPad or phone, open that link in Safari or Chrome and choose **Add to Home Screen**. It then opens full screen and keeps working offline for everything except live weather and new map areas.

## First run
- **Settings → openAIP:** paste your free openAIP API key, then turn on *openAIP aviation chart* under **Layers** on the map.
- Your log, VRPs, circuits and route are stored on each device. Use **Settings → Backup** to move them.

## Files
`index.html`, `style.css`, `app.js` (the app), `data.js` (airport data from OurAirports, unverified), `sw.js` (offline), `manifest.json` and icons.

## School server (accounts, NOTAMs, HNMS charts)

Sign-in, pilot accounts, NOTAMs and the HNMS (EMY) weather charts need the small server in `functions/`.
It runs free on Cloudflare Pages. GitHub Pages cannot run it; on GitHub Pages the app still works, without those features.

1. Create a free account at dash.cloudflare.com.
2. Workers & Pages → Create → Pages → Connect to Git → choose `MarinosA320/flightbag`. Framework preset: None. Build command: empty. Output directory: `/`. Deploy.
3. Workers & Pages → KV → Create namespace `flightbag-users`.
4. Your Pages project → Settings → Bindings → Add → KV namespace: variable name `USERS`, namespace `flightbag-users`.
5. Settings → Variables and Secrets → add three **Secrets**:
   - `SESSION_SECRET`: any long random text (40+ characters)
   - `ADMIN_EMAIL`: the first administrator's e-mail
   - `ADMIN_CODE`: the first administrator's access code
   - `AUTOROUTER_EMAIL` and `AUTOROUTER_PASSWORD` (recommended, free): an autorouter.aero account with API access enabled (ask autorouter support). NOTAMs then come from EUROCONTROL EAD data.
   - `NOTAMIFY_TOKEN` (optional, paid): Notamify API token from notamify.com/api-manager. With it, NOTAMs come from Notamify (with plain-English summaries); without it, from FAA NOTAM Search. Results are cached 30 minutes.
6. Deployments → Retry deployment. Open the `*.pages.dev` address and sign in with the administrator e-mail and code.
7. Settings → Pilot accounts: create, view and delete accounts, or give someone a new access code.

After this works, make the GitHub repository private and turn off GitHub Pages, so the school documents are only reachable after sign-in.
