/**
 * Screenshot generator using Chrome DevTools Protocol
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = '/Users/newtonuser/.gemini/antigravity-ide/brain/3d548fb5-2b76-41d6-95e2-088477819984';

async function captureScreen(width, height, setupFnStr, filename) {
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--disable-gpu',
    `--window-size=${width},${height}`,
    '--remote-debugging-port=9225',
    'http://localhost:8080/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const res = await fetch('http://127.0.0.1:9225/json');
    const tabs = await res.json();
    const tab = tabs.find(t => t.url.includes('localhost:8080')) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      let id = 1;
      const send = (method, params = {}) => {
        ws.send(JSON.stringify({ id: id++, method, params }));
      };

      ws.onopen = async () => {
        send('Page.enable');
        send('Runtime.enable');
        send('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: width < 600
        });
        await new Promise(r => setTimeout(r, 800));

        if (setupFnStr) {
          send('Runtime.evaluate', { expression: setupFnStr });
          await new Promise(r => setTimeout(r, 600));
        }

        ws.onmessage = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.result && msg.result.data) {
            const buf = Buffer.from(msg.result.data, 'base64');
            const filePath = path.join(outDir, filename);
            fs.writeFileSync(filePath, buf);
            console.log(`Saved screenshot: ${filename} (${width}x${height})`);
            resolve();
          }
        };

        send('Page.captureScreenshot', { format: 'png' });
      };
      ws.onerror = reject;
    });

    ws.close();
  } catch (err) {
    console.error(`Error capturing ${filename}:`, err);
  } finally {
    chrome.kill();
    await new Promise(r => setTimeout(r, 800));
  }
}

async function run() {
  console.log('Capturing screenshots for Phase 1...');

  // 1. Laptop Title (1366x768)
  await captureScreen(1366, 768, '', 'nah_laptop_title.png');

  // 2. Laptop Match Screen
  await captureScreen(1366, 768, `
    document.getElementById('cardModeBot').click();
    document.getElementById('btnStartBotMatch').click();
  `, 'nah_laptop_match.png');

  // 3. Laptop Settings
  await captureScreen(1366, 768, `
    document.getElementById('btnTitleSettings').click();
  `, 'nah_laptop_settings.png');

  // 4. Laptop Results
  await captureScreen(1366, 768, `
    const fakeVs = { winner:0, sc:[7,4], names:['You','Computer (Hard)'], stats:{ fastestShot:[108,82], shots:[24,18], saves:[5,2], powerUps:[3,1], touchTime:[42,35] } };
    window.nah.showResultsScreen(fakeVs);
  `, 'nah_laptop_results.png');

  // 5. Phone Portrait Title (390x844)
  await captureScreen(390, 844, '', 'nah_phone_portrait_title.png');

  // 6. Phone Portrait Match
  await captureScreen(390, 844, `
    document.getElementById('cardModeBot').click();
    document.getElementById('btnStartBotMatch').click();
  `, 'nah_phone_portrait_match.png');

  // 7. Phone Landscape Match (844x390)
  await captureScreen(844, 390, `
    document.getElementById('cardModeBot').click();
    document.getElementById('btnStartBotMatch').click();
  `, 'nah_phone_landscape_match.png');

  console.log('Finished capturing all screenshots!');
}

run();
