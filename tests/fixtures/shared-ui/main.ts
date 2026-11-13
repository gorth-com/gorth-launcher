import path from "node:path";
import { app, BrowserWindow } from "electron";
import { setTimeout as delay } from "node:timers/promises";
const directory = process.argv.at(-1);
if (
  !directory ||
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-shared-ui-")
)
  throw new Error("Isolated fixture profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
let result: Record<string, unknown> = {};
const timeout = setTimeout(() => {
  errors.push("Sidebar fixture timed out");
  app.quit();
}, 15000);
app.once("will-quit", () => clearTimeout(timeout));
app.once("quit", () =>
  console.log("GORTH_SHARED_UI=" + JSON.stringify({ errors, result })),
);
void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const portals: BrowserWindow[] = [];
    window.webContents.setWindowOpenHandler(({ url }) =>
      url === "about:blank"
        ? {
            action: "allow",
            overrideBrowserWindowOptions: {
              show: false,
              webPreferences: {
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
              },
            },
          }
        : { action: "deny" },
    );
    window.webContents.on("did-create-window", (child) => portals.push(child));
    let phase = "mount";
    window.webContents.on("console-message", (details) => {
      if (details.level === "error")
        errors.push(phase + ": " + details.message);
    });
    window.webContents.on("render-process-gone", (_event, details) =>
      errors.push(details.reason),
    );
    const source = process.argv.at(-2);
    if (source?.startsWith("http://127.0.0.1:")) await window.loadURL(source);
    else await window.loadFile(path.join(directory, "renderer/index.html"));
    const run = (script: string) =>
      window.webContents.executeJavaScript(script);
    const wait = async (check: () => Promise<boolean>) => {
      const until = Date.now() + 4000;
      while (!(await check())) {
        if (Date.now() >= until)
          throw new Error("Sidebar fixture did not settle");
        await delay(50);
      }
    };
    await wait(
      async () =>
        !!(await run(
          'document.querySelector("[data-slot=sidebar-footer] button")',
        )),
    );
    result = await run(`(() => {
      const height = [...document.querySelectorAll('main button')][0].getBoundingClientRect().height;
      const large = [...document.querySelectorAll('[data-slot=sidebar-menu-button][data-size=lg]')].map(el=>el.getBoundingClientRect().height);
      const heading = document.querySelector('[data-slot=sidebar-header] button');
      return { height,large,brandFont:getComputedStyle(heading.querySelector('span')).fontSize,
        iconWidth:heading.querySelector('div').getBoundingClientRect().width,
        footer:!!document.querySelector('[data-slot=sidebar-footer] [aria-label="Account menu"]'),
        light:getComputedStyle(document.querySelector('main')).backgroundColor };
    })()`);
    await run("document.documentElement.classList.add('dark')");
    await delay(200);
    result.dark = await run(
      "getComputedStyle(document.querySelector('main')).backgroundColor",
    );
    phase = "navigation";
    const origin = window.webContents.getURL();
    await run(
      `document.querySelector('[data-slot=sidebar-content] button[aria-label]').click()`,
    );
    result.navigation = await run("window.sidebarFixture.calls.length > 0");
    result.stayedInRenderer = window.webContents.getURL() === origin;
    phase = "portal";
    await run(`document.querySelector('[aria-label="Account menu"]').click()`);
    await wait(async () => {
      for (const portal of portals)
        if (
          !portal.isDestroyed() &&
          (await portal.webContents.executeJavaScript(
            '!!document.querySelector("[role=menu]")',
          ))
        )
          return true;
      return false;
    });
    const menu = async () => {
      for (const portal of portals)
        if (
          !portal.isDestroyed() &&
          (await portal.webContents.executeJavaScript(
            '!!document.querySelector("[role=menu]")',
          ))
        )
          return portal;
      throw new Error("Missing native portal menu");
    };
    result.portalSeparate = !(await run(
      '!!document.querySelector("[role=menu]")',
    ));
    await (
      await menu()
    ).webContents.executeJavaScript(
      `document.querySelector('[role=menuitem]').click()`,
    );
    await delay(150);
    result.accountNavigation = await run(
      "window.sidebarFixture.calls.some(value => value === 'accounts' || value === 'settings/get-started')",
    );
    await run(`document.querySelector('[aria-label="Account menu"]').click()`);
    await delay(150);
    await (
      await menu()
    ).webContents.executeJavaScript(
      `window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
    );
    await wait(
      async () =>
        !(await run(
          `document.querySelector('[aria-label="Account menu"]').getAttribute("aria-expanded")==="true"`,
        )),
    );
    result.escaped = true;
    await run(`document.querySelector('[aria-label="Account menu"]').click()`);
    await delay(150);
    await (
      await menu()
    ).webContents.executeJavaScript(
      `[...document.querySelectorAll('[role=menuitem]')].find(el=>el.textContent.includes('Sign out')).click()`,
    );
    await wait(
      async () =>
        !!(await run("window.sidebarFixture.calls.includes('logout')")),
    );
    result.logout = true;
    for (const label of ["Sign in", "Create account"]) {
      await run(
        `document.querySelector('[aria-label="Account menu"]').click()`,
      );
      await delay(150);
      await (
        await menu()
      ).webContents.executeJavaScript(
        `[...document.querySelectorAll('[role=menuitem]')].find(el=>el.textContent.includes('${label}')).click()`,
      );
      await delay(100);
    }
    result.headingIcon = await run(`(() => {
      const icon=document.querySelector('[data-heading-fixture] [aria-hidden="true"]');
      const svg=icon.querySelector('svg');
      return [icon.getBoundingClientRect().width, icon.getBoundingClientRect().height, svg.getBoundingClientRect().width, svg.getBoundingClientRect().height];
    })()`);
    result.guestActions = await run(
      "window.sidebarFixture.calls.filter(v=>v==='login'||v==='register')",
    );
    await run(
      `[...document.querySelectorAll('main button')].find(el=>el.textContent==='Toggle sidebar').click()`,
    );
    await delay(300);
    phase = "collapsed";
    result.collapsed = await run(`(() => {
      const sidebar=document.querySelector('[data-slot=sidebar-container]');
      const buttons=[...sidebar.querySelectorAll('[data-sidebar=menu-button]')];
      return {width:sidebar.getBoundingClientRect().width,buttons:buttons.map(el=>({
        width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,
        avatar:!!el.querySelector('[data-slot=avatar]'),
        labelHidden:[...el.querySelectorAll('span:not([data-slot=avatar]):not([data-slot=avatar-fallback]),.grid')].every(span=>getComputedStyle(span).display==='none'||span.getBoundingClientRect().width===0)
      }))};
    })()`);
    const previous = await run(
      "document.querySelector('[data-fixture-page]').getAttribute('data-fixture-page')",
    );
    await run(
      "Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Open Settings').click()",
    );
    await wait(
      async () =>
        !!(await run(
          "document.querySelector('[data-launcher-settings-layout]')",
        )),
    );
    result.settingsFullWindow = await run(
      "document.querySelector('[data-launcher-settings-layout]').getBoundingClientRect().height === innerHeight",
    );
    result.settingsSidebar = await run(
      "document.querySelectorAll('[data-slot=sidebar]').length === 1 && !!document.querySelector('[data-slot=sidebar-footer] [aria-label=\"Account menu\"]')",
    );
    result.appearance = await run(`(() => {
      const root=document.querySelector('[data-settings-section=appearance]');
      return root.querySelector('header').textContent==='Appearance'
        && root.querySelectorAll('[data-slot=card]').length===1
        && root.querySelectorAll('[role=radiogroup]').length===2
        && !!root.querySelector('[role=combobox]');
    })()`);
    await run(
      "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === 'Compact').click()",
    );
    await wait(
      async () =>
        !!(await run(
          "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === 'Compact').querySelector('[role=radio]').getAttribute('aria-checked')==='true'",
        )),
    );
    result.layoutRadio = true;
    await run("document.querySelector('[aria-label=\"Java\"]').click()");
    await wait(
      async () =>
        !!(await run(
          "document.querySelector('[data-settings-section=runtime]')",
        )),
    );
    result.settingsNavigation = true;
    result.runtimeControls = await run(
      "!!document.querySelector('#java-path') && !!document.querySelector('#memory')",
    );
    phase = "java-controls";
    await run(`(() => {
      document.querySelector('[aria-label="Auto-download Mojang Java"]').click();
      document.querySelector('[role=radio][value=zgc]')?.click();
      const input=document.querySelector('[aria-label="Minimum memory usage (MiB)"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1536');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await run(
      "Array.from(document.querySelectorAll('label')).find(el=>el.textContent.trim()==='ZGC').click()",
    );
    phase = "java-save";
    await run(
      "Array.from(document.querySelectorAll('button')).find(el=>el.textContent.trim()==='Save Java settings').click()",
    );
    await wait(
      async () =>
        !!(await run(
          "window.fixturePreferences.java?.memoryMinMiB===1536 && window.fixturePreferences.java?.garbageCollector==='zgc'",
        )),
    );
    result.javaSaved = await run(
      "window.fixturePreferences.java.autoDownloadMojang===true",
    );
    await delay(500);
    result.permGenDisabled = await run(
      "document.querySelector('[aria-label=\"PermGen size (MiB)\"]').disabled",
    );
    phase = "java-tabs";
    await run(
      "Array.from(document.querySelectorAll('[role=tab]')).find(el=>el.textContent==='Installations').click()",
    );
    await wait(
      async () =>
        !!(await run(
          "document.body.textContent.includes('Installed Java runtimes')",
        )),
    );
    phase = "minecraft-open";
    await run("document.querySelector('[aria-label=\"Minecraft\"]').click()");
    await wait(
      async () =>
        !!(await run(
          "document.querySelector('[data-settings-section=instance] [role=tab]')",
        )),
    );
    await delay(500);
    phase = "minecraft-controls";
    await run(
      "document.querySelector('[aria-label=\"When the game window opens, hide the launcher\"]').click()",
    );
    await run(
      "document.querySelector('[aria-label=\"Always show durations in hours\"]').click()",
    );
    phase = "minecraft-save";
    await run(
      "Array.from(document.querySelectorAll('button')).find(el=>el.textContent.trim()==='Save Minecraft settings').click()",
    );
    await wait(
      async () =>
        !!(await run(
          "window.fixturePreferences.minecraft?.hideLauncher===true && window.fixturePreferences.minecraft?.durationsInHours===true",
        )),
    );
    result.minecraftSaved = true;
    await delay(500);
    result.minecraftTabs = await run(
      "Array.from(document.querySelectorAll('[data-settings-section=instance] [role=tab]')).map(el=>el.textContent)",
    );
    phase = "other-settings";
    result.additionalSettings = [];
    for (const [label, section] of [
      ["General", "general"],
      ["Language", "language"],
      ["Services", "services"],
      ["Tools", "tools"],
      ["Proxy", "proxy"],
    ]) {
      await run(`document.querySelector('[aria-label="${label}"]').click()`);
      await wait(
        async () =>
          !!(await run(
            `document.querySelector('[data-settings-section="${section}"] [data-slot=card]')`,
          )),
      );
      (result.additionalSettings as string[]).push(
        await run(
          `document.querySelector('[data-settings-section="${section}"] header').textContent`,
        ),
      );
      if (section === "general") {
        await run(
          "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim()==='By last launched').click()",
        );
        await wait(
          async () =>
            !!(await run(
              "window.fixturePreferences.instanceSort==='last-played'",
            )),
        );
      }
      if (section === "tools") {
        await run(
          "Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim()==='Browse').click()",
        );
        await wait(
          async () =>
            !!(await run(
              "document.querySelector('[aria-label=\"Text editor path\"]').value==='/fixture/tools/editor'",
            )),
        );
      }
      if (section === "proxy") {
        await wait(
          async () =>
            !!(await run(
              "document.querySelector('button[type=submit]:not(:disabled)')",
            )),
        );
        result.proxySystemDisabled = await run(
          "document.querySelector('[aria-label=\"Proxy address\"]').disabled",
        );
        await run(
          "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim()==='HTTP').click()",
        );
        await wait(
          async () =>
            !!(await run(
              "!document.querySelector('[aria-label=\"Proxy address\"]').disabled && !document.querySelector('[aria-label=\"Proxy password\"]').disabled",
            )),
        );
        result.proxyHttpEnabled = true;
      }
    }
    await run(
      "Array.from(document.querySelectorAll('[data-slot=sidebar-header] button')).find(el => el.textContent.trim() === 'Main').click()",
    );
    await wait(
      async () =>
        !!(await run("document.querySelector('[data-fixture-page]')")),
    );
    result.mainReturn = await run(
      `document.querySelector('[data-fixture-page]').getAttribute('data-fixture-page') === ${JSON.stringify(previous)}`,
    );

    const confirmationPortal = async () => {
      for (const portal of portals) {
        if (
          !portal.isDestroyed() &&
          (await portal.webContents.executeJavaScript(
            '!!document.querySelector("[role=alertdialog]")',
          ))
        )
          return portal;
      }
      return null;
    };
    for (const action of ["cancel", "action", "escape"]) {
      await run("window.confirmFixture()");
      await wait(async () => !!(await confirmationPortal()));
      const portal = (await confirmationPortal())!;
      if (action === "escape")
        await portal.webContents.executeJavaScript(
          "document.querySelector('[data-slot=alert-dialog-cancel]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))",
        );
      else
        await portal.webContents.executeJavaScript(
          `document.querySelector('[data-slot=alert-dialog-${action}]').click()`,
        );
      await wait(async () => !(await confirmationPortal()));
    }
    result.confirmations = await run(
      "window.sidebarFixture.calls.filter(value => value.startsWith('confirm:'))",
    );

    phase = "instance-workspaces";
    await run("window.navigateRoute('/instances/create')");
    result.createRoute = await run("window.routePath()");
    await run("window.openWorkspace('create')");
    await wait(
      async () =>
        !!(await run("document.querySelector('[aria-label=\"New group\"]')")),
    );
    await run(`(() => {
      const input=document.querySelector('input[placeholder="My instance"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Native fixture');
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const group=document.querySelector('[aria-label="New group"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(group,'Friends');
      group.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('[aria-label="star instance icon"]').click();
    })()`);
    await run("document.querySelector('[aria-label=Import]').click()");
    await wait(
      async () =>
        !!(await run(
          "Array.from(document.querySelectorAll('main button')).find(el=>el.textContent.includes('Choose archive'))",
        )),
    );
    await run("document.querySelector('[aria-label=Custom]').click()");
    await wait(
      async () =>
        !!(await run(
          "document.querySelector('input[placeholder=\"My instance\"]')",
        )),
    );
    result.createState = await run(
      "document.querySelector('input[placeholder=\"My instance\"]').value",
    );
    await run("document.querySelector('main form').requestSubmit()");
    await wait(
      async () => !!(await run("window.instanceFixture.created.length")),
    );
    result.createdInstance = await run("window.instanceFixture.created[0]");
    await run(
      "window.navigateRoute('/instances/edit/6f60ed3d-84f9-4dd2-b77a-c3f037d0306e')",
    );
    result.editRoute = await run("window.routePath()");
    await run("window.openWorkspace('edit')");
    await wait(
      async () => !!(await run("document.querySelector('[aria-label=Notes]')")),
    );
    await run("document.querySelector('[aria-label=Notes]').click()");
    await wait(
      async () =>
        !!(await run(
          "document.querySelector('textarea')?.value === 'Fixture notes'",
        )),
    );
    result.editData = await run("window.instanceFixture.dataIds.at(-1)");
    await run("document.querySelector('[aria-label=Worlds]').click()");
    await wait(
      async () =>
        !!(await run(
          "Array.from(document.querySelectorAll('[data-slot=card-title]')).find(el=>el.textContent.includes('World & backup'))",
        )),
    );
    result.editSectionOnly = await run("!document.querySelector('textarea')");
    await run(
      "Array.from(document.querySelectorAll('[data-slot=sidebar-header] button')).find(el=>el.textContent.trim()==='Main').click()",
    );
    await wait(
      async () =>
        !!(await run("document.querySelector('[data-fixture-page]')")),
    );
    result.workspaceBack = true;
    await run("window.navigateRoute('/instance-data')");
    result.dataRoute = await run("window.routePath()");
    await run("window.openWorkspace('data')");
    await wait(
      async () =>
        !!(await run(
          "document.querySelector('textarea')?.value === 'Fixture notes'",
        )),
    );
    result.dataLoaded = true;
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
