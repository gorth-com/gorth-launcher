import path from "node:path";
import { app, BrowserWindow } from "electron";
import { setTimeout as delay } from "node:timers/promises";

const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-instance-workflow-")
)
  throw new Error("Isolated fixture directory required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const result: Record<string, unknown> = {};
const errors: string[] = [];
let phase = "mount";
const timer = setTimeout(() => {
  errors.push(phase + ": timed out");
  app.quit();
}, 30000);
app.once("quit", () => {
  clearTimeout(timer);
  console.log("GORTH_INSTANCE_WORKFLOW=" + JSON.stringify({ result, errors }));
});

void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    window.webContents.on("console-message", (details) => {
      if (details.level === "error")
        errors.push(phase + ": " + details.message);
    });
    const run = (script: string) =>
      window.webContents.executeJavaScript(script);
    const wait = async (condition: string) => {
      const deadline = Date.now() + 6000;
      while (!(await run(condition))) {
        if (Date.now() > deadline) throw new Error("Waiting for " + condition);
        await delay(25);
      }
    };
    const navigate = async (page: string) => {
      await run(`document.querySelector('[data-test-nav="${page}"]').click()`);
      await wait(`window.flow.page === ${JSON.stringify(page)}`);
    };
    await window.loadFile(path.join(directory, "renderer/index.html"));
    await wait("!!window.flow && !!document.querySelector('main')");
    if (process.argv.includes("--page-cards")) {
      await run("window.flow.navigate('downloads')");
      await wait("!!document.querySelector('[data-download-item]')");
      result.downloadCards = await run(`(() => {
        const layout = document.querySelector('[data-downloads-layout]');
        const card = layout.querySelector('[data-download-item]');
        const directory = layout.querySelector('[data-download-directory]');
        const actions = card.querySelector('[data-download-actions]');
        return {
          columns: getComputedStyle(layout).gridTemplateColumns.split(' ').length,
          ratio: layout.firstElementChild.getBoundingClientRect().width / layout.querySelector('aside').getBoundingClientRect().width,
          padding: getComputedStyle(card).padding,
          directoryCard: directory.getAttribute('data-slot') === 'card',
          below: card.getBoundingClientRect().top > directory.getBoundingClientRect().bottom,
          topRight: Math.abs(actions.getBoundingClientRect().top - card.getBoundingClientRect().top - 16) < 2 && Math.abs(actions.getBoundingClientRect().right - card.getBoundingClientRect().right + 16) < 2,
        };
      })()`);
      await run(
        "window.flow.navigate('notifications'); window.flow.failNotification()",
      );
      await wait(
        "document.querySelector('[data-notifications-layout]')?.textContent.includes('Lỗi')",
      );
      result.notificationCards = await run(`(() => {
        const layout = document.querySelector('[data-notifications-layout]');
        const card = layout.querySelector('[data-notification-item]');
        return {
          columns: getComputedStyle(layout).gridTemplateColumns.split(' ').length,
          padding: getComputedStyle(card).padding,
          title: !card.querySelector('[data-slot="card-title"]').textContent.includes('Mới'),
          badges: Array.from(layout.querySelectorAll('[data-slot="badge"]')).some(badge => badge.textContent === 'Lỗi'),
          heading: document.querySelector('main header').textContent.includes('Notifications'),
          unread: document.querySelector('main header [aria-label="Thông báo mới"]').textContent === '2',
          removed: !document.querySelector('main').textContent.includes('thông báo chưa đọc ·'),
        };
      })()`);
      await run(
        "Array.from(document.querySelectorAll('main header button')).find(button => button.textContent.includes('Đánh dấu đã đọc')).click()",
      );
      await wait(
        "document.querySelector('main header [aria-label=\"Thông báo mới\"]').textContent === '0'",
      );
      await run("window.flow.navigate('console')");
      await wait(
        "!!document.querySelector('[data-game-console] header [aria-label=\"Instance console\"]')",
      );
      result.consolePicker = true;
      await run("window.flow.navigate('pack')");
      await wait("!!document.querySelector('main form[role=search]')");
      await run(
        "window.flow.holdSearch(); document.querySelector('main form[role=search] button[type=submit]').click()",
      );
      await wait("!!document.querySelector('main [data-slot=spinner]')");
      result.searchSpinner = await run(
        "!document.querySelector('main').textContent.includes('Đang xử lý')",
      );
      await run("window.flow.resolveSearch()");
      await wait("!document.querySelector('main [data-slot=spinner]')");
      await run("window.flow.finishContent()");
      await wait("window.fixtureToasts?.includes('Cài đặt hoàn tất.')");
      result.completionToast = await run(
        "!document.querySelector('main').textContent.includes('Đã cài đặt. Mở Thư viện')",
      );
      window.destroy();
      return;
    }
    if (process.argv.includes("--logs")) {
      await run(
        "window.flow.navigate('instances/edit/b', { section: 'console' })",
      );
      await wait(
        "document.querySelector('[data-game-console] pre')?.textContent.includes('Beta log')",
      );
      result.consoleLayout = await run(`(() => {
        const page = document.querySelector('[data-game-console]');
        const toolbar = page.querySelector('[data-console-toolbar]');
        const block = page.querySelector('[data-slot="code-block"]');
        const stop = Array.from(toolbar.querySelectorAll('button')).find(button => button.textContent.trim() === 'Stop');
        return {
          toolbar: toolbar.getBoundingClientRect().height,
          fills: Math.abs(block.getBoundingClientRect().bottom - page.getBoundingClientRect().bottom) < 2,
          tall: block.getBoundingClientRect().height > 400,
          scrollArea: !!block.querySelector('[data-slot="scroll-area"]'),
          destructive: stop.className.includes('destructive'),
          text: page.textContent.includes('Game logs, launch output') && page.textContent.includes('Export xuất buffer gốc'),
        };
      })()`);
      await run(
        "Array.from(document.querySelectorAll('[data-game-console] button')).find(button => button.textContent.trim() === 'Clear').click()",
      );
      await wait(
        "document.querySelector('[data-game-console] pre')?.textContent.includes('Chưa có log')",
      );
      await run(
        "Array.from(document.querySelectorAll('[data-game-console] button')).find(button => button.textContent.trim() === 'Export').click()",
      );
      result.consoleExport = await run(
        "window.flow.calls.some(call => call.action === 'export.log' && call.id === 'b')",
      );
      await run(
        "window.flow.navigate('instances/edit/b', { section: 'logs' })",
      );
      await wait(
        "document.querySelector('[data-other-logs] pre')?.textContent.includes('latest.log')",
      );
      await run(
        "document.querySelector('[aria-label=\"Other log file\"]').click()",
      );
      await wait(
        "Array.from(document.querySelectorAll('[role=option]')).some(option => option.textContent.includes('archived.log.gz'))",
      );
      await run(
        "Array.from(document.querySelectorAll('[role=option]')).find(option => option.textContent.includes('archived.log.gz')).click()",
      );
      await wait(
        "document.querySelector('[data-other-logs] pre')?.textContent.includes('archived.log.gz')",
      );
      result.otherLogs = await run(`(() => {
        const page = document.querySelector('[data-other-logs]');
        const block = page.querySelector('[data-slot="code-block"]');
        return {
          gzip: block.textContent.includes('archived.log.gz'),
          literal: block.textContent.includes('<unsafe>') && !block.querySelector('unsafe'),
          scrollArea: !!block.querySelector('[data-slot="scroll-area"]'),
          height: block.getBoundingClientRect().height,
          export: Array.from(page.querySelectorAll('button')).some(button => button.textContent.trim() === 'Export'),
          fits: page.getBoundingClientRect().bottom <= window.innerHeight,
        };
      })()`);
      await run(
        "Array.from(document.querySelectorAll('[data-other-logs] button')).find(button => button.textContent.trim() === 'Bottom').click()",
      );
      await wait(
        "document.querySelector('[data-other-logs] [data-slot=\"scroll-area-viewport\"]').scrollTop > 0",
      );
      result.otherLogsBottom = true;
      await run(`(() => {
        const input = document.querySelector('[aria-label="Search other logs"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'archived log');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await run(
        "document.querySelector('[data-other-logs] form button[type=submit]').click()",
      );
      await wait("!!document.querySelector('[data-log-line=\"0\"].bg-accent')");
      result.otherLogsFind = true;
      await run("window.flow.navigate('console')");
      await wait(
        "document.querySelector('[data-game-console] header')?.textContent.includes('Console')",
      );
      result.consoleHeading = true;
      window.destroy();
      return;
    }
    if (process.argv.includes("--installed-mods")) {
      await run(
        "window.flow.enableModMetadata(); window.flow.navigate('instances/edit/a', { section: 'overview' })",
      );
      await wait(
        "document.querySelector('[data-modpack-overview]')?.textContent.includes('Updated mods')",
      );
      result.modpackOverview = await run(`(() => {
        const card = document.querySelector('[data-modpack-overview]');
        return {
          info: ['Master of Cipher', '2.0.0', '1526695', '9418600', 'CurseForge'].every(text => card.textContent.includes(text)),
          actions: Array.from(card.querySelectorAll('button')).filter(button => ['Update Pack', 'Update From File'].includes(button.textContent.trim())).length,
          changelog: card.textContent.includes('Major Updates') && !window.unsafeChangelog && !card.querySelector('script'),
        };
      })()`);
      await run(
        "window.flow.navigate('instances/edit/a', { section: 'version' })",
      );
      await wait(
        "document.querySelector('[data-runtime-components]')?.textContent.includes('3.3.1')",
      );
      result.runtimeComponents = await run(`(() => {
        const container = document.querySelector('[data-runtime-components]');
        const card = container.querySelector('[data-slot="card"]');
        return {
          table: !!container.querySelector('table'),
          minecraft: container.textContent.includes('1.20.1'),
          padding: getComputedStyle(card).padding,
          gap: getComputedStyle(card).gap,
          ratio: container.firstElementChild.getBoundingClientRect().width / card.getBoundingClientRect().width,
        };
      })()`);
      await run(
        "window.flow.enableModMetadata(); window.flow.navigate('instances/edit/a', { section: 'mod' })",
      );
      await wait(
        "document.querySelector('main')?.textContent.includes('Identified Fixture Mod')",
      );
      result.installedMods = await run(`(() => {
        const container = document.querySelector('[data-installed-content]');
        const sidebar = container.querySelector('aside');
        const toggle = container.querySelector('[role="switch"]');
        const card = toggle.closest('[data-slot="card"]');
        return {
          columns: getComputedStyle(container).gridTemplateColumns.split(' ').length,
          ratio: container.firstElementChild.getBoundingClientRect().width / sidebar.getBoundingClientRect().width,
          online: card.textContent.includes('CurseForge') && card.textContent.includes('1.2.3') && card.textContent.includes('Fixture author'),
          checked: toggle.getAttribute('aria-checked'),
          footerJustify: getComputedStyle(toggle.parentElement).justifyContent,
          search: !!sidebar.querySelector('input'),
          searchOutside: !sidebar.querySelector('[data-slot="card"] input') && !!sidebar.querySelector('form button[type="submit"]'),
          padding: getComputedStyle(sidebar.querySelector('[data-slot="card"]')).padding,
          gap: getComputedStyle(sidebar.querySelector('[data-slot="card"]')).gap,
        };
      })()`);
      await run(
        "document.querySelector('[data-installed-content] [role=switch]').click()",
      );
      await wait(
        "document.querySelector('[data-installed-content] [role=switch]')?.getAttribute('aria-checked') === 'false'",
      );
      await run(
        "document.querySelector('[data-installed-content] [role=switch]').click()",
      );
      await wait(
        "document.querySelector('[data-installed-content] [role=switch]')?.getAttribute('aria-checked') === 'true'",
      );
      result.installedMods.toggled = await run(
        "window.flow.calls.some(call => call.action === 'disable') && window.flow.calls.some(call => call.action === 'enable')",
      );
      window.destroy();
      return;
    }
    result.badges = await run(
      `Array.from(document.querySelectorAll('[data-slot="sidebar-menu-badge"]')).map(el => ({ text: el.textContent, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))`,
    );
    result.home = await run(
      `({ oldPanels: /Active Profile|Runtime|Total Launches|Recent Activity|Last Played Profiles/.test(document.querySelector('main').innerText), recent: document.querySelector('main').innerText.includes('Recently played'), selects: document.querySelectorAll('main select').length })`,
    );
    result.removedNavigation = await run(
      `!document.querySelector('[data-slot="sidebar-menu-button"][aria-label="Gallery"]') && !document.querySelector('[data-slot="sidebar-menu-button"][aria-label="Dữ liệu instance"]')`,
    );

    phase = "console isolation";
    await navigate("console");
    result.noOtherGameLog = await run(
      `!document.querySelector('pre').textContent.includes('Beta log')`,
    );
    await navigate("home");
    await run(
      `const select = document.querySelector('select[aria-label="Instance trang chủ"]'); select.value = 'b'; select.dispatchEvent(new Event('change', {bubbles:true}));`,
    );
    await wait("window.flow.selected === 'b'");
    await navigate("instances");
    result.instances = await run(
      `({ cards: document.querySelectorAll('main [data-slot="card"]').length, aside: !!document.querySelector('main aside'), oldSelector: !!document.querySelector('[aria-label="Instance settings preview"]') })`,
    );
    result.instanceToolbar = await run(`(() => {
      const form = document.querySelector('main form[role="search"]');
      const input = form.querySelector('input[aria-label="Tìm instance"]');
      const select = form.querySelector('[aria-label="Lọc mod loader"]');
      const search = form.querySelector('button[type="submit"]');
      const layout = form.querySelector('[aria-label="Instance layout"]');
      const header = document.querySelector('main header');
      return {
        order: select.getBoundingClientRect().x < input.getBoundingClientRect().x && input.getBoundingClientRect().x < search.getBoundingClientRect().x && search.getBoundingClientRect().x < layout.getBoundingClientRect().x,
        selectWidth: select.getBoundingClientRect().width,
        gap: getComputedStyle(form).gap,
        sectionGap: getComputedStyle(form.parentElement).gap,
        iconInside: !!input.parentElement.querySelector('svg'),
        countInside: select.textContent.includes('(2)'),
        actionsInHeading: header.textContent.includes('Nhập instance mồ côi') && header.textContent.includes('Tạo instance') && getComputedStyle(header).justifyContent === 'space-between',
      };
    })()`);
    await run(`document.querySelector('main [aria-label="List"]').click()`);
    result.instanceList = await run(
      `document.querySelector('main [aria-label="List"]').getAttribute('aria-pressed') === 'true'`,
    );
    result.instanceHorizontal = await run(`(() => {
      const card = document.querySelector('main [data-slot="card"]');
      const image = card.firstElementChild;
      const name = card.querySelector('[data-slot="card-title"]');
      const play = Array.from(card.querySelectorAll('button')).find(button => button.textContent.trim() === 'Play now');
      const badge = card.querySelector('[data-slot="badge"]');
      return getComputedStyle(card).flexDirection === 'row' && image.getBoundingClientRect().x < name.getBoundingClientRect().x && name.getBoundingClientRect().x < play.getBoundingClientRect().x && Math.abs(name.getBoundingClientRect().y - play.getBoundingClientRect().y) < 2 && badge.getBoundingClientRect().y > play.getBoundingClientRect().bottom && getComputedStyle(card).padding === '16px' && getComputedStyle(card).gap === '16px';
    })()`);
    await run(`(() => {
      const input = document.querySelector('main input[aria-label="Tìm instance"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ' Beta ');
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`);
    await run(`document.querySelector('main button[type="submit"]').click()`);
    await wait(
      `document.querySelector('main input[aria-label="Tìm instance"]').value === 'Beta'`,
    );
    result.instanceSearch = await run(
      `document.querySelectorAll('main [data-slot="card"]').length`,
    );
    await run(
      `Array.from(document.querySelectorAll('main button')).find(button => button.textContent.trim() === 'Play now').click()`,
    );
    result.instancePlay = await run(
      `window.flow.calls.some(command => command.action === 'play' && command.instance.id === 'b')`,
    );
    result.instanceDetailIcon = await run(
      `document.querySelector('main button[aria-label="Chi tiết Beta"]').textContent.trim() === ''`,
    );
    await run(
      `document.querySelector('main button[aria-label="Chi tiết Beta"]').click()`,
    );
    await wait("!!document.querySelector('[aria-label=\"Minecraft log\"]')");
    await run(
      "document.querySelector('[aria-label=\"Minecraft log\"]').click()",
    );
    await wait(
      "document.querySelector('pre')?.textContent.includes('Beta log')",
    );
    await run(`document.fonts.load('600 13px "JetBrains Mono"')`);
    result.log = await run(
      `(() => { const el=document.querySelector('[data-slot="code-block-content"]'); const style=getComputedStyle(el); return { family:style.fontFamily, weight:style.fontWeight, size:style.fontSize, loaded:document.fonts.check('600 13px "JetBrains Mono"'), literal:el.textContent.includes('<unsafe>'), unsafe:!!el.querySelector('unsafe'), selector:!!document.querySelector('[aria-label="Instance console"]') }; })()`,
    );

    phase = "editor content";
    await run("document.querySelector('[aria-label=\"Mods\"]').click()");
    await wait("document.body.innerText.includes('Chưa tìm thấy mod')");
    result.editorContentSelector = await run(
      `!!document.querySelector('[aria-label="Quản lý nội dung của instance"]')`,
    );
    await run(
      `Array.from(document.querySelectorAll('button')).find(el=>el.textContent.includes('Browse & install')).click()`,
    );
    await wait("window.flow.page === 'mods'");
    await wait(
      `document.querySelector('[aria-label="Instance đích"][data-slot="select-trigger"]')?.textContent.includes('Beta')`,
    );
    result.contentHasManager = await run(
      `document.body.innerText.includes('Tải danh sách') || document.body.innerText.includes('Kiểm tra cập nhật')`,
    );
    await run(`document.querySelector('button[type="submit"]').click()`);
    await wait("window.flow.calls.some(item=>item.provider === 'modrinth')");
    result.search = await run(
      "window.flow.calls.find(item=>item.provider === 'modrinth')",
    );

    phase = "legacy screenshot route";
    await run("window.flow.navigate('gallery')");
    await wait(
      "window.flow.page === 'instances/edit/b' && !!document.querySelector('img[alt=\"shot.png\"]')",
    );
    result.screenshots = await run("window.flow.selected === 'b'");
    await run("window.flow.navigate('instances/data')");
    await wait("document.querySelector('textarea')?.value === 'Notes for b'");
    result.dataSelector = await run(
      "!!document.querySelector('[aria-label=\"Choose instance\"]')",
    );
    await run("document.querySelector('[aria-label=\"Other logs\"]').click()");
    await wait("document.body.innerText.includes('latest.log')");
    await wait(
      "document.querySelector('[data-slot=\"code-block-content\"]')?.textContent.includes('archived log for b')",
    );
    result.archiveFont = await run(
      `getComputedStyle(document.querySelector('pre')).fontSize`,
    );

    phase = "downloads destinations";
    await navigate("downloads");
    result.downloads = await run(
      `({ pre:!!document.querySelector('main pre'), history:document.querySelector('main').innerText.includes('Lịch sử chơi'), progress:!!document.querySelector('progress') })`,
    );
    await run(
      `Array.from(document.querySelectorAll('main button')).find(el=>el.textContent.trim()==='Console').click()`,
    );
    await wait(
      "window.flow.page === 'console' && window.flow.selected === 'b'",
    );
    result.downloadConsole = await run(
      "document.querySelector('pre').textContent.includes('Beta log')",
    );
    await navigate("downloads");
    await run(
      `Array.from(document.querySelectorAll('main button')).find(el=>el.textContent.trim()==='History').click()`,
    );
    await wait("!!document.querySelector('[data-history]')");
    result.history = true;
    phase = "pack catalog";
    await navigate("pack");
    result.packTabs = await run(
      `Array.from(document.querySelectorAll('main [role="tab"]')).map(tab => tab.textContent)`,
    );
    result.packDefaults = await run(
      `({provider: document.querySelector('main [aria-label="Nguồn"][data-slot="select-trigger"]').textContent.includes('CurseForge'), browse: document.querySelector('main [aria-label="Instance đích"][data-slot="select-trigger"]').textContent.includes('Chỉ duyệt')})`,
    );
    result.packFiltersRight = await run(`(() => {
      const filters = document.querySelector('main form[aria-label="Filters"]');
      const aside = filters.closest('aside');
      return aside.getBoundingClientRect().x > aside.nextElementSibling.getBoundingClientRect().x;
    })()`);
    result.packToolbar = await run(`(() => {
      const search = document.querySelector('main form[role="search"]');
      const tabs = document.querySelector('main [role="tablist"]');
      const aside = document.querySelector('main form[aria-label="Filters"]').closest('aside');
      const columns = getComputedStyle(aside.parentElement).gridTemplateColumns.split(' ').map(Number.parseFloat);
      return {
        searchRight: search.getBoundingClientRect().x > tabs.getBoundingClientRect().x || search.getBoundingClientRect().y >= tabs.getBoundingClientRect().bottom,
        searchIcon: !!search.querySelector('input').parentElement.querySelector('svg'),
        noLabel: !search.querySelector('label'),
        headingRight: aside.querySelector('header').textContent.includes('Pack'),
        card: !!aside.querySelector('[data-slot="card"]'),
        equalColumns: columns.length === 3 && Math.max(...columns) - Math.min(...columns) < 1,
        searchWithinRight: aside.contains(search),
        equalTabWidths: (() => { const widths = Array.from(tabs.querySelectorAll('[role="tab"]')).map(tab => tab.getBoundingClientRect().width); return widths.length === 5 && Math.max(...widths) - Math.min(...widths) < 1 && Math.max(...widths) <= 181; })(),
        searchIconOnly: search.querySelector('button[type="submit"]').textContent.trim() === '',
        sortWidth: document.querySelector('main [aria-label="Sort projects"]').getBoundingClientRect().width,
        countWidth: document.querySelector('main [aria-label="Items per page"]').getBoundingClientRect().width,
        controlsJustify: getComputedStyle(document.querySelector('main [aria-label="Catalog controls"]')).justifyContent,
        pagingBeforeLayout: document.querySelector('main [aria-label="Project pages"]').getBoundingClientRect().x < document.querySelector('main [aria-label="Project layout"]').getBoundingClientRect().x,
      };
    })()`);
    for (const title of ["Resource Packs", "Shader Packs"]) {
      await run(
        `Array.from(document.querySelectorAll('main [role="tab"]')).find(tab => tab.textContent === ${JSON.stringify(title)}).click()`,
      );
      await wait(
        `Array.from(document.querySelectorAll('main [role="tab"]')).find(tab => tab.textContent === ${JSON.stringify(title)}).getAttribute('aria-selected') === 'true'`,
      );
      await run(
        `document.querySelector('main form[role="search"] button[type="submit"]').click()`,
      );
      await wait(
        `window.flow.calls.some(query => query.kind === '${title === "Resource Packs" ? "resourcepack" : "shader"}' && query.provider === 'curseforge')`,
      );
    }
    result.packSearchKinds = await run(
      `window.flow.calls.filter(query => query.provider === 'curseforge').map(query => query.kind)`,
    );
    await run("window.flow.navigate('console'); window.flow.remove('b')");
    await wait(
      "window.flow.page === 'console' && window.flow.selected === 'a'",
    );
    result.deletedFallback = await run(
      "!document.querySelector('pre').textContent.includes('Beta log')",
    );
    window.destroy();
  } catch (error) {
    errors.push(phase + ": " + String(error));
  } finally {
    app.quit();
  }
})();
