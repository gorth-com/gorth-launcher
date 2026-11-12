import path from "node:path";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { app, BrowserWindow } from "electron";

const directory = process.argv.at(-1)!;
if (!path.isAbsolute(directory) || !path.basename(directory).startsWith("gorth-instance-settings-")) throw new Error("Isolated fixture directory required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
let passed = false;
const timer = setTimeout(() => { errors.push("Timed out"); app.quit(); }, 25000);
app.once("quit", () => { clearTimeout(timer); console.log("GORTH_INSTANCE_SETTINGS=" + JSON.stringify({ passed, errors })); });
void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    window.webContents.on("console-message", (details) => { if (details.level === "error") errors.push(details.message); });
    const run = (script: string) => window.webContents.executeJavaScript(script);
    const wait = async (condition: string) => {
      const deadline = Date.now() + 5000;
      while (!(await run(condition))) {
        if (Date.now() > deadline) throw new Error("Waiting for " + condition);
        await delay(25);
      }
    };
    await window.loadFile(path.join(directory, "renderer/index.html"));
    await wait("!!window.settingsTest && document.querySelectorAll('[role=tab]').length===5");
    await run(`window.clickTab = name => Array.from(document.querySelectorAll('[role=tab]')).find(el=>el.textContent===name).click(); window.toggle = title => { const label = Array.from(document.querySelectorAll('label')).find(el=>el.textContent===title); document.getElementById(label.htmlFor).click(); }; window.input = (label, value) => { const el = Array.from(document.querySelectorAll('label')).find(el=>el.textContent===label); const input = document.getElementById(el.htmlFor); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input',{bubbles:true})); }; window.button = name => Array.from(document.querySelectorAll('button')).find(el=>el.textContent===name).click(); void 0;`);
    assert(await run(`document.querySelector('input[type=number]').matches(':disabled')`));
    await run(`toggle('Game window')`);
    await wait(`!document.querySelector('input[type=number]').matches(':disabled')`);
    await run(`input('Width (pixels)', '1600'); clickTab('Java');`);
    await wait(`!!document.getElementById('instance-java-path')`);
    await run(`toggle('Java installation')`);
    await run(`button('Detect')`);
    await wait(`document.querySelectorAll('[role=dialog] tbody tr').length===2`);
    await run(`document.querySelectorAll('[role=dialog] tbody tr')[1].querySelector('button').click()`);
    await wait(`document.getElementById('instance-java-path').value==='/java-21/bin/java' && !document.querySelector('[role=dialog]')`);
    await run(`button('Browse')`);
    await wait(`document.getElementById('instance-java-path').value==='/browsed/java'`);
    await run(`toggle('Memory')`);
    await run(`input('Maximum memory (MiB) · -Xmx', '8192'); clickTab('Custom Commands');`);
    await wait(`document.body.innerText.includes('Override global commands')`);
    await run(`toggle('Override global commands')`);
    await run(`input('Wrapper command', '"/wrapper with spaces" --option'); clickTab('Environment Variables');`);
    await wait(`document.body.innerText.includes('Override global environment variables')`);
    await run(`toggle('Override global environment variables')`);
    await run(`button('Add')`);
    await wait(`!!document.querySelector('input[aria-label="Variable name 1"]')`);
    await run(`for (const [name,value] of [['Variable name 1','FIXTURE'],['Variable value 1','yes']]) { const el=document.querySelector('input[aria-label="'+name+'"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); }`);
    await run(`button('Lưu cấu hình instance')`);
    await wait(`window.settingsTest.saved.length===1`);
    const saved = await run(`window.settingsTest.saved[0]`);
    assert.equal(saved.resolutionWidth, 1600);
    assert.equal(saved.memoryMax, 8);
    assert.equal(saved.javaPath, "/browsed/java");
    assert.equal(saved.wrapperCommand, '"/wrapper with spaces" --option');
    assert.deepEqual(saved.environment, { FIXTURE: "yes" });
    assert.equal(saved.overrides.environment, true);
    await run(`clickTab('Tweaks')`);
    await wait(`document.body.innerText.includes('Legacy tweaks')`);
    assert(await run(`Array.from(document.querySelectorAll('label')).find(el=>el.textContent.includes('Legacy tweaks')).parentElement.parentElement.parentElement.querySelector('[role=switch]').hasAttribute('data-disabled')`));
    await run(`toggle('Native libraries')`);
    await run(`toggle('Use system installation of GLFW')`);
    await run(`input('GLFW library path', '/custom/libglfw.dylib'); button('Lưu cấu hình instance');`);
    await wait(`window.settingsTest.saved.length===2`);
    assert.equal(await run(`window.settingsTest.saved[1].glfwPath`), "/custom/libglfw.dylib");
    await run(`clickTab('General')`);
    await wait(`document.body.innerText.includes('Enable Auto-join')`);
    await run(`toggle('Enable Auto-join')`);
    await run(`document.querySelectorAll('[data-slot=radio-group-item]')[1].click()`);
    await wait(`!!document.querySelector('[aria-label="Singleplayer world"]')`);
    await run(`document.querySelector('[aria-label="Singleplayer world"]').click()`);
    await wait(`!!Array.from(document.querySelectorAll('[role=option]')).find(el=>el.textContent==='Test World')`);
    await run(`Array.from(document.querySelectorAll('[role=option]')).find(el=>el.textContent==='Test World').click()`);
    await run(`button('Lưu cấu hình instance')`);
    await wait(`window.settingsTest.saved.length===3`);
    assert.equal(await run(`window.settingsTest.saved[2].joinWorld`), "Test World");
    await run(`window.settingsTest.switchInstance()`);
    await wait(`window.settingsTest.id==='beta' && document.querySelector('[role=tab][aria-selected=true]').textContent==='General'`);
    assert(await run(`document.querySelector('input[type=number]').matches(':disabled')`));
    assert.deepEqual(await run(`window.settingsTest.errors`), []);
    passed = true;
    window.destroy();
  } catch (error) { errors.push(String(error)); }
  finally { app.quit(); }
})();
