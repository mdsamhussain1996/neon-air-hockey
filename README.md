# Neon Air Hockey

A neon arcade air hockey game with power-ups (Freeze, Multi-puck, Shield). First to 7 goals.

- **Vs computer** – Easy, Medium or Hard
- **Two players, one screen** – drag on your own half of a phone/tablet, or mouse + W A S D on a laptop
- **Online** – each player on their own device; the host sends an invite link or a 4-letter code

Online play is peer-to-peer (WebRTC via [PeerJS](https://peerjs.com)). The free PeerJS server only introduces the two browsers; the game then runs directly between them. Some school, office or mobile networks block direct connections; if a game won't connect, try another network.

## Files
| File | Purpose |
|---|---|
| `index.html` | The whole game |
| `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` | Make it installable as an app and let it start offline |

## Put it online with GitHub Pages
1. On GitHub, create a new **public** repository named `neon-air-hockey`.
2. **Add file → Upload files**, drag in every file from this folder, and commit.
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`. Save.
4. After a minute the game is live at `https://<your-username>.github.io/neon-air-hockey/`.

## Install it as an app
- **Chrome / Edge (laptop or Android):** open the site and press **Install app** (or the install icon in the address bar).
- **iPhone / iPad:** open the site in Safari → **Share** → **Add to Home Screen**.
