/**
 * 长夜 · 样式
 *
 * 全部挂在 .nw- 前缀下，不污染宿主。
 * 颜色走 CSS 变量，两套主题只换变量。
 */

const NIGHTWRITE_CSS = `
.nw-shell{
  --nw-bg:#14161a; --nw-bg-1:#191c21; --nw-bg-2:#1f232a; --nw-bg-3:#262b33;
  --nw-line:#2c323b; --nw-line-2:#3a424e;
  --nw-fg:#e8e9ec; --nw-fg-2:#b6bcc6; --nw-fg-3:#7f8792;
  --nw-amber:#d9a054; --nw-amber-soft:rgba(217,160,84,.14);
  --nw-teal:#4aa8a0; --nw-teal-soft:rgba(74,168,160,.14);
  --nw-red:#e05a54; --nw-red-soft:rgba(224,90,84,.14);
  --nw-green:#4aa07a; --nw-green-soft:rgba(74,160,122,.14);
  --nw-blue:#5b8fd6; --nw-blue-soft:rgba(91,143,214,.14);
  --nw-radius:10px;
  display:flex; flex-direction:column; height:100%; min-height:0;
  background:var(--nw-bg); color:var(--nw-fg);
  font-size:13px; line-height:1.6;
  font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
}
.nw-shell.nw-theme-light{
  --nw-bg:#f6f4f0; --nw-bg-1:#fffdfa; --nw-bg-2:#f1eee8; --nw-bg-3:#e7e2d9;
  --nw-line:#ddd7cc; --nw-line-2:#c9c1b3;
  --nw-fg:#23201c; --nw-fg-2:#5a544b; --nw-fg-3:#8b8579;
  --nw-amber:#b57d2e; --nw-amber-soft:rgba(181,125,46,.12);
  --nw-teal:#2f827a; --nw-green:#2f7a58; --nw-red:#c0453f; --nw-blue:#3f6fae;
}
/* ── 第三档主题「纸」：米黄底 + 宋体，长文阅读久盯不刺眼 ── */
.nw-shell.nw-theme-paper{
  --nw-bg:#f0e8d8; --nw-bg-1:#faf5e9; --nw-bg-2:#efe6d3; --nw-bg-3:#e4d8c0;
  --nw-line:#d6c8ac; --nw-line-2:#c2b192;
  --nw-fg:#3a3025; --nw-fg-2:#6b5d4a; --nw-fg-3:#9a8b73;
  --nw-amber:#a9702a; --nw-amber-soft:rgba(169,112,42,.13);
  --nw-teal:#2c6f68; --nw-green:#3d7550; --nw-red:#b04a3f; --nw-blue:#3c6a9c;
  font-family:Georgia,"Songti SC","STSong","SimSun",serif;
}
.nw-shell.nw-theme-paper .nw-textarea,
.nw-shell.nw-theme-paper .nw-para{font-family:Georgia,"Songti SC","STSong","SimSun",serif;font-size:14.5px;line-height:2.05}
.nw-shell *{box-sizing:border-box}
.nw-shell button{font:inherit;color:inherit;cursor:pointer;background:none;border:0}
.nw-shell h2{font-size:19px;margin:0;font-weight:650}
.nw-shell h3{font-size:13px;margin:0;font-weight:600}
.nw-shell p{margin:0}
.nw-shell pre{margin:0;font-family:ui-monospace,Consolas,monospace}

/* ── 顶栏 ── */
.nw-top{display:flex;align-items:center;gap:14px;padding:9px 16px;border-bottom:1px solid var(--nw-line);background:var(--nw-bg-1);flex:none}
.nw-brand{display:flex;align-items:center;gap:8px;flex:none}
.nw-brand-mark{font-size:16px}
.nw-brand-name{font-weight:650;letter-spacing:.04em}
.nw-brand-page{color:var(--nw-fg-3);font-size:12px;padding-left:8px;border-left:1px solid var(--nw-line)}
.nw-top-mid{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.nw-top-mid .nw-input{min-width:180px;max-width:260px}
.nw-top-stat{color:var(--nw-fg-3);font-size:12px;border:1px solid var(--nw-line);border-radius:999px;padding:1px 9px;white-space:nowrap}
.nw-top-cost{color:var(--nw-amber);border-color:var(--nw-amber-soft);background:var(--nw-amber-soft)}
.nw-top-right{display:flex;align-items:center;gap:8px;flex:none}
.nw-top-hint{color:var(--nw-fg-3);font-size:11.5px;white-space:nowrap;padding-right:2px}
.nw-top-hint-on{color:var(--nw-teal)}

/* ── 主体 ── */
/* 【P1】主体改成「左竖栏 + 内容区」。以前是一条底栏横排十颗钉子，
   天天要开的「正文」和一年动两次的「设置」占一样宽。 */
.nw-body{flex:1;min-height:0;overflow:auto;padding:14px 16px 8px}
.nw-page{display:flex;flex-direction:column;gap:14px;min-height:0;max-width:1360px;margin:0 auto}
.nw-cockpit{max-width:1360px}
.nw-review{max-width:1360px}

/* ── 底栏：居中的胶囊导航 ── */
.nw-bottom{display:flex;align-items:center;justify-content:center;padding:8px 16px;border-top:1px solid var(--nw-line);background:var(--nw-bg-1);flex:none}
.nw-dock{display:flex;gap:2px;flex:none;background:var(--nw-bg-2);border:1px solid var(--nw-line);border-radius:999px;padding:3px}
.nw-dock-btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 12px;border-radius:999px;color:var(--nw-fg-3);font-size:11px}
.nw-dock-btn:hover{color:var(--nw-fg-2)}
.nw-dock-btn.on{background:var(--nw-amber-soft);color:var(--nw-amber)}
.nw-dock-icon{font-size:13px;line-height:1.2}
.nw-dock-label{line-height:1.3}
.nw-dock-badge{position:absolute;top:1px;right:3px;background:var(--nw-red);color:#fff;font-size:9px;line-height:1.35;border-radius:999px;padding:0 4px}
.nw-bottom-pad{flex:1 1 0;min-width:120px}
.nw-bottom-acts{flex:1 1 0;display:flex;justify-content:flex-end;gap:6px;min-width:120px}
.nw-bottom-btn{white-space:nowrap}

.nw-principle{display:flex;align-items:center;gap:8px;width:100%;padding:6px 16px;border:0;border-bottom:1px solid var(--nw-line);background:linear-gradient(90deg,var(--nw-amber-weak),transparent 60%);color:var(--nw-fg-2);font:inherit;font-size:11.5px;text-align:left;cursor:pointer;flex:none}
.nw-principle:hover{color:var(--nw-fg)}
.nw-principle-mark{flex:none;color:var(--nw-amber)}
.nw-principle-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-principle-tog{flex:none;color:var(--nw-fg-3);font-size:10.5px}
/* 分场景的写作原则：一行一个场景，左边场景名右边删除。
   做成竖排而不是表格 —— 一条原则就是一整句，挤进表格列里会换行成三行。 */
.nw-princ{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.nw-princ-row{border:1px solid var(--nw-line);border-radius:8px;padding:8px;background:var(--nw-bg-1)}
.nw-princ-head{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.nw-princ-head .nw-input{flex:1;min-width:0}
.nw-princ-x{
  flex:none;width:24px;height:24px;line-height:1;border:1px solid var(--nw-line);
  border-radius:6px;background:transparent;color:var(--nw-fg-3);
  font:inherit;font-size:14px;cursor:pointer;
}
.nw-princ-x:hover{border-color:var(--nw-red);color:var(--nw-red)}


/* ── 通用控件 ── */
.nw-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:8px;border:1px solid var(--nw-line-2);color:var(--nw-fg);background:var(--nw-bg-2);transition:.12s}
.nw-btn:hover{border-color:var(--nw-amber);color:var(--nw-amber)}
.nw-btn-sm{padding:3px 9px;font-size:12px;border-radius:7px}
.nw-btn-primary{background:var(--nw-amber);border-color:var(--nw-amber);color:#1a1408;font-weight:600}
.nw-btn-primary:hover{filter:brightness(1.08);color:#1a1408}
.nw-btn-ghost{background:transparent}
.nw-btn-danger{border-color:var(--nw-red-soft);color:var(--nw-red);background:transparent}
.nw-btn-danger:hover{background:var(--nw-red-soft);border-color:var(--nw-red);color:var(--nw-red)}
.nw-btn:disabled{opacity:.45;cursor:not-allowed}
.nw-tag{display:inline-flex;align-items:center;padding:1px 7px;border-radius:999px;font-size:11px;white-space:nowrap}
.nw-tag-amber{background:var(--nw-amber-soft);color:var(--nw-amber)}
.nw-tag-teal{background:var(--nw-teal-soft);color:var(--nw-teal)}
.nw-tag-red{background:var(--nw-red-soft);color:var(--nw-red)}
.nw-tag-green{background:var(--nw-green-soft);color:var(--nw-green)}
.nw-tag-blue{background:var(--nw-blue-soft);color:var(--nw-blue)}
.nw-tag-grey{background:var(--nw-bg-3);color:var(--nw-fg-3)}
.nw-input{width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--nw-line-2);background:var(--nw-bg);color:var(--nw-fg);font:inherit;outline:none}
.nw-input:focus{border-color:var(--nw-amber)}
.nw-textarea{resize:vertical;line-height:1.75}
.nw-field{display:flex;flex-direction:column;gap:4px}
.nw-field > label{font-size:11px;color:var(--nw-fg-3);letter-spacing:.03em}
.nw-hint{color:var(--nw-fg-3);font-size:12px}
.nw-warn{color:var(--nw-red);font-size:12px}
.nw-mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px}
.nw-empty{color:var(--nw-fg-3);font-size:12px;padding:16px;text-align:center;border:1px dashed var(--nw-line);border-radius:var(--nw-radius)}
.nw-loading{display:flex;align-items:center;gap:8px;color:var(--nw-fg-3);font-size:12px;padding:20px}
.nw-spin{width:12px;height:12px;border:2px solid var(--nw-line-2);border-top-color:var(--nw-amber);border-radius:50%;animation:nw-spin .7s linear infinite}
@keyframes nw-spin{to{transform:rotate(360deg)}}
.nw-error{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--nw-red-soft);color:var(--nw-red);font-size:12px}
.nw-bar{display:block;height:5px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-bar > i{display:block;height:100%;border-radius:999px;background:var(--nw-amber)}
.nw-bar-red > i{background:var(--nw-red)}
.nw-bar-green > i{background:var(--nw-green)}
.nw-switch{width:34px;height:18px;border-radius:999px;background:var(--nw-bg-3);border:1px solid var(--nw-line-2);position:relative;transition:.15s}
.nw-switch.on{background:var(--nw-amber);border-color:var(--nw-amber)}
.nw-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--nw-fg);transition:.15s}
.nw-switch.on::after{left:18px;background:#1a1408}
.nw-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nw-seg{display:flex;gap:2px;background:var(--nw-bg-2);border:1px solid var(--nw-line);border-radius:8px;padding:3px}
.nw-seg-btn{display:flex;align-items:center;gap:5px;padding:3px 11px;border-radius:6px;font-size:12px;color:var(--nw-fg-3)}
.nw-seg-btn.on{background:var(--nw-bg-1);color:var(--nw-amber);box-shadow:0 1px 2px rgba(0,0,0,.3)}
.nw-seg-n{font-size:10px;opacity:.7}
.nw-link{color:var(--nw-blue);font-size:12px;padding:0 4px}
.nw-link-danger{color:var(--nw-red)}
.nw-icon-btn{width:24px;height:24px;border-radius:6px;color:var(--nw-fg-3)}
.nw-icon-btn:hover{background:var(--nw-bg-3);color:var(--nw-fg)}

/* ── 卡片 ── */
.nw-card{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.nw-card-head{display:flex;align-items:center;gap:10px}
.nw-card-line{flex:1;height:1px;background:var(--nw-line)}
.nw-card-badge{font-size:11px;color:var(--nw-fg-3);border:1px solid var(--nw-line);border-radius:999px;padding:0 7px}
.nw-card-debt{border-color:var(--nw-red-soft)}
.nw-kv-wrap{display:flex;flex-direction:column;gap:5px}
.nw-kv{display:flex;gap:10px;font-size:12px}
.nw-kv-k{color:var(--nw-fg-3);min-width:78px;flex:none}
.nw-kv-v{color:var(--nw-fg-2);word-break:break-all}
.nw-cols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
.nw-col-side{display:flex;flex-direction:column;gap:14px;min-width:0}

/* ── 驾驶舱 ── */
.nw-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:linear-gradient(135deg,var(--nw-bg-2),var(--nw-bg-1))}
.nw-hero-left{display:flex;flex-direction:column;gap:7px;min-width:0}
.nw-hero-tags{display:flex;gap:6px;flex-wrap:wrap}
.nw-hero-right{display:flex;gap:8px;flex:none}
.nw-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.nw-stat{display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:11px 13px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);text-align:left}
.nw-stat:hover{border-color:var(--nw-line-2)}
.nw-stat-label{font-size:11px;color:var(--nw-fg-3)}
.nw-stat-value{font-size:23px;font-weight:650;line-height:1.15}
.nw-stat-value em{font-size:11px;font-style:normal;color:var(--nw-fg-3);margin-left:3px;font-weight:400}
.nw-stat-hint{font-size:11px;color:var(--nw-fg-3)}
.nw-stat-amber .nw-stat-value{color:var(--nw-amber)}
.nw-stat-teal .nw-stat-value{color:var(--nw-teal)}
.nw-stat-red .nw-stat-value{color:var(--nw-red)}
.nw-stat-green .nw-stat-value{color:var(--nw-green)}
.nw-stat-blue .nw-stat-value{color:var(--nw-blue)}
.nw-debt-list{display:flex;flex-direction:column;gap:6px}
.nw-debt{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--nw-line);background:var(--nw-bg-2);text-align:left}
.nw-debt:hover{border-color:var(--nw-amber);background:var(--nw-bg-3)}
.nw-debt-dot{width:7px;height:7px;border-radius:50%;flex:none}
.nw-dot-red{background:var(--nw-red)}
.nw-dot-orange{background:var(--nw-amber)}
.nw-dot-yellow{background:var(--nw-blue)}
.nw-dot-grey{background:var(--nw-fg-3)}
.nw-debt-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.nw-debt-title{font-size:12.5px;font-weight:600}
.nw-debt-sub{font-size:11px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-debt-go{color:var(--nw-fg-3);flex:none}
.nw-suggest{font-size:13px;color:var(--nw-amber);padding:8px 10px;border-radius:8px;background:var(--nw-amber-soft)}
.nw-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11.5px;color:var(--nw-fg-3)}
.nw-recent{display:flex;flex-direction:column;gap:4px}
.nw-recent-row{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;text-align:left}
.nw-recent-row:hover{background:var(--nw-bg-3)}
.nw-recent-n{color:var(--nw-fg-3);font-size:11.5px;min-width:56px;flex:none}
.nw-recent-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.nw-recent-score{font-size:12px;font-weight:600;flex:none}
.nw-score-good{color:var(--nw-green)}
.nw-score-mid{color:var(--nw-amber)}
.nw-score-bad{color:var(--nw-red)}

/* ── 生产台 ── */
.nw-studio-cols{display:grid;grid-template-columns:230px minmax(0,1fr) 270px;gap:12px;align-items:start}
.nw-tpl-panel{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);display:flex;flex-direction:column;overflow:hidden}
.nw-tpl-head{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-bottom:1px solid var(--nw-line);font-size:12px;color:var(--nw-fg-3)}
.nw-tpl-list{display:flex;flex-direction:column;padding:6px;gap:4px;max-height:520px;overflow:auto}
.nw-tpl{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-radius:7px;text-align:left;border:1px solid transparent}
.nw-tpl:hover{background:var(--nw-bg-3);border-color:var(--nw-line-2)}
.nw-tpl-name{font-size:12.5px;font-weight:600}
.nw-tpl-intent{font-size:11px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-tpl-used{font-size:10px;color:var(--nw-fg-3)}
.nw-order{display:flex;flex-direction:column;gap:10px;min-width:0}
.nw-order-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.nw-order-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:4px;border-top:1px solid var(--nw-line)}
.nw-ctx{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg)}
.nw-ctx-over{border-color:var(--nw-red-soft)}
.nw-ctx-head{display:flex;justify-content:space-between;font-size:11.5px;color:var(--nw-fg-3)}
.nw-ctx-total{font-family:ui-monospace,Consolas,monospace}
.nw-ctx-total.nw-over{color:var(--nw-red)}
.nw-ctx-list{display:flex;flex-direction:column;gap:2px}
.nw-ctx-row{display:flex;align-items:center;gap:8px;font-size:11.5px;padding:2px 0}
.nw-ctx-kind{color:var(--nw-amber);min-width:52px;flex:none}
.nw-ctx-label{flex:1;min-width:0;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ctx-token{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-ctx-x{color:var(--nw-fg-3);flex:none;font-size:10px}
.nw-ctx-x:hover{color:var(--nw-red)}
.nw-queue{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);display:flex;flex-direction:column;gap:7px;padding:10px 11px}
.nw-queue-head{display:flex;align-items:center;justify-content:space-between;font-size:12px}
.nw-queue-list{display:flex;flex-direction:column;gap:4px;max-height:430px;overflow:auto}
.nw-q-row{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:7px;border:1px solid var(--nw-line);background:var(--nw-bg-2)}
.nw-q-running{border-color:var(--nw-teal-soft)}
.nw-q-n{font-size:11.5px;color:var(--nw-fg-3)}
.nw-q-intent{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-q-acts{display:flex;gap:4px;margin-top:2px}

/* ── 大纲 ── */
.nw-plan{max-width:1360px}
.nw-plan-brief .nw-input{max-width:none}
.nw-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.nw-plan-field{min-width:0}
.nw-plan-wide{grid-column:1 / -1}
.nw-plan-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px solid var(--nw-line)}
.nw-plan-vols{display:flex;gap:2px;background:var(--nw-bg-2);border:1px solid var(--nw-line);border-radius:8px;padding:3px;flex-wrap:wrap}
.nw-plan-rows{display:flex;flex-direction:column;gap:6px;max-height:520px;overflow:auto}
.nw-plan-row{display:grid;grid-template-columns:66px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2)}
.nw-plan-n{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--nw-fg-3)}
.nw-plan-main{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.5fr) minmax(0,1fr);gap:6px;min-width:0}
.nw-plan-main .nw-input{font-size:11.5px;padding:4px 8px}

/* ── 验收台 ── */
.nw-rv-bar{display:flex;align-items:center;justify-content:space-between;gap:12px}
.nw-rv-list{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:var(--nw-radius);overflow:hidden;background:var(--nw-bg-1)}
.nw-rv-head,.nw-rv-row{display:grid;grid-template-columns:46px minmax(0,1fr) 84px 62px 128px 128px;gap:8px;align-items:center;padding:7px 12px}
.nw-rv-head{background:var(--nw-bg-2);font-size:11px;color:var(--nw-fg-3);border-bottom:1px solid var(--nw-line)}
.nw-rv-row{text-align:left;border-bottom:1px solid var(--nw-line);font-size:12px}
.nw-rv-row:last-child{border-bottom:0}
.nw-rv-row:hover{background:var(--nw-bg-2)}
.nw-rv-row.on{background:var(--nw-amber-soft)}
.nw-rv-n{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-rv-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-rv-words{color:var(--nw-fg-3);font-size:11.5px}
.nw-rv-issues{display:flex;gap:4px;align-items:center}
.nw-score{display:flex;align-items:center;gap:6px}
.nw-score .nw-bar{flex:1;min-width:38px}
.nw-score-n{font-size:12px;font-style:normal;font-weight:600}
.nw-rv-detail{display:flex;flex-direction:column;gap:10px}
/* 【12 条 #11】阅读模式：正文单栏占满，字号提一档、行距放松，眼睛不用来回扫。 */
.nw-rv-detail.nw-rv-read{max-width:820px;margin:0 auto}
.nw-rv-detail.nw-rv-read .nw-paras,.nw-rv-detail.nw-rv-read .nw-textarea{font-size:15.5px;line-height:2.1}
.nw-rv-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.nw-rv-detail-head > div:first-child{display:flex;align-items:baseline;gap:10px}
.nw-rv-body{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;align-items:start}
.nw-rv-doc{display:flex;flex-direction:column;gap:9px}
.nw-rv-doc .nw-textarea{font-family:Georgia,"Songti SC","SimSun",serif;font-size:14px;line-height:2;background:var(--nw-bg-1)}
.nw-rv-acts{display:flex;gap:8px;flex-wrap:wrap}
.nw-rv-side{display:flex;flex-direction:column;gap:10px;min-width:0}
.nw-score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.nw-score-cell{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border-radius:7px;background:var(--nw-bg-2)}
.nw-score-cell em{font-style:normal;font-size:15px;font-weight:650;color:var(--nw-amber)}
.nw-score-cell span{font-size:10px;color:var(--nw-fg-3)}
.nw-score-total{display:flex;align-items:center;gap:10px;font-size:12px}
.nw-score-total .nw-score{flex:1}
.nw-issues{display:flex;flex-direction:column;gap:5px;max-height:280px;overflow:auto}
.nw-issue{display:flex;align-items:flex-start;gap:7px;padding:6px 8px;border-radius:7px;background:var(--nw-bg-2);font-size:11.5px}
.nw-issue-violation{background:var(--nw-red-soft)}
.nw-issue-n{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-issue-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.nw-issue-text{color:var(--nw-fg-2)}
.nw-issue-quote{color:var(--nw-fg-3);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-issue-sev{color:var(--nw-fg-3);font-size:10px;flex:none}
.nw-audit{font-size:11px;color:var(--nw-fg-2);white-space:pre-wrap;background:var(--nw-bg-2);padding:8px;border-radius:7px;max-height:200px;overflow:auto}

/* ── 验收台的两个抽屉：提案 / 问题单 ── */
.nw-board{display:flex;flex-direction:column;gap:10px}
.nw-prop-list,.nw-prob-list{display:flex;flex-direction:column;gap:8px}
.nw-prop{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:9px 11px;display:flex;flex-direction:column;gap:6px}
.nw-prop-accepted{border-color:var(--nw-green-soft)}
.nw-prop-rejected{opacity:.72}
.nw-prop-head{display:flex;align-items:center;gap:8px;width:100%;text-align:left}
.nw-prop-n{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--nw-fg-3);flex:none}
.nw-prop-title{font-size:12.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-prop-go{color:var(--nw-fg-3);font-size:11px;flex:none}
.nw-prop-body{display:flex;flex-direction:column;gap:7px;padding:6px 0 2px}
.nw-prop-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:5px;border-top:1px solid var(--nw-line)}
.nw-diff{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;align-items:start}
.nw-diff-n{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:var(--nw-fg-3);padding-top:6px}
.nw-diff-cols{display:grid;grid-template-columns:1fr 1fr;gap:7px;min-width:0}
.nw-diff-cell{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:7px;font-size:11.5px;line-height:1.7;min-width:0}
.nw-diff-before{background:var(--nw-red-soft)}
.nw-diff-after{background:var(--nw-green-soft)}
.nw-diff-tag{font-size:10px;color:var(--nw-fg-3)}
.nw-diff-why{grid-column:2;color:var(--nw-fg-3);font-size:10.5px}

.nw-prob{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-1);padding:7px 10px}
.nw-prob-fixed{opacity:.66}
.nw-prob-ignored{opacity:.5}
.nw-prob-main{display:flex;align-items:center;gap:7px;text-align:left;min-width:0}
.nw-prob-n{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--nw-fg-3);flex:none}
.nw-prob-text{font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-prob-quote{grid-column:1;font-size:10.5px;color:var(--nw-fg-3);padding-left:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-prob-acts{display:flex;gap:5px;flex:none}

/* ── 世界库 ── */
.nw-ws-banner{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;border:1px solid var(--nw-amber-soft);border-radius:var(--nw-radius);background:var(--nw-amber-soft)}
.nw-ws-label{color:var(--nw-amber);font-size:11.5px;flex:none;font-weight:600}
.nw-ws-text{flex:1;min-width:0;font-size:12px;color:var(--nw-fg-2);line-height:1.65}
.nw-world-body{display:grid;grid-template-columns:186px minmax(0,1fr);gap:12px;align-items:start}
.nw-world-nav{display:flex;flex-direction:column;gap:2px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:6px}
.nw-world-nav-btn{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;font-size:12.5px;color:var(--nw-fg-2);text-align:left}
.nw-world-nav-btn:hover{background:var(--nw-bg-3)}
.nw-world-nav-btn.on{background:var(--nw-amber-soft);color:var(--nw-amber);font-weight:600}
.nw-world-nav-icon{font-size:12px;width:16px;flex:none}
.nw-world-nav-n{margin-left:auto;font-size:10.5px;color:var(--nw-fg-3)}
.nw-world-nav-foot{padding:7px 9px;border-top:1px solid var(--nw-line);margin-top:3px;font-size:10.5px;color:var(--nw-fg-3)}
.nw-world-main{display:flex;flex-direction:column;gap:10px;min-width:0}
.nw-world-bar{display:flex;align-items:center;justify-content:space-between;gap:10px}
.nw-table{border:1px solid var(--nw-line);border-radius:var(--nw-radius);overflow:hidden;background:var(--nw-bg-1)}
.nw-table-head,.nw-table-row{display:grid;gap:8px;align-items:center;padding:7px 11px}
.nw-table-head{background:var(--nw-bg-2);font-size:11px;color:var(--nw-fg-3);border-bottom:1px solid var(--nw-line)}
.nw-table-row{border-bottom:1px solid var(--nw-line);font-size:12px}
.nw-table-row:last-child{border-bottom:0}
.nw-table-row:hover{background:var(--nw-bg-2)}
.nw-td{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-td-strong{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-td-acts{display:flex;gap:4px}
.nw-graph{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:8px}
.nw-graph-svg{width:100%;height:auto;display:block}
.nw-graph-text{fill:var(--nw-fg);font-size:12px;font-weight:600}
.nw-graph-sub{fill:var(--nw-fg-3);font-size:10px}
.nw-timeline{position:relative;display:flex;flex-direction:column;gap:2px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:10px 12px}
.nw-tl-rail{position:absolute;left:25px;top:16px;bottom:16px;width:1px;background:var(--nw-line-2)}
.nw-tl-row{display:grid;grid-template-columns:12px 72px minmax(0,1fr) 110px;gap:9px;align-items:center;padding:5px 0;position:relative}
.nw-tl-dot{width:7px;height:7px;border-radius:50%;background:var(--nw-amber);justify-self:center;z-index:1}
.nw-tl-n{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-tl-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nw-tl-title{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-tl-sub{font-size:10.5px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-tl-bar{height:4px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-tl-bar > i{display:block;height:100%;background:var(--nw-amber-soft)}

/* ── 侦察 ── */
.nw-scout-lead{color:var(--nw-fg-2);font-size:12.5px;padding:10px 12px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1)}
.nw-scout-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.nw-scout-card{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1)}
.nw-scout-head{display:flex;align-items:center;gap:8px}
.nw-scout-icon{font-size:16px}
.nw-scout-desc{font-size:12px;color:var(--nw-fg-2);line-height:1.65;flex:1}
.nw-scout-meta{display:flex;flex-direction:column;gap:3px}
.nw-cmd{font-size:11.5px;color:var(--nw-fg-2);white-space:pre-wrap;background:var(--nw-bg-2);padding:9px;border-radius:7px;max-height:220px;overflow:auto;line-height:1.7}

/* ── 设置 ── */
.nw-settings{max-width:900px}
.nw-proj-list{display:flex;flex-direction:column;gap:4px}
.nw-proj{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;border:1px solid var(--nw-line);background:var(--nw-bg-2);text-align:left}
.nw-proj.on{border-color:var(--nw-amber);background:var(--nw-amber-soft)}
.nw-proj-name{font-size:12.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-proj-meta{font-size:11px;color:var(--nw-fg-3);flex:none}
.nw-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.nw-danger-zone{border:1px solid var(--nw-red-soft);border-radius:8px;padding:9px 11px}
.nw-danger-zone summary{color:var(--nw-red);font-size:12px;cursor:pointer}
.nw-danger-zone[open] summary{margin-bottom:7px}
.nw-switch-row{display:flex;align-items:center;justify-content:space-between;font-size:12.5px}

/* ── 弹层与通知 ── */
.nw-modal-mask{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.52);padding:24px}
.nw-modal{width:min(560px,96vw);max-height:86vh;display:flex;flex-direction:column;border-radius:12px;border:1px solid var(--nw-line-2);background:var(--nw-bg-1);box-shadow:0 24px 64px rgba(0,0,0,.45)}
.nw-modal-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--nw-line)}
.nw-modal-body{display:flex;flex-direction:column;gap:10px;padding:14px;overflow:auto}
.nw-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:11px 14px;border-top:1px solid var(--nw-line)}
.nw-toast-wrap{position:fixed;right:18px;bottom:66px;z-index:90;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.nw-toast{display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:8px;background:var(--nw-bg-3);border:1px solid var(--nw-line-2);color:var(--nw-fg);font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);animation:nw-toast-in .18s ease-out}
.nw-toast-mark{color:var(--nw-amber)}
@keyframes nw-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.nw-panel-glyph{display:inline-flex;align-items:center;justify-content:center;line-height:1}

/* ══════════════════════════════════════════════════════════
   界面增补（24 条）—— 纯展示层，全部假数据驱动
   ══════════════════════════════════════════════════════════ */

/* ── #1 状态灯 ── */
.nw-lamp{display:flex;align-items:center;gap:7px;padding:5px 10px;border-radius:999px;border:1px solid var(--nw-line);background:var(--nw-bg-2);flex:none;text-align:left}
.nw-lamp:hover{border-color:var(--nw-amber);background:var(--nw-bg-3)}
.nw-lamp-dot{width:8px;height:8px;border-radius:50%;background:var(--nw-fg-3);flex:none}
.nw-lamp.on .nw-lamp-dot{background:var(--nw-green);box-shadow:0 0 0 0 rgba(74,160,122,.7);animation:nw-pulse 1.6s infinite}
@keyframes nw-pulse{0%{box-shadow:0 0 0 0 rgba(74,160,122,.55)}70%{box-shadow:0 0 0 7px rgba(74,160,122,0)}100%{box-shadow:0 0 0 0 rgba(74,160,122,0)}}
.nw-lamp-body{display:flex;flex-direction:column;gap:0;line-height:1.25}
.nw-lamp-text{font-size:11.5px;color:var(--nw-fg)}
.nw-lamp-sub{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-cmdk-open{flex:none}


/* ── #3 命令面板 ── */
.nw-cmdk-list{display:flex;flex-direction:column;gap:2px;margin-top:8px;max-height:320px;overflow:auto}
.nw-cmdk-row{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(0,1.2fr) 18px;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;border:1px solid transparent;text-align:left}
.nw-cmdk-row:hover,.nw-cmdk-row.on{background:var(--nw-bg-2);border-color:var(--nw-line-2)}
.nw-cmdk-icon{font-size:14px;text-align:center}
.nw-cmdk-label{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-cmdk-hint{font-size:11px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-cmdk-go{font-size:11px;color:var(--nw-fg-3);text-align:right}
.nw-cmdk-row.on .nw-cmdk-go{color:var(--nw-amber)}

/* ── #4 行动卡 / 今日一句 ── */
.nw-action{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:9px;padding:12px 14px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:linear-gradient(135deg,var(--nw-teal-soft),var(--nw-bg-1))}
.nw-action.nw-action-warn{background:linear-gradient(135deg,var(--nw-amber-soft),var(--nw-bg-1));border-color:var(--nw-amber)}
.nw-action-main{display:flex;flex-direction:column;gap:2px;font-size:13.5px;color:var(--nw-fg);line-height:1.7;min-width:0}
.nw-action-title{font-weight:600;margin:0;font-size:14px}
.nw-action-sub{font-size:12px;color:var(--nw-fg-2);line-height:1.6}
.nw-action-cap{font-size:11px;color:var(--nw-fg-3)}

/* ── #5 两周柱状图 ── */
.nw-days{display:flex;flex-direction:column;gap:6px;padding:2px 0 4px}
.nw-days-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--nw-fg-2)}
.nw-days-bars{display:flex;align-items:flex-end;gap:3px;height:56px;padding:0 1px;border-bottom:1px solid var(--nw-line)}
.nw-day{flex:1 1 0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;height:100%;padding:0;min-width:0}
.nw-day-fill{display:block;width:100%;border-radius:2px 2px 0 0;background:var(--nw-amber-soft);border:1px solid var(--nw-line-2);border-bottom:0;transition:.12s}
.nw-day-ok .nw-day-fill{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-day-off .nw-day-fill{background:repeating-linear-gradient(45deg,var(--nw-bg-3),var(--nw-bg-3) 3px,transparent 3px,transparent 6px);border-color:var(--nw-line)}
.nw-day:hover .nw-day-fill{filter:brightness(1.25)}
.nw-day-label{font-size:9px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-days-rule{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #6 全书进度条 ── */
.nw-progress{display:flex;flex-direction:column;gap:7px;padding:10px 12px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1)}
.nw-progress-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.nw-progress-num{font-size:13px;font-weight:600;font-family:ui-monospace,Consolas,monospace;color:var(--nw-fg)}
.nw-progress-meta{font-size:11px;color:var(--nw-fg-3)}
.nw-progress-track{display:flex;gap:1px;height:16px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-progress-vol{position:relative;display:flex;align-items:center;justify-content:center;min-width:0;padding:0;background:transparent;border:0}
.nw-progress-fill{position:absolute;inset:0 auto 0 0;background:var(--nw-amber-soft);border-right:1px solid var(--nw-amber);transition:.15s}
.nw-progress-vol:hover .nw-progress-fill{background:var(--nw-amber-soft);filter:brightness(1.3)}
.nw-progress-sep{position:absolute;left:0;top:0;bottom:0;width:1px;background:var(--nw-line-2);z-index:1}
.nw-progress-name{position:relative;z-index:2;font-size:9.5px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}
.nw-progress-foot{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #7/#8 大纲卡片墙 / 三视图 ── */
.nw-plan-viewbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.nw-plan-brief{font-size:11.5px;color:var(--nw-fg-3)}
.nw-pcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.nw-pcard{display:flex;flex-direction:column;gap:6px;padding:10px 11px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);text-align:left;min-height:132px}
.nw-pcard:hover{border-color:var(--nw-amber);background:var(--nw-bg-2)}
.nw-pcard.is-empty,.nw-pcard.nw-pcard-empty{border-style:dashed;background:transparent}
.nw-pcard.nw-pcard-done{border-color:var(--nw-green)}
.nw-pcard.nw-pcard-done .nw-pcard-n{color:var(--nw-green)}
.nw-pcard-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.nw-pcard-n{font-size:11px;color:var(--nw-amber);font-family:ui-monospace,Consolas,monospace}
.nw-pcard-title{font-size:13px;font-weight:600;color:var(--nw-fg);line-height:1.45}
.nw-pcard-sum{font-size:11.5px;color:var(--nw-fg-2);line-height:1.6;flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nw-pcard-hook{display:flex;gap:5px;align-items:baseline;font-size:11px;color:var(--nw-teal)}
.nw-pcard-hook-k{color:var(--nw-fg-3);flex:none}
.nw-pcard-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--nw-fg-3)}
.nw-pcard-ph{font-size:11px;color:var(--nw-fg-3);font-style:italic}
/* 时间线视图 */
.nw-ptl{display:flex;flex-direction:column;gap:0;padding-left:8px}
.nw-ptl-vol{display:flex;flex-direction:column;gap:5px;padding:8px 0 8px 14px;border-left:2px solid var(--nw-line-2);position:relative}
.nw-ptl-vol:hover{border-left-color:var(--nw-amber)}
.nw-ptl-head{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--nw-fg);font-weight:600}
.nw-ptl-rail{display:flex;flex-wrap:wrap;gap:3px;align-items:center}
.nw-ptl-dot{width:14px;height:14px;border-radius:4px;border:1px solid var(--nw-line-2);background:var(--nw-bg-3);padding:0;font-size:0}
.nw-ptl-dot:hover{transform:scale(1.25);border-color:var(--nw-amber)}
.nw-ptl-dot.nw-ptl-drafted{background:var(--nw-amber-soft);border-color:var(--nw-amber)}
.nw-ptl-dot.nw-ptl-written{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-ptl-dot.done{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-ptl-dot.cur{background:var(--nw-amber-soft);border-color:var(--nw-amber);box-shadow:0 0 0 2px var(--nw-amber-soft)}

/* ── #9 AI 填整卷摘要 ── */
.nw-fillbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 11px;border:1px dashed var(--nw-line-2);border-radius:9px;background:var(--nw-bg-2)}
.nw-fillbar-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.nw-fillbar-title{font-size:12px;color:var(--nw-fg)}
.nw-fillbar-sub{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #10 上下文可拖可关 / #11 预算条 ── */
.nw-ctx-grip{cursor:grab;color:var(--nw-fg-3);font-size:11px;padding:0 2px;user-select:none}
.nw-ctx-grip:active{cursor:grabbing}
.nw-ctx-row.dragging{opacity:.45;border-style:dashed}
.nw-ctx-row.drop-target{border-color:var(--nw-amber);box-shadow:0 0 0 2px var(--nw-amber-soft)}
.nw-ctx-row.off,.nw-ctx-row.nw-ctx-off{opacity:.42;text-decoration:line-through}
.nw-ctx-sw{width:26px;height:14px;border-radius:999px;background:var(--nw-bg-3);border:1px solid var(--nw-line-2);position:relative;flex:none;transition:.12s}
.nw-ctx-sw::after{content:'';position:absolute;top:1px;left:1px;width:10px;height:10px;border-radius:50%;background:var(--nw-fg-3);transition:.12s}
.nw-ctx-sw.on{background:var(--nw-teal-soft);border-color:var(--nw-teal)}
.nw-ctx-sw.on::after{left:13px;background:var(--nw-teal)}
.nw-ctx-meter{display:flex;flex-direction:column;gap:3px;padding-top:6px;border-top:1px solid var(--nw-line)}
.nw-ctx-foot{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--nw-fg-3)}
/* 预算三档色（复用 .nw-bar 容器） */
.nw-budget{display:flex;flex-direction:column;gap:5px}
.nw-budget .nw-bar > i.ok{background:var(--nw-green)}
.nw-budget .nw-bar > i.warn{background:var(--nw-amber)}
.nw-budget .nw-bar > i.bad{background:var(--nw-red)}

/* ── #12 意图复用 ── */
.nw-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 0 0}
.nw-chips-label{font-size:10.5px;color:var(--nw-fg-3);flex:none}
.nw-chip{max-width:220px;padding:3px 9px;border-radius:999px;border:1px solid var(--nw-line-2);background:var(--nw-bg-2);font-size:11px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:.12s}
.nw-chip:hover{border-color:var(--nw-amber);color:var(--nw-amber);background:var(--nw-amber-soft)}

/* ── #13 正文右侧彩带 ── */
.nw-rv-docbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.nw-rv-pick{font-size:11px;color:var(--nw-amber);padding:2px 8px;border-radius:999px;background:var(--nw-amber-soft);border:1px solid var(--nw-amber);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-heat{display:flex;align-items:flex-end;gap:6px;padding:6px 8px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2)}
.nw-heat-title{font-size:10px;color:var(--nw-fg-3);flex:none;writing-mode:horizontal-tb}
.nw-heat-track{display:flex;flex:1 1 auto;gap:2px;height:22px;min-width:0}
.nw-heat-cell{flex:1 1 0;min-width:3px;border-radius:2px;border:1px solid var(--nw-line-2);background:var(--nw-bg-3);transition:.1s}
.nw-heat-good{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-heat-warn{background:var(--nw-amber-soft);border-color:var(--nw-amber)}
.nw-heat-bad{background:var(--nw-red-soft);border-color:var(--nw-red)}
.nw-heat-cell:hover{filter:brightness(1.4)}
.nw-heat-cell.on{outline:2px solid var(--nw-fg);outline-offset:1px}
.nw-heat-legend{display:flex;gap:6px;align-items:center;flex:none}
.nw-heat-key{font-size:9.5px;color:var(--nw-fg-3);padding:1px 5px;border-radius:999px;border:1px solid transparent}
.nw-heat-key.nw-heat-good{border-color:var(--nw-green);color:var(--nw-green)}
.nw-heat-key.nw-heat-warn{border-color:var(--nw-amber);color:var(--nw-amber)}
.nw-heat-key.nw-heat-bad{border-color:var(--nw-red);color:var(--nw-red)}

/* ── #14 段落视图 + 点亮 ── */
.nw-para-list{display:flex;flex-direction:column;gap:2px;padding:2px 2px 6px;max-height:52vh;overflow:auto}
.nw-para-empty{margin:0;padding:22px 10px;color:var(--nw-fg-3);font-size:13px;text-align:center}
.nw-para{position:relative;padding:6px 10px 6px 30px;border-radius:7px;border-left:2px solid transparent;font-size:14px;line-height:2;color:var(--nw-fg);cursor:pointer;background:none;border-top:0;border-right:0;border-bottom:0;width:100%;text-align:left;font-family:inherit}
.nw-para:hover{background:var(--nw-bg-2)}
.nw-para:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-para-n{position:absolute;left:8px;top:8px;font-size:9.5px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-para-on{border-left-color:var(--nw-amber);background:var(--nw-amber-soft)}
.nw-para-bad{border-left-color:var(--nw-red-soft)}
.nw-para-warn{border-left-color:var(--nw-amber-soft)}
.nw-para-on.nw-para-bad{border-left-color:var(--nw-red);box-shadow:inset 0 0 0 1px var(--nw-red-soft)}
.nw-para-on.nw-para-warn{border-left-color:var(--nw-amber)}
.nw-issue.active,.nw-issue.nw-issue-on{background:var(--nw-amber-soft);box-shadow:inset 0 0 0 1px var(--nw-amber)}
.nw-keys{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;padding:0 6px;border:1px solid var(--nw-line);border-radius:5px}

/* ── #16 提案按章折叠 / 批量 ── */
.nw-prop-group{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.nw-prop-group-head{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:7px;background:var(--nw-bg-2);border:1px solid var(--nw-line);text-align:left;width:100%}
.nw-prop-group-head:hover{border-color:var(--nw-line-2)}
.nw-prop-fold{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px dashed var(--nw-line-2);background:var(--nw-bg-2);text-align:left;width:100%;margin-bottom:6px}
.nw-prop-fold:hover{border-color:var(--nw-amber);background:var(--nw-bg-3)}
.nw-prop-fold-n{font-size:11.5px;color:var(--nw-amber);font-family:ui-monospace,Consolas,monospace;flex:none}

/* ── #18 账本格可点 ── */
.nw-td-cell{display:flex;align-items:center;gap:4px;min-width:0;text-align:left;padding:0;color:var(--nw-fg-2)}
.nw-td-cell:hover .nw-td-value{color:var(--nw-amber);text-decoration:underline dotted}
.nw-td-cell:hover .nw-td-pin{opacity:1}
.nw-td-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.nw-td-pin{flex:none;font-size:9px;color:var(--nw-amber);opacity:0;transition:.1s}
.nw-td-strong{font-weight:600;color:var(--nw-fg)}
.nw-source{display:flex;flex-direction:column;gap:9px}
.nw-source-quote{font-size:13px;line-height:1.9;color:var(--nw-fg);padding:9px 11px;border-left:2px solid var(--nw-amber);background:var(--nw-bg-2);border-radius:0 7px 7px 0}

/* ── #19 关系图过滤 ── */
.nw-graph-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:6px}
.nw-tl-ok{font-size:11.5px;color:var(--nw-green);padding:4px 9px;border-radius:7px;background:var(--nw-green-soft);border:1px solid var(--nw-green);display:inline-block}

/* ── #20 逾期伏笔 ── */
.nw-tl-overdue{display:flex;flex-direction:column;gap:4px;padding:8px 10px;margin-bottom:10px;border:1px solid var(--nw-red);border-radius:9px;background:var(--nw-red-soft)}
.nw-tl-overdue-title{font-size:11.5px;color:var(--nw-red);font-weight:600}
.nw-tl-overdue-row{display:flex;flex-direction:column;gap:1px;padding:4px 7px;border-radius:6px;border:1px solid transparent;text-align:left;background:transparent}
.nw-tl-overdue-row:hover{border-color:var(--nw-red);background:var(--nw-bg-1)}
.nw-tl-overdue-name{font-size:12px;color:var(--nw-fg)}
.nw-tl-overdue-sub{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #21 最近干过什么 ── */
.nw-hist{display:flex;flex-direction:column;gap:3px}
.nw-hist-row{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg-2);overflow:hidden}
.nw-hist-row.on{border-color:var(--nw-amber)}
.nw-hist-main{display:grid;grid-template-columns:20px minmax(0,1fr) auto auto 14px;align-items:center;gap:9px;padding:8px 10px;text-align:left}
.nw-hist-main:hover{background:var(--nw-bg-3)}
.nw-hist-icon{font-size:13px;text-align:center}
.nw-hist-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nw-hist-title{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-hist-sub{font-size:10.5px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-hist-at{font-size:10.5px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-hist-detail{display:flex;flex-direction:column;gap:7px;padding:9px 11px;border-top:1px solid var(--nw-line);font-size:12px;color:var(--nw-fg-2);background:var(--nw-bg-1)}

/* ── #22 扫榜表格 ── */
.nw-scan{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:9px;overflow:hidden;background:var(--nw-bg-1)}
.nw-scan-head,.nw-scan-row{display:grid;grid-template-columns:36px 62px minmax(0,1.4fr) 62px 76px minmax(0,1.6fr) 54px;align-items:center;gap:8px;padding:6px 10px}
.nw-scan-head{background:var(--nw-bg-2);border-bottom:1px solid var(--nw-line);position:sticky;top:0;z-index:1}
.nw-scan-th{text-align:left;font-size:10.5px;color:var(--nw-fg-3);padding:2px 0}
.nw-scan-th.on{color:var(--nw-amber)}
.nw-scan-th:hover{color:var(--nw-fg)}
.nw-scan-row{text-align:left;border-bottom:1px solid var(--nw-line);background:transparent}
.nw-scan-row:last-child{border-bottom:0}
.nw-scan-row:hover{background:var(--nw-bg-2)}
.nw-scan-td{font-size:11.5px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-scan-rank{font-family:ui-monospace,Consolas,monospace;color:var(--nw-fg-3)}
.nw-scan-book{color:var(--nw-fg);font-weight:600}
.nw-scan-num{font-family:ui-monospace,Consolas,monospace;text-align:right}
.nw-scan-hook{color:var(--nw-fg-3);font-size:11px}
.nw-scan-trend{text-align:right;font-family:ui-monospace,Consolas,monospace}
.nw-scan-trend.up{color:var(--nw-green)}
.nw-scan-trend.down{color:var(--nw-red)}

/* ── #23 导出 ── */
.nw-export-tree{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2);font-family:ui-monospace,Consolas,monospace}
.nw-export-row{display:grid;grid-template-columns:20px minmax(0,150px) minmax(0,1fr);align-items:center;gap:9px}
.nw-export-icon{font-size:11px;color:var(--nw-fg-3);text-align:center}
.nw-export-text{color:var(--nw-amber)}
.nw-export-name{font-size:11.5px;color:var(--nw-fg)}

/* ── #24 主题三档 ── */
.nw-theme-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.nw-theme-card{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2);text-align:left}
.nw-theme-card.on{border-color:var(--nw-amber);box-shadow:0 0 0 1px var(--nw-amber)}
.nw-theme-swatch{height:22px;border-radius:6px;border:1px solid var(--nw-line-2);display:flex;align-items:center;justify-content:center;font-size:10px;color:#6b5d4a}
.nw-theme-dark .nw-theme-swatch{background:#191c21;border-color:#3a424e}
.nw-theme-light .nw-theme-swatch{background:#fffdfa}
.nw-theme-paper .nw-theme-swatch{background:#f0e8d8;font-family:Georgia,"Songti SC",serif}
.nw-theme-name{font-size:12px;color:var(--nw-fg)}
.nw-theme-hint{font-size:10px;color:var(--nw-fg-3)}

/* ── 【12 条】这轮补的四个小件 ── */

/* #6 月预算泡：本体是 button（点了给明细），里面叠一条 3px 进度。 */
.nw-budget{display:inline-flex;flex-direction:column;gap:4px;align-items:flex-start;cursor:pointer;font:inherit}
.nw-budget:hover{color:var(--nw-fg-1)}
.nw-budget-over{color:var(--nw-red);border-color:var(--nw-red)}
.nw-budget-bar{display:block;width:100%;min-width:64px;height:3px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-budget-fill{display:block;height:100%;border-radius:999px;background:var(--nw-amber)}
.nw-budget-over .nw-budget-fill{background:var(--nw-red)}

/* #10 样例开关：空态也得有东西可点，但必须是你自己按的。 */
.nw-demo-sw{border:1px dashed var(--nw-line);border-radius:999px;background:transparent;color:var(--nw-fg-3);font:inherit;font-size:12px;padding:2px 10px;cursor:pointer}
.nw-demo-sw:hover{color:var(--nw-fg-1);border-color:var(--nw-fg-3)}
.nw-demo-sw.on{border-style:solid;border-color:var(--nw-amber);color:var(--nw-amber)}

/* #8 AI 味词表编辑器。 */
.nw-lex-add{display:grid;grid-template-columns:minmax(120px,1fr) minmax(160px,2fr) auto;gap:8px;align-items:center;margin:10px 0}
.nw-lex-list{display:flex;flex-direction:column;gap:4px;max-height:280px;overflow:auto}
.nw-lex-row{display:grid;grid-template-columns:minmax(80px,140px) 1fr auto auto;gap:8px;align-items:center;padding:5px 8px;border:1px solid var(--nw-line);border-radius:7px;background:var(--nw-bg-2)}
.nw-lex-row.nw-lex-off{opacity:.45}
.nw-lex-word{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:var(--nw-fg-1)}
.nw-lex-row.nw-lex-off .nw-lex-word{text-decoration:line-through}
.nw-lex-acts{display:flex;gap:4px}

/* 保存状态小签：以前跟键盘提示共用 nw-keys，两件事挤一个样式，
   smoke 里数「键盘提示条」会数到两个。拆开，外观保持一致。 */
.nw-save-state{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;padding:0 6px;border:1px solid var(--nw-line);border-radius:5px}
.nw-save-state.nw-dirty{color:var(--nw-amber);border-color:var(--nw-amber-soft);background:var(--nw-amber-soft)}

/* ── 页级容器补齐 ── */
.nw-scout,.nw-studio,.nw-world{display:flex;flex-direction:column;gap:12px;min-width:0}

/* ── 窄屏 ── */
@media (max-width:1000px){
  .nw-cols,.nw-rv-body{grid-template-columns:minmax(0,1fr)}
  .nw-studio-cols{grid-template-columns:minmax(0,1fr)}
  .nw-world-body{grid-template-columns:minmax(0,1fr)}
  .nw-world-nav{flex-direction:row;flex-wrap:wrap}
  .nw-world-nav-foot{display:none}
  .nw-order-grid{grid-template-columns:1fr 1fr}
  .nw-form-grid{grid-template-columns:1fr}
  .nw-plan-grid{grid-template-columns:1fr}
  .nw-plan-main{grid-template-columns:minmax(0,1fr)}
  .nw-plan-row{grid-template-columns:56px minmax(0,1fr)}
  .nw-diff-cols{grid-template-columns:1fr}
  .nw-top-right{flex-wrap:wrap;justify-content:flex-end}
}
/* ── 第 10 轮：搜索命中断、历史版本、回收站、派单话术、采纳前告警 ── */
.nw-cmdk-scope{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--nw-line)}
.nw-cmdk-head{padding:8px 12px 3px;font-size:11px;letter-spacing:.08em;color:var(--nw-fg-3);text-transform:uppercase}
.nw-cmdk-hit .nw-cmdk-label{color:var(--nw-fg)}
.nw-cmdk-hit .nw-cmdk-hint{font-family:var(--nw-mono,ui-monospace,monospace);font-size:11px}

.nw-hist-ver{display:flex;flex-direction:column;gap:6px}
.nw-ver-row{display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:6px;background:var(--nw-bg-2)}
.nw-ver-at{font-family:var(--nw-mono,ui-monospace,monospace);font-size:12px;color:var(--nw-fg-2);min-width:126px}
.nw-ver-w{font-size:11px;color:var(--nw-fg-3);min-width:56px}

.nw-trash-list{display:flex;flex-direction:column;gap:4px}
.nw-trash-row{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:6px;background:var(--nw-bg-2)}
.nw-trash-n{font-size:12px;color:var(--nw-amber);min-width:56px}
.nw-trash-title{flex:1;font-size:12px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-trash-w{font-size:11px;color:var(--nw-fg-3);min-width:52px}
.nw-trash-at{min-width:104px;font-family:var(--nw-mono,ui-monospace,monospace)}

.nw-dispatch{margin-top:10px;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg-2)}
.nw-dispatch-head{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--nw-line);font-size:11px;color:var(--nw-fg-3)}
.nw-dispatch-body{margin:0;padding:10px;font-family:var(--nw-mono,ui-monospace,monospace);font-size:11.5px;line-height:1.7;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word}

.nw-prop-warn{display:flex;flex-wrap:wrap;align-items:flex-start;gap:7px;margin-bottom:9px;padding:8px 10px;border-radius:7px;border:1px solid var(--nw-amber-d, #7a5a18);background:rgba(214,158,46,.1);font-size:12px;color:var(--nw-amber)}
.nw-prop-warn-icon{line-height:1.2}
.nw-prop-warn-list{margin:0;padding-left:18px;width:100%;list-style:disc}
.nw-prop-warn-list li{margin-top:2px;color:var(--nw-fg-2);font-size:11.5px}
.nw-heat-density{font-size:10px;color:var(--nw-fg-3)}


/* ── 【QA】撤销 / 重做 ──
   紧跟在「段落视图 / 编辑正文」两个分段按钮后面，不换行。 */
.nw-rv-undo{display:inline-flex;align-items:center;gap:5px;margin-left:2px}
.nw-undo-btn,.nw-redo-btn{font-variant-numeric:tabular-nums}
.nw-undo-btn[disabled],.nw-redo-btn[disabled]{opacity:.4}
.nw-undo-n{font-size:10.5px;color:var(--nw-fg-3);font-family:var(--nw-mono,ui-monospace,monospace);min-width:52px}

/* ── 【QA】弹窗无障碍 ──
   焦点搬进浮层后必须看得见落在哪个格子，否则键盘用户彻底迷路。
   只给 :focus-visible 描边，鼠标点击不会留一圈亮边。 */
.nw-modal:focus{outline:none}
.nw-modal:focus-visible{outline:2px solid var(--nw-amber);outline-offset:2px}
.nw-modal-mask .nw-modal button:focus-visible,
.nw-modal-mask .nw-modal input:focus-visible,
.nw-modal-mask .nw-modal textarea:focus-visible,
.nw-modal-mask .nw-modal select:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}

/* ── 【QA】预算拦截 ──
   掉在顶栏月预算泡旁边的一条小标，和它同一个色系。 */
.nw-budget-stop{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:5px;font-size:10.5px;border:1px solid var(--nw-line);color:var(--nw-fg-3)}
.nw-budget-stop.nw-budget-halt{border-color:var(--nw-red-d,#7a2a2a);background:rgba(220,80,80,.12);color:var(--nw-red,#e2685f)}
.nw-btn.nw-btn-halt{border-color:var(--nw-red-d,#7a2a2a);color:var(--nw-red,#e2685f)}

/* ── 更窄一档：平板竖屏 / 分屏 ──
   上一条 1000px 只把两栏叠成一栏，但顶栏、底栏、表格、工具栏那时还是横向铺开，
   768 宽就开始横向溢出。这一档专门收它们。 */
@media (max-width:720px){
  .nw-top{flex-direction:column;align-items:stretch;gap:6px}
  .nw-top-mid,.nw-top-right{flex-wrap:wrap;justify-content:flex-start;gap:6px}
  .nw-top-hint{order:-1;width:100%}
  /* 窄屏：竖栏转成一条可横滑的横排，组名藏起来（省掉一行高度）。 */
  .nw-bottom{padding:6px 8px}
  .nw-bottom-pad{display:none}
  .nw-bottom-acts{display:none}
  .nw-dock{gap:2px;overflow-x:auto;max-width:100%}
  .nw-dock-btn{padding:4px 6px;white-space:nowrap}
  .nw-principle{padding:6px 10px}
  .nw-stat-grid{grid-template-columns:1fr 1fr}
  .nw-actions{grid-template-columns:1fr}
  .nw-rv-docbar{flex-wrap:wrap;gap:5px}
  .nw-rv-acts{flex-wrap:wrap}
  .nw-heat{display:none}
  .nw-ledger-table,.nw-scan{overflow-x:auto}
  .nw-ledger-row,.nw-scan-row{min-width:560px}
  .nw-cmdk{left:8px;right:8px;width:auto;max-height:74vh}
  .nw-modal{left:8px;right:8px;width:auto;max-height:86vh}
  .nw-modal-foot{flex-wrap:wrap}
  .nw-theme-row{grid-template-columns:1fr}
}

/* ── 流水线（派单台） ── */
.nw-pipe{display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:12px;padding:12px;align-items:start;min-height:0}
.nw-pipe-right{display:flex;flex-direction:column;gap:12px;min-width:0}
.nw-pipe-roles{position:sticky;top:0}
.nw-pipe-form{display:flex;flex-direction:column;gap:8px}
.nw-pipe-form-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:2px}
.nw-pipe-prompt{
  margin:8px 0 0;padding:12px;max-height:52vh;overflow:auto;
  background:var(--nw-bg);border:1px solid var(--nw-line);border-radius:8px;
  color:var(--nw-fg-2);font-size:12px;line-height:1.72;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  white-space:pre-wrap;word-break:break-word;
}
.nw-pipe-modal-foot{display:flex;gap:8px;justify-content:flex-end}

.nw-role-grid{display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px}
.nw-role{
  display:grid;grid-template-columns:1fr auto;gap:2px 8px;
  padding:7px 9px;border:1px solid var(--nw-line);border-radius:8px;
  background:var(--nw-bg-1);color:inherit;text-align:left;cursor:pointer;
  transition:border-color .12s,background .12s;
}
.nw-role:hover{border-color:var(--nw-line-2);background:var(--nw-bg-2)}
.nw-role:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-role-boss{border-color:var(--nw-amber);background:var(--nw-amber-soft)}
.nw-role-name{font-weight:600;font-size:12.5px;color:var(--nw-fg)}
.nw-role-id{
  font-size:10.5px;color:var(--nw-fg-3);justify-self:end;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-role-duty{grid-column:1 / -1;font-size:11.5px;color:var(--nw-fg-3);line-height:1.5}
.nw-role-foot{grid-column:1 / -1;display:flex;gap:5px;flex-wrap:wrap;margin-top:2px}
/* 收起态：一排小方块，只留名字和「派单」标记。
   11 个岗位铺成职责卡要半屏，可它一天点不到三次 —— 派单页真正天天动的是指令单和队列。 */
.nw-role-grid-compact{grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:5px}
.nw-role-grid-compact .nw-role{
  display:flex;align-items:center;gap:4px;justify-content:center;
  padding:5px 8px;border-radius:999px;font-size:12px;
}
.nw-role-grid-compact .nw-role-name{font-size:12px;font-weight:600}
.nw-role-on{border-color:var(--nw-amber);background:var(--nw-amber-soft)}
.nw-role-more{
  display:block;width:100%;margin-top:6px;padding:4px;
  border:0;background:transparent;color:var(--nw-fg-3);
  font:inherit;font-size:11px;cursor:pointer;text-align:center;
}
.nw-role-more:hover{color:var(--nw-amber)}

.nw-dp-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.nw-dp{
  border:1px solid var(--nw-line);border-left:3px solid var(--nw-line-2);
  border-radius:8px;padding:8px 10px;background:var(--nw-bg-1);
}
.nw-dp-issued{border-left-color:var(--nw-blue)}
.nw-dp-claimed{border-left-color:var(--nw-amber)}
.nw-dp-submitted{border-left-color:var(--nw-green)}
.nw-dp-expired{border-left-color:var(--nw-red)}
.nw-dp-revoked{opacity:.62;border-left-color:var(--nw-fg-3)}
.nw-dp-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nw-dp-role{font-weight:600;font-size:12.5px}
.nw-dp-id{
  margin-left:auto;font-size:10.5px;color:var(--nw-fg-3);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-dp-task{margin-top:4px;font-size:12.5px;color:var(--nw-fg-2);line-height:1.6;white-space:pre-wrap}
.nw-dp-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:5px;font-size:11px;color:var(--nw-fg-3)}
.nw-dp-left{color:var(--nw-amber)}
.nw-dp-err{color:var(--nw-red)}
.nw-dp-report{
  margin-top:7px;padding:8px 10px;border-radius:7px;
  background:var(--nw-bg-2);border:1px dashed var(--nw-line-2);
}
.nw-dp-report-head{font-size:11px;color:var(--nw-fg-3);letter-spacing:.06em}
.nw-dp-verdict{margin-top:3px;font-size:12.5px;font-weight:600;color:var(--nw-amber)}
.nw-dp-sec{display:flex;gap:8px;margin-top:5px;font-size:12px;line-height:1.6}
.nw-dp-sec-t{flex:0 0 88px;color:var(--nw-fg-3);font-size:11.5px}
.nw-dp-sec-b{flex:1 1 auto;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word}
.nw-dp-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:7px;border-top:1px solid var(--nw-line)}

.nw-rep-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.nw-rep{padding:7px 10px;border-radius:7px;background:var(--nw-bg-1);border:1px solid var(--nw-line)}
.nw-rep-head{display:flex;align-items:center;gap:8px}
.nw-rep-role{font-weight:600;font-size:12px}
.nw-rep-at{margin-left:auto;font-size:10.5px;color:var(--nw-fg-3)}
.nw-rep-verdict{margin-top:3px;font-size:12px;color:var(--nw-fg-2);line-height:1.6}

@media (max-width:900px){
  .nw-pipe{grid-template-columns:1fr}
  .nw-pipe-roles{position:static}
  .nw-role-grid{grid-template-columns:1fr 1fr}
}

/* ── 文风校验（第 1 批） ── */
.nw-lint .nw-lint-sum{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 8px}
.nw-lint-verdict{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid transparent}
.nw-lint-verdict-ok{color:var(--nw-green);background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-lint-verdict-bad{color:var(--nw-red);background:var(--nw-red-soft);border-color:var(--nw-red)}
.nw-lint-seg{margin-left:auto}
.nw-lint-list{display:flex;flex-direction:column;gap:5px;max-height:46vh;overflow:auto}
.nw-lint-hit{
  display:grid;grid-template-columns:22px auto 1fr;gap:3px 7px;align-items:baseline;
  padding:6px 8px;border:1px solid var(--nw-line);border-left-width:3px;border-radius:7px;
  background:var(--nw-bg-1);color:inherit;text-align:left;cursor:pointer;font:inherit;
}
.nw-lint-hit:hover{background:var(--nw-bg-2);border-color:var(--nw-line-2)}
.nw-lint-hit:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-lint-blocking{border-left-color:var(--nw-red)}
.nw-lint-advisory{border-left-color:var(--nw-amber)}
.nw-lint-n{
  font-size:10.5px;color:var(--nw-fg-3);text-align:right;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-lint-quote{
  grid-column:3;font-size:12px;color:var(--nw-fg);line-height:1.55;
  word-break:break-word;
}
.nw-lint-hint{grid-column:3;font-size:11px;color:var(--nw-fg-3);line-height:1.5}
.nw-lint-about{margin-top:8px;font-size:11.5px;color:var(--nw-fg-3)}
.nw-lint-about summary{cursor:pointer;color:var(--nw-fg-2);padding:2px 0}
.nw-lint-about p{margin:4px 0 0;line-height:1.6}
.nw-lint-modal-lead{margin:0 0 8px;font-size:12.5px;color:var(--nw-fg-2);line-height:1.65}
.nw-lint-modal-foot{display:flex;gap:8px;justify-content:flex-end}
.nw-lint-compact .nw-lint-list{max-height:none}
/* 阶段 A：每条命中的「为什么」。命中行下面挂一行可展开的判据。 */
.nw-lint-item{display:flex;flex-direction:column}
.nw-lint-line{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:start}
.nw-lint-why-btn{grid-column:2;justify-self:end;font-size:11px;color:var(--nw-fg-3);cursor:pointer;padding:2px 7px;border-radius:5px;border:1px solid transparent;background:none;font-family:inherit;white-space:nowrap}
.nw-lint-why-btn:hover{color:var(--nw-amber);border-color:var(--nw-line)}
.nw-lint-why-btn.on{color:var(--nw-amber);background:var(--nw-amber-soft);border-color:var(--nw-amber)}
.nw-lint-why-btn:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-lint-why{display:flex;flex-direction:column;gap:2px;margin:0 0 2px;padding:6px 10px 7px;border-left:2px solid var(--nw-amber);background:var(--nw-bg-2);border-radius:0 6px 6px 0}
.nw-lint-why-tag{font-size:10.5px;color:var(--nw-amber);letter-spacing:.02em}
.nw-lint-why-text{font-size:12px;color:var(--nw-fg-2);line-height:1.65}
/* 阶段 C：本书自己的阈值卡 */
.nw-lint-cal{display:block}
.nw-lint-cal-lead{margin:0 0 10px}
.nw-lint-cal-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nw-lint-cal-more{background:none;border:none;padding:2px 4px;font-size:11.5px;color:var(--nw-fg-3);cursor:pointer;font:inherit}
.nw-lint-cal-more:hover{color:var(--nw-amber)}
.nw-lint-cal-more:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-lint-cal-list{margin:10px 0 0;display:flex;flex-direction:column;gap:3px;max-height:34vh;overflow:auto}
.nw-lint-cal-row{display:flex;align-items:baseline;gap:8px;padding:4px 8px;border-radius:6px;background:var(--nw-bg-2);border-left:2px solid var(--nw-amber)}
.nw-lint-cal-name{font-size:12px;color:var(--nw-fg);flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-lint-cal-num{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;flex:0 0 auto}
.nw-lint-cal-note{margin:3px 0 0;padding-left:7px;border-left:2px solid var(--nw-line-2)}
.nw-lint-cal-tight{border-left-color:var(--nw-amber)}
.nw-lint-cal-loose{border-left-color:var(--nw-blue)}
.nw-lint-cal-loud{border-left-color:var(--nw-red)}
.nw-lint-cal-idle{border-left-color:var(--nw-line);color:var(--nw-fg-3)}

/* ── 拆书 / 导入 / 扫榜（第 2·3·4 批） ── */
.nw-analyze{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.nw-analyze-stat{
  padding:8px 10px;border-radius:8px;
  background:var(--nw-bg-2);border:1px solid var(--nw-line);
}
.nw-analyze-hooks{display:flex;gap:6px;flex-wrap:wrap}
.nw-analyze-open{
  display:flex;flex-direction:column;gap:4px;
  padding:8px 10px;border-radius:8px;
  background:var(--nw-bg-1);border:1px solid var(--nw-line);
}
.nw-analyze-open h4{margin:0 0 4px;font-size:11.5px;font-weight:600;color:var(--nw-fg-3);letter-spacing:.06em}
.nw-analyze-row{
  display:grid;grid-template-columns:64px minmax(80px,1.1fr) auto auto minmax(0,2fr);
  gap:8px;align-items:baseline;
  padding:4px 0;border-bottom:1px dashed var(--nw-line);
  font-size:12px;line-height:1.55;
}
.nw-analyze-row:last-child{border-bottom:none}
.nw-analyze-ch{
  color:var(--nw-fg-3);font-size:11px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-analyze-title{font-weight:600;color:var(--nw-fg);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-analyze-num{color:var(--nw-fg-3);font-size:11px;white-space:nowrap}
.nw-analyze-beats{color:var(--nw-fg-2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ana-hist,.nw-scan-hist{display:flex;flex-direction:column;gap:3px}
.nw-ana-hist-row,.nw-scan-hist-row{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg-2);overflow:hidden}
.nw-ana-hist-row.on{border-color:var(--nw-amber)}
.nw-ana-hist-main{
  display:grid;grid-template-columns:20px minmax(0,1fr) auto auto 14px;align-items:center;gap:9px;
  padding:8px 10px;text-align:left;background:none;border:none;color:inherit;font:inherit;cursor:pointer;
}
.nw-ana-hist-main:hover{background:var(--nw-bg-3)}
.nw-scan-hist-row{
  display:grid;grid-template-columns:20px minmax(0,1fr) auto 14px;align-items:center;gap:9px;
  padding:8px 10px;text-align:left;background:none;border:1px solid var(--nw-line);color:inherit;font:inherit;cursor:pointer;
}
.nw-scan-hist-row:hover{background:var(--nw-bg-3)}
.nw-ana-hist-icon,.nw-scan-hist-icon{font-size:13px;text-align:center}
.nw-ana-hist-body,.nw-scan-hist-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nw-ana-hist-title,.nw-scan-hist-title{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ana-hist-sub,.nw-scan-hist-sub{font-size:10.5px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ana-hist-at,.nw-scan-hist-at{font-size:10.5px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-ana-hist-detail{display:flex;flex-direction:column;gap:7px;padding:9px 11px;border-top:1px solid var(--nw-line);font-size:12px;color:var(--nw-fg-2);background:var(--nw-bg-1)}
.nw-import-opts{display:grid;grid-template-columns:1fr 180px;gap:10px}
.nw-scan-auto{margin-top:8px;padding-top:8px;border-top:1px dashed var(--nw-line)}
.nw-scan-auto summary{cursor:pointer;font-size:11.5px;color:var(--nw-fg-3);padding:2px 0}
.nw-scan-auto summary:hover{color:var(--nw-fg-2)}
.nw-scan-auto .nw-actions{margin-top:7px;flex-wrap:nowrap}
.nw-scan-auto .nw-actions .nw-input{flex:1 1 auto;min-width:0}

@media (max-width:900px){
  .nw-analyze-row{grid-template-columns:52px 1fr auto;row-gap:2px}
  .nw-analyze-beats{grid-column:1 / -1}
  .nw-import-opts{grid-template-columns:1fr}
  .nw-scan-auto .nw-actions{flex-wrap:wrap}

/* ── 【阶段 B】语料池 ─────────────────────────────────────── */
.nw-corpus-bar{height:8px;border-radius:99px;background:var(--nw-bg-3);overflow:hidden;margin:9px 0 6px}
.nw-corpus-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--nw-amber,#d9a441),var(--nw-amber-2,#e8c477));transition:width .35s ease}
.nw-corpus-nums{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--nw-fg-3);flex-wrap:wrap}
.nw-corpus-list{display:flex;flex-direction:column;gap:1px;margin:10px 0 4px}
.nw-corpus-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto 26px;align-items:center;gap:9px;padding:7px 9px;border-radius:7px;background:var(--nw-bg-1)}
.nw-corpus-row:hover{background:var(--nw-bg-2)}
.nw-corpus-name{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-corpus-meta{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap}
.nw-corpus-add{display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:9px;margin-top:10px}
.nw-corpus-out{margin-top:11px;padding-top:10px;border-top:1px dashed var(--nw-line);display:flex;flex-direction:column;gap:8px}
.nw-corpus-sum{font-size:12px;color:var(--nw-fg-2);line-height:1.6}
.nw-corpus-th{display:flex;flex-direction:column;gap:1px}
.nw-corpus-th-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:11.5px}
.nw-corpus-th-row:nth-child(odd){background:var(--nw-bg-1)}
.nw-corpus-th-noisy{background:rgba(217,164,65,.1)}
.nw-corpus-th-name{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-corpus-th-num{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap}

@media (max-width:900px){
  .nw-corpus-add{grid-template-columns:1fr}
  .nw-corpus-th-row{grid-template-columns:minmax(0,1fr) auto;row-gap:2px}
}

/* ── 【借 LNW 六项】地图 · 成书 · 检查更新 · 冷读 · 意见池 · 简报 ───────── */

/* 地图：坐标是百分比，所以节点用绝对定位、边用 SVG 铺满底。 */
.nw-map{display:flex;flex-direction:column;gap:10px}
.nw-map-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.nw-map-hint{font-size:11.5px;color:var(--nw-fg-3);line-height:1.6}
.nw-map-stage{position:relative;height:420px;border-radius:10px;background:var(--nw-bg-1);border:1px solid var(--nw-line);overflow:hidden}
.nw-map-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.nw-map-edge{stroke:var(--nw-line);stroke-width:1.4;fill:none}
.nw-map-edge-road{stroke-dasharray:none}
.nw-map-edge.on{stroke:var(--nw-amber,#d9a441);stroke-width:2.2}
.nw-map-edge-label{font-size:10px;fill:var(--nw-fg-3)}
.nw-map-nodes{position:absolute;inset:0}
.nw-map-node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:grab;user-select:none}
.nw-map-node:active{cursor:grabbing}
.nw-map-dot{width:14px;height:14px;border-radius:50%;background:var(--nw-amber,#d9a441);box-shadow:0 0 0 3px rgba(217,164,65,.18)}
.nw-map-node.orphan .nw-map-dot{background:var(--nw-fg-3);box-shadow:0 0 0 3px rgba(0,0,0,.08)}
.nw-map-name{font-size:11px;color:var(--nw-fg-2);white-space:nowrap;padding:1px 5px;border-radius:5px;background:var(--nw-bg-2)}
.nw-map-ch{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-map-orphan{font-size:11.5px;color:var(--nw-amber,#d9a441)}
.nw-map-select{height:30px;border-radius:7px;border:1px solid var(--nw-line);background:var(--nw-bg-1);color:var(--nw-fg);font-size:12px;padding:0 8px}
.nw-map-select:focus{outline:none;border-color:var(--nw-amber,#d9a441)}
.nw-map-edges,.nw-map-edgelist{display:flex;flex-direction:column;gap:1px;margin-top:8px}
.nw-map-edgerow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr) 26px;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:11.5px;background:var(--nw-bg-1)}
.nw-map-edgerow:nth-child(odd){background:var(--nw-bg-2)}
.nw-map-edgetext{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-map-edgedel{width:22px;height:22px;border:0;border-radius:5px;background:transparent;color:var(--nw-fg-3);cursor:pointer}
.nw-map-edgedel:hover{background:rgba(217,74,65,.14);color:#d94a41}
.nw-map-link{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) auto;gap:8px;align-items:center}
.nw-map-link-label{font-size:11.5px;color:var(--nw-fg-3)}
.nw-map-label-input{margin-top:6px}

/* 成书导出：四个格式牌，点一下才真下。 */
.nw-book-formats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:10px 0}
.nw-book-format{display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:11px 12px;border-radius:9px;border:1px solid var(--nw-line);background:var(--nw-bg-1);cursor:pointer;text-align:left}
.nw-book-format:hover{border-color:var(--nw-amber,#d9a441);background:var(--nw-bg-2)}
.nw-book-format-name{font-size:13px;color:var(--nw-fg);font-weight:600}
.nw-book-format-hint{font-size:11px;color:var(--nw-fg-3);line-height:1.55}
.nw-book-skip{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--nw-fg-2)}
.nw-update-err{font-size:11.5px;color:#d94a41}

/* 冷读：汇包 → 复制提示词 → 粘回执。三步在一个卡里，不跳页。 */
.nw-cold-form{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:9px 0 4px}
.nw-cold-pkg{margin-top:11px;padding-top:10px;border-top:1px dashed var(--nw-line);display:flex;flex-direction:column;gap:7px}
.nw-cold-file{font-size:12.5px;color:var(--nw-fg);font-family:ui-monospace,Consolas,monospace}
.nw-cold-prompt{max-height:190px;overflow:auto;margin:0;padding:9px 10px;border-radius:8px;background:var(--nw-bg-1);border:1px solid var(--nw-line);font-size:11.5px;line-height:1.7;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word}
.nw-cold-submit{margin-top:12px;padding-top:11px;border-top:1px dashed var(--nw-line);display:flex;flex-direction:column;gap:7px}
.nw-cold-history{margin-top:11px;font-size:11.5px;color:var(--nw-fg-3)}
.nw-cold-history summary{cursor:pointer;color:var(--nw-fg-2)}
.nw-cold-histrow{display:flex;justify-content:space-between;gap:9px;padding:3px 0 3px 10px}
.nw-cold-histname{font-family:ui-monospace,Consolas,monospace;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 意见池：一行一条，右边两个决定。 */
.nw-opinion-src{margin-top:6px}
.nw-opinion-list{display:flex;flex-direction:column;gap:1px;margin-top:9px}
.nw-opinion{display:grid;grid-template-columns:64px minmax(0,1fr) auto auto;align-items:start;gap:9px;padding:8px 9px;border-radius:7px;background:var(--nw-bg-1)}
.nw-opinion:nth-child(odd){background:var(--nw-bg-2)}
.nw-opinion-open .nw-opinion-text{color:var(--nw-fg)}
.nw-opinion-adopted{opacity:.62}
.nw-opinion-dismissed{opacity:.45}
.nw-opinion-ch{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap;padding-top:1px}
.nw-opinion-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.nw-opinion-text{font-size:12.5px;color:var(--nw-fg);line-height:1.65;word-break:break-word}
.nw-opinion-quote{font-size:11.5px;color:var(--nw-fg-3);line-height:1.6;word-break:break-word}
.nw-opinion-acts{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}

/* 对齐简报 */
.nw-brief{margin-top:9px;display:flex;flex-direction:column;gap:7px}
.nw-brief-text{max-height:300px;overflow:auto;margin:0;padding:10px;border-radius:8px;background:var(--nw-bg-1);border:1px solid var(--nw-line);font-size:11.5px;line-height:1.75;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Consolas,monospace}

@media (max-width:900px){
  .nw-map-stage{height:320px}
  .nw-map-link{grid-template-columns:1fr 1fr}
  .nw-opinion{grid-template-columns:minmax(0,1fr) auto;row-gap:5px}
  .nw-opinion-ch{grid-column:1/-1}
  .nw-opinion-acts{grid-column:1/-1;justify-content:flex-start}
}

/* ── 【借 oh-story】章级体检：四件事各查各的 ─────────────────── */
.nw-health{display:flex;flex-direction:column;gap:4px;margin-top:9px}
.nw-health-degenerate .nw-health-label{color:var(--nw-fg)}
.nw-health-row{border-radius:8px;background:var(--nw-bg-1);overflow:hidden}
.nw-health-head{display:grid;grid-template-columns:minmax(0,1fr) auto 16px;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;background:transparent;cursor:pointer;text-align:left}
.nw-health-head:hover{background:var(--nw-bg-2)}
.nw-health-label{font-size:12.5px;color:var(--nw-fg)}
.nw-health-caret{font-size:10px;color:var(--nw-fg-3)}
.nw-health-body{padding:2px 10px 10px;display:flex;flex-direction:column;gap:5px}
.nw-health-hits{display:flex;flex-direction:column;gap:1px}
.nw-health-hit{display:block;width:100%;padding:4px 8px;border:0;border-radius:5px;background:var(--nw-bg-2);color:var(--nw-fg-2);font-size:11.5px;line-height:1.6;text-align:left;cursor:pointer;word-break:break-word}
.nw-health-hit:hover{background:var(--nw-bg-3);color:var(--nw-fg)}
.nw-health-hit-flat{cursor:default}
.nw-health-hit-flat:hover{background:var(--nw-bg-2);color:var(--nw-fg-2)}

/* ── 任务包查看器 ──────────────────────────────────────────── */
.nw-taskpack{width:100%}
.nw-tp-list{display:flex;flex-direction:column;gap:4px;margin-top:9px}
.nw-tp-row{border-radius:8px;background:var(--nw-bg-1);overflow:hidden}
.nw-tp-head{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto auto;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;background:transparent;cursor:pointer;text-align:left}
.nw-tp-head:hover{background:var(--nw-bg-2)}
.nw-tp-role{font-size:12.5px;color:var(--nw-fg)}
.nw-tp-n{font-size:11.5px;color:var(--nw-fg-2)}
.nw-tp-at{font-size:11px;color:var(--nw-fg-3);font-variant-numeric:tabular-nums}
.nw-tp-body{padding:2px 10px 10px;display:flex;flex-direction:column;gap:5px}
.nw-tp-files{display:flex;flex-direction:column;gap:2px}
.nw-tp-file{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,2fr) auto;gap:8px;align-items:baseline;padding:4px 8px;border-radius:5px;background:var(--nw-bg-2)}
.nw-tp-file-name{font-size:11.5px;color:var(--nw-fg);font-family:var(--nw-mono);word-break:break-all}
.nw-tp-file-why{font-size:11px;color:var(--nw-fg-2);line-height:1.6}
.nw-tp-file-b{font-size:10.5px;color:var(--nw-fg-3);font-variant-numeric:tabular-nums}
.nw-tp-omit{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:5px;background:var(--nw-bg-2)}
.nw-tp-omit-t{font-size:11px;color:var(--nw-fg-3);letter-spacing:.04em}
.nw-tp-omit-row{font-size:11.5px;color:var(--nw-fg-2);line-height:1.6;word-break:break-word}
.nw-tp-prompt{margin-top:2px}
.nw-tp-prompt summary{cursor:pointer;font-size:11.5px;color:var(--nw-fg-2)}
.nw-tp-prompt-body{margin:5px 0 0;padding:8px;border-radius:6px;background:var(--nw-bg-2);font-family:var(--nw-mono);font-size:11px;line-height:1.65;white-space:pre-wrap;word-break:break-word;color:var(--nw-fg-2);max-height:240px;overflow:auto}

/* ── 成本卡：数字要能一眼读到，别让 ¥ 藏在段落里 ─────────── */
.nw-cost-total{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:9px;background:var(--nw-bg-2)}
.nw-cost-num{font-size:22px;font-weight:600;color:var(--nw-amber);line-height:1.2;font-variant-numeric:tabular-nums}
.nw-cost-desc{font-size:11.5px;color:var(--nw-fg-3);line-height:1.6}
.nw-cost-list{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.nw-cost-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:var(--nw-bg-1);font-size:11.5px}
.nw-cost-name{font-family:var(--nw-mono);color:var(--nw-fg-3)}
.nw-cost-meta{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-cost-money{color:var(--nw-amber);font-variant-numeric:tabular-nums}
.nw-cost-budget{display:flex;flex-direction:column;gap:4px;margin-top:8px}

/* ── 写策略卡：三档 + 目录勾选 ───────────────────────────── */
.nw-policy-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.nw-policy-card{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2);text-align:left;cursor:pointer}
.nw-policy-card:hover{border-color:var(--nw-line-2)}
.nw-policy-card.on{border-color:var(--nw-amber);box-shadow:0 0 0 1px var(--nw-amber)}
.nw-policy-card:disabled{opacity:.55;cursor:not-allowed}
.nw-policy-enforce.on{border-color:var(--nw-red);box-shadow:0 0 0 1px var(--nw-red)}
.nw-policy-name{font-size:12.5px;color:var(--nw-fg-1)}
.nw-policy-hint{font-size:11px;color:var(--nw-fg-3);line-height:1.5}
.nw-policy-dirs{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px}
.nw-policy-dir{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--nw-fg-2);cursor:pointer}
.nw-policy-dir input{accent-color:var(--nw-amber)}

@media (max-width:760px){
  .nw-policy-row{grid-template-columns:1fr}
}

/* ── 提案的段落地址：小、等宽、不抢正文的视线 ─────────────── */
.nw-diff-pid{font-family:var(--nw-mono);font-size:10.5px;color:var(--nw-fg-3);letter-spacing:.03em;align-self:center}
.nw-diff-tag-stale{font-size:10.5px;color:var(--nw-red);border:1px solid var(--nw-red);border-radius:4px;padding:0 4px;align-self:center}
.nw-diff-stale .nw-diff-before{opacity:.62;text-decoration:line-through;text-decoration-color:var(--nw-red)}
.nw-prop-stale-hint{margin:0 0 4px;font-size:11.5px;color:var(--nw-amber);line-height:1.6}

/* ── 派单票上的子代理编号 ─────────────────────────────── */
.nw-dp-child{font-family:var(--nw-mono);font-size:10.5px;color:var(--nw-teal)}

/* ── 状态灯按 verdict 上色：红灯就真的是红的 ─────────────
   以前只有「亮 / 不亮」两态，等于没说实话——没开轮、等确认、可以写三种状态
   长得一模一样。现在按绿色绿、琥珀黄、红色红，看颜色就知道卡没卡。 */
.nw-lamp-green .nw-lamp-dot{background:var(--nw-green)}
.nw-lamp-amber .nw-lamp-dot{background:var(--nw-amber);animation:nw-pulse 1.6s infinite}
.nw-lamp-red .nw-lamp-dot{background:var(--nw-red)}
.nw-lamp-red{border-color:var(--nw-red)}
.nw-lamp-amber{border-color:var(--nw-amber)}
.nw-lamp-grey .nw-lamp-dot{background:var(--nw-fg-3)}

/* ── 正文页：字、章号、进度，别的一概不摆 ───────────────── */
.nw-read{display:flex;flex-direction:column;gap:14px}
.nw-read-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.nw-read-nav{display:flex;align-items:center;gap:8px}
.nw-read-pos{font-size:11.5px;color:var(--nw-fg-3);font-family:var(--nw-mono)}
.nw-read-font{display:flex;align-items:center;gap:6px;margin-left:auto}
.nw-read-font-n{font-size:11.5px;color:var(--nw-fg-2);font-family:var(--nw-mono);min-width:18px;text-align:center}
.nw-read-sheet{border:1px solid var(--nw-line);border-radius:12px;background:var(--nw-bg-2);padding:22px 26px 16px}
.nw-read-head{display:flex;align-items:baseline;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--nw-line);margin-bottom:16px}
.nw-read-title{margin:0;font-size:17px;font-weight:600;color:var(--nw-fg)}
.nw-read-sub{margin-left:auto;font-size:11.5px;color:var(--nw-fg-3)}
.nw-read-doc{color:var(--nw-fg-1);max-width:44em}
.nw-read-para{margin:0 0 1.05em;text-indent:2em;letter-spacing:.01em}
.nw-read-para:hover{background:rgba(217,160,84,.06);border-radius:4px}
.nw-read-tab{min-width:64px}
.nw-read-empty{margin:0;padding:18px 0;color:var(--nw-fg-3);font-size:13px}
.nw-read-edit{display:flex;flex-direction:column;gap:10px}
.nw-read-foot{display:flex;align-items:center;gap:10px;justify-content:flex-end}
.nw-read-more{display:flex;justify-content:center;padding:8px 0 2px}
.nw-read-tail{display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid var(--nw-line)}
.nw-read-tail .nw-btn:last-child{margin-left:auto}
.nw-read-flag{font-size:11.5px;color:var(--nw-green)}

@media (max-width:760px){
  .nw-read-sheet{padding:16px 14px 12px}
  .nw-read-doc{max-width:none}
}

/* ── 停靠点：一句话说清「现在能不能写」 ─────────────────── */
.nw-run{display:flex;flex-direction:column;gap:14px}
.nw-run-hero h2{margin:0 0 4px;font-size:18px;color:var(--nw-fg)}
.nw-run-verdict{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:1px solid var(--nw-line);background:var(--nw-bg-2)}
.nw-run-verdict-dot{width:9px;height:9px;border-radius:50%;background:var(--nw-fg-3);flex:none}
.nw-run-verdict-text{font-size:13px;color:var(--nw-fg-1)}
.nw-run-verdict-green{border-color:var(--nw-green)}
.nw-run-verdict-green .nw-run-verdict-dot{background:var(--nw-green)}
.nw-run-verdict-amber{border-color:var(--nw-amber)}
.nw-run-verdict-amber .nw-run-verdict-dot{background:var(--nw-amber)}
.nw-run-verdict-red{border-color:var(--nw-red)}
.nw-run-verdict-red .nw-run-verdict-dot{background:var(--nw-red)}
.nw-run-verdict .nw-btn{margin-left:auto}
.nw-run-active{display:flex;flex-direction:column;gap:12px;border:1px solid var(--nw-line);border-radius:12px;background:var(--nw-bg-2);padding:16px 18px}
.nw-run-head{display:flex;align-items:flex-start;gap:12px}
.nw-run-head h3{margin:0 0 3px;font-size:15px;color:var(--nw-fg)}
.nw-run-head .nw-actions{margin-left:auto;align-items:center}
.nw-run-count{font-size:11.5px;color:var(--nw-fg-2);font-family:var(--nw-mono)}
.nw-run-chs{display:flex;flex-direction:column;gap:6px}
.nw-run-ch{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;background:var(--nw-bg-3);font-size:12px}
.nw-run-ch-done{opacity:.72}
.nw-run-ch-n{font-weight:600;color:var(--nw-fg-1);min-width:56px}
.nw-run-ch-w{color:var(--nw-fg-2);font-family:var(--nw-mono);font-size:11.5px}
.nw-run-ch-at{color:var(--nw-fg-3);font-family:var(--nw-mono);font-size:11px}
.nw-run-ch-acts{margin-left:auto;display:flex;gap:6px}
.nw-run-foot{display:flex;align-items:flex-end;gap:12px;border-top:1px solid var(--nw-line);padding-top:12px}
.nw-run-foot .nw-field{flex:1;margin:0}
.nw-run-foot .nw-actions{align-self:flex-end}
.nw-run-form{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px}
.nw-run-form .nw-actions{grid-column:1/-1}
.nw-run-hist{display:flex;flex-direction:column;gap:5px}
.nw-run-hist-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;border:1px solid transparent;background:var(--nw-bg-2);cursor:pointer;text-align:left;font-size:12px}
.nw-run-hist-row:hover{border-color:var(--nw-amber)}
.nw-run-hist-id{font-family:var(--nw-mono);font-size:10.5px;color:var(--nw-fg-3)}
.nw-run-hist-n{color:var(--nw-fg-2);font-family:var(--nw-mono);font-size:11.5px}
.nw-run-hist-at{margin-left:auto;color:var(--nw-fg-3);font-family:var(--nw-mono);font-size:11px}

@media (max-width:760px){
  .nw-run-form{grid-template-columns:1fr}
  .nw-run-foot{flex-direction:column;align-items:stretch}
}

/* ── 建作品页（没有作品时的首屏） ─────────────────────────── */
.nw-top-solo{justify-content:flex-start;gap:12px}
.nw-top-solo .nw-brand-page{margin-left:2px}
.nw-create{display:flex;flex-direction:column;gap:16px}
.nw-create-lead{display:flex;flex-direction:column;gap:5px}
.nw-create-title{margin:0;font-size:20px;color:var(--nw-fg)}
.nw-create-sub{margin:0;color:var(--nw-fg-2);font-size:12.5px;line-height:1.7;max-width:640px}
.nw-create-cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
.nw-create-main{display:flex;flex-direction:column;gap:14px;min-width:0}
.nw-create-side{display:flex;flex-direction:column;gap:14px;position:sticky;top:12px}
.nw-create-card{display:flex;flex-direction:column;gap:10px}
.nw-create-field{display:flex;flex-direction:column;gap:5px;margin:0}
.nw-create-field>label{font-size:12px;color:var(--nw-fg-2)}
.nw-create-field-bad>label{color:var(--nw-red)}
.nw-create-field-bad .nw-input{border-color:var(--nw-red)}
.nw-create-hint{font-size:11px;color:var(--nw-fg-3);line-height:1.5}
.nw-create-err{font-size:11px;color:var(--nw-red);line-height:1.5}
.nw-create-steps{margin:0;padding-left:17px;color:var(--nw-fg-2);font-size:12px;line-height:1.9}
.nw-create-submit{width:100%;justify-content:center}
.nw-create-notice{margin:0;font-size:11.5px;color:var(--nw-amber);line-height:1.6}
.nw-create-fail{font-size:11.5px;line-height:1.6;flex-wrap:wrap}
.nw-create-code{font-family:var(--nw-mono);font-size:10.5px;color:var(--nw-fg-3)}
.nw-create-steps-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nw-create-step{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:var(--nw-bg-2);color:var(--nw-fg-3);font-size:11.5px}
.nw-create-step-n{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:var(--nw-bg-3);color:var(--nw-fg-2);font-size:10px;font-weight:700}
.nw-create-step.on{background:var(--nw-amber-weak);color:var(--nw-amber);font-weight:600}
.nw-create-step.on .nw-create-step-n{background:var(--nw-amber);color:var(--nw-bg)}
.nw-create-step.done{color:var(--nw-fg-2)}
.nw-create-scale-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.nw-create-scale{display:flex;flex-direction:column;gap:4px;padding:11px 12px;border:1px solid var(--nw-line);border-radius:10px;background:var(--nw-bg);color:var(--nw-fg);font:inherit;text-align:left;cursor:pointer}
.nw-create-scale:hover{border-color:var(--nw-amber)}
.nw-create-scale-on{border-color:var(--nw-amber);background:var(--nw-amber-weak)}
.nw-create-scale-head{display:flex;align-items:center;gap:8px}
.nw-create-scale-name{font-size:13px;font-weight:600}
.nw-create-scale-meta{font-size:11px;color:var(--nw-fg-2);font-family:var(--nw-mono)}
.nw-create-scale-desc{font-size:11px;color:var(--nw-fg-3);line-height:1.5}
.nw-create-scale-total{font-size:11.5px;color:var(--nw-amber);font-weight:600;margin-top:2px}
.nw-create-more{align-self:flex-start;border:0;background:transparent;color:var(--nw-fg-2);font:inherit;font-size:11.5px;cursor:pointer;padding:2px 0}
.nw-create-more:hover{color:var(--nw-amber)}
.nw-create-more-body{display:flex;flex-direction:column;gap:10px;padding:11px 12px;border:1px dashed var(--nw-line);border-radius:10px}
.nw-create-check{display:flex;flex-direction:column;gap:5px;padding:11px 12px;border:1px solid var(--nw-line);border-radius:10px;background:var(--nw-bg-2)}
.nw-create-foot{display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:4px}
.nw-create-foot .nw-btn-primary{flex:1;justify-content:center}
.nw-create-next{flex:1;justify-content:center}

/* ══ 【P1/P4/P5】今天 / 派单 / 读者视角 / 历史版本 ══════════════════ */

/* ── 今天：顶部一条「现在能不能写」 ── */
.nw-today-run{display:flex;flex-direction:column;gap:8px;padding:9px 12px;border:1px solid var(--nw-line);border-radius:10px;background:var(--nw-bg-1)}
.nw-today-run-green{border-color:var(--nw-green)}
.nw-today-run-amber{border-color:var(--nw-amber)}
.nw-today-run-red{border-color:var(--nw-red)}
.nw-today-run-blocked{background:var(--nw-bg-1);box-shadow:inset 2px 0 0 var(--nw-amber)}
.nw-today-run-line{display:flex;align-items:center;gap:8px}
.nw-today-run-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--nw-fg-3)}
.nw-today-run-green .nw-today-run-dot{background:var(--nw-green)}
.nw-today-run-amber .nw-today-run-dot{background:var(--nw-amber);animation:nw-pulse 2.4s ease-in-out infinite}
.nw-today-run-red .nw-today-run-dot{background:var(--nw-red)}
.nw-today-run-text{flex:1;min-width:0;font-size:12.5px;color:var(--nw-fg)}
.nw-today-run-count{flex:none;font-size:11px;color:var(--nw-fg-2);font-family:var(--nw-mono)}
.nw-today-run-body{display:flex;flex-direction:column;gap:8px;padding-top:8px;border-top:1px dashed var(--nw-line)}
.nw-today-run-foot{display:flex;align-items:flex-end;gap:8px}
.nw-today-run-foot .nw-field{flex:1;min-width:0}

/* ── 派单：把两页拼起来的过渡头 ── */
.nw-dispatch-lead{display:flex;flex-direction:column;gap:3px}
.nw-dispatch-lead h2{margin:0;font-size:15px;font-weight:600}
.nw-dispatch-lead p{margin:0}

/* ── 验收台：读者视角两视图 ── */
.nw-reader{display:flex;flex-direction:column;gap:12px}

/* ── 验收台：历史版本整屏 ── */
.nw-vers{display:flex;flex-direction:column;gap:12px}
.nw-vers-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.nw-vers-list{display:flex;flex-direction:column;gap:4px}
.nw-vers-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg-1)}
.nw-vers-row.on{border-color:var(--nw-amber);background:var(--nw-amber-weak)}
.nw-vers-main{flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:0;background:transparent;color:var(--nw-fg);font:inherit;font-size:12px;text-align:left;cursor:pointer;padding:3px 0}
.nw-vers-at{flex:none;font-family:var(--nw-mono);font-size:11px;color:var(--nw-fg-2)}
.nw-vers-w{flex:none;font-family:var(--nw-mono);font-size:11px;color:var(--nw-fg-2)}
.nw-vers-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--nw-fg-3);font-family:var(--nw-mono)}
.nw-vers-text{margin:0;max-height:440px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.85;color:var(--nw-fg)}

/* ── 顶栏：超预算才浮的那条 ── */
.nw-top-new{white-space:nowrap}
.nw-top-warn{width:100%;border:0;border-top:1px solid var(--nw-amber);background:var(--nw-amber-weak);color:var(--nw-amber);font:inherit;font-size:11.5px;padding:5px 16px;text-align:left;cursor:pointer;flex:none}

/* 今天页外壳（内嵌的驾驶舱是 bare 的，不再套 .nw-page）。 */
.nw-today{max-width:1360px}

@media (max-width:900px){
  .nw-today-run-foot{flex-direction:column;align-items:stretch}
}

@media (max-width:900px){
  .nw-create-cols{grid-template-columns:1fr}
  .nw-create-side{position:static}
  .nw-create-scale-grid{grid-template-columns:1fr}
}
`
