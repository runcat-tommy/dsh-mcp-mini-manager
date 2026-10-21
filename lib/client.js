/**
 * dsh-mcp-mini-manager, browser half.
 *
 * One Settings page — `settings.section` id `mcp-mini-manager`, order 16 — so it
 * sits in the settings sidebar at the same level as the built-in 插件 (Plugins)
 * section rather than inside it.
 *
 * The page lists every MCP server this DSH actually loads. In DSH an MCP server
 * is one loader row of `@deepseek-ai/dsh-mcp-client`, so the host half reads the
 * Loader's live entry tree and reconciles it with the composed patch layers; each
 * row arrives here with its own summary (transport and endpoint), its live state,
 * and the MCP tools it registered. One 移除 action per server writes an
 * id-targeted disable patch into the profile's own layer — a recoverable removal
 * the user can undo from the same page, and one that never edits a package file.
 *
 * Hand-written ModuleLoader bundle (no build step, no bundler): it requires only
 * `react` from the platform seed and talks to its host half over plain
 * same-origin `fetch`. All copy is localized through the `locale` service and
 * re-registered on locale change, so the DSH UI language drives this page too.
 *
 * The plugin NEVER sends a path or a YAML fragment to the host: every request
 * carries a row id the catalog itself reported, and the host re-derives the file
 * and the patch from it.
 */

