/**
 * 长夜 · 样式
 *
 * 全部挂在 .cy- 前缀下，不污染宿主。
 * 颜色走 CSS 变量，两套主题只换变量。
 */

const CHANGYE_CSS = `
.cy-shell{
  --cy-bg:#14161a; --cy-bg-1:#191c21; --cy-bg-2:#1f232a; --cy-bg-3:#262b33;
  --cy-line:#2c323b; --cy-line-2:#3a424e;
  --cy-fg:#e8e9ec; --cy-fg-2:#b6bcc6; --cy-fg-3:#7f8792;
  --cy-amber:#d9a054; --cy-amber-soft:rgba(217,160,84,.14);
  --cy-teal:#4aa8a0; --cy-teal-soft:rgba(74,168,160,.14);
  --cy-red:#e05a54; --cy-red-soft:rgba(224,90,84,.14);
  --cy-green:#4aa07a; --cy-green-soft:rgba(74,160,122,.14);
  --cy-blue:#5b8fd6; --cy-blue-soft:rgba(91,143,214,.14);
  --cy-radius:10px;
  display:flex; flex-direction:column; height:100%; min-height:0;
  background:var(--cy-bg); color:var(--cy-fg);
  font-size:13px; line-height:1.6;
  font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
}
.cy-shell.cy-theme-light{
  --cy-bg:#f6f4f0; --cy-bg-1:#fffdfa; --cy-bg-2:#f1eee8; --cy-bg-3:#e7e2d9;
  --cy-line:#ddd7cc; --cy-line-2:#c9c1b3;
  --cy-fg:#23201c; --cy-fg-2:#5a544b; --cy-fg-3:#8b8579;
  --cy-amber:#b57d2e; --cy-amber-soft:rgba(181,125,46,.12);
  --cy-teal:#2f827a; --cy-green:#2f7a58; --cy-red:#c0453f; --cy-blue:#3f6fae;
}
/* ── 第三档主题「纸」：米黄底 + 宋体，长文阅读久盯不刺眼 ── */
.cy-shell.cy-theme-paper{
  --cy-bg:#f0e8d8; --cy-bg-1:#faf5e9; --cy-bg-2:#efe6d3; --cy-bg-3:#e4d8c0;
  --cy-line:#d6c8ac; --cy-line-2:#c2b192;
  --cy-fg:#3a3025; --cy-fg-2:#6b5d4a; --cy-fg-3:#9a8b73;
  --cy-amber:#a9702a; --cy-amber-soft:rgba(169,112,42,.13);
  --cy-teal:#2c6f68; --cy-green:#3d7550; --cy-red:#b04a3f; --cy-blue:#3c6a9c;
  font-family:Georgia,"Songti SC","STSong","SimSun",serif;
}
.cy-shell.cy-theme-paper .cy-textarea,
.cy-shell.cy-theme-paper .cy-para{font-family:Georgia,"Songti SC","STSong","SimSun",serif;font-size:14.5px;line-height:2.05}
.cy-shell *{box-sizing:border-box}
.cy-shell button{font:inherit;color:inherit;cursor:pointer;background:none;border:0}
.cy-shell h2{font-size:19px;margin:0;font-weight:650}
.cy-shell h3{font-size:13px;margin:0;font-weight:600}
.cy-shell p{margin:0}
.cy-shell pre{margin:0;font-family:ui-monospace,Consolas,monospace}

/* ── 顶栏 ── */
.cy-top{display:flex;align-items:center;gap:14px;padding:9px 16px;border-bottom:1px solid var(--cy-line);background:var(--cy-bg-1);flex:none}
.cy-brand{display:flex;align-items:center;gap:8px;flex:none}
.cy-brand-mark{font-size:16px}
.cy-brand-name{font-weight:650;letter-spacing:.04em}
.cy-brand-page{color:var(--cy-fg-3);font-size:12px;padding-left:8px;border-left:1px solid var(--cy-line)}
.cy-top-mid{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.cy-top-mid .cy-input{min-width:180px;max-width:260px}
.cy-top-stat{color:var(--cy-fg-3);font-size:12px;border:1px solid var(--cy-line);border-radius:999px;padding:1px 9px;white-space:nowrap}
.cy-top-cost{color:var(--cy-amber);border-color:var(--cy-amber-soft);background:var(--cy-amber-soft)}
.cy-top-right{display:flex;align-items:center;gap:8px;flex:none}
.cy-top-hint{color:var(--cy-fg-3);font-size:11.5px;white-space:nowrap;padding-right:2px}
.cy-top-hint-on{color:var(--cy-teal)}

/* ── 主体 ── */
.cy-body{flex:1;min-height:0;overflow:auto;padding:14px 16px 8px}
.cy-page{display:flex;flex-direction:column;gap:14px;min-height:0;max-width:1360px;margin:0 auto}
.cy-cockpit{max-width:1360px}
.cy-review{max-width:1360px}

/* ── 底栏：只放导航，且居中 ── */
.cy-bottom{display:flex;align-items:center;justify-content:center;padding:8px 16px;border-top:1px solid var(--cy-line);background:var(--cy-bg-1);flex:none}
.cy-dock{display:flex;gap:2px;flex:none;background:var(--cy-bg-2);border:1px solid var(--cy-line);border-radius:999px;padding:3px}
.cy-dock-btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 12px;border-radius:999px;color:var(--cy-fg-3);font-size:11px}
.cy-dock-btn:hover{color:var(--cy-fg-2)}
.cy-dock-btn.on{background:var(--cy-amber-soft);color:var(--cy-amber)}
.cy-dock-icon{font-size:13px;line-height:1.2}
.cy-dock-label{line-height:1.3}
.cy-dock-badge{position:absolute;top:1px;right:3px;background:var(--cy-red);color:#fff;font-size:9px;line-height:1.35;border-radius:999px;padding:0 4px}

/* ── 通用控件 ── */
.cy-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:8px;border:1px solid var(--cy-line-2);color:var(--cy-fg);background:var(--cy-bg-2);transition:.12s}
.cy-btn:hover{border-color:var(--cy-amber);color:var(--cy-amber)}
.cy-btn-sm{padding:3px 9px;font-size:12px;border-radius:7px}
.cy-btn-primary{background:var(--cy-amber);border-color:var(--cy-amber);color:#1a1408;font-weight:600}
.cy-btn-primary:hover{filter:brightness(1.08);color:#1a1408}
.cy-btn-ghost{background:transparent}
.cy-btn-danger{border-color:var(--cy-red-soft);color:var(--cy-red);background:transparent}
.cy-btn-danger:hover{background:var(--cy-red-soft);border-color:var(--cy-red);color:var(--cy-red)}
.cy-btn:disabled{opacity:.45;cursor:not-allowed}
.cy-tag{display:inline-flex;align-items:center;padding:1px 7px;border-radius:999px;font-size:11px;white-space:nowrap}
.cy-tag-amber{background:var(--cy-amber-soft);color:var(--cy-amber)}
.cy-tag-teal{background:var(--cy-teal-soft);color:var(--cy-teal)}
.cy-tag-red{background:var(--cy-red-soft);color:var(--cy-red)}
.cy-tag-green{background:var(--cy-green-soft);color:var(--cy-green)}
.cy-tag-blue{background:var(--cy-blue-soft);color:var(--cy-blue)}
.cy-tag-grey{background:var(--cy-bg-3);color:var(--cy-fg-3)}
.cy-input{width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--cy-line-2);background:var(--cy-bg);color:var(--cy-fg);font:inherit;outline:none}
.cy-input:focus{border-color:var(--cy-amber)}
.cy-textarea{resize:vertical;line-height:1.75}
.cy-field{display:flex;flex-direction:column;gap:4px}
.cy-field > label{font-size:11px;color:var(--cy-fg-3);letter-spacing:.03em}
.cy-hint{color:var(--cy-fg-3);font-size:12px}
.cy-warn{color:var(--cy-red);font-size:12px}
.cy-mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px}
.cy-empty{color:var(--cy-fg-3);font-size:12px;padding:16px;text-align:center;border:1px dashed var(--cy-line);border-radius:var(--cy-radius)}
.cy-loading{display:flex;align-items:center;gap:8px;color:var(--cy-fg-3);font-size:12px;padding:20px}
.cy-spin{width:12px;height:12px;border:2px solid var(--cy-line-2);border-top-color:var(--cy-amber);border-radius:50%;animation:cy-spin .7s linear infinite}
@keyframes cy-spin{to{transform:rotate(360deg)}}
.cy-error{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--cy-red-soft);color:var(--cy-red);font-size:12px}
.cy-bar{display:block;height:5px;border-radius:999px;background:var(--cy-bg-3);overflow:hidden}
.cy-bar > i{display:block;height:100%;border-radius:999px;background:var(--cy-amber)}
.cy-bar-red > i{background:var(--cy-red)}
.cy-bar-green > i{background:var(--cy-green)}
.cy-switch{width:34px;height:18px;border-radius:999px;background:var(--cy-bg-3);border:1px solid var(--cy-line-2);position:relative;transition:.15s}
.cy-switch.on{background:var(--cy-amber);border-color:var(--cy-amber)}
.cy-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--cy-fg);transition:.15s}
.cy-switch.on::after{left:18px;background:#1a1408}
.cy-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cy-seg{display:flex;gap:2px;background:var(--cy-bg-2);border:1px solid var(--cy-line);border-radius:8px;padding:3px}
.cy-seg-btn{display:flex;align-items:center;gap:5px;padding:3px 11px;border-radius:6px;font-size:12px;color:var(--cy-fg-3)}
.cy-seg-btn.on{background:var(--cy-bg-1);color:var(--cy-amber);box-shadow:0 1px 2px rgba(0,0,0,.3)}
.cy-seg-n{font-size:10px;opacity:.7}
.cy-link{color:var(--cy-blue);font-size:12px;padding:0 4px}
.cy-link-danger{color:var(--cy-red)}
.cy-icon-btn{width:24px;height:24px;border-radius:6px;color:var(--cy-fg-3)}
.cy-icon-btn:hover{background:var(--cy-bg-3);color:var(--cy-fg)}

/* ── 卡片 ── */
.cy-card{border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.cy-card-head{display:flex;align-items:center;gap:10px}
.cy-card-line{flex:1;height:1px;background:var(--cy-line)}
.cy-card-badge{font-size:11px;color:var(--cy-fg-3);border:1px solid var(--cy-line);border-radius:999px;padding:0 7px}
.cy-card-debt{border-color:var(--cy-red-soft)}
.cy-kv-wrap{display:flex;flex-direction:column;gap:5px}
.cy-kv{display:flex;gap:10px;font-size:12px}
.cy-kv-k{color:var(--cy-fg-3);min-width:78px;flex:none}
.cy-kv-v{color:var(--cy-fg-2);word-break:break-all}
.cy-cols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
.cy-col-side{display:flex;flex-direction:column;gap:14px;min-width:0}

/* ── 驾驶舱 ── */
.cy-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:linear-gradient(135deg,var(--cy-bg-2),var(--cy-bg-1))}
.cy-hero-left{display:flex;flex-direction:column;gap:7px;min-width:0}
.cy-hero-tags{display:flex;gap:6px;flex-wrap:wrap}
.cy-hero-right{display:flex;gap:8px;flex:none}
.cy-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.cy-stat{display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:11px 13px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);text-align:left}
.cy-stat:hover{border-color:var(--cy-line-2)}
.cy-stat-label{font-size:11px;color:var(--cy-fg-3)}
.cy-stat-value{font-size:23px;font-weight:650;line-height:1.15}
.cy-stat-value em{font-size:11px;font-style:normal;color:var(--cy-fg-3);margin-left:3px;font-weight:400}
.cy-stat-hint{font-size:11px;color:var(--cy-fg-3)}
.cy-stat-amber .cy-stat-value{color:var(--cy-amber)}
.cy-stat-teal .cy-stat-value{color:var(--cy-teal)}
.cy-stat-red .cy-stat-value{color:var(--cy-red)}
.cy-stat-green .cy-stat-value{color:var(--cy-green)}
.cy-stat-blue .cy-stat-value{color:var(--cy-blue)}
.cy-debt-list{display:flex;flex-direction:column;gap:6px}
.cy-debt{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--cy-line);background:var(--cy-bg-2);text-align:left}
.cy-debt:hover{border-color:var(--cy-amber);background:var(--cy-bg-3)}
.cy-debt-dot{width:7px;height:7px;border-radius:50%;flex:none}
.cy-dot-red{background:var(--cy-red)}
.cy-dot-orange{background:var(--cy-amber)}
.cy-dot-yellow{background:var(--cy-blue)}
.cy-dot-grey{background:var(--cy-fg-3)}
.cy-debt-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.cy-debt-title{font-size:12.5px;font-weight:600}
.cy-debt-sub{font-size:11px;color:var(--cy-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-debt-go{color:var(--cy-fg-3);flex:none}
.cy-suggest{font-size:13px;color:var(--cy-amber);padding:8px 10px;border-radius:8px;background:var(--cy-amber-soft)}
.cy-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11.5px;color:var(--cy-fg-3)}
.cy-recent{display:flex;flex-direction:column;gap:4px}
.cy-recent-row{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;text-align:left}
.cy-recent-row:hover{background:var(--cy-bg-3)}
.cy-recent-n{color:var(--cy-fg-3);font-size:11.5px;min-width:56px;flex:none}
.cy-recent-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.cy-recent-score{font-size:12px;font-weight:600;flex:none}
.cy-score-good{color:var(--cy-green)}
.cy-score-mid{color:var(--cy-amber)}
.cy-score-bad{color:var(--cy-red)}

/* ── 生产台 ── */
.cy-studio-cols{display:grid;grid-template-columns:230px minmax(0,1fr) 270px;gap:12px;align-items:start}
.cy-tpl-panel{border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);display:flex;flex-direction:column;overflow:hidden}
.cy-tpl-head{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-bottom:1px solid var(--cy-line);font-size:12px;color:var(--cy-fg-3)}
.cy-tpl-list{display:flex;flex-direction:column;padding:6px;gap:4px;max-height:520px;overflow:auto}
.cy-tpl{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-radius:7px;text-align:left;border:1px solid transparent}
.cy-tpl:hover{background:var(--cy-bg-3);border-color:var(--cy-line-2)}
.cy-tpl-name{font-size:12.5px;font-weight:600}
.cy-tpl-intent{font-size:11px;color:var(--cy-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-tpl-used{font-size:10px;color:var(--cy-fg-3)}
.cy-order{display:flex;flex-direction:column;gap:10px;min-width:0}
.cy-order-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.cy-order-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:4px;border-top:1px solid var(--cy-line)}
.cy-ctx{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border:1px solid var(--cy-line);border-radius:8px;background:var(--cy-bg)}
.cy-ctx-over{border-color:var(--cy-red-soft)}
.cy-ctx-head{display:flex;justify-content:space-between;font-size:11.5px;color:var(--cy-fg-3)}
.cy-ctx-total{font-family:ui-monospace,Consolas,monospace}
.cy-ctx-total.cy-over{color:var(--cy-red)}
.cy-ctx-list{display:flex;flex-direction:column;gap:2px}
.cy-ctx-row{display:flex;align-items:center;gap:8px;font-size:11.5px;padding:2px 0}
.cy-ctx-kind{color:var(--cy-amber);min-width:52px;flex:none}
.cy-ctx-label{flex:1;min-width:0;color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-ctx-token{color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.cy-ctx-x{color:var(--cy-fg-3);flex:none;font-size:10px}
.cy-ctx-x:hover{color:var(--cy-red)}
.cy-queue{border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);display:flex;flex-direction:column;gap:7px;padding:10px 11px}
.cy-queue-head{display:flex;align-items:center;justify-content:space-between;font-size:12px}
.cy-queue-list{display:flex;flex-direction:column;gap:4px;max-height:430px;overflow:auto}
.cy-q-row{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:7px;border:1px solid var(--cy-line);background:var(--cy-bg-2)}
.cy-q-running{border-color:var(--cy-teal-soft)}
.cy-q-n{font-size:11.5px;color:var(--cy-fg-3)}
.cy-q-intent{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-q-acts{display:flex;gap:4px;margin-top:2px}

/* ── 大纲 ── */
.cy-plan{max-width:1360px}
.cy-plan-brief .cy-input{max-width:none}
.cy-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.cy-plan-field{min-width:0}
.cy-plan-wide{grid-column:1 / -1}
.cy-plan-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px solid var(--cy-line)}
.cy-plan-vols{display:flex;gap:2px;background:var(--cy-bg-2);border:1px solid var(--cy-line);border-radius:8px;padding:3px;flex-wrap:wrap}
.cy-plan-rows{display:flex;flex-direction:column;gap:6px;max-height:520px;overflow:auto}
.cy-plan-row{display:grid;grid-template-columns:66px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--cy-line);border-radius:9px;background:var(--cy-bg-2)}
.cy-plan-n{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--cy-fg-3)}
.cy-plan-main{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.5fr) minmax(0,1fr);gap:6px;min-width:0}
.cy-plan-main .cy-input{font-size:11.5px;padding:4px 8px}

/* ── 验收台 ── */
.cy-rv-bar{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cy-rv-list{display:flex;flex-direction:column;border:1px solid var(--cy-line);border-radius:var(--cy-radius);overflow:hidden;background:var(--cy-bg-1)}
.cy-rv-head,.cy-rv-row{display:grid;grid-template-columns:46px minmax(0,1fr) 84px 62px 128px 128px;gap:8px;align-items:center;padding:7px 12px}
.cy-rv-head{background:var(--cy-bg-2);font-size:11px;color:var(--cy-fg-3);border-bottom:1px solid var(--cy-line)}
.cy-rv-row{text-align:left;border-bottom:1px solid var(--cy-line);font-size:12px}
.cy-rv-row:last-child{border-bottom:0}
.cy-rv-row:hover{background:var(--cy-bg-2)}
.cy-rv-row.on{background:var(--cy-amber-soft)}
.cy-rv-n{color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace}
.cy-rv-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-rv-words{color:var(--cy-fg-3);font-size:11.5px}
.cy-rv-issues{display:flex;gap:4px;align-items:center}
.cy-score{display:flex;align-items:center;gap:6px}
.cy-score .cy-bar{flex:1;min-width:38px}
.cy-score-n{font-size:12px;font-style:normal;font-weight:600}
.cy-rv-detail{display:flex;flex-direction:column;gap:10px}
/* 【12 条 #11】阅读模式：正文单栏占满，字号提一档、行距放松，眼睛不用来回扫。 */
.cy-rv-detail.cy-rv-read{max-width:820px;margin:0 auto}
.cy-rv-detail.cy-rv-read .cy-paras,.cy-rv-detail.cy-rv-read .cy-textarea{font-size:15.5px;line-height:2.1}
.cy-rv-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cy-rv-detail-head > div:first-child{display:flex;align-items:baseline;gap:10px}
.cy-rv-body{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;align-items:start}
.cy-rv-doc{display:flex;flex-direction:column;gap:9px}
.cy-rv-doc .cy-textarea{font-family:Georgia,"Songti SC","SimSun",serif;font-size:14px;line-height:2;background:var(--cy-bg-1)}
.cy-rv-acts{display:flex;gap:8px;flex-wrap:wrap}
.cy-rv-side{display:flex;flex-direction:column;gap:10px;min-width:0}
.cy-score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cy-score-cell{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border-radius:7px;background:var(--cy-bg-2)}
.cy-score-cell em{font-style:normal;font-size:15px;font-weight:650;color:var(--cy-amber)}
.cy-score-cell span{font-size:10px;color:var(--cy-fg-3)}
.cy-score-total{display:flex;align-items:center;gap:10px;font-size:12px}
.cy-score-total .cy-score{flex:1}
.cy-issues{display:flex;flex-direction:column;gap:5px;max-height:280px;overflow:auto}
.cy-issue{display:flex;align-items:flex-start;gap:7px;padding:6px 8px;border-radius:7px;background:var(--cy-bg-2);font-size:11.5px}
.cy-issue-violation{background:var(--cy-red-soft)}
.cy-issue-n{color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.cy-issue-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.cy-issue-text{color:var(--cy-fg-2)}
.cy-issue-quote{color:var(--cy-fg-3);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-issue-sev{color:var(--cy-fg-3);font-size:10px;flex:none}
.cy-audit{font-size:11px;color:var(--cy-fg-2);white-space:pre-wrap;background:var(--cy-bg-2);padding:8px;border-radius:7px;max-height:200px;overflow:auto}

/* ── 验收台的两个抽屉：提案 / 问题单 ── */
.cy-board{display:flex;flex-direction:column;gap:10px}
.cy-prop-list,.cy-prob-list{display:flex;flex-direction:column;gap:8px}
.cy-prop{border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);padding:9px 11px;display:flex;flex-direction:column;gap:6px}
.cy-prop-accepted{border-color:var(--cy-green-soft)}
.cy-prop-rejected{opacity:.72}
.cy-prop-head{display:flex;align-items:center;gap:8px;width:100%;text-align:left}
.cy-prop-n{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--cy-fg-3);flex:none}
.cy-prop-title{font-size:12.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-prop-go{color:var(--cy-fg-3);font-size:11px;flex:none}
.cy-prop-body{display:flex;flex-direction:column;gap:7px;padding:6px 0 2px}
.cy-prop-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:5px;border-top:1px solid var(--cy-line)}
.cy-diff{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;align-items:start}
.cy-diff-n{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:var(--cy-fg-3);padding-top:6px}
.cy-diff-cols{display:grid;grid-template-columns:1fr 1fr;gap:7px;min-width:0}
.cy-diff-cell{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:7px;font-size:11.5px;line-height:1.7;min-width:0}
.cy-diff-before{background:var(--cy-red-soft)}
.cy-diff-after{background:var(--cy-green-soft)}
.cy-diff-tag{font-size:10px;color:var(--cy-fg-3)}
.cy-diff-why{grid-column:2;color:var(--cy-fg-3);font-size:10.5px}

.cy-prob{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;border:1px solid var(--cy-line);border-radius:9px;background:var(--cy-bg-1);padding:7px 10px}
.cy-prob-fixed{opacity:.66}
.cy-prob-ignored{opacity:.5}
.cy-prob-main{display:flex;align-items:center;gap:7px;text-align:left;min-width:0}
.cy-prob-n{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--cy-fg-3);flex:none}
.cy-prob-text{font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-prob-quote{grid-column:1;font-size:10.5px;color:var(--cy-fg-3);padding-left:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-prob-acts{display:flex;gap:5px;flex:none}

/* ── 世界库 ── */
.cy-ws-banner{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;border:1px solid var(--cy-amber-soft);border-radius:var(--cy-radius);background:var(--cy-amber-soft)}
.cy-ws-label{color:var(--cy-amber);font-size:11.5px;flex:none;font-weight:600}
.cy-ws-text{flex:1;min-width:0;font-size:12px;color:var(--cy-fg-2);line-height:1.65}
.cy-world-body{display:grid;grid-template-columns:186px minmax(0,1fr);gap:12px;align-items:start}
.cy-world-nav{display:flex;flex-direction:column;gap:2px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);padding:6px}
.cy-world-nav-btn{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;font-size:12.5px;color:var(--cy-fg-2);text-align:left}
.cy-world-nav-btn:hover{background:var(--cy-bg-3)}
.cy-world-nav-btn.on{background:var(--cy-amber-soft);color:var(--cy-amber);font-weight:600}
.cy-world-nav-icon{font-size:12px;width:16px;flex:none}
.cy-world-nav-n{margin-left:auto;font-size:10.5px;color:var(--cy-fg-3)}
.cy-world-nav-foot{padding:7px 9px;border-top:1px solid var(--cy-line);margin-top:3px;font-size:10.5px;color:var(--cy-fg-3)}
.cy-world-main{display:flex;flex-direction:column;gap:10px;min-width:0}
.cy-world-bar{display:flex;align-items:center;justify-content:space-between;gap:10px}
.cy-table{border:1px solid var(--cy-line);border-radius:var(--cy-radius);overflow:hidden;background:var(--cy-bg-1)}
.cy-table-head,.cy-table-row{display:grid;gap:8px;align-items:center;padding:7px 11px}
.cy-table-head{background:var(--cy-bg-2);font-size:11px;color:var(--cy-fg-3);border-bottom:1px solid var(--cy-line)}
.cy-table-row{border-bottom:1px solid var(--cy-line);font-size:12px}
.cy-table-row:last-child{border-bottom:0}
.cy-table-row:hover{background:var(--cy-bg-2)}
.cy-td{color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-td-strong{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-td-acts{display:flex;gap:4px}
.cy-graph{border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);padding:8px}
.cy-graph-svg{width:100%;height:auto;display:block}
.cy-graph-text{fill:var(--cy-fg);font-size:12px;font-weight:600}
.cy-graph-sub{fill:var(--cy-fg-3);font-size:10px}
.cy-timeline{position:relative;display:flex;flex-direction:column;gap:2px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);padding:10px 12px}
.cy-tl-rail{position:absolute;left:25px;top:16px;bottom:16px;width:1px;background:var(--cy-line-2)}
.cy-tl-row{display:grid;grid-template-columns:12px 72px minmax(0,1fr) 110px;gap:9px;align-items:center;padding:5px 0;position:relative}
.cy-tl-dot{width:7px;height:7px;border-radius:50%;background:var(--cy-amber);justify-self:center;z-index:1}
.cy-tl-n{font-size:11px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace}
.cy-tl-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.cy-tl-title{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-tl-sub{font-size:10.5px;color:var(--cy-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-tl-bar{height:4px;border-radius:999px;background:var(--cy-bg-3);overflow:hidden}
.cy-tl-bar > i{display:block;height:100%;background:var(--cy-amber-soft)}

/* ── 侦察 ── */
.cy-scout-lead{color:var(--cy-fg-2);font-size:12.5px;padding:10px 12px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1)}
.cy-scout-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.cy-scout-card{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1)}
.cy-scout-head{display:flex;align-items:center;gap:8px}
.cy-scout-icon{font-size:16px}
.cy-scout-desc{font-size:12px;color:var(--cy-fg-2);line-height:1.65;flex:1}
.cy-scout-meta{display:flex;flex-direction:column;gap:3px}
.cy-cmd{font-size:11.5px;color:var(--cy-fg-2);white-space:pre-wrap;background:var(--cy-bg-2);padding:9px;border-radius:7px;max-height:220px;overflow:auto;line-height:1.7}

/* ── 设置 ── */
.cy-settings{max-width:900px}
.cy-proj-list{display:flex;flex-direction:column;gap:4px}
.cy-proj{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;border:1px solid var(--cy-line);background:var(--cy-bg-2);text-align:left}
.cy-proj.on{border-color:var(--cy-amber);background:var(--cy-amber-soft)}
.cy-proj-name{font-size:12.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-proj-meta{font-size:11px;color:var(--cy-fg-3);flex:none}
.cy-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.cy-danger-zone{border:1px solid var(--cy-red-soft);border-radius:8px;padding:9px 11px}
.cy-danger-zone summary{color:var(--cy-red);font-size:12px;cursor:pointer}
.cy-danger-zone[open] summary{margin-bottom:7px}
.cy-switch-row{display:flex;align-items:center;justify-content:space-between;font-size:12.5px}

/* ── 弹层与通知 ── */
.cy-modal-mask{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.52);padding:24px}
.cy-modal{width:min(560px,96vw);max-height:86vh;display:flex;flex-direction:column;border-radius:12px;border:1px solid var(--cy-line-2);background:var(--cy-bg-1);box-shadow:0 24px 64px rgba(0,0,0,.45)}
.cy-modal-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--cy-line)}
.cy-modal-body{display:flex;flex-direction:column;gap:10px;padding:14px;overflow:auto}
.cy-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:11px 14px;border-top:1px solid var(--cy-line)}
.cy-toast-wrap{position:fixed;right:18px;bottom:66px;z-index:90;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.cy-toast{display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:8px;background:var(--cy-bg-3);border:1px solid var(--cy-line-2);color:var(--cy-fg);font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);animation:cy-toast-in .18s ease-out}
.cy-toast-mark{color:var(--cy-amber)}
@keyframes cy-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.cy-panel-glyph{display:inline-flex;align-items:center;justify-content:center;line-height:1}

/* ══════════════════════════════════════════════════════════
   界面增补（24 条）—— 纯展示层，全部假数据驱动
   ══════════════════════════════════════════════════════════ */

/* ── #1 状态灯 ── */
.cy-lamp{display:flex;align-items:center;gap:7px;padding:5px 10px;border-radius:999px;border:1px solid var(--cy-line);background:var(--cy-bg-2);flex:none;text-align:left}
.cy-lamp:hover{border-color:var(--cy-amber);background:var(--cy-bg-3)}
.cy-lamp-dot{width:8px;height:8px;border-radius:50%;background:var(--cy-fg-3);flex:none}
.cy-lamp.on .cy-lamp-dot{background:var(--cy-green);box-shadow:0 0 0 0 rgba(74,160,122,.7);animation:cy-pulse 1.6s infinite}
@keyframes cy-pulse{0%{box-shadow:0 0 0 0 rgba(74,160,122,.55)}70%{box-shadow:0 0 0 7px rgba(74,160,122,0)}100%{box-shadow:0 0 0 0 rgba(74,160,122,0)}}
.cy-lamp-body{display:flex;flex-direction:column;gap:0;line-height:1.25}
.cy-lamp-text{font-size:11.5px;color:var(--cy-fg)}
.cy-lamp-sub{font-size:10px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace}
.cy-cmdk-open{flex:none}

/* ── #2 底栏右侧按钮 + 居中 ── */
.cy-bottom-pad{flex:1 1 0;min-width:120px}
.cy-bottom-acts{flex:1 1 0;display:flex;justify-content:flex-end;gap:6px;min-width:120px}
.cy-bottom-btn{white-space:nowrap}

/* ── #3 命令面板 ── */
.cy-cmdk-list{display:flex;flex-direction:column;gap:2px;margin-top:8px;max-height:320px;overflow:auto}
.cy-cmdk-row{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(0,1.2fr) 18px;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;border:1px solid transparent;text-align:left}
.cy-cmdk-row:hover,.cy-cmdk-row.on{background:var(--cy-bg-2);border-color:var(--cy-line-2)}
.cy-cmdk-icon{font-size:14px;text-align:center}
.cy-cmdk-label{font-size:12.5px;color:var(--cy-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-cmdk-hint{font-size:11px;color:var(--cy-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-cmdk-go{font-size:11px;color:var(--cy-fg-3);text-align:right}
.cy-cmdk-row.on .cy-cmdk-go{color:var(--cy-amber)}

/* ── #4 行动卡 / 今日一句 ── */
.cy-action{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:9px;padding:12px 14px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:linear-gradient(135deg,var(--cy-teal-soft),var(--cy-bg-1))}
.cy-action.cy-action-warn{background:linear-gradient(135deg,var(--cy-amber-soft),var(--cy-bg-1));border-color:var(--cy-amber)}
.cy-action-main{display:flex;flex-direction:column;gap:2px;font-size:13.5px;color:var(--cy-fg);line-height:1.7;min-width:0}
.cy-action-title{font-weight:600;margin:0;font-size:14px}
.cy-action-sub{font-size:12px;color:var(--cy-fg-2);line-height:1.6}
.cy-action-cap{font-size:11px;color:var(--cy-fg-3)}

/* ── #5 两周柱状图 ── */
.cy-days{display:flex;flex-direction:column;gap:6px;padding:2px 0 4px}
.cy-days-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--cy-fg-2)}
.cy-days-bars{display:flex;align-items:flex-end;gap:3px;height:56px;padding:0 1px;border-bottom:1px solid var(--cy-line)}
.cy-day{flex:1 1 0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;height:100%;padding:0;min-width:0}
.cy-day-fill{display:block;width:100%;border-radius:2px 2px 0 0;background:var(--cy-amber-soft);border:1px solid var(--cy-line-2);border-bottom:0;transition:.12s}
.cy-day-ok .cy-day-fill{background:var(--cy-green-soft);border-color:var(--cy-green)}
.cy-day-off .cy-day-fill{background:repeating-linear-gradient(45deg,var(--cy-bg-3),var(--cy-bg-3) 3px,transparent 3px,transparent 6px);border-color:var(--cy-line)}
.cy-day:hover .cy-day-fill{filter:brightness(1.25)}
.cy-day-label{font-size:9px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace}
.cy-days-rule{font-size:10.5px;color:var(--cy-fg-3)}

/* ── #6 全书进度条 ── */
.cy-progress{display:flex;flex-direction:column;gap:7px;padding:10px 12px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1)}
.cy-progress-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.cy-progress-num{font-size:13px;font-weight:600;font-family:ui-monospace,Consolas,monospace;color:var(--cy-fg)}
.cy-progress-meta{font-size:11px;color:var(--cy-fg-3)}
.cy-progress-track{display:flex;gap:1px;height:16px;border-radius:999px;background:var(--cy-bg-3);overflow:hidden}
.cy-progress-vol{position:relative;display:flex;align-items:center;justify-content:center;min-width:0;padding:0;background:transparent;border:0}
.cy-progress-fill{position:absolute;inset:0 auto 0 0;background:var(--cy-amber-soft);border-right:1px solid var(--cy-amber);transition:.15s}
.cy-progress-vol:hover .cy-progress-fill{background:var(--cy-amber-soft);filter:brightness(1.3)}
.cy-progress-sep{position:absolute;left:0;top:0;bottom:0;width:1px;background:var(--cy-line-2);z-index:1}
.cy-progress-name{position:relative;z-index:2;font-size:9.5px;color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}
.cy-progress-foot{font-size:10.5px;color:var(--cy-fg-3)}

/* ── #7/#8 大纲卡片墙 / 三视图 ── */
.cy-plan-viewbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.cy-plan-brief{font-size:11.5px;color:var(--cy-fg-3)}
.cy-pcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.cy-pcard{display:flex;flex-direction:column;gap:6px;padding:10px 11px;border:1px solid var(--cy-line);border-radius:var(--cy-radius);background:var(--cy-bg-1);text-align:left;min-height:132px}
.cy-pcard:hover{border-color:var(--cy-amber);background:var(--cy-bg-2)}
.cy-pcard.is-empty,.cy-pcard.cy-pcard-empty{border-style:dashed;background:transparent}
.cy-pcard.cy-pcard-done{border-color:var(--cy-green)}
.cy-pcard.cy-pcard-done .cy-pcard-n{color:var(--cy-green)}
.cy-pcard-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.cy-pcard-n{font-size:11px;color:var(--cy-amber);font-family:ui-monospace,Consolas,monospace}
.cy-pcard-title{font-size:13px;font-weight:600;color:var(--cy-fg);line-height:1.45}
.cy-pcard-sum{font-size:11.5px;color:var(--cy-fg-2);line-height:1.6;flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.cy-pcard-hook{display:flex;gap:5px;align-items:baseline;font-size:11px;color:var(--cy-teal)}
.cy-pcard-hook-k{color:var(--cy-fg-3);flex:none}
.cy-pcard-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--cy-fg-3)}
.cy-pcard-ph{font-size:11px;color:var(--cy-fg-3);font-style:italic}
/* 时间线视图 */
.cy-ptl{display:flex;flex-direction:column;gap:0;padding-left:8px}
.cy-ptl-vol{display:flex;flex-direction:column;gap:5px;padding:8px 0 8px 14px;border-left:2px solid var(--cy-line-2);position:relative}
.cy-ptl-vol:hover{border-left-color:var(--cy-amber)}
.cy-ptl-head{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--cy-fg);font-weight:600}
.cy-ptl-rail{display:flex;flex-wrap:wrap;gap:3px;align-items:center}
.cy-ptl-dot{width:14px;height:14px;border-radius:4px;border:1px solid var(--cy-line-2);background:var(--cy-bg-3);padding:0;font-size:0}
.cy-ptl-dot:hover{transform:scale(1.25);border-color:var(--cy-amber)}
.cy-ptl-dot.cy-ptl-drafted{background:var(--cy-amber-soft);border-color:var(--cy-amber)}
.cy-ptl-dot.cy-ptl-written{background:var(--cy-green-soft);border-color:var(--cy-green)}
.cy-ptl-dot.done{background:var(--cy-green-soft);border-color:var(--cy-green)}
.cy-ptl-dot.cur{background:var(--cy-amber-soft);border-color:var(--cy-amber);box-shadow:0 0 0 2px var(--cy-amber-soft)}

/* ── #9 AI 填整卷摘要 ── */
.cy-fillbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 11px;border:1px dashed var(--cy-line-2);border-radius:9px;background:var(--cy-bg-2)}
.cy-fillbar-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.cy-fillbar-title{font-size:12px;color:var(--cy-fg)}
.cy-fillbar-sub{font-size:10.5px;color:var(--cy-fg-3)}

/* ── #10 上下文可拖可关 / #11 预算条 ── */
.cy-ctx-grip{cursor:grab;color:var(--cy-fg-3);font-size:11px;padding:0 2px;user-select:none}
.cy-ctx-grip:active{cursor:grabbing}
.cy-ctx-row.dragging{opacity:.45;border-style:dashed}
.cy-ctx-row.drop-target{border-color:var(--cy-amber);box-shadow:0 0 0 2px var(--cy-amber-soft)}
.cy-ctx-row.off,.cy-ctx-row.cy-ctx-off{opacity:.42;text-decoration:line-through}
.cy-ctx-sw{width:26px;height:14px;border-radius:999px;background:var(--cy-bg-3);border:1px solid var(--cy-line-2);position:relative;flex:none;transition:.12s}
.cy-ctx-sw::after{content:'';position:absolute;top:1px;left:1px;width:10px;height:10px;border-radius:50%;background:var(--cy-fg-3);transition:.12s}
.cy-ctx-sw.on{background:var(--cy-teal-soft);border-color:var(--cy-teal)}
.cy-ctx-sw.on::after{left:13px;background:var(--cy-teal)}
.cy-ctx-meter{display:flex;flex-direction:column;gap:3px;padding-top:6px;border-top:1px solid var(--cy-line)}
.cy-ctx-foot{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--cy-fg-3)}
/* 预算三档色（复用 .cy-bar 容器） */
.cy-budget{display:flex;flex-direction:column;gap:5px}
.cy-budget .cy-bar > i.ok{background:var(--cy-green)}
.cy-budget .cy-bar > i.warn{background:var(--cy-amber)}
.cy-budget .cy-bar > i.bad{background:var(--cy-red)}

/* ── #12 意图复用 ── */
.cy-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 0 0}
.cy-chips-label{font-size:10.5px;color:var(--cy-fg-3);flex:none}
.cy-chip{max-width:220px;padding:3px 9px;border-radius:999px;border:1px solid var(--cy-line-2);background:var(--cy-bg-2);font-size:11px;color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:.12s}
.cy-chip:hover{border-color:var(--cy-amber);color:var(--cy-amber);background:var(--cy-amber-soft)}

/* ── #13 正文右侧彩带 ── */
.cy-rv-docbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.cy-rv-pick{font-size:11px;color:var(--cy-amber);padding:2px 8px;border-radius:999px;background:var(--cy-amber-soft);border:1px solid var(--cy-amber);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-heat{display:flex;align-items:flex-end;gap:6px;padding:6px 8px;border:1px solid var(--cy-line);border-radius:9px;background:var(--cy-bg-2)}
.cy-heat-title{font-size:10px;color:var(--cy-fg-3);flex:none;writing-mode:horizontal-tb}
.cy-heat-track{display:flex;flex:1 1 auto;gap:2px;height:22px;min-width:0}
.cy-heat-cell{flex:1 1 0;min-width:3px;border-radius:2px;border:1px solid var(--cy-line-2);background:var(--cy-bg-3);transition:.1s}
.cy-heat-good{background:var(--cy-green-soft);border-color:var(--cy-green)}
.cy-heat-warn{background:var(--cy-amber-soft);border-color:var(--cy-amber)}
.cy-heat-bad{background:var(--cy-red-soft);border-color:var(--cy-red)}
.cy-heat-cell:hover{filter:brightness(1.4)}
.cy-heat-cell.on{outline:2px solid var(--cy-fg);outline-offset:1px}
.cy-heat-legend{display:flex;gap:6px;align-items:center;flex:none}
.cy-heat-key{font-size:9.5px;color:var(--cy-fg-3);padding:1px 5px;border-radius:999px;border:1px solid transparent}
.cy-heat-key.cy-heat-good{border-color:var(--cy-green);color:var(--cy-green)}
.cy-heat-key.cy-heat-warn{border-color:var(--cy-amber);color:var(--cy-amber)}
.cy-heat-key.cy-heat-bad{border-color:var(--cy-red);color:var(--cy-red)}

/* ── #14 段落视图 + 点亮 ── */
.cy-para-list{display:flex;flex-direction:column;gap:2px;padding:2px 2px 6px;max-height:52vh;overflow:auto}
.cy-para{position:relative;padding:6px 10px 6px 30px;border-radius:7px;border-left:2px solid transparent;font-size:14px;line-height:2;color:var(--cy-fg);cursor:pointer;background:none;border-top:0;border-right:0;border-bottom:0;width:100%;text-align:left;font-family:inherit}
.cy-para:hover{background:var(--cy-bg-2)}
.cy-para:focus-visible{outline:2px solid var(--cy-amber);outline-offset:1px}
.cy-para-n{position:absolute;left:8px;top:8px;font-size:9.5px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace}
.cy-para-on{border-left-color:var(--cy-amber);background:var(--cy-amber-soft)}
.cy-para-bad{border-left-color:var(--cy-red-soft)}
.cy-para-warn{border-left-color:var(--cy-amber-soft)}
.cy-para-on.cy-para-bad{border-left-color:var(--cy-red);box-shadow:inset 0 0 0 1px var(--cy-red-soft)}
.cy-para-on.cy-para-warn{border-left-color:var(--cy-amber)}
.cy-issue.active,.cy-issue.cy-issue-on{background:var(--cy-amber-soft);box-shadow:inset 0 0 0 1px var(--cy-amber)}
.cy-keys{font-size:10px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;padding:0 6px;border:1px solid var(--cy-line);border-radius:5px}

/* ── #16 提案按章折叠 / 批量 ── */
.cy-prop-group{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.cy-prop-group-head{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:7px;background:var(--cy-bg-2);border:1px solid var(--cy-line);text-align:left;width:100%}
.cy-prop-group-head:hover{border-color:var(--cy-line-2)}
.cy-prop-fold{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px dashed var(--cy-line-2);background:var(--cy-bg-2);text-align:left;width:100%;margin-bottom:6px}
.cy-prop-fold:hover{border-color:var(--cy-amber);background:var(--cy-bg-3)}
.cy-prop-fold-n{font-size:11.5px;color:var(--cy-amber);font-family:ui-monospace,Consolas,monospace;flex:none}

/* ── #18 账本格可点 ── */
.cy-td-cell{display:flex;align-items:center;gap:4px;min-width:0;text-align:left;padding:0;color:var(--cy-fg-2)}
.cy-td-cell:hover .cy-td-value{color:var(--cy-amber);text-decoration:underline dotted}
.cy-td-cell:hover .cy-td-pin{opacity:1}
.cy-td-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cy-td-pin{flex:none;font-size:9px;color:var(--cy-amber);opacity:0;transition:.1s}
.cy-td-strong{font-weight:600;color:var(--cy-fg)}
.cy-source{display:flex;flex-direction:column;gap:9px}
.cy-source-quote{font-size:13px;line-height:1.9;color:var(--cy-fg);padding:9px 11px;border-left:2px solid var(--cy-amber);background:var(--cy-bg-2);border-radius:0 7px 7px 0}

/* ── #19 关系图过滤 ── */
.cy-graph-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:6px}
.cy-tl-ok{font-size:11.5px;color:var(--cy-green);padding:4px 9px;border-radius:7px;background:var(--cy-green-soft);border:1px solid var(--cy-green);display:inline-block}

/* ── #20 逾期伏笔 ── */
.cy-tl-overdue{display:flex;flex-direction:column;gap:4px;padding:8px 10px;margin-bottom:10px;border:1px solid var(--cy-red);border-radius:9px;background:var(--cy-red-soft)}
.cy-tl-overdue-title{font-size:11.5px;color:var(--cy-red);font-weight:600}
.cy-tl-overdue-row{display:flex;flex-direction:column;gap:1px;padding:4px 7px;border-radius:6px;border:1px solid transparent;text-align:left;background:transparent}
.cy-tl-overdue-row:hover{border-color:var(--cy-red);background:var(--cy-bg-1)}
.cy-tl-overdue-name{font-size:12px;color:var(--cy-fg)}
.cy-tl-overdue-sub{font-size:10.5px;color:var(--cy-fg-3)}

/* ── #21 最近干过什么 ── */
.cy-hist{display:flex;flex-direction:column;gap:3px}
.cy-hist-row{display:flex;flex-direction:column;border:1px solid var(--cy-line);border-radius:8px;background:var(--cy-bg-2);overflow:hidden}
.cy-hist-row.on{border-color:var(--cy-amber)}
.cy-hist-main{display:grid;grid-template-columns:20px minmax(0,1fr) auto auto 14px;align-items:center;gap:9px;padding:8px 10px;text-align:left}
.cy-hist-main:hover{background:var(--cy-bg-3)}
.cy-hist-icon{font-size:13px;text-align:center}
.cy-hist-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.cy-hist-title{font-size:12.5px;color:var(--cy-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-hist-sub{font-size:10.5px;color:var(--cy-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-hist-at{font-size:10.5px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.cy-hist-detail{display:flex;flex-direction:column;gap:7px;padding:9px 11px;border-top:1px solid var(--cy-line);font-size:12px;color:var(--cy-fg-2);background:var(--cy-bg-1)}

/* ── #22 扫榜表格 ── */
.cy-scan{display:flex;flex-direction:column;border:1px solid var(--cy-line);border-radius:9px;overflow:hidden;background:var(--cy-bg-1)}
.cy-scan-head,.cy-scan-row{display:grid;grid-template-columns:36px 62px minmax(0,1.4fr) 62px 76px minmax(0,1.6fr) 54px;align-items:center;gap:8px;padding:6px 10px}
.cy-scan-head{background:var(--cy-bg-2);border-bottom:1px solid var(--cy-line);position:sticky;top:0;z-index:1}
.cy-scan-th{text-align:left;font-size:10.5px;color:var(--cy-fg-3);padding:2px 0}
.cy-scan-th.on{color:var(--cy-amber)}
.cy-scan-th:hover{color:var(--cy-fg)}
.cy-scan-row{text-align:left;border-bottom:1px solid var(--cy-line);background:transparent}
.cy-scan-row:last-child{border-bottom:0}
.cy-scan-row:hover{background:var(--cy-bg-2)}
.cy-scan-td{font-size:11.5px;color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-scan-rank{font-family:ui-monospace,Consolas,monospace;color:var(--cy-fg-3)}
.cy-scan-book{color:var(--cy-fg);font-weight:600}
.cy-scan-num{font-family:ui-monospace,Consolas,monospace;text-align:right}
.cy-scan-hook{color:var(--cy-fg-3);font-size:11px}
.cy-scan-trend{text-align:right;font-family:ui-monospace,Consolas,monospace}
.cy-scan-trend.up{color:var(--cy-green)}
.cy-scan-trend.down{color:var(--cy-red)}

/* ── #23 导出 ── */
.cy-export-tree{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid var(--cy-line);border-radius:9px;background:var(--cy-bg-2);font-family:ui-monospace,Consolas,monospace}
.cy-export-row{display:grid;grid-template-columns:20px minmax(0,150px) minmax(0,1fr);align-items:center;gap:9px}
.cy-export-icon{font-size:11px;color:var(--cy-fg-3);text-align:center}
.cy-export-text{color:var(--cy-amber)}
.cy-export-name{font-size:11.5px;color:var(--cy-fg)}

/* ── #24 主题三档 ── */
.cy-theme-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.cy-theme-card{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border:1px solid var(--cy-line);border-radius:9px;background:var(--cy-bg-2);text-align:left}
.cy-theme-card.on{border-color:var(--cy-amber);box-shadow:0 0 0 1px var(--cy-amber)}
.cy-theme-swatch{height:22px;border-radius:6px;border:1px solid var(--cy-line-2);display:flex;align-items:center;justify-content:center;font-size:10px;color:#6b5d4a}
.cy-theme-dark .cy-theme-swatch{background:#191c21;border-color:#3a424e}
.cy-theme-light .cy-theme-swatch{background:#fffdfa}
.cy-theme-paper .cy-theme-swatch{background:#f0e8d8;font-family:Georgia,"Songti SC",serif}
.cy-theme-name{font-size:12px;color:var(--cy-fg)}
.cy-theme-hint{font-size:10px;color:var(--cy-fg-3)}

/* ── 【12 条】这轮补的四个小件 ── */

/* #6 月预算泡：本体是 button（点了给明细），里面叠一条 3px 进度。 */
.cy-budget{display:inline-flex;flex-direction:column;gap:4px;align-items:flex-start;cursor:pointer;font:inherit}
.cy-budget:hover{color:var(--cy-fg-1)}
.cy-budget-over{color:var(--cy-red);border-color:var(--cy-red)}
.cy-budget-bar{display:block;width:100%;min-width:64px;height:3px;border-radius:999px;background:var(--cy-bg-3);overflow:hidden}
.cy-budget-fill{display:block;height:100%;border-radius:999px;background:var(--cy-amber)}
.cy-budget-over .cy-budget-fill{background:var(--cy-red)}

/* #10 样例开关：空态也得有东西可点，但必须是你自己按的。 */
.cy-demo-sw{border:1px dashed var(--cy-line);border-radius:999px;background:transparent;color:var(--cy-fg-3);font:inherit;font-size:12px;padding:2px 10px;cursor:pointer}
.cy-demo-sw:hover{color:var(--cy-fg-1);border-color:var(--cy-fg-3)}
.cy-demo-sw.on{border-style:solid;border-color:var(--cy-amber);color:var(--cy-amber)}

/* #8 AI 味词表编辑器。 */
.cy-lex-add{display:grid;grid-template-columns:minmax(120px,1fr) minmax(160px,2fr) auto;gap:8px;align-items:center;margin:10px 0}
.cy-lex-list{display:flex;flex-direction:column;gap:4px;max-height:280px;overflow:auto}
.cy-lex-row{display:grid;grid-template-columns:minmax(80px,140px) 1fr auto auto;gap:8px;align-items:center;padding:5px 8px;border:1px solid var(--cy-line);border-radius:7px;background:var(--cy-bg-2)}
.cy-lex-row.cy-lex-off{opacity:.45}
.cy-lex-word{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:var(--cy-fg-1)}
.cy-lex-row.cy-lex-off .cy-lex-word{text-decoration:line-through}
.cy-lex-acts{display:flex;gap:4px}

/* 保存状态小签：以前跟键盘提示共用 cy-keys，两件事挤一个样式，
   smoke 里数「键盘提示条」会数到两个。拆开，外观保持一致。 */
.cy-save-state{font-size:10px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;padding:0 6px;border:1px solid var(--cy-line);border-radius:5px}
.cy-save-state.cy-dirty{color:var(--cy-amber);border-color:var(--cy-amber-soft);background:var(--cy-amber-soft)}

/* ── 页级容器补齐 ── */
.cy-scout,.cy-studio,.cy-world{display:flex;flex-direction:column;gap:12px;min-width:0}

/* ── 窄屏 ── */
@media (max-width:1000px){
  .cy-cols,.cy-rv-body{grid-template-columns:minmax(0,1fr)}
  .cy-studio-cols{grid-template-columns:minmax(0,1fr)}
  .cy-world-body{grid-template-columns:minmax(0,1fr)}
  .cy-world-nav{flex-direction:row;flex-wrap:wrap}
  .cy-world-nav-foot{display:none}
  .cy-order-grid{grid-template-columns:1fr 1fr}
  .cy-form-grid{grid-template-columns:1fr}
  .cy-plan-grid{grid-template-columns:1fr}
  .cy-plan-main{grid-template-columns:minmax(0,1fr)}
  .cy-plan-row{grid-template-columns:56px minmax(0,1fr)}
  .cy-diff-cols{grid-template-columns:1fr}
  .cy-top-right{flex-wrap:wrap;justify-content:flex-end}
}
/* ── 第 10 轮：搜索命中断、历史版本、回收站、派单话术、采纳前告警 ── */
.cy-cmdk-scope{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--cy-line)}
.cy-cmdk-head{padding:8px 12px 3px;font-size:11px;letter-spacing:.08em;color:var(--cy-fg-3);text-transform:uppercase}
.cy-cmdk-hit .cy-cmdk-label{color:var(--cy-fg)}
.cy-cmdk-hit .cy-cmdk-hint{font-family:var(--cy-mono,ui-monospace,monospace);font-size:11px}

.cy-hist-ver{display:flex;flex-direction:column;gap:6px}
.cy-ver-row{display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:6px;background:var(--cy-bg-2)}
.cy-ver-at{font-family:var(--cy-mono,ui-monospace,monospace);font-size:12px;color:var(--cy-fg-2);min-width:126px}
.cy-ver-w{font-size:11px;color:var(--cy-fg-3);min-width:56px}

.cy-trash-list{display:flex;flex-direction:column;gap:4px}
.cy-trash-row{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:6px;background:var(--cy-bg-2)}
.cy-trash-n{font-size:12px;color:var(--cy-amber);min-width:56px}
.cy-trash-title{flex:1;font-size:12px;color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-trash-w{font-size:11px;color:var(--cy-fg-3);min-width:52px}
.cy-trash-at{min-width:104px;font-family:var(--cy-mono,ui-monospace,monospace)}

.cy-dispatch{margin-top:10px;border:1px solid var(--cy-line);border-radius:8px;background:var(--cy-bg-2)}
.cy-dispatch-head{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--cy-line);font-size:11px;color:var(--cy-fg-3)}
.cy-dispatch-body{margin:0;padding:10px;font-family:var(--cy-mono,ui-monospace,monospace);font-size:11.5px;line-height:1.7;color:var(--cy-fg-2);white-space:pre-wrap;word-break:break-word}

.cy-prop-warn{display:flex;flex-wrap:wrap;align-items:flex-start;gap:7px;margin-bottom:9px;padding:8px 10px;border-radius:7px;border:1px solid var(--cy-amber-d, #7a5a18);background:rgba(214,158,46,.1);font-size:12px;color:var(--cy-amber)}
.cy-prop-warn-icon{line-height:1.2}
.cy-prop-warn-list{margin:0;padding-left:18px;width:100%;list-style:disc}
.cy-prop-warn-list li{margin-top:2px;color:var(--cy-fg-2);font-size:11.5px}
.cy-heat-density{font-size:10px;color:var(--cy-fg-3)}


/* ── 【QA】撤销 / 重做 ──
   紧跟在「段落视图 / 编辑正文」两个分段按钮后面，不换行。 */
.cy-rv-undo{display:inline-flex;align-items:center;gap:5px;margin-left:2px}
.cy-undo-btn,.cy-redo-btn{font-variant-numeric:tabular-nums}
.cy-undo-btn[disabled],.cy-redo-btn[disabled]{opacity:.4}
.cy-undo-n{font-size:10.5px;color:var(--cy-fg-3);font-family:var(--cy-mono,ui-monospace,monospace);min-width:52px}

/* ── 【QA】弹窗无障碍 ──
   焦点搬进浮层后必须看得见落在哪个格子，否则键盘用户彻底迷路。
   只给 :focus-visible 描边，鼠标点击不会留一圈亮边。 */
.cy-modal:focus{outline:none}
.cy-modal:focus-visible{outline:2px solid var(--cy-amber);outline-offset:2px}
.cy-modal-mask .cy-modal button:focus-visible,
.cy-modal-mask .cy-modal input:focus-visible,
.cy-modal-mask .cy-modal textarea:focus-visible,
.cy-modal-mask .cy-modal select:focus-visible{outline:2px solid var(--cy-amber);outline-offset:1px}

/* ── 【QA】预算拦截 ──
   掉在顶栏月预算泡旁边的一条小标，和它同一个色系。 */
.cy-budget-stop{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:5px;font-size:10.5px;border:1px solid var(--cy-line);color:var(--cy-fg-3)}
.cy-budget-stop.cy-budget-halt{border-color:var(--cy-red-d,#7a2a2a);background:rgba(220,80,80,.12);color:var(--cy-red,#e2685f)}
.cy-btn.cy-btn-halt{border-color:var(--cy-red-d,#7a2a2a);color:var(--cy-red,#e2685f)}

/* ── 更窄一档：平板竖屏 / 分屏 ──
   上一条 1000px 只把两栏叠成一栏，但顶栏、底栏、表格、工具栏那时还是横向铺开，
   768 宽就开始横向溢出。这一档专门收它们。 */
@media (max-width:720px){
  .cy-top{flex-direction:column;align-items:stretch;gap:6px}
  .cy-top-mid,.cy-top-right{flex-wrap:wrap;justify-content:flex-start;gap:6px}
  .cy-top-hint{order:-1;width:100%}
  .cy-bottom-pad{flex-direction:column;gap:5px}
  .cy-bottom-acts{width:100%;justify-content:center;flex-wrap:wrap}
  .cy-dock{gap:2px;overflow-x:auto;max-width:100%}
  .cy-dock-btn{padding:4px 5px;white-space:nowrap}
  .cy-stat-grid{grid-template-columns:1fr 1fr}
  .cy-actions{grid-template-columns:1fr}
  .cy-rv-docbar{flex-wrap:wrap;gap:5px}
  .cy-rv-acts{flex-wrap:wrap}
  .cy-heat{display:none}
  .cy-ledger-table,.cy-scan{overflow-x:auto}
  .cy-ledger-row,.cy-scan-row{min-width:560px}
  .cy-cmdk{left:8px;right:8px;width:auto;max-height:74vh}
  .cy-modal{left:8px;right:8px;width:auto;max-height:86vh}
  .cy-modal-foot{flex-wrap:wrap}
  .cy-theme-row{grid-template-columns:1fr}
}

/* ── 流水线（派单台） ── */
.cy-pipe{display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:12px;padding:12px;align-items:start;min-height:0}
.cy-pipe-right{display:flex;flex-direction:column;gap:12px;min-width:0}
.cy-pipe-roles{position:sticky;top:0}
.cy-pipe-form{display:flex;flex-direction:column;gap:8px}
.cy-pipe-form-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:2px}
.cy-pipe-prompt{
  margin:8px 0 0;padding:12px;max-height:52vh;overflow:auto;
  background:var(--cy-bg);border:1px solid var(--cy-line);border-radius:8px;
  color:var(--cy-fg-2);font-size:12px;line-height:1.72;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  white-space:pre-wrap;word-break:break-word;
}
.cy-pipe-modal-foot{display:flex;gap:8px;justify-content:flex-end}

.cy-role-grid{display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px}
.cy-role{
  display:grid;grid-template-columns:1fr auto;gap:2px 8px;
  padding:7px 9px;border:1px solid var(--cy-line);border-radius:8px;
  background:var(--cy-bg-1);color:inherit;text-align:left;cursor:pointer;
  transition:border-color .12s,background .12s;
}
.cy-role:hover{border-color:var(--cy-line-2);background:var(--cy-bg-2)}
.cy-role:focus-visible{outline:2px solid var(--cy-amber);outline-offset:1px}
.cy-role-boss{border-color:var(--cy-amber);background:var(--cy-amber-soft)}
.cy-role-name{font-weight:600;font-size:12.5px;color:var(--cy-fg)}
.cy-role-id{
  font-size:10.5px;color:var(--cy-fg-3);justify-self:end;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.cy-role-duty{grid-column:1 / -1;font-size:11.5px;color:var(--cy-fg-3);line-height:1.5}
.cy-role-foot{grid-column:1 / -1;display:flex;gap:5px;flex-wrap:wrap;margin-top:2px}

.cy-dp-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.cy-dp{
  border:1px solid var(--cy-line);border-left:3px solid var(--cy-line-2);
  border-radius:8px;padding:8px 10px;background:var(--cy-bg-1);
}
.cy-dp-issued{border-left-color:var(--cy-blue)}
.cy-dp-claimed{border-left-color:var(--cy-amber)}
.cy-dp-submitted{border-left-color:var(--cy-green)}
.cy-dp-expired{border-left-color:var(--cy-red)}
.cy-dp-revoked{opacity:.62;border-left-color:var(--cy-fg-3)}
.cy-dp-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cy-dp-role{font-weight:600;font-size:12.5px}
.cy-dp-id{
  margin-left:auto;font-size:10.5px;color:var(--cy-fg-3);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.cy-dp-task{margin-top:4px;font-size:12.5px;color:var(--cy-fg-2);line-height:1.6;white-space:pre-wrap}
.cy-dp-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:5px;font-size:11px;color:var(--cy-fg-3)}
.cy-dp-left{color:var(--cy-amber)}
.cy-dp-err{color:var(--cy-red)}
.cy-dp-report{
  margin-top:7px;padding:8px 10px;border-radius:7px;
  background:var(--cy-bg-2);border:1px dashed var(--cy-line-2);
}
.cy-dp-report-head{font-size:11px;color:var(--cy-fg-3);letter-spacing:.06em}
.cy-dp-verdict{margin-top:3px;font-size:12.5px;font-weight:600;color:var(--cy-amber)}
.cy-dp-sec{display:flex;gap:8px;margin-top:5px;font-size:12px;line-height:1.6}
.cy-dp-sec-t{flex:0 0 88px;color:var(--cy-fg-3);font-size:11.5px}
.cy-dp-sec-b{flex:1 1 auto;color:var(--cy-fg-2);white-space:pre-wrap;word-break:break-word}
.cy-dp-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:7px;border-top:1px solid var(--cy-line)}

.cy-rep-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.cy-rep{padding:7px 10px;border-radius:7px;background:var(--cy-bg-1);border:1px solid var(--cy-line)}
.cy-rep-head{display:flex;align-items:center;gap:8px}
.cy-rep-role{font-weight:600;font-size:12px}
.cy-rep-at{margin-left:auto;font-size:10.5px;color:var(--cy-fg-3)}
.cy-rep-verdict{margin-top:3px;font-size:12px;color:var(--cy-fg-2);line-height:1.6}

@media (max-width:900px){
  .cy-pipe{grid-template-columns:1fr}
  .cy-pipe-roles{position:static}
  .cy-role-grid{grid-template-columns:1fr 1fr}
}

/* ── 文风校验（第 1 批） ── */
.cy-lint .cy-lint-sum{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 8px}
.cy-lint-verdict{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid transparent}
.cy-lint-verdict-ok{color:var(--cy-green);background:var(--cy-green-soft);border-color:var(--cy-green)}
.cy-lint-verdict-bad{color:var(--cy-red);background:var(--cy-red-soft);border-color:var(--cy-red)}
.cy-lint-seg{margin-left:auto}
.cy-lint-list{display:flex;flex-direction:column;gap:5px;max-height:46vh;overflow:auto}
.cy-lint-hit{
  display:grid;grid-template-columns:22px auto 1fr;gap:3px 7px;align-items:baseline;
  padding:6px 8px;border:1px solid var(--cy-line);border-left-width:3px;border-radius:7px;
  background:var(--cy-bg-1);color:inherit;text-align:left;cursor:pointer;font:inherit;
}
.cy-lint-hit:hover{background:var(--cy-bg-2);border-color:var(--cy-line-2)}
.cy-lint-hit:focus-visible{outline:2px solid var(--cy-amber);outline-offset:1px}
.cy-lint-blocking{border-left-color:var(--cy-red)}
.cy-lint-advisory{border-left-color:var(--cy-amber)}
.cy-lint-n{
  font-size:10.5px;color:var(--cy-fg-3);text-align:right;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.cy-lint-quote{
  grid-column:3;font-size:12px;color:var(--cy-fg);line-height:1.55;
  word-break:break-word;
}
.cy-lint-hint{grid-column:3;font-size:11px;color:var(--cy-fg-3);line-height:1.5}
.cy-lint-about{margin-top:8px;font-size:11.5px;color:var(--cy-fg-3)}
.cy-lint-about summary{cursor:pointer;color:var(--cy-fg-2);padding:2px 0}
.cy-lint-about p{margin:4px 0 0;line-height:1.6}
.cy-lint-modal-lead{margin:0 0 8px;font-size:12.5px;color:var(--cy-fg-2);line-height:1.65}
.cy-lint-modal-foot{display:flex;gap:8px;justify-content:flex-end}
.cy-lint-compact .cy-lint-list{max-height:none}
/* 阶段 A：每条命中的「为什么」。命中行下面挂一行可展开的判据。 */
.cy-lint-item{display:flex;flex-direction:column}
.cy-lint-line{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:start}
.cy-lint-why-btn{grid-column:2;justify-self:end;font-size:11px;color:var(--cy-fg-3);cursor:pointer;padding:2px 7px;border-radius:5px;border:1px solid transparent;background:none;font-family:inherit;white-space:nowrap}
.cy-lint-why-btn:hover{color:var(--cy-amber);border-color:var(--cy-line)}
.cy-lint-why-btn.on{color:var(--cy-amber);background:var(--cy-amber-soft);border-color:var(--cy-amber)}
.cy-lint-why-btn:focus-visible{outline:2px solid var(--cy-amber);outline-offset:1px}
.cy-lint-why{display:flex;flex-direction:column;gap:2px;margin:0 0 2px;padding:6px 10px 7px;border-left:2px solid var(--cy-amber);background:var(--cy-bg-2);border-radius:0 6px 6px 0}
.cy-lint-why-tag{font-size:10.5px;color:var(--cy-amber);letter-spacing:.02em}
.cy-lint-why-text{font-size:12px;color:var(--cy-fg-2);line-height:1.65}
/* 阶段 C：本书自己的阈值卡 */
.cy-lint-cal{display:block}
.cy-lint-cal-lead{margin:0 0 10px}
.cy-lint-cal-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cy-lint-cal-more{background:none;border:none;padding:2px 4px;font-size:11.5px;color:var(--cy-fg-3);cursor:pointer;font:inherit}
.cy-lint-cal-more:hover{color:var(--cy-amber)}
.cy-lint-cal-more:focus-visible{outline:2px solid var(--cy-amber);outline-offset:1px}
.cy-lint-cal-list{margin:10px 0 0;display:flex;flex-direction:column;gap:3px;max-height:34vh;overflow:auto}
.cy-lint-cal-row{display:flex;align-items:baseline;gap:8px;padding:4px 8px;border-radius:6px;background:var(--cy-bg-2);border-left:2px solid var(--cy-amber)}
.cy-lint-cal-name{font-size:12px;color:var(--cy-fg);flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-lint-cal-num{font-size:11px;color:var(--cy-fg-3);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;flex:0 0 auto}
.cy-lint-cal-note{margin:3px 0 0;padding-left:7px;border-left:2px solid var(--cy-line-2)}
.cy-lint-cal-tight{border-left-color:var(--cy-amber)}
.cy-lint-cal-loose{border-left-color:var(--cy-blue)}
.cy-lint-cal-loud{border-left-color:var(--cy-red)}
.cy-lint-cal-idle{border-left-color:var(--cy-line);color:var(--cy-fg-3)}

/* ── 拆书 / 导入 / 扫榜（第 2·3·4 批） ── */
.cy-analyze{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.cy-analyze-stat{
  padding:8px 10px;border-radius:8px;
  background:var(--cy-bg-2);border:1px solid var(--cy-line);
}
.cy-analyze-hooks{display:flex;gap:6px;flex-wrap:wrap}
.cy-analyze-open{
  display:flex;flex-direction:column;gap:4px;
  padding:8px 10px;border-radius:8px;
  background:var(--cy-bg-1);border:1px solid var(--cy-line);
}
.cy-analyze-open h4{margin:0 0 4px;font-size:11.5px;font-weight:600;color:var(--cy-fg-3);letter-spacing:.06em}
.cy-analyze-row{
  display:grid;grid-template-columns:64px minmax(80px,1.1fr) auto auto minmax(0,2fr);
  gap:8px;align-items:baseline;
  padding:4px 0;border-bottom:1px dashed var(--cy-line);
  font-size:12px;line-height:1.55;
}
.cy-analyze-row:last-child{border-bottom:none}
.cy-analyze-ch{
  color:var(--cy-fg-3);font-size:11px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.cy-analyze-title{font-weight:600;color:var(--cy-fg);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-analyze-num{color:var(--cy-fg-3);font-size:11px;white-space:nowrap}
.cy-analyze-beats{color:var(--cy-fg-2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-ana-hist,.cy-scan-hist{display:flex;flex-direction:column;gap:3px}
.cy-ana-hist-row,.cy-scan-hist-row{display:flex;flex-direction:column;border:1px solid var(--cy-line);border-radius:8px;background:var(--cy-bg-2);overflow:hidden}
.cy-ana-hist-row.on{border-color:var(--cy-amber)}
.cy-ana-hist-main{
  display:grid;grid-template-columns:20px minmax(0,1fr) auto auto 14px;align-items:center;gap:9px;
  padding:8px 10px;text-align:left;background:none;border:none;color:inherit;font:inherit;cursor:pointer;
}
.cy-ana-hist-main:hover{background:var(--cy-bg-3)}
.cy-scan-hist-row{
  display:grid;grid-template-columns:20px minmax(0,1fr) auto 14px;align-items:center;gap:9px;
  padding:8px 10px;text-align:left;background:none;border:1px solid var(--cy-line);color:inherit;font:inherit;cursor:pointer;
}
.cy-scan-hist-row:hover{background:var(--cy-bg-3)}
.cy-ana-hist-icon,.cy-scan-hist-icon{font-size:13px;text-align:center}
.cy-ana-hist-body,.cy-scan-hist-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.cy-ana-hist-title,.cy-scan-hist-title{font-size:12.5px;color:var(--cy-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-ana-hist-sub,.cy-scan-hist-sub{font-size:10.5px;color:var(--cy-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-ana-hist-at,.cy-scan-hist-at{font-size:10.5px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.cy-ana-hist-detail{display:flex;flex-direction:column;gap:7px;padding:9px 11px;border-top:1px solid var(--cy-line);font-size:12px;color:var(--cy-fg-2);background:var(--cy-bg-1)}
.cy-import-opts{display:grid;grid-template-columns:1fr 180px;gap:10px}
.cy-scan-auto{margin-top:8px;padding-top:8px;border-top:1px dashed var(--cy-line)}
.cy-scan-auto summary{cursor:pointer;font-size:11.5px;color:var(--cy-fg-3);padding:2px 0}
.cy-scan-auto summary:hover{color:var(--cy-fg-2)}
.cy-scan-auto .cy-actions{margin-top:7px;flex-wrap:nowrap}
.cy-scan-auto .cy-actions .cy-input{flex:1 1 auto;min-width:0}

@media (max-width:900px){
  .cy-analyze-row{grid-template-columns:52px 1fr auto;row-gap:2px}
  .cy-analyze-beats{grid-column:1 / -1}
  .cy-import-opts{grid-template-columns:1fr}
  .cy-scan-auto .cy-actions{flex-wrap:wrap}

/* ── 【阶段 B】语料池 ─────────────────────────────────────── */
.cy-corpus-bar{height:8px;border-radius:99px;background:var(--cy-bg-3);overflow:hidden;margin:9px 0 6px}
.cy-corpus-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--cy-amber,#d9a441),var(--cy-amber-2,#e8c477));transition:width .35s ease}
.cy-corpus-nums{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--cy-fg-3);flex-wrap:wrap}
.cy-corpus-list{display:flex;flex-direction:column;gap:1px;margin:10px 0 4px}
.cy-corpus-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto 26px;align-items:center;gap:9px;padding:7px 9px;border-radius:7px;background:var(--cy-bg-1)}
.cy-corpus-row:hover{background:var(--cy-bg-2)}
.cy-corpus-name{font-size:12.5px;color:var(--cy-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-corpus-meta{font-size:11px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap}
.cy-corpus-add{display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:9px;margin-top:10px}
.cy-corpus-out{margin-top:11px;padding-top:10px;border-top:1px dashed var(--cy-line);display:flex;flex-direction:column;gap:8px}
.cy-corpus-sum{font-size:12px;color:var(--cy-fg-2);line-height:1.6}
.cy-corpus-th{display:flex;flex-direction:column;gap:1px}
.cy-corpus-th-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:11.5px}
.cy-corpus-th-row:nth-child(odd){background:var(--cy-bg-1)}
.cy-corpus-th-noisy{background:rgba(217,164,65,.1)}
.cy-corpus-th-name{color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-corpus-th-num{color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap}

@media (max-width:900px){
  .cy-corpus-add{grid-template-columns:1fr}
  .cy-corpus-th-row{grid-template-columns:minmax(0,1fr) auto;row-gap:2px}
}

/* ── 【借 LNW 六项】地图 · 成书 · 检查更新 · 冷读 · 意见池 · 简报 ───────── */

/* 地图：坐标是百分比，所以节点用绝对定位、边用 SVG 铺满底。 */
.cy-map{display:flex;flex-direction:column;gap:10px}
.cy-map-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.cy-map-hint{font-size:11.5px;color:var(--cy-fg-3);line-height:1.6}
.cy-map-stage{position:relative;height:420px;border-radius:10px;background:var(--cy-bg-1);border:1px solid var(--cy-line);overflow:hidden}
.cy-map-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.cy-map-edge{stroke:var(--cy-line);stroke-width:1.4;fill:none}
.cy-map-edge-road{stroke-dasharray:none}
.cy-map-edge.on{stroke:var(--cy-amber,#d9a441);stroke-width:2.2}
.cy-map-edge-label{font-size:10px;fill:var(--cy-fg-3)}
.cy-map-nodes{position:absolute;inset:0}
.cy-map-node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:grab;user-select:none}
.cy-map-node:active{cursor:grabbing}
.cy-map-dot{width:14px;height:14px;border-radius:50%;background:var(--cy-amber,#d9a441);box-shadow:0 0 0 3px rgba(217,164,65,.18)}
.cy-map-node.orphan .cy-map-dot{background:var(--cy-fg-3);box-shadow:0 0 0 3px rgba(0,0,0,.08)}
.cy-map-name{font-size:11px;color:var(--cy-fg-2);white-space:nowrap;padding:1px 5px;border-radius:5px;background:var(--cy-bg-2)}
.cy-map-ch{font-size:10px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace}
.cy-map-orphan{font-size:11.5px;color:var(--cy-amber,#d9a441)}
.cy-map-select{height:30px;border-radius:7px;border:1px solid var(--cy-line);background:var(--cy-bg-1);color:var(--cy-fg);font-size:12px;padding:0 8px}
.cy-map-select:focus{outline:none;border-color:var(--cy-amber,#d9a441)}
.cy-map-edges,.cy-map-edgelist{display:flex;flex-direction:column;gap:1px;margin-top:8px}
.cy-map-edgerow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr) 26px;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:11.5px;background:var(--cy-bg-1)}
.cy-map-edgerow:nth-child(odd){background:var(--cy-bg-2)}
.cy-map-edgetext{color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cy-map-edgedel{width:22px;height:22px;border:0;border-radius:5px;background:transparent;color:var(--cy-fg-3);cursor:pointer}
.cy-map-edgedel:hover{background:rgba(217,74,65,.14);color:#d94a41}
.cy-map-link{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) auto;gap:8px;align-items:center}
.cy-map-link-label{font-size:11.5px;color:var(--cy-fg-3)}
.cy-map-label-input{margin-top:6px}

/* 成书导出：四个格式牌，点一下才真下。 */
.cy-book-formats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:10px 0}
.cy-book-format{display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:11px 12px;border-radius:9px;border:1px solid var(--cy-line);background:var(--cy-bg-1);cursor:pointer;text-align:left}
.cy-book-format:hover{border-color:var(--cy-amber,#d9a441);background:var(--cy-bg-2)}
.cy-book-format-name{font-size:13px;color:var(--cy-fg);font-weight:600}
.cy-book-format-hint{font-size:11px;color:var(--cy-fg-3);line-height:1.55}
.cy-book-skip{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--cy-fg-2)}
.cy-update-err{font-size:11.5px;color:#d94a41}

/* 冷读：汇包 → 复制提示词 → 粘回执。三步在一个卡里，不跳页。 */
.cy-cold-form{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:9px 0 4px}
.cy-cold-pkg{margin-top:11px;padding-top:10px;border-top:1px dashed var(--cy-line);display:flex;flex-direction:column;gap:7px}
.cy-cold-file{font-size:12.5px;color:var(--cy-fg);font-family:ui-monospace,Consolas,monospace}
.cy-cold-prompt{max-height:190px;overflow:auto;margin:0;padding:9px 10px;border-radius:8px;background:var(--cy-bg-1);border:1px solid var(--cy-line);font-size:11.5px;line-height:1.7;color:var(--cy-fg-2);white-space:pre-wrap;word-break:break-word}
.cy-cold-submit{margin-top:12px;padding-top:11px;border-top:1px dashed var(--cy-line);display:flex;flex-direction:column;gap:7px}
.cy-cold-history{margin-top:11px;font-size:11.5px;color:var(--cy-fg-3)}
.cy-cold-history summary{cursor:pointer;color:var(--cy-fg-2)}
.cy-cold-histrow{display:flex;justify-content:space-between;gap:9px;padding:3px 0 3px 10px}
.cy-cold-histname{font-family:ui-monospace,Consolas,monospace;color:var(--cy-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 意见池：一行一条，右边两个决定。 */
.cy-opinion-src{margin-top:6px}
.cy-opinion-list{display:flex;flex-direction:column;gap:1px;margin-top:9px}
.cy-opinion{display:grid;grid-template-columns:64px minmax(0,1fr) auto auto;align-items:start;gap:9px;padding:8px 9px;border-radius:7px;background:var(--cy-bg-1)}
.cy-opinion:nth-child(odd){background:var(--cy-bg-2)}
.cy-opinion-open .cy-opinion-text{color:var(--cy-fg)}
.cy-opinion-adopted{opacity:.62}
.cy-opinion-dismissed{opacity:.45}
.cy-opinion-ch{font-size:11px;color:var(--cy-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap;padding-top:1px}
.cy-opinion-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.cy-opinion-text{font-size:12.5px;color:var(--cy-fg);line-height:1.65;word-break:break-word}
.cy-opinion-quote{font-size:11.5px;color:var(--cy-fg-3);line-height:1.6;word-break:break-word}
.cy-opinion-acts{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}

/* 对齐简报 */
.cy-brief{margin-top:9px;display:flex;flex-direction:column;gap:7px}
.cy-brief-text{max-height:300px;overflow:auto;margin:0;padding:10px;border-radius:8px;background:var(--cy-bg-1);border:1px solid var(--cy-line);font-size:11.5px;line-height:1.75;color:var(--cy-fg-2);white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Consolas,monospace}

@media (max-width:900px){
  .cy-map-stage{height:320px}
  .cy-map-link{grid-template-columns:1fr 1fr}
  .cy-opinion{grid-template-columns:minmax(0,1fr) auto;row-gap:5px}
  .cy-opinion-ch{grid-column:1/-1}
  .cy-opinion-acts{grid-column:1/-1;justify-content:flex-start}
}

/* ── 【借 oh-story】章级体检：四件事各查各的 ─────────────────── */
.cy-health{display:flex;flex-direction:column;gap:4px;margin-top:9px}
.cy-health-degenerate .cy-health-label{color:var(--cy-fg)}
.cy-health-row{border-radius:8px;background:var(--cy-bg-1);overflow:hidden}
.cy-health-head{display:grid;grid-template-columns:minmax(0,1fr) auto 16px;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;background:transparent;cursor:pointer;text-align:left}
.cy-health-head:hover{background:var(--cy-bg-2)}
.cy-health-label{font-size:12.5px;color:var(--cy-fg)}
.cy-health-caret{font-size:10px;color:var(--cy-fg-3)}
.cy-health-body{padding:2px 10px 10px;display:flex;flex-direction:column;gap:5px}
.cy-health-hits{display:flex;flex-direction:column;gap:1px}
.cy-health-hit{display:block;width:100%;padding:4px 8px;border:0;border-radius:5px;background:var(--cy-bg-2);color:var(--cy-fg-2);font-size:11.5px;line-height:1.6;text-align:left;cursor:pointer;word-break:break-word}
.cy-health-hit:hover{background:var(--cy-bg-3);color:var(--cy-fg)}
.cy-health-hit-flat{cursor:default}
.cy-health-hit-flat:hover{background:var(--cy-bg-2);color:var(--cy-fg-2)}

/* ── 任务包查看器 ──────────────────────────────────────────── */
.cy-taskpack{width:100%}
.cy-tp-list{display:flex;flex-direction:column;gap:4px;margin-top:9px}
.cy-tp-row{border-radius:8px;background:var(--cy-bg-1);overflow:hidden}
.cy-tp-head{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto auto;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;background:transparent;cursor:pointer;text-align:left}
.cy-tp-head:hover{background:var(--cy-bg-2)}
.cy-tp-role{font-size:12.5px;color:var(--cy-fg)}
.cy-tp-n{font-size:11.5px;color:var(--cy-fg-2)}
.cy-tp-at{font-size:11px;color:var(--cy-fg-3);font-variant-numeric:tabular-nums}
.cy-tp-body{padding:2px 10px 10px;display:flex;flex-direction:column;gap:5px}
.cy-tp-files{display:flex;flex-direction:column;gap:2px}
.cy-tp-file{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,2fr) auto;gap:8px;align-items:baseline;padding:4px 8px;border-radius:5px;background:var(--cy-bg-2)}
.cy-tp-file-name{font-size:11.5px;color:var(--cy-fg);font-family:var(--cy-mono);word-break:break-all}
.cy-tp-file-why{font-size:11px;color:var(--cy-fg-2);line-height:1.6}
.cy-tp-file-b{font-size:10.5px;color:var(--cy-fg-3);font-variant-numeric:tabular-nums}
.cy-tp-omit{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:5px;background:var(--cy-bg-2)}
.cy-tp-omit-t{font-size:11px;color:var(--cy-fg-3);letter-spacing:.04em}
.cy-tp-omit-row{font-size:11.5px;color:var(--cy-fg-2);line-height:1.6;word-break:break-word}
.cy-tp-prompt{margin-top:2px}
.cy-tp-prompt summary{cursor:pointer;font-size:11.5px;color:var(--cy-fg-2)}
.cy-tp-prompt-body{margin:5px 0 0;padding:8px;border-radius:6px;background:var(--cy-bg-2);font-family:var(--cy-mono);font-size:11px;line-height:1.65;white-space:pre-wrap;word-break:break-word;color:var(--cy-fg-2);max-height:240px;overflow:auto}
`
