# Broken Feather 🐔

**Your hand is the controller.** A playful browser arcade game where you aim with a finger gun and flick your hand upward to shoot flying chickens.

**[Play Broken Feather](https://broken-feather.netlify.app/)** · [Report a bug](https://github.com/rohanrogers/broken-feather/issues)

![Sunny meadow game background](dist/assets/meadow.png)

## Features

- On-device webcam hand tracking with MediaPipe; no camera frames are uploaded.
- Thumb-up gun poses with either your index finger or index and middle fingers forward.
- Finger-direction aiming, a visible crosshair, and a shotgun that follows your hand in the mirrored preview.
- A quick upward hand flick fires at your aim before the recoil.
- Brief tracking-gap handling, short centre calibration, and instant recentering.
- Mouse/touch practice, six shells, automatic reload, scores, combos, and 60-second rounds.
- Bundled tracking model and runtime; no API key, backend, dependency installation, or build step needed to play locally.

## Play

Open the [live game](https://broken-feather.netlify.app/) and choose **Enable camera & play**, or **Try with mouse or touch**.

For camera controls, raise your thumb, point one or two fingers forward, and fold your ring and little fingers. Point comfortably toward the centre during the short initial calibration. Small natural hand tremor is expected. Turn your pointing direction to move the crosshair; you do not need to move your entire hand. Make a quick upward hand lift to fire, then let your hand settle before the next shot.

The crosshair is a screen controller: your finger does not need to physically line up with a chicken. Use good lighting and keep your hand visible.

| Control | Action |
| --- | --- |
| Finger direction | Aim |
| Quick upward hand lift | Shoot |
| Mouse move + click / touch | Practice controls |
| **C** or **Space** | Recenter using your current pointing direction |
| **R** | Reload |
| **P** | Pause / resume |
| Sound button | Mute / unmute |

## Run locally

You need **Python 3** and a modern browser with a camera for hand controls. Git is optional: you can use **Code → Download ZIP**, extract it, and open a terminal in the extracted folder instead of cloning.

The server binds to your computer only and serves the `dist` folder at **http://127.0.0.1:5180/**. Keep the terminal open while playing; press **Ctrl+C** to stop. You do not need Node.js or npm to run the game.

### Windows (PowerShell)

Install Python 3 from [python.org](https://www.python.org/downloads/windows/) and Git from [git-scm.com](https://git-scm.com/downloads/win) if you want to clone. Open a new PowerShell window after installing.

```powershell
git clone https://github.com/rohanrogers/broken-feather.git
cd broken-feather
py -3 server.py
```

Then open **http://127.0.0.1:5180/** in your browser. If `py` is unavailable but `python --version` shows Python 3, use `python server.py` instead.

### macOS (Terminal)

Install Python 3 from [python.org](https://www.python.org/downloads/macos/) if `python3 --version` is unavailable. Git can be installed through Apple's Command Line Tools (`xcode-select --install`), or download the ZIP instead.

```sh
git clone https://github.com/rohanrogers/broken-feather.git
cd broken-feather
python3 server.py
```

Then open **http://127.0.0.1:5180/** in your browser.

### Ubuntu (Terminal)

```sh
sudo apt update
sudo apt install -y python3 git
git clone https://github.com/rohanrogers/broken-feather.git
cd broken-feather
python3 server.py
```

Then open **http://127.0.0.1:5180/** in your browser.

### Troubleshooting

- **Camera blocked:** allow camera access in the browser and, if needed, your operating system's privacy settings. Camera controls require localhost or HTTPS. Opening `index.html` directly is insufficient.
- **Address already in use:** an existing preview may already be running. Open its URL, or stop the old server with Ctrl+C before starting again.
- **Want another port?** From the project root, use `python3 -m http.server 5181 --bind 127.0.0.1 --directory dist` (Windows: `py -3 -m http.server 5181 --bind 127.0.0.1 --directory dist`). Open http://127.0.0.1:5181/.
- **Jitter or poor recognition:** improve lighting, keep your whole hand visible, and press C or Space with a comfortable pointing pose. Camera blur and hidden joints can still affect tracking.
- **Testing with speakers nearby:** mute with the sound button.

## Host online with Netlify

This is a static site. Publish **only `dist/`**; Python is just a local preview server.

### Connect this GitHub repository

1. In Netlify, choose **Add new project → Import an existing project** and select this repository.
2. Leave the build command empty and set the publish directory to **`dist`**. The included `netlify.toml` sets that directory automatically.
3. Deploy, open the HTTPS URL, and allow camera access. Check both camera controls and mouse practice on the deployed site.

Alternatively, upload the **`dist` folder** at [Netlify Drop](https://app.netlify.com/drop). For updates, upload the updated folder to the existing site's Deploys page. See [Netlify deployment documentation](https://docs.netlify.com/deploy/create-deploys/).

Other static HTTPS hosts can also serve `dist` as the site root. Keep the bundled `assets` directory and JavaScript files together. The Python development server is not intended for public production hosting.

## How it works

The app uses HTML, CSS, Canvas 2D, and native JavaScript modules. MediaPipe Hand Landmarker estimates 21 hand landmarks, with inference running locally in a worker where supported and CPU fallback available.

Aiming uses the first index-finger bone relative to palm size, a calibrated neutral, bounded response curves, and filtering. Firing separately checks coherent upward wrist/palm motion. A short observed upward precursor can complete one predicted shot if the hand then leaves view; disappearance alone cannot fire. A held crosshair during a brief tracking gap does not authorize a live shot.

The gestures are geometric heuristics, not a trained gesture classifier. Webcam results vary with lighting, camera speed, hand orientation, and occlusion. Automated checks do not establish real-world accuracy.

| File / folder | Purpose |
| --- | --- |
| `dist/` | Complete deployable game |
| `dist/app.js` | UI, rendering, and game lifecycle |
| `dist/camera.js`, `dist/tracker-worker.js` | Camera and hand inference |
| `dist/controls.js`, `dist/steering.js` | Pose, calibration, and aiming |
| `dist/recoil.js` | Upward recoil trigger |
| `dist/aim-presence.js` | Crosshair continuity through brief gaps |
| `dist/game.js`, `dist/audio.js` | Game rules and sound |
| `dist/debug/` | Local parameter-recording tools |
| `dist/qa/` | Synthetic browser verification pages |
| `tests/` | Automated public tests |
| `server.py` | Local-only Python preview server |

## Tests and debug tools

With a recent Node.js version installed:

```sh
npm test
```

No `npm install` is needed. Browser checks are available at `/qa/smoke.html` and `/qa/grip.html` on your local server; these use synthetic camera input. Keep tests muted.

Open `/debug/` to record separate **shooting attempts**, **aim-only paths**, or **hold-still** sessions. Exports contain hand landmark coordinates and control parameters, not video or audio. Recording requires you to start it; exports and saved sessions stay in your browser unless you choose to share them.

Private landmark captures, local analyses, and their dependent replay tests are excluded from Git. The project owner's local `npm run test:private` command requires those untracked fixtures; it is not part of the public clone's test suite.

## Privacy and assets

Camera processing runs in your browser. This application does not upload camera frames or debug recordings. Model/runtime files are bundled locally. Hosting providers still receive normal page and asset requests.

Artwork provenance is documented in [ASSETS.md](ASSETS.md). Bundled third-party runtime/model notices are in [THIRD_PARTY_NOTICES.md](dist/assets/THIRD_PARTY_NOTICES.md); their licenses remain applicable.

GitHub tokens, `.env` files, private recordings, and local generated output are excluded through `.gitignore`. Never commit credentials or add them to frontend code.
