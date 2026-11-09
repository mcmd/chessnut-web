# Chessnut Air web app

Client-only web app for the Chessnut Air e-board over Web Bluetooth: live board view, reading and importing the games stored on the board, a browser-side game library with PGN/ZIP export, battery and firmware info, and LED hints during live games.

Live at <https://mcmd.github.io/chessnut-web/> (Chrome on Android, ChromeOS, Windows, macOS or Linux).

## Development

```sh
npm install
npm run dev     # http://localhost:5173/chessnut-web/
npm test
npm run build
```

On Linux, free the board from BlueZ before connecting from Chrome (`bluetoothctl disconnect <address>`); a stale system connection stops it advertising.

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Layout

- `src/ble/protocol.js` — UUIDs, commands, frame codecs (pure).
- `src/ble/ChessnutBoard.js` — Web Bluetooth connection, stored-game transfer, LEDs.
- `src/chess/` — game reconstruction from positions, live tracking, PGN.
- `src/store/games.js` — IndexedDB library; `src/export/download.js` — PGN/ZIP downloads.
- `src/components/` — UI.