window.__ModuleLoader__.load({
  id: "dsh-mcp-mini-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var React = require("react");

    /** Dictionary namespace owned by this plugin. */
    var NS = "mcpMiniManager";

    /** Route base served by this package's host half. */
    var API = "/dsh-mcp-mini-manager/api";

    /* ------------------------------- styles ------------------------------- */

    var CSS = [
      ".mmm-root { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 820px; color: var(--dsw-alias-label-primary); }",
      ".mmm-head { display: flex; flex-direction: column; gap: 4px; }",
      ".mmm-head h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; }",
      ".mmm-sub { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }",
      ".mmm-search { position: relative; display: flex; align-items: center; width: 100%; }",
      ".mmm-search input { width: 100%; height: 34px; font: inherit; font-size: 13px; padding: 0 10px; border-radius: 8px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); outline: none; }",
      ".mmm-search input:focus-visible { border-color: var(--dsw-alias-state-business-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent); }",
      ".mmm-btn { font: inherit; font-size: 13px; line-height: 20px; padding: 6px 12px; border-radius: 8px; cursor: pointer; color: var(--dsw-alias-label-primary); background: transparent; border: 1px solid var(--dsw-alias-border-l2); white-space: nowrap; }",
      ".mmm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }",
      ".mmm-btn:disabled { cursor: default; opacity: 0.55; }",
      ".mmm-btn.small { font-size: 12px; line-height: 18px; padding: 4px 10px; }",
      ".mmm-btn.danger { color: var(--dsw-alias-state-error-primary); }",
      ".mmm-btn.primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-foreground); }",
      ".mmm-btn.primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }",
      ".mmm-list { display: flex; flex-direction: column; gap: 9px; margin: 0; padding: 0; list-style: none; }",
      ".mmm-card { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; border-radius: 12px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); }",
      ".mmm-card:hover { border-color: var(--dsw-alias-border-l2); }",
      ".mmm-card.off { background: var(--dsw-alias-bg-layer-2); }",
      ".mmm-card.armed { border-color: var(--dsw-alias-state-error-primary); }",
      ".mmm-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
      ".mmm-name { font-size: 14px; line-height: 20px; font-weight: 600; overflow-wrap: anywhere; }",
      ".mmm-tag { font-size: 11px; line-height: 16px; padding: 1px 7px; border-radius: 999px; color: var(--dsw-alias-label-tertiary); border: 1px solid var(--dsw-alias-border-l2); white-space: nowrap; }",
      ".mmm-tag.active { color: var(--dsw-alias-state-success-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 40%, transparent); }",
      ".mmm-tag.failed { color: var(--dsw-alias-state-error-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent); }",
      ".mmm-tag.starting { color: var(--dsw-alias-state-business-primary); }",
      ".mmm-tag.off { color: var(--dsw-alias-label-secondary); }",
      ".mmm-tag.warn { color: var(--dsw-alias-state-warn-primary); }",
      ".mmm-spacer { flex: 1 1 auto; }",
      ".mmm-desc { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }",
      ".mmm-desc.mono { font-family: var(--ds-font-family-code); font-size: 12px; line-height: 18px; }",
      ".mmm-meta { margin: 0; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-dimmed); font-family: var(--ds-font-family-code); overflow-wrap: anywhere; }",
      ".mmm-tools { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }",
      ".mmm-tools li { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); font-family: var(--ds-font-family-code); overflow-wrap: anywhere; }",
      ".mmm-confirm { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 8px; background: var(--dsw-alias-interactive-bg-hover-danger); border: 1px solid var(--dsw-alias-border-l2); }",
      ".mmm-confirm p { margin: 0; font-size: 12px; line-height: 18px; }",
      ".mmm-confirm .path, .mmm-preview { font-family: var(--ds-font-family-code); font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; white-space: pre-wrap; margin: 0; }",
      ".mmm-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
      ".mmm-notice { margin: 0; font-size: 12px; line-height: 18px; padding: 8px 10px; border-radius: 8px; }",
      ".mmm-notice.ok { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-interactive-bg-hover); }",
      ".mmm-notice.bad { color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-interactive-bg-hover-danger); }",
      ".mmm-notice.warn { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); }",
      ".mmm-section { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); }",
      ".mmm-section h3 { margin: 0; font-size: 13px; line-height: 20px; font-weight: 600; }",
      ".mmm-section h3 .count { color: var(--dsw-alias-label-tertiary); font-weight: 400; font-variant-numeric: tabular-nums; }",
      ".mmm-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }",
      ".mmm-row .grow { flex: 1 1 160px; min-width: 0; }",
      ".mmm-empty { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary); }",
      ".mmm-foot { display: flex; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); flex-wrap: wrap; }",
      ".mmm-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--dsw-alias-border-l3); border-top-color: var(--dsw-alias-brand-primary); animation: mmm-spin 0.8s linear infinite; display: inline-block; flex: none; }",
      "@keyframes mmm-spin { to { transform: rotate(360deg); } }",
    ].join(" ");

    /* ----------------------------- dictionaries ----------------------------- */

    var zh = {
      nav: "MCP 极简管理",
      title: "MCP 极简管理",
      subtitle: "当前 DSH 实际装载的 MCP 服务器。移除一个会在本 profile 的 cordis.patch.yml 里写入一条停用补丁，可随时恢复。",
      search: "搜索 MCP",
      searchPlaceholder: "按名称或简介过滤…",
      refresh: "刷新",
      close: "完成",
      loading: "正在读取 MCP 列表…",
      errorTitle: "读取失败",
      retry: "重试",
      empty: "当前没有装载任何 MCP 服务器。",
      emptyHint: "MCP 服务器是 cordis 里一行 @deepseek-ai/dsh-mcp-client。在本 profile 的 cordis.patch.yml 里加一行即可装入，装好后回到这里就能看到。",
      emptySearch: "没有匹配的 MCP 服务器。",
      count: "共 {0} 个 MCP 服务器",
      countFiltered: "匹配 {0} / {1} 个",
      countActive: "{0} 个在用",
      countDisabled: "{0} 个已移除",
      remove: "移除",
      removeTitle: "移除 MCP「{0}」？",
      removeHint: "会向下面这个文件追加一条停用补丁（不改动任何包文件）：",
      removeBlock: "追加内容：",
      removeYes: "确认移除",
      removeEffectLive: "已写入停用补丁，并已即时生效。",
      removeEffectRestart: "已写入停用补丁，重启 DSH 后生效。",
      cancel: "取消",
      stateActive: "在用",
      stateDisabled: "已移除",
      stateFailed: "启动失败",
      stateStarting: "启动中",
      stateUnobserved: "未观测",
      transportStdio: "stdio",
      transportHttp: "streamable-http",
      noTransport: "未声明传输方式，这一行无法连接。",
      tools: "{0} 个工具",
      toolsNone: "没有注册任何工具",
      toolsTitle: "模型可见的工具",
      configLive: "配置来自运行中的实例",
      configRecord: "配置来自移除记录",
      configNone: "配置不可读",
      removedSection: "已移除（可恢复）",
      removedHint: "移除记录保存在 {0}。恢复只是删掉那条停用补丁。",
      restore: "恢复",
      restored: "已恢复「{0}」。",
      restoreEffectLive: "已恢复，并已即时生效。",
      restoreEffectRestart: "已恢复，重启 DSH 后生效。",
      removedAt: "移除于 {0}",
      recordStale: "补丁文件里已经没有对应的停用块了，这条记录只是残留。",
      purge: "清空移除记录",
      purgeConfirm: "清空移除记录会删除 {0} 条记录，不会恢复任何 MCP。",
      purgeYes: "清空记录",
      purged: "已清空 {0} 条移除记录。",
      advisorySection: "疑似自带 MCP 能力的插件",
      advisoryHint: "下面这些是普通 DSH 插件，它们自己用 MCP 连接远端（不经过 dsh-mcp-client），工具命名也由插件自己决定。移除它们等于卸载插件，所以这里只列出、不提供操作。",
      advisoryTools: "其中 {0} 个提供界面",
      diagnostics: "诊断信息",
      profile: "profile",
      patchFile: "写入目标",
      homePatch: "home 层补丁",
      harnessHome: "harness home",
      layers: "读取的补丁层",
      layerRows: "{0} 行",
      loaderMissing: "没有读到 loader 服务，无法列出运行中的行。",
      toolsMissing: "没有读到工具注册表，工具列表为空不代表没有工具。",
      loaderError: "读取 loader 时出错：{0}",
      unsupportedLayer: "这一层有 {0} 处无法解析的内容。",
      caveat: "说明：fiber 处于 active 只表示插件装载成功，不代表远端连上了；连接状态只写在日志里。",
      errCrossOrigin: "请求来源不受信任，已拒绝。",
      errBadRowId: "这个行 id 不合法。",
      errUnknownRow: "这个 MCP 行已不存在，请刷新。",
      errAlreadyDisabled: "这一行已经是停用状态，无需重复写入。",
      errNoManagedBlock: "没有找到本插件写入的停用块，可能已被手动删除。",
      errMarkerUnpaired: "补丁文件里的标记不配对（可能被手动改过或写入中断），为避免误删已拒绝操作。",
      errNoTrailingNewline: "补丁文件末尾没有换行，写入会让恢复不再精确，因此拒绝。请补一个换行后重试。",
      errNoProfile: "没有找到 profile 目录，无法写入停用补丁。",
      errNoPatchFile: "profile 里没有 cordis.patch.yml。",
      errWriteFailed: "写入失败：{0}",
      errBadResponse: "响应无法解析。",
      errHostUnreachable: "插件的主机半侧没有响应。装上后需要重启一次 DSH（dsh web）才会挂载路由。",
      errInternal: "主机半侧出错了。",
      errGeneric: "操作失败：{0}",
      unknown: "未知",
    };

    var en = {
      nav: "MCP Mini Manager",
      title: "MCP Mini Manager",
      subtitle: "The MCP servers this DSH actually loads. Removing one writes a disable patch into this profile's cordis.patch.yml, and you can restore it from the same page.",
      search: "Search MCP servers",
      searchPlaceholder: "Filter by name or summary…",
      refresh: "Refresh",
      close: "Done",
      loading: "Reading the MCP list…",
      errorTitle: "Could not read the list",
      retry: "Retry",
      empty: "No MCP server is currently loaded.",
      emptyHint: "An MCP server is one @deepseek-ai/dsh-mcp-client row in cordis. Add a row to this profile's cordis.patch.yml to load one, then come back here.",
      emptySearch: "No MCP server matches.",
      count: "{0} MCP server(s)",
      countFiltered: "{0} of {1} shown",
      countActive: "{0} in service",
      countDisabled: "{0} removed",
      remove: "Remove",
      removeTitle: "Remove the MCP server “{0}”?",
      removeHint: "This appends one disable patch to the file below. No package file is touched:",
      removeBlock: "Appended:",
      removeYes: "Confirm removal",
      removeEffectLive: "Disable patch written, and already in effect.",
      removeEffectRestart: "Disable patch written; it takes effect after DSH restarts.",
      cancel: "Cancel",
      stateActive: "In service",
      stateDisabled: "Removed",
      stateFailed: "Failed to start",
      stateStarting: "Starting",
      stateUnobserved: "Unobserved",
      transportStdio: "stdio",
      transportHttp: "streamable-http",
      noTransport: "No transport declared, so this row cannot connect.",
      tools: "{0} tool(s)",
      toolsNone: "No tool registered",
      toolsTitle: "Tools the model can see",
      configLive: "config from the running instance",
      configRecord: "config from the removal record",
      configNone: "config unreadable",
      removedSection: "Removed (restorable)",
      removedHint: "Removal records live in {0}. Restoring just deletes that disable patch.",
      restore: "Restore",
      restored: "Restored “{0}”.",
      restoreEffectLive: "Restored, and already in effect.",
      restoreEffectRestart: "Restored; it takes effect after DSH restarts.",
      removedAt: "Removed {0}",
      recordStale: "The patch file no longer holds the matching disable block, so this record is only a leftover.",
      purge: "Clear removal records",
      purgeConfirm: "Clearing removal records deletes {0} record(s). It restores no MCP server.",
      purgeYes: "Clear records",
      purged: "Cleared {0} removal record(s).",
      advisorySection: "Plugins that appear to speak MCP themselves",
      advisoryHint: "These are ordinary DSH plugins that consume MCP on their own (not through dsh-mcp-client) and choose their own tool names. Removing one would be uninstalling a plugin, so they are listed here with no action offered.",
      advisoryTools: "{0} of them ship a UI",
      diagnostics: "Diagnostics",
      profile: "profile",
      patchFile: "Write target",
      homePatch: "Home-layer patch",
      harnessHome: "harness home",
      layers: "Patch layers read",
      layerRows: "{0} row(s)",
      loaderMissing: "No loader service was readable, so the running rows cannot be listed.",
      toolsMissing: "No tool registry was readable, so an empty tool list does not mean there are no tools.",
      loaderError: "Reading the loader failed: {0}",
      unsupportedLayer: "This layer has {0} unparsed construct(s).",
      caveat: "Note: a fiber in state active only means the plugin loaded; it does not mean the server connected. Connection state is reported to the log only.",
      errCrossOrigin: "The request came from an untrusted origin and was refused.",
      errBadRowId: "That row id is not valid.",
      errUnknownRow: "That MCP row no longer exists — refresh.",
      errAlreadyDisabled: "That row is already disabled; there is nothing to write.",
      errNoManagedBlock: "No disable block written by this plugin was found; it may have been deleted by hand.",
      errMarkerUnpaired: "The patch file's markers are unpaired (hand-edited, or an interrupted write). The operation was refused rather than risk a bad splice.",
      errNoTrailingNewline: "The patch file does not end with a newline, which would make restore inexact. Add one and retry.",
      errNoProfile: "No profile directory was found, so no disable patch can be written.",
      errNoPatchFile: "The profile has no cordis.patch.yml.",
      errWriteFailed: "Writing failed: {0}",
      errBadResponse: "The response could not be parsed.",
      errHostUnreachable: "The plugin's host half did not answer. It mounts its routes on the next DSH start (dsh web).",
      errInternal: "The host half failed.",
      errGeneric: "Failed: {0}",
      unknown: "unknown",
    };

    /* -------------------------------- helpers -------------------------------- */

    var boundT = null;

    /** Translate `key`, substituting positional `{0}`-style placeholders. */
    function tf(key, args) {
      var text = boundT ? boundT(key) : key;
      if (args) {
        for (var i = 0; i < args.length; i++) text = String(text).split("{" + i + "}").join(String(args[i]));
      }
      return text;
    }

    /** `React.createElement` with variadic children. */
    function el(type, props) {
      var rest = Array.prototype.slice.call(arguments, 2);
      return React.createElement.apply(React, [type, props].concat(rest));
    }

    /** Short, locale-aware timestamp. */
    function formatStamp(ms) {
      if (typeof ms !== "number" || !isFinite(ms)) return "";
      try {
        return new Date(ms).toLocaleString();
      } catch (error) {
        return String(ms);
      }
    }

    /**
     * One JSON call to the host half.
     *
     * A non-JSON body is reported as `host-unreachable` rather than a parse
     * failure: the SPA fallback answers an unmounted route with index.html and a
     * 200, which is exactly what a not-yet-restarted host looks like.
     */
    function request(path, init) {
      var options = Object.assign(
        { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } },
        init || {},
      );
      return fetch(path, options).then(function (response) {
        var type = response.headers.get("content-type") || "";
        if (type.indexOf("application/json") === -1) throw new Error("host-unreachable");
        return response.json().then(
          function (payload) {
            if (!response.ok) throw new Error(payload && payload.error ? payload.error : "http-" + response.status);
            if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || "bad-response");
            return payload;
          },
          function () {
            throw new Error("bad-response");
          },
        );
      });
    }

    /** POST one JSON body and return the parsed payload. */
    function post(path, body) {
      return request(path, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
    }

    /** Map one failure code onto localized copy. */
    function describeError(error) {
      var code = error && error.message ? error.message : "unknown";
      var known = {
        "cross-origin": "errCrossOrigin",
        "bad-row-id": "errBadRowId",
        "unknown-row": "errUnknownRow",
        "already-disabled": "errAlreadyDisabled",
        "no-managed-block": "errNoManagedBlock",
        "marker-unpaired": "errMarkerUnpaired",
        "no-trailing-newline": "errNoTrailingNewline",
        "no-profile": "errNoProfile",
        "no-patch-file": "errNoPatchFile",
        "write-failed": "errWriteFailed",
        "bad-response": "errBadResponse",
        "host-unreachable": "errHostUnreachable",
        internal: "errInternal",
      };
      if (code in known) return tf(known[code]);
      return tf("errGeneric", [code]);
    }

    /** Localized label for one live state. */
    function stateLabel(state) {
      var known = {
        active: "stateActive",
        disabled: "stateDisabled",
        failed: "stateFailed",
        starting: "stateStarting",
        unobserved: "stateUnobserved",
      };
      return tf(known[state] || "stateUnobserved");
    }

    /** Localized label for one transport. */
    function transportLabel(transport) {
      if (transport === "stdio") return tf("transportStdio");
      if (transport === "streamable-http") return tf("transportHttp");
      return tf("unknown");
    }

    /** Localized label for where a row's config came from. */
    function configSourceLabel(source) {
      if (source === "removal-record") return tf("configRecord");
      if (source === "live") return tf("configLive");
      return tf("configNone");
    }

    /** Localized label for one layer kind. */
    function layerLabel(layer) {
      if (layer.kind === "bundle") return layer.label;
      if (layer.kind === "profile-patch") return tf("profile");
      if (layer.kind === "home-patch") return tf("homePatch");
      return layer.label;
    }

    /**
     * The exact YAML this plugin will append for one row.
     *
     * Rendered from the row id alone, so it can only ever show what the host's
     * own planner writes — the page never composes a patch and sends it.
     */
    function disablePreview(server) {
      return [
        "# >>> dsh-mcp-mini-manager: disabled mcp row " + server.rowId,
        "# server: " + (server.serverName || server.rowId),
        "# removed: <timestamp> by dsh-mcp-mini-manager",
        "# restore this server from the MCP 极简管理 settings page, or delete",
        "# these lines to re-enable the row by hand.",
        "- id: " + server.rowId,
        "  disabled: true",
        "# <<< dsh-mcp-mini-manager: disabled mcp row " + server.rowId,
      ].join("\n");
    }

    /* ------------------------------- components ------------------------------- */

    /**
     * One MCP server card.
     * @param props - the server, its armed/busy flags, and the action callbacks.
     */
    function ServerCard(props) {
      var server = props.server;
      var armed = props.armed;
      var busy = props.busy;
      var disabled = server.state === "disabled";

      var facts = [];
      facts.push(configSourceLabel(server.configSource));

      return el(
        "li",
        { className: "mmm-card" + (disabled ? " off" : "") + (armed ? " armed" : "") },
        el(
          "div",
          { className: "mmm-top" },
          el("span", { className: "mmm-name" }, server.serverName || server.label || server.rowId),
          el("span", { className: "mmm-tag " + (disabled ? "off" : server.state), "data-state": server.state }, stateLabel(server.state)),
          server.transport ? el("span", { className: "mmm-tag" }, transportLabel(server.transport)) : null,
          !server.transport ? el("span", { className: "mmm-tag warn" }, tf("noTransport")) : null,
          server.origin === "managed-disable" ? el("span", { className: "mmm-tag off" }, tf("stateDisabled")) : null,
          el("span", { className: "mmm-spacer" }),
          disabled
            ? el(
                "button",
                {
                  type: "button",
                  className: "mmm-btn small",
                  disabled: busy !== null,
                  onClick: function () {
                    props.onRestore(server.rowId);
                  },
                },
                tf("restore"),
              )
            : el(
                "button",
                {
                  type: "button",
                  className: "mmm-btn small danger",
                  disabled: busy !== null || armed,
                  onClick: function () {
                    props.onArm(server.rowId);
                  },
                },
                tf("remove"),
              ),
        ),
        server.endpoint
          ? el("p", { className: "mmm-desc mono" }, server.endpoint)
          : el("p", { className: "mmm-desc" }, tf("configNone")),
        server.expressionKeys && server.expressionKeys.length > 0
          ? el("p", { className: "mmm-desc" }, "\u2026 !!js: " + server.expressionKeys.join(", "))
          : null,
        el("p", { className: "mmm-meta" }, facts.join("  \u00b7  ") + "  \u00b7  " + server.rowId),
        server.tools && server.tools.length > 0
          ? el(
              "details",
              { style: { marginTop: "6px" } },
              el("summary", { className: "mmm-meta", style: { cursor: "pointer", userSelect: "none" } }, tf("toolsTitle") + "\uff08" + String(server.tools.length) + "\uff09"),
              el("ul", { className: "mmm-tools", "aria-label": tf("toolsTitle"), style: { marginTop: "6px", gap: "8px" } }, server.tools.map(function (tool) {
                var _d = tool.description ? String(tool.description).trim() : "";
                return el("li", { key: tool.name, style: { fontSize: "12.5px", lineHeight: "1.6", color: "var(--dsw-alias-label-secondary)", whiteSpace: "pre-wrap" } },
                  el("span", { style: { color: "var(--dsw-alias-label-primary)", fontWeight: 500 } }, tool.name),
                  _d ? el("span", null, "\n" + _d) : null);
              })),
            )
          : null,
        server.removedAt
          ? el("p", { className: "mmm-meta" }, tf("removedAt", [formatStamp(server.removedAt)]))
          : null,
        armed
          ? el(
              "div",
              { className: "mmm-confirm" },
              el("p", null, tf("removeTitle", [server.serverName || server.rowId])),
              el("p", null, tf("removeHint")),
              el("p", { className: "path" }, props.patchPath || ""),
              el("p", null, tf("removeBlock")),
              el("pre", { className: "mmm-preview" }, disablePreview(server)),
              el(
                "div",
                { className: "mmm-actions" },
                el(
                  "button",
                  {
                    type: "button",
                    className: "mmm-btn small",
                    disabled: busy,
                    onClick: props.onCancel,
                  },
                  tf("cancel"),
                ),
                el(
                  "button",
                  {
                    type: "button",
                    className: "mmm-btn small danger",
                    disabled: busy,
                    onClick: function () {
                      props.onConfirm(server.rowId);
                    },
                  },
                  tf("removeYes"),
                ),
              ),
            )
          : null,
      );
    }

    /**
     * The Settings page.
     * @param props - the settings shell supplies `close`; the inject face supplies `t`.
     */
    function McpMiniManagerSection(props) {
      var state = React.useState({ status: "loading", data: null, message: null });
      var snapshot = state[0];
      var setSnapshot = state[1];
      var queryState = React.useState("");
      var query = queryState[0];
      var setQuery = queryState[1];
      var armedState = React.useState(null);
      var armed = armedState[0];
      var setArmed = armedState[1];
      var busyState = React.useState(null);
      var busy = busyState[0];
      var setBusy = busyState[1];
      var noticeState = React.useState(null);
      var notice = noticeState[0];
      var setNotice = noticeState[1];
      var purgeState = React.useState(false);
      var purgeArmed = purgeState[0];
      var setPurgeArmed = purgeState[1];
      var tickState = React.useState(0);
      var tick = tickState[0];
      var setTick = tickState[1];
      // A locale switch only needs a re-render (every label goes through `tf`,
      // which reads the active locale at call time) — never a refetch.
      var localeTickState = React.useState(0);
      var setLocaleTick = localeTickState[1];

      React.useEffect(
        function () {
          var live = true;
          var controller = typeof AbortController === "function" ? new AbortController() : null;
          setSnapshot(function (previous) {
            return { status: previous.data ? "ready" : "loading", data: previous.data, message: null };
          });
          request(API + "/catalog", controller ? { signal: controller.signal } : undefined).then(
            function (data) {
              if (!live) return;
              setSnapshot({ status: "ready", data: data, message: null });
            },
            function (error) {
              if (!live) return;
              setSnapshot({ status: "error", data: null, message: describeError(error) });
            },
          );
          return function () {
            live = false;
            if (controller) controller.abort();
          };
        },
        [tick],
      );

      React.useEffect(
        function () {
          if (!props.localeSubscribe) return undefined;
          return props.localeSubscribe(function () {
            setLocaleTick(function (value) {
              return value + 1;
            });
          });
        },
        [],
      );

      var data = snapshot.data;
      var servers = data && Array.isArray(data.servers) ? data.servers : [];
      var backups = data && Array.isArray(data.backupsWithoutRow) ? data.backupsWithoutRow : [];
      var advisory = data && Array.isArray(data.advisory) ? data.advisory : [];
      var normalized = query.trim().toLowerCase();
      var filtered =
        normalized.length === 0
          ? servers
          : servers.filter(function (server) {
              return [server.serverName, server.label, server.rowId, server.endpoint, server.transport]
                .filter(function (value) {
                  return typeof value === "string";
                })
                .some(function (value) {
                  return value.toLowerCase().indexOf(normalized) !== -1;
                });
            });
      var activeCount = servers.filter(function (server) {
        return server.state !== "disabled";
      }).length;
      var disabledCount = servers.length - activeCount;

      function reload(message) {
        setNotice(message || null);
        setArmed(null);
        setPurgeArmed(false);
        setTick(function (value) {
          return value + 1;
        });
      }

      /** Run one write verb against one row and report what actually happened. */
      function act(verb, rowId, doneKey, liveKey, restartKey) {
        setBusy(rowId);
        setNotice(null);
        setArmed(null);
        return post(API + "/" + verb, { rowId: rowId }).then(
          function (payload) {
            setBusy(null);
            var target = verb === "disable" ? payload.disabled : payload.restored;
            var name = (target && (target.serverName || target.rowId)) || rowId;
            // The host reports whether the row actually left (or returned to)
            // the live tree, so the page tells the truth about the restart.
            reload(tf(doneKey, [name]) + " " + tf(payload.effect === "applied" ? liveKey : restartKey));
          },
          function (error) {
            setBusy(null);
            setNotice({ kind: "bad", text: describeError(error) });
          },
        );
      }

      function runPurge() {
        setBusy("*");
        setNotice(null);
        post(API + "/purge", {}).then(
          function (payload) {
            setBusy(null);
            reload(tf("purged", [payload.purged]));
          },
          function (error) {
            setBusy(null);
            setNotice({ kind: "bad", text: describeError(error) });
          },
        );
      }

      var children = [];

      children.push(
        el(
          "div",
          { className: "mmm-head" },
          el("h2", null, tf("title")),
          el("p", { className: "mmm-sub" }, tf("subtitle")),
        ),
      );

      if (snapshot.status === "loading") {
        children.push(
          el(
            "p",
            { className: "mmm-sub", "aria-busy": "true" },
            el("span", { className: "mmm-spin", "aria-hidden": "true" }),
            " " + tf("loading"),
          ),
        );
      }

      if (snapshot.status === "error") {
        children.push(
          el(
            "div",
            { className: "mmm-notice bad", role: "alert" },
            el("strong", null, tf("errorTitle") + " "),
            snapshot.message,
            " ",
            el(
              "button",
              {
                type: "button",
                className: "mmm-btn small",
                onClick: function () {
                  reload(null);
                },
              },
              tf("retry"),
            ),
          ),
        );
      }

      if (notice) {
        children.push(
          el("p", { className: "mmm-notice " + (notice.kind === "ok" ? "ok" : "bad"), role: "alert" }, notice.text),
        );
      }

      if (data) {
        if (data.loaderAvailable !== true) {
          children.push(el("p", { className: "mmm-notice warn", role: "alert" }, tf("loaderMissing")));
        } else if (data.loaderError) {
          children.push(
            el("p", { className: "mmm-notice warn", role: "alert" }, tf("loaderError", [data.loaderError])),
          );
        }
        if (data.toolsAvailable !== true) {
          children.push(el("p", { className: "mmm-notice warn", role: "alert" }, tf("toolsMissing")));
        }

        children.push(
          el(
            "div",
            { className: "mmm-search" },
            el("input", {
              type: "search",
              value: query,
              placeholder: tf("searchPlaceholder"),
              "aria-label": tf("search"),
              onChange: function (event) {
                setQuery(event.target.value);
              },
            }),
          ),
        );

        children.push(
          el(
            "div",
            { className: "mmm-actions" },
            el("span", { className: "mmm-sub" }, tf("count", [servers.length])),
            servers.length > 0
              ? el("span", { className: "mmm-tag active" }, tf("countActive", [activeCount]))
              : null,
            disabledCount > 0 ? el("span", { className: "mmm-tag off" }, tf("countDisabled", [disabledCount])) : null,
            normalized.length > 0
              ? el("span", { className: "mmm-sub" }, tf("countFiltered", [filtered.length, servers.length]))
              : null,
            el("span", { className: "mmm-spacer" }),
            el(
              "button",
              {
                type: "button",
                className: "mmm-btn small",
                disabled: busy !== null,
                onClick: function () {
                  reload(null);
                },
              },
              tf("refresh"),
            ),
          ),
        );

        if (servers.length === 0) {
          children.push(el("p", { className: "mmm-empty" }, tf("empty")));
          children.push(el("p", { className: "mmm-sub" }, tf("emptyHint")));
        } else if (filtered.length === 0) {
          children.push(el("p", { className: "mmm-empty" }, tf("emptySearch")));
        } else {
          children.push(
            el(
              "ul",
              { className: "mmm-list" },
              filtered.map(function (server) {
                return el(ServerCard, {
                  key: server.rowId,
                  server: server,
                  armed: armed === server.rowId,
                  busy: busy === server.rowId ? true : null,
                  patchPath: (data.profile && data.profile.patchPath) || "",
                  onArm: setArmed,
                  onCancel: function () {
                    setArmed(null);
                  },
                  onConfirm: function (rowId) {
                    act("disable", rowId, "removed", "removeEffectLive", "removeEffectRestart");
                  },
                  onRestore: function (rowId) {
                    act("restore", rowId, "restored", "restoreEffectLive", "restoreEffectRestart");
                  },
                });
              }),
            ),
          );
        }

        children.push(el("p", { className: "mmm-sub" }, tf("caveat")));

        if (backups.length > 0 || purgeArmed) {
          children.push(
            el(
              "div",
              { className: "mmm-section" },
              el(
                "h3",
                null,
                tf("removedSection") + " ",
                el("span", { className: "count" }, String(backups.length)),
              ),
              el("p", { className: "mmm-sub" }, tf("removedHint", [data.backupRoot || ""])),
              el(
                "ul",
                { className: "mmm-list" },
                backups.map(function (record) {
                  return el(
                    "li",
                    { className: "mmm-row", key: record.rowId },
                    el(
                      "span",
                      { className: "grow" },
                      el("span", { className: "mmm-name" }, record.serverName || record.rowId),
                      el(
                        "p",
                        { className: "mmm-meta" },
                        record.rowId + (record.removedAt ? "  \u00b7  " + tf("removedAt", [formatStamp(record.removedAt)]) : ""),
                      ),
                      !record.inPatch ? el("p", { className: "mmm-meta" }, tf("recordStale")) : null,
                    ),
                    el(
                      "button",
                      {
                        type: "button",
                        className: "mmm-btn small",
                        disabled: busy !== null || !record.inPatch,
                        onClick: function () {
                          act("restore", record.rowId, "restored", "restoreEffectLive", "restoreEffectRestart");
                        },
                      },
                      tf("restore"),
                    ),
                  );
                }),
              ),
              purgeArmed
                ? el(
                    "div",
                    { className: "mmm-confirm" },
                    el("p", null, tf("purgeConfirm", [backups.length])),
                    el(
                      "div",
                      { className: "mmm-actions" },
                      el(
                        "button",
                        {
                          type: "button",
                          className: "mmm-btn small",
                          onClick: function () {
                            setPurgeArmed(false);
                          },
                        },
                        tf("cancel"),
                      ),
                      el(
                        "button",
                        { type: "button", className: "mmm-btn small danger", onClick: runPurge },
                        tf("purgeYes"),
                      ),
                    ),
                  )
                : el(
                    "div",
                    { className: "mmm-actions" },
                    el(
                      "button",
                      {
                        type: "button",
                        className: "mmm-btn small danger",
                        onClick: function () {
                          setPurgeArmed(true);
                        },
                      },
                      tf("purge"),
                    ),
                  ),
            ),
          );
        }

        if (advisory.length > 0) {
          children.push(
            el(
              "div",
              { className: "mmm-section" },
              el(
                "h3",
                null,
                tf("advisorySection") + " ",
                el("span", { className: "count" }, String(advisory.length)),
              ),
              el("p", { className: "mmm-sub" }, tf("advisoryHint")),
              el(
                "ul",
                { className: "mmm-list" },
                advisory.map(function (plugin) {
                  return el(
                    "li",
                    { className: "mmm-row", key: plugin.packageName },
                    el(
                      "span",
                      { className: "grow" },
                      el("span", { className: "mmm-name" }, plugin.packageName),
                      plugin.description ? el("p", { className: "mmm-desc" }, plugin.description) : null,
                      el(
                        "p",
                        { className: "mmm-meta" },
                        (plugin.version ? plugin.version + "  \u00b7  " : "") + plugin.since +
                          (plugin.hasClientFace ? "  \u00b7  " + tf("advisoryTools", [1]) : ""),
                      ),
                    ),
                  );
                }),
              ),
            ),
          );
        }

        children.push(
          el(
            "details",
            { className: "mmm-section" },
            el("summary", null, tf("diagnostics")),
            el(
              "ul",
              { className: "mmm-tools" },
              el("li", null, tf("profile") + ": " + ((data.profile && data.profile.dir) || "\u2014")),
              el("li", null, tf("patchFile") + ": " + ((data.profile && data.profile.patchPath) || "\u2014")),
              el(
                "li",
                null,
                tf("homePatch") +
                  ": " +
                  ((data.profile && data.profile.homePatchPath) || "\u2014") +
                  (data.profile && data.profile.homePatchExists ? "" : " (\u2014)"),
              ),
              el("li", null, tf("harnessHome") + ": " + (data.harnessHome || "\u2014")),
              el(
                "li",
                null,
                tf("layers") +
                  ": " +
                  (data.layers || [])
                    .map(function (layer) {
                      return layerLabel(layer) + " (" + tf("layerRows", [layer.rows]) + ")";
                    })
                    .join(", "),
              ),
            ),
            (data.layers || [])
              .filter(function (layer) {
                return layer.unsupported && layer.unsupported.length > 0;
              })
              .map(function (layer) {
                return el(
                  "p",
                  { className: "mmm-meta", key: layer.path },
                  layer.path + " \u2014 " + tf("unsupportedLayer", [layer.unsupported.length]),
                );
              }),
          ),
        );
      }

      children.push(
        el(
          "div",
          { className: "mmm-foot" },
          el(
            "button",
            {
              type: "button",
              className: "mmm-btn primary",
              onClick: function () {
                if (typeof props.close === "function") props.close();
              },
            },
            tf("close"),
          ),
        ),
      );

      return el("div", { className: "mmm-root" }, children);
    }

    /* --------------------------------- apply --------------------------------- */

    /** Install the page's stylesheet, removed again on teardown. */
    function installStyles() {
      if (typeof document === "undefined") return function () {};
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-mcp-mini-manager";
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return function () {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
      };
    }

    function apply(ctx) {
      var removeStyles = installStyles();

      // Both dictionaries are registered at once and `t` reads the active locale
      // at call time, so a locale switch needs no re-registration: the nav label
      // (a function the shell resolves per locale revision) and every rendered
      // string follow the switch on their own.
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "dsh-mcp-mini-manager: dictionaries");
      boundT = ctx.locale.bind(NS);

      ctx.effect(function () {
        return removeStyles;
      }, "dsh-mcp-mini-manager: stylesheet");

      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            // Order 16 puts this page directly after 插件 (order 15) and before
            // 智能体预设 (order 20): the same sidebar level, not a tab inside the
            // Plugins section.
            id: "mcp-mini-manager",
            order: 16,
            label: function () {
              return tf("nav");
            },
            locale: NS,
            inject: function () {
              return {
                t: ctx.locale.bind(NS),
                localeSubscribe: function (listener) {
                  return ctx.locale.subscribe(listener);
                },
              };
            },
          },
          McpMiniManagerSection,
        );
      });
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale"];
    return module.exports;
  },
});
