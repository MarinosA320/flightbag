# DA40 D Flight Bag

Training flight bag for a DA40 D school flying 22 Greek aerodromes. Map with openAIP chart layers, airport pages, circuit counter and landing log, navlog, briefing, calculators and risk assessment.

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
