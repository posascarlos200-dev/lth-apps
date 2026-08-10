/* =========================================================
   LTH Code - UI del motor v2.
   El motor nuevo se conecta por window.electron.code.* + evento 'code:event'.
   ========================================================= */
(function () {
  'use strict';

  const APP_ID = 'lth-code';
  const APP_NAME = 'LTH Code';
  const GRADIENT = 'linear-gradient(135deg,#031014 0%,#0b7f6b 55%,#18d5ff 100%)';
  const RECENTS_KEY = 'lthcode.recents.v1';
  const APP_ICON_URL = '../assets/lth-code.p.png';
  const APP_ICON_HTML = `<img src="${APP_ICON_URL}" alt="${APP_NAME}" style="width:72px;height:72px;object-fit:contain;display:block;filter:drop-shadow(0 10px 18px rgba(72,28,0,.28));">`;
  const APP_ICON_STYLE = 'width:88%;height:88%;object-fit:contain;display:block;filter:drop-shadow(0 12px 18px rgba(72,28,0,.24));';
  const APP_TITLEBAR_ICON_WRAP_STYLE = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:inherit;overflow:visible;';
  const APP_TITLEBAR_ICON_STYLE = 'width:100%;height:100%;object-fit:contain;display:block;transform:scale(1.04);filter:drop-shadow(0 2px 6px rgba(72,28,0,.28));';
  const APP_CHIP_ICON_STYLE = 'width:94%;height:94%;object-fit:contain;border-radius:14px;display:block;transform:scale(1.03);filter:drop-shadow(0 8px 12px rgba(72,28,0,.24));';
  const APP_HEAD_ICON = `<img src="${APP_ICON_URL}" alt="${APP_NAME}">`;

  const CSS = `
    .lthc-root{height:100%;display:flex;flex-direction:column;color:#e7f6ff;background:#000;
      font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden;position:relative;}
    .lthc-head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:#000;}
    .lthc-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));border:1px solid rgba(255,170,84,.26);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 20px rgba(0,0,0,.18);}
    .lthc-mark img{width:100%;height:100%;object-fit:contain;display:block;transform:scale(1.03);filter:drop-shadow(0 8px 14px rgba(72,28,0,.22));}
    .lthc-title{flex:1;min-width:0;}
    .lthc-title h2{margin:0;font-size:16px;letter-spacing:.2px;}
    .lthc-title p{margin:2px 0 0;font-size:12px;color:rgba(231,246,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,Consolas,monospace;}
    .lthc-proj{display:flex;align-items:center;gap:6px;}
    .lthc-proj select{background:#0a0b0d;color:rgba(231,246,255,.86);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 10px;font-size:12px;max-width:190px;}
    .lthc-pill{font-size:11px;font-weight:760;padding:6px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.035);color:rgba(231,246,255,.74);cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.045);letter-spacing:.01em;transition:border-color .14s ease,background .14s ease,color .14s ease;}
    .lthc-pill:hover{background:rgba(255,255,255,.065);border-color:rgba(255,255,255,.22);color:rgba(231,246,255,.94);}
    .lthc-pill.static{cursor:default;}
    .lthc-pill.static:hover{background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.14);color:rgba(231,246,255,.74);}
    .lthc-pill.model{color:rgba(184,225,238,.9);border-color:rgba(24,213,255,.18);background:rgba(24,213,255,.04);letter-spacing:.01em;}
    select.lthc-pill.model{cursor:pointer;appearance:none;-webkit-appearance:none;outline:none;font-family:inherit;}
    select.lthc-pill.model option{background:#0a1216;color:#cfeaf5;}
    .lthc-modes{display:flex;align-items:center;gap:2px;padding:2px;border:1px solid rgba(255,255,255,.11);border-radius:999px;background:rgba(255,255,255,.025);}
    .lthc-modes .lthc-pill{border-color:transparent;background:transparent;box-shadow:none;color:rgba(231,246,255,.64);}
    .lthc-modes .lthc-pill:hover{background:rgba(255,255,255,.07);border-color:transparent;color:rgba(231,246,255,.92);}
    .lthc-pill.toggle.active{box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}
    .lthc-pill.toggle[data-mode="auto"].active{color:#f1c98b;background:rgba(255,174,94,.13);border-color:transparent;}
    .lthc-pill.toggle[data-mode="plan"].active{color:#a7dce8;background:rgba(24,213,255,.1);border-color:transparent;}
    .lthc-pill.toggle[data-mode="mind"].active{color:#c9b3ff;background:rgba(177,74,255,.14);border-color:transparent;}
    .lthc-integrations{min-width:94px;}
    .lthc-approve{margin:6px auto 2px;max-width:820px;width:100%;}
    .lthc-approve button{border:none;border-radius:10px;padding:9px 14px;font-size:12.5px;font-weight:800;cursor:pointer;color:#04121f;background:linear-gradient(135deg,#18d5ff,#0b7f6b);}
    .lthc-mem{font-size:12px;color:rgba(126,240,192,.85);padding:2px 4px;}
    .lthc-sub{font-size:12.5px;color:#c9a6ff;padding:6px 10px;border-left:2px solid rgba(160,120,255,.5);background:rgba(160,120,255,.06);border-radius:0 8px 8px 0;}
    .lthc-sub.done{color:rgba(201,166,255,.75);}
    .lthc-usage{display:none;border-bottom:1px solid rgba(255,255,255,.075);background:linear-gradient(180deg,rgba(5,9,12,.94),rgba(2,4,6,.94));padding:8px 16px 9px;}
    .lthc-usage.show{display:block;}
    .lthc-usage-head{max-width:1060px;margin:0 auto 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
    .lthc-usage-title{display:flex;flex-direction:column;gap:2px;min-width:0;}
    .lthc-usage-title b{font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:#38dfff;text-shadow:0 0 14px rgba(24,213,255,.38);}
    .lthc-usage-title span{font-size:11.5px;color:rgba(231,246,255,.5);}
    .lthc-usage-close{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#dff9ff;font-size:15px;font-weight:900;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
    .lthc-usage-close:hover{border-color:rgba(255,255,255,.24);background:rgba(255,255,255,.08);}
    .lthc-usage-inner{max-width:1060px;margin:0 auto;display:grid;grid-template-columns:260px minmax(0,1fr);gap:10px;align-items:start;}
    .lthc-usage-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
    .lthc-usage-kpi{border:1px solid rgba(24,213,255,.16);background:rgba(24,213,255,.035);border-radius:8px;padding:6px 8px;min-width:0;}
    .lthc-usage-kpi b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:rgba(186,232,246,.66);}
    .lthc-usage-kpi span{display:block;margin-top:2px;font-size:13px;font-weight:850;color:#dff9ff;font-family:ui-monospace,"Cascadia Code",Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .lthc-usage-empty{max-width:1060px;margin:0 auto;border:1px dashed rgba(24,213,255,.2);border-radius:10px;padding:14px 16px;font-size:12px;color:rgba(231,246,255,.56);background:rgba(24,213,255,.025);}
    .lthc-usage-rows{display:flex;flex-direction:column;gap:5px;max-height:128px;overflow:auto;padding-right:2px;}
    .lthc-usage-row{display:grid;grid-template-columns:54px 1fr auto;gap:8px;align-items:center;border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.026);border-radius:8px;padding:6px 8px;font-size:11.5px;color:rgba(231,246,255,.72);}
    .lthc-usage-row.warn{border-color:rgba(255,217,138,.24);background:rgba(255,217,138,.05);}
    .lthc-usage-row.err{border-color:rgba(255,154,154,.24);background:rgba(255,154,154,.05);}
    .lthc-usage-row .idx{font-family:ui-monospace,"Cascadia Code",Consolas,monospace;color:#7ef0c0;font-weight:850;}
    .lthc-usage-row .main{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .lthc-usage-row .meta{font-family:ui-monospace,"Cascadia Code",Consolas,monospace;color:rgba(231,246,255,.5);white-space:nowrap;}
    @media (max-width:760px){.lthc-usage-head{align-items:flex-start;}.lthc-usage-inner{grid-template-columns:1fr}.lthc-usage-summary{grid-template-columns:repeat(4,minmax(0,1fr));}.lthc-usage-row{grid-template-columns:44px 1fr;}.lthc-usage-row .meta{grid-column:2;}}
    .lthc-undo{margin:2px auto 4px;max-width:820px;width:100%;display:flex;justify-content:flex-start;}
    .lthc-undo button{border:1px solid rgba(255,154,154,.4);background:rgba(255,154,154,.08);color:#ffb3b3;border-radius:9px;padding:7px 12px;font-size:12px;font-weight:800;cursor:pointer;}
    .lthc-undo button:hover{background:rgba(255,154,154,.16);}
    .lthc-undo button:disabled{opacity:.5;cursor:default;}
    /* Panel de procesos en segundo plano */
    .lthc-procs{display:none;flex-direction:column;gap:6px;padding:8px 16px 0;max-height:230px;overflow:auto;border-top:1px solid rgba(255,255,255,.06);}
    .lthc-procs.show{display:flex;}
    .lthc-proc{border:1px solid rgba(24,213,255,.2);border-radius:9px;background:#060606;overflow:hidden;}
    .lthc-proc-head{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:12px;}
    .lthc-proc-cmd{flex:1;min-width:0;font-family:ui-monospace,Consolas,monospace;color:#bfe9ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .lthc-proc-st{font-size:11px;font-weight:800;color:#7ef0c0;}
    .lthc-proc-st.dead{color:rgba(231,246,255,.4);}
    .lthc-proc-stop{border:1px solid rgba(255,154,154,.4);background:rgba(255,154,154,.08);color:#ffb3b3;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:800;cursor:pointer;}
    .lthc-proc-stop:disabled{opacity:.4;cursor:default;}
    .lthc-proc-log{margin:0;padding:6px 10px;max-height:120px;overflow:auto;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.4;white-space:pre-wrap;color:#cfe6d8;border-top:1px solid rgba(255,255,255,.06);}
    .lthc-proc-log .err{color:#ffb3b3;}
    .lthc-proc-log:empty{display:none;}
    .lthc-pill.ok{color:#9adfbd;border-color:rgba(126,240,192,.26);background:rgba(126,240,192,.055);}
    .lthc-pill.busy{color:#e6c98f;border-color:rgba(255,217,138,.26);background:rgba(255,217,138,.055);}
    .lthc-pill.err{color:#eaa0a0;border-color:rgba(255,154,154,.3);background:rgba(255,154,154,.055);}
    .lthc-thread-wrap{position:relative;flex:1;min-height:0;display:flex;}
    .lthc-thread{flex:1;overflow:auto;padding:18px 16px 8px;display:flex;flex-direction:column;gap:12px;background:#000;}
    .lthc-jump{display:none;align-items:center;gap:6px;position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:20;background:linear-gradient(135deg,rgba(178,74,255,.92),rgba(24,213,255,.82));color:#04121f;border:none;border-radius:999px;padding:8px 16px;font-size:12.5px;font-weight:800;letter-spacing:.02em;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.45),0 0 22px rgba(24,213,255,.28);animation:lthc-jump-in .18s ease;}
    .lthc-jump.show{display:flex;}
    .lthc-jump:hover{transform:translateX(-50%) translateY(-1px);}
    @keyframes lthc-jump-in{from{opacity:0;transform:translateX(-50%) translateY(6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
    .lthc-msg{max-width:820px;width:100%;margin:0 auto;}
    .lthc-user{align-self:flex-end;background:linear-gradient(135deg,rgba(178,74,255,.16),rgba(94,42,145,.12));border:1px solid rgba(178,74,255,.38);border-radius:14px 14px 4px 14px;padding:10px 14px;font-size:14px;max-width:80%;margin-left:auto;white-space:pre-wrap;box-shadow:0 0 0 1px rgba(178,74,255,.08),0 0 20px rgba(178,74,255,.13),inset 0 1px 0 rgba(255,255,255,.05);color:#f3e7ff;}
    .lthc-assistant{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);border-radius:14px 14px 14px 4px;padding:12px 14px;font-size:14px;line-height:1.5;white-space:pre-wrap;}
    .lthc-assistant code{background:rgba(24,213,255,.12);padding:1px 5px;border-radius:4px;font-family:ui-monospace,Consolas,monospace;font-size:.9em;}
    .lthc-assistant strong{color:#bfe9ff;}
    .lthc-thought{max-width:860px;font-size:13px;line-height:1.55;color:rgba(231,246,255,.62);font-style:italic;padding:10px 14px 10px 16px;background:rgba(255,255,255,.026);border:1px solid rgba(255,255,255,.08);border-left:2px solid rgba(178,74,255,.42);border-radius:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.035);}
    .lthc-thought.live{color:rgba(206,243,255,.84);border-left-color:rgba(24,213,255,.58);background:rgba(24,213,255,.035);}
    .lthc-thought.live::after{content:'|';margin-left:1px;animation:lthcBlink 1s steps(2) infinite;}
    .lthc-thinking{max-width:860px;display:flex;align-items:center;gap:10px;color:rgba(214,241,250,.72);font-size:13px;line-height:1.4;padding:11px 14px;background:linear-gradient(180deg,rgba(255,255,255,.032),rgba(255,255,255,.018));border:1px solid rgba(255,255,255,.085);border-left:2px solid rgba(24,213,255,.48);border-radius:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
    .lthc-thinking .orb{position:relative;width:16px;height:16px;flex:none;border-radius:50%;background:rgba(24,213,255,.15);box-shadow:0 0 18px rgba(24,213,255,.18);}
    .lthc-thinking .orb::before,.lthc-thinking .orb::after{content:'';position:absolute;inset:3px;border-radius:50%;background:#7ef0c0;animation:lthcThinkPulse 1.18s ease-in-out infinite;}
    .lthc-thinking .orb::after{inset:6px;background:#38dfff;animation-delay:.22s;}
    .lthc-thinking .label{font-style:italic;}
    .lthc-thinking .dots{display:inline-grid;grid-auto-flow:column;gap:3px;margin-left:2px;vertical-align:middle;}
    .lthc-thinking .dots i{width:4px;height:4px;border-radius:50%;background:rgba(126,240,192,.8);animation:lthcDot 1.05s ease-in-out infinite;}
    .lthc-thinking .dots i:nth-child(2){animation-delay:.16s}.lthc-thinking .dots i:nth-child(3){animation-delay:.32s}
    @keyframes lthcBlink{50%{opacity:0;}}
    @keyframes lthcThinkPulse{0%,100%{transform:scale(.72);opacity:.45;}50%{transform:scale(1);opacity:1;}}
    @keyframes lthcDot{0%,80%,100%{transform:translateY(0);opacity:.38;}40%{transform:translateY(-3px);opacity:1;}}
    .lthc-tool{border:1px solid rgba(255,255,255,.1);border-radius:11px;overflow:hidden;background:#060606;min-height:42px;box-shadow:inset 0 1px 0 rgba(255,255,255,.025);}
    .lthc-tool-head{display:flex;align-items:center;gap:9px;min-height:42px;padding:9px 12px;font-size:12.5px;font-weight:700;background:rgba(255,255,255,.035);}
    .lthc-tool-ico{width:34px;flex:none;text-align:center;font-family:ui-monospace,"Cascadia Code",Consolas,monospace;font-size:10px;font-weight:800;color:rgba(231,246,255,.68);}
    .lthc-tool-label{flex:1;min-width:0;font-family:ui-monospace,"Cascadia Code",Consolas,monospace;font-weight:600;color:#bfe9ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .lthc-tool-status{flex:none;font-size:11px;font-weight:800;color:rgba(231,246,255,.5);}
    .lthc-tool-status.ok{color:#7ef0c0;} .lthc-tool-status.err{color:#ff9a9a;}
    .lthc-tool-out{margin:0;padding:10px 12px;max-height:320px;overflow:auto;font-family:ui-monospace,"Cascadia Code",Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#cfe6d8;border-top:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.012);}
    .lthc-tool-out .err{color:#ffb3b3;}
    .lthc-tool-out .del{color:#ff9a9a;}
    .lthc-tool-out .add{color:#7ef0c0;}
    .lthc-tool-out .summary{color:rgba(207,230,216,.78);}
    .lthc-tool-out:empty{display:none;}
    /* Panel de TODOs */
    .lthc-agents{display:none;margin:12px auto 0;max-width:860px;width:calc(100% - 48px);align-items:center;gap:10px;flex-wrap:wrap;background:linear-gradient(180deg,rgba(20,8,30,.96),rgba(12,4,18,.94));border:1px solid rgba(177,74,255,.55);border-radius:12px;padding:10px 14px;box-shadow:0 0 26px rgba(177,74,255,.18),inset 0 1px 0 rgba(255,255,255,.05);}
    .lthc-agents.show{display:flex;}
    .lthc-agents .dot{width:10px;height:10px;border-radius:50%;background:#c9a6ff;box-shadow:0 0 12px rgba(201,166,255,.8);animation:lthcPulse 1s ease-in-out infinite;flex:none;}
    @keyframes lthcPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.7);}}
    .lthc-agents .txt{font-size:12.5px;font-weight:600;letter-spacing:.02em;color:#d7b8ff;}
    .lthc-agents .jobs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;width:100%;}
    .lthc-agents .jobs li{font-size:12px;color:rgba(215,184,255,.72);padding-left:16px;position:relative;}
    .lthc-agents .jobs li:before{content:'';position:absolute;left:4px;top:6px;width:5px;height:5px;border-radius:50%;background:rgba(201,166,255,.6);}
    .lthc-todos{display:none;margin:12px auto 0;max-width:860px;width:calc(100% - 48px);background:linear-gradient(180deg,rgba(2,13,19,.96),rgba(2,7,10,.94));border:1px solid rgba(24,213,255,.52);border-radius:12px;padding:13px 16px 14px;box-shadow:0 0 0 1px rgba(24,213,255,.09),0 0 26px rgba(24,213,255,.18),inset 0 1px 0 rgba(255,255,255,.055);}
    .lthc-todos.show{display:block;}
    .lthc-todos h4{margin:0 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#38dfff;text-shadow:0 0 14px rgba(24,213,255,.45);}
    .lthc-todos ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
    .lthc-todos li{font-size:13px;line-height:1.35;display:flex;gap:10px;align-items:flex-start;color:rgba(231,246,255,.84);}
    .lthc-todos li .m{width:9px;height:9px;margin-top:4px;border-radius:50%;flex:none;border:1px solid rgba(175,238,255,.72);font-size:0;box-shadow:0 0 10px rgba(24,213,255,.24);}
    .lthc-todos li.done{color:rgba(231,246,255,.42);text-decoration:line-through;}
    .lthc-todos li.done .m{background:rgba(126,240,192,.75);border-color:rgba(126,240,192,.9);box-shadow:0 0 12px rgba(126,240,192,.32);}
    .lthc-todos li.doing{color:#ffd98a;}
    .lthc-todos li.doing .m{background:#ffd98a;border-color:#ffe6ad;box-shadow:0 0 13px rgba(255,217,138,.48);}
    /* Estado sin motor */
    .lthc-gate{margin:auto;text-align:center;max-width:460px;padding:30px 24px;}
    .lthc-gate .lock{font-size:40px;margin-bottom:8px;}
    .lthc-gate h3{color:#ffd98a;font-size:20px;margin:0 0 10px;}
    .lthc-gate p{color:rgba(231,246,255,.62);font-size:14px;line-height:1.55;margin:0 0 8px;}
    .lthc-gate .sub{font-size:12.5px;color:rgba(231,246,255,.4);}
    .lthc-note{font-size:12.5px;color:rgba(255,217,138,.9);padding:4px 6px;}
    .lthc-note.err{color:#ff9a9a;}
    .lthc-cont{max-width:760px;background:linear-gradient(180deg,rgba(4,11,16,.98),rgba(3,5,9,.98));border:1px solid rgba(24,213,255,.58);border-left:2px solid rgba(190,82,255,.78);border-radius:12px;padding:13px 14px;box-shadow:0 0 0 1px rgba(190,82,255,.08),0 0 24px rgba(24,213,255,.14),inset 0 1px 0 rgba(255,255,255,.055);}
    .lthc-cont .t{font-size:11px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:#38dfff;margin-bottom:6px;text-shadow:0 0 14px rgba(24,213,255,.45);}
    .lthc-cont .d{font-size:13px;line-height:1.45;color:rgba(231,246,255,.76);}
    .lthc-cont-actions{display:flex;gap:8px;margin-top:11px;}
    .lthc-cont button{height:34px;border-radius:9px;padding:0 13px;font-size:12px;font-weight:900;cursor:pointer;border:1px solid rgba(255,255,255,.14);background:#08090b;color:#eafaff;box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}
    .lthc-cont button:disabled{opacity:.55;cursor:default;}
    .lthc-cont .resume{color:#f4ddff;border-color:rgba(190,82,255,.72);background:linear-gradient(180deg,rgba(59,20,86,.96),rgba(30,13,45,.96));box-shadow:0 0 18px rgba(190,82,255,.32),inset 0 1px 0 rgba(255,255,255,.11);}
    .lthc-cont .stop{color:#ccefff;border-color:rgba(24,213,255,.34);background:rgba(4,14,18,.88);}
    .lthc-foot{padding:12px 18px;border-top:1px solid rgba(255,255,255,.075);background:#000;}
    .lthc-attachments{max-width:1060px;margin:0 auto 8px;display:none;flex-wrap:wrap;gap:6px;}
    .lthc-attachments.show{display:flex;}
    .lthc-chip{position:relative;width:56px;height:56px;border-radius:8px;overflow:hidden;border:1px solid rgba(24,213,255,.3);background:#0a0a0a;}
    .lthc-chip img{width:100%;height:100%;object-fit:cover;}
    .lthc-chip .x{position:absolute;top:1px;right:1px;width:16px;height:16px;line-height:15px;text-align:center;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;font-size:11px;cursor:pointer;border:none;}
    .lthc-attach-btn{border:1px solid rgba(255,255,255,.16);background:#090a0c;color:#ccefff;border-radius:10px;width:88px;height:44px;padding:0 12px;font-size:12px;font-weight:800;cursor:pointer;display:grid;place-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.055);}
    .lthc-attach-btn:hover{border-color:rgba(24,213,255,.34);background:#0d1114;color:#e3f7ff;}
    .lthc-attach-btn:disabled{opacity:.5;cursor:default;}
    .lthc-inputrow{max-width:1060px;margin:0 auto;display:grid;grid-template-columns:88px minmax(220px,1fr)96px;gap:8px;align-items:center;}
    .lthc-input{width:100%;resize:none;min-height:44px;height:44px;max-height:132px;background:#050506;color:#eef7ff;border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:11px 14px;font-size:13px;font-family:inherit;line-height:1.45;box-shadow:inset 0 1px 0 rgba(255,255,255,.035);}
    .lthc-input::placeholder{color:rgba(231,246,255,.4);}
    .lthc-input:focus{outline:none;border-color:rgba(178,74,255,.62);box-shadow:0 0 0 2px rgba(178,74,255,.16),0 0 18px rgba(178,74,255,.16),inset 0 1px 0 rgba(255,255,255,.05);}
    .lthc-foot{position:relative;}
    .lthc-cmdpanel{position:absolute;left:10px;bottom:calc(100% + 8px);width:300px;max-height:270px;overflow:auto;background:#0a0a10;border:1px solid rgba(178,74,255,.35);border-radius:12px;padding:8px;z-index:40;box-shadow:0 12px 34px rgba(0,0,0,.55);}
    .lthc-cmdpanel .ttl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(231,246,255,.45);padding:2px 8px 8px;}
    .lthc-cmdpanel .cmd{display:grid;grid-template-columns:auto 1fr auto;gap:2px 10px;width:100%;text-align:left;background:transparent;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;color:#eef7ff;font-family:inherit;}
    .lthc-cmdpanel .cmd:hover,.lthc-cmdpanel .cmd.sel{background:rgba(178,74,255,.14);}
    .lthc-cmdpanel .cmd .name{font-size:12px;color:#c98bff;font-weight:600;}
    .lthc-cmdpanel .cmd .lbl{font-size:12px;}
    .lthc-cmdpanel .cmd .st{font-size:10px;font-weight:700;color:rgba(231,246,255,.4);align-self:center;}
    .lthc-cmdpanel .cmd .st.on{color:#7dffb1;}
    .lthc-cmdpanel .cmd .desc{grid-column:1 / -1;font-size:11px;color:rgba(231,246,255,.55);}
    .lthc-parallel{max-width:78%;margin:10px 0;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,rgba(178,74,255,.12),rgba(94,44,165,.07));border:1px solid rgba(178,74,255,.5);box-shadow:0 0 22px rgba(178,74,255,.12);}
    .lthc-parallel .hd{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#c98bff;font-weight:700;margin-bottom:8px;}
    .lthc-parallel .hd .pulse{width:8px;height:8px;border-radius:50%;background:#b24aff;animation:lthcParPulse 1.1s ease-in-out infinite;flex:none;}
    .lthc-parallel.done{border-color:rgba(125,255,177,.4);box-shadow:none;}
    .lthc-parallel.done .hd{color:#7dffb1;}
    .lthc-parallel.done .hd .pulse{animation:none;background:#7dffb1;}
    .lthc-parallel .lane{display:block;padding:7px 10px;border-left:2px solid rgba(178,74,255,.6);margin:5px 0;font-size:12px;color:#e7f6ff;background:rgba(0,0,0,.25);border-radius:0 8px 8px 0;}
    .lthc-parallel .lane .who{color:#c98bff;font-weight:600;margin-right:6px;}
    .lthc-parallel .lane.done{border-left-color:#7dffb1;}
    .lthc-parallel .lane.done .who{color:#7dffb1;}
    .lthc-parallel .lane .res{display:block;font-size:11px;color:rgba(231,246,255,.6);margin-top:3px;}
    @keyframes lthcParPulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
    .lthc-btn{border:1px solid rgba(194,86,255,.72);border-radius:10px;width:96px;height:44px;padding:0 14px;font-size:13px;font-weight:900;cursor:pointer;color:#f4ddff;background:linear-gradient(180deg,#2a123d 0%,#21102f 100%);box-shadow:0 0 18px rgba(183,74,255,.44),inset 0 1px 0 rgba(255,255,255,.13);transition:transform .12s ease,background .12s ease,box-shadow .12s ease,border-color .12s ease;}
    .lthc-btn:hover{background:linear-gradient(180deg,#35154f 0%,#28123a 100%);border-color:rgba(216,125,255,.9);box-shadow:0 0 22px rgba(190,82,255,.58),inset 0 1px 0 rgba(255,255,255,.16);}
    .lthc-btn:active{transform:translateY(1px);}
    .lthc-btn:disabled{opacity:.48;cursor:default;box-shadow:0 0 12px rgba(183,74,255,.22),inset 0 1px 0 rgba(255,255,255,.09);}
    .lthc-btn.stop{color:#ffe7c7;border-color:rgba(255,137,32,.76);background:linear-gradient(180deg,#3b1904 0%,#2b1104 100%);box-shadow:0 0 18px rgba(255,122,25,.5),inset 0 1px 0 rgba(255,255,255,.13);}
    .lthc-btn.stop:hover{background:linear-gradient(180deg,#4b2107 0%,#361606 100%);border-color:rgba(255,173,75,.92);box-shadow:0 0 24px rgba(255,129,27,.68),inset 0 1px 0 rgba(255,255,255,.16);}
    .lthc-empty{margin:auto;text-align:center;color:rgba(231,246,255,.5);font-size:13.5px;max-width:480px;padding:24px;}
    .lthc-empty h3{color:#bfe9ff;font-size:18px;margin:0 0 8px;}
    .lthc-empty .paths{margin-top:12px;font-size:12px;color:rgba(231,246,255,.4);}
    /* Modal de permisos */
    .lthc-perm-back{position:absolute;inset:0;background:rgba(0,0,0,.76);backdrop-filter:blur(5px) saturate(1.08);display:flex;align-items:center;justify-content:center;z-index:50;}
    .lthc-perm{width:min(392px,88%);background:linear-gradient(180deg,rgba(6,9,12,.97),rgba(3,4,7,.97));border:1px solid rgba(24,213,255,.38);border-radius:13px;padding:17px 18px 18px;box-shadow:0 18px 48px rgba(0,0,0,.68),0 0 0 1px rgba(177,74,255,.08),0 0 30px rgba(24,213,255,.12);}
    .lthc-perm h4{margin:0 0 5px;font-size:13px;line-height:1.2;color:#d9f7ff;text-transform:uppercase;letter-spacing:.08em;text-shadow:0 0 14px rgba(24,213,255,.28);}
    .lthc-perm .reason{font-size:12px;color:rgba(231,246,255,.58);margin:0 0 11px;}
    .lthc-perm pre{background:rgba(0,0,0,.55);border:1px solid rgba(177,74,255,.22);border-radius:9px;padding:9px 11px;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.45;color:#d7f8ff;white-space:pre-wrap;word-break:break-word;margin:0 0 13px;max-height:132px;overflow:auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.035);}
    .lthc-perm-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
    .lthc-perm-actions button{height:38px;border-radius:9px;padding:0 10px;font-size:11.5px;font-weight:800;letter-spacing:.02em;cursor:pointer;border:1px solid rgba(255,255,255,.13);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease;color:#eafaff;}
    .lthc-perm-actions button:hover{transform:translateY(-1px);}
    /* Modal de integraciones */
    .lthc-integ{width:min(520px,92%);max-height:80%;overflow:auto;background:#080808;border:1px solid rgba(24,213,255,.28);border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.7);}
    .lthc-integ h4{margin:0 0 4px;font-size:16px;color:#bfe9ff;}
    .lthc-integ .sub{font-size:12px;color:rgba(231,246,255,.5);margin:0 0 14px;}
    .lthc-integ .list{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
    .lthc-integ .row{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:8px 10px;}
    .lthc-integ .row .n{flex:1;min-width:0;}
    .lthc-integ .row .n b{color:#bfe9ff;font-size:13px;}
    .lthc-integ .row .n span{display:block;font-size:11px;color:rgba(231,246,255,.5);font-family:ui-monospace,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .lthc-integ .row button{border:1px solid rgba(255,154,154,.4);background:rgba(255,154,154,.08);color:#ff9a9a;border-radius:7px;padding:4px 9px;font-size:11px;font-weight:800;cursor:pointer;}
    .lthc-integ form{display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px;}
    .lthc-integ input{background:#0a0a0a;color:#e7f6ff;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:9px 11px;font-size:13px;}
    .lthc-integ input:focus{outline:none;border-color:rgba(24,213,255,.5);}
    .lthc-integ .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
    .lthc-integ .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:4px;}
    .lthc-integ .acts button{border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:800;cursor:pointer;border:none;}
    .lthc-integ .acts .save{background:linear-gradient(135deg,#18d5ff,#0b7f6b);color:#04121f;}
    .lthc-integ .acts .close{background:rgba(255,255,255,.08);color:#e7f6ff;border:1px solid rgba(255,255,255,.14);}
    .lthc-integ .hint{font-size:11px;color:rgba(126,240,192,.75);}
    .lthc-integ .reco{display:flex;flex-direction:column;gap:6px;margin:6px 0;}
    .reco-card{display:flex;align-items:center;gap:10px;text-align:left;background:rgba(62,207,142,.08);border:1px solid rgba(62,207,142,.3);border-radius:10px;padding:9px 11px;cursor:pointer;color:#e7f6ff;}
    .reco-card:hover{border-color:rgba(62,207,142,.6);background:rgba(62,207,142,.14);}
    .reco-card .lg{width:22px;height:22px;display:grid;place-items:center;flex:none;}
    .reco-card .tx{display:flex;flex-direction:column;min-width:0;}
    .reco-card .tx b{font-size:13px;color:#bfe9ff;}
    .reco-card .tx i{font-size:11px;color:rgba(231,246,255,.5);font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .lthc-perm .allow{background:linear-gradient(135deg,rgba(177,74,255,.26),rgba(24,213,255,.2));border-color:rgba(24,213,255,.62);box-shadow:0 0 18px rgba(24,213,255,.12),inset 0 1px 0 rgba(255,255,255,.08);color:#dff9ff;}
    .lthc-perm .always{background:rgba(126,240,192,.1);border-color:rgba(126,240,192,.38);color:#7ef0c0;box-shadow:0 0 16px rgba(126,240,192,.08);}
    .lthc-perm .deny{background:rgba(255,111,145,.08);border-color:rgba(255,111,145,.28);color:#ff9ab1;}
  `;

  function ensureCss() {
    if (document.getElementById('lthc-css')) return;
    const s = document.createElement('style');
    s.id = 'lthc-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function baseName(p) {
    const s = String(p || '').replace(/[\\/]+$/, '');
    const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    return i >= 0 ? s.slice(i + 1) : s;
  }  // Proyectos recientes (persistidos en localStorage)
  function readRecents() {
    try { const a = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch { return []; }
  }
  function pushRecent(path, name) {
    if (!path) return readRecents();
    let list = readRecents().filter((r) => r.path !== path);
    list.unshift({ path, name: name || baseName(path) });
    list = list.slice(0, 12);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(list)); } catch {}
    return list;
  }

  const TOOL_ICON = { bash: 'SH', bash_bg: 'BG', stop_bg: 'STOP', open_path: 'OPEN', read: 'RD', write: 'WR', ls: 'LS', glob: 'GL', grep: 'GR', edit: 'ED', web_search: 'WEB', web_fetch: 'WEB', memory: 'MEM', map: 'MAP', register_change: 'ID', todo: 'TODO', subagent: 'SUB', sql: 'SQL', skill: 'SKL', api: 'API' };

  async function render(container) {
    ensureCss();
    const auth = window.LTHAuth || null;
    const fsApi = window.electron?.fs || null;

    container.innerHTML = `
      <div class="lthc-root">
        <div class="lthc-head">
          <div class="lthc-mark">${APP_HEAD_ICON}</div>
          <div class="lthc-title">
            <h2>LTH Code</h2>
            <p data-cwd>Motor v2 - Fase 3</p>
          </div>
          <div class="lthc-proj">
            <select data-projects title="Proyecto"></select>
            <button class="lthc-pill" data-open type="button" title="Abrir una carpeta existente">Abrir...</button>
            <button class="lthc-pill" data-newproj type="button" title="Crear un proyecto nuevo">Nuevo...</button>
          </div>
          <div class="lthc-modes">
            <button class="lthc-pill toggle" data-mode="auto" type="button" title="Loop autonomo con herramientas de Fase 3">Auto</button>
            <button class="lthc-pill toggle" data-mode="plan" type="button" title="Planificacion y permisos de Fase 3">Plan</button>
            <button class="lthc-pill toggle" data-mode="mind" type="button" title="Memoria narrativa: recuerda en que quedamos, retoma planes y aprende tus preferencias. Se auto-limpia.">Mente</button>
            <button class="lthc-pill lthc-integrations" data-integrations type="button" title="Conectar servicios que LTH Code puede ejecutar">Integraciones</button>
          </div>
          <select class="lthc-pill model" data-model title="Perfil del motor"><option value="little">LTH Mini</option><option value="custom">LTH Custom</option><option value="pro">LTH Pro</option></select>
          <div class="lthc-pill static" data-status>iniciando</div>
        </div>
        <div class="lthc-usage" data-usage></div>
        <div class="lthc-agents" data-agents><span class="dot"></span><span class="txt"></span><ul class="jobs"></ul></div>
        <div class="lthc-todos" data-todos><h4>Plan</h4><ul></ul></div>
        <div class="lthc-thread-wrap">
          <div class="lthc-thread" data-thread>
            <div class="lthc-empty" data-empty>
              <h3>Motor v2 conectado</h3>
              Fase 3 activa: agente regulado, Supabase y memoria segura.
              Prueba: lista archivos, leer package.json o buscar "texto".
              <div class="paths">Usa <b>Abrir...</b> para trabajar sobre una carpeta existente o <b>Nuevo...</b> para crear un proyecto desde cero.</div>
            </div>
          </div>
          <button class="lthc-jump" data-jump type="button">v <span data-jump-count>0</span> mensaje(s) nuevo(s)</button>
        </div>
        <div class="lthc-procs" data-procs></div>
        <div class="lthc-foot">
          <div class="lthc-cmdpanel" data-cmdpanel hidden></div>
          <div class="lthc-attachments" data-attachments></div>
          <div class="lthc-inputrow">
            <button class="lthc-attach-btn" data-attach type="button" title="Adjuntar imagen (o pega/arrastra)">Adjuntar</button>
            <textarea class="lthc-input" data-input placeholder="Pide cambios, ediciones o consultas... (escribe / para comandos)"></textarea>
            <button class="lthc-btn" data-send type="button" disabled>Enviar</button>
          </div>
          <input type="file" data-file accept="image/*" multiple style="display:none">
        </div>
      </div>`;

    const root = container.querySelector('.lthc-root');
    const thread = container.querySelector('[data-thread]');
    const jumpBtn = container.querySelector('[data-jump]');
    const jumpCount = container.querySelector('[data-jump-count]');
    const empty = container.querySelector('[data-empty]');
    const input = container.querySelector('[data-input]');
    const sendBtn = container.querySelector('[data-send]');
    const statusPill = container.querySelector('[data-status]');
    const cwdLabel = container.querySelector('[data-cwd]');
    const projSelect = container.querySelector('[data-projects]');
    const openBtn = container.querySelector('[data-open]');
    const newProjBtn = container.querySelector('[data-newproj]');
    const todosBox = container.querySelector('[data-todos]');
    const agentsBox = container.querySelector('[data-agents]');
    const usageBox = container.querySelector('[data-usage]');
    const procsBox = container.querySelector('[data-procs]');
    const autoBtn = container.querySelector('[data-mode="auto"]');
    const planBtn = container.querySelector('[data-mode="plan"]');
    const mindBtn = container.querySelector('[data-mode="mind"]');
    const integrationsBtn = container.querySelector('[data-integrations]');
    const modelSelect = container.querySelector('[data-model]');
    const attachBox = container.querySelector('[data-attachments]');
    const attachBtn = container.querySelector('[data-attach]');
    const fileInput = container.querySelector('[data-file]');
    const cmdPanel = container.querySelector('[data-cmdpanel]');
    const procsMap = new Map();
    let pendingImages = [];   // { dataUrl, name }

    const code = window.electron?.code;
    if (!code) {
      statusPill.textContent = 'no disponible';
      statusPill.className = 'lthc-pill static err';
      empty.innerHTML = '<h3>Motor no disponible</h3>LTH Code necesita ejecutarse dentro de LTH OS (Electron).';
      return;
    }

    let sessionId = null;
    let busy = false;
    let lastToolOut = null;
    const MAX_TOOL_OUTPUT_CHARS = 7000;
    let unsub = null;
    let unsubAuth = null;
    let accessOk = false;
    let started = false;
    let liveThink = null;      // burbuja de "pensando" en vivo (por paso)
    let thinkingEl = null;     // indicador estable mientras no hay evento visible
    let thinkBuf = '';         // buffer de tokens del paso actual
    let streamedThoughtShown = false; // ya mostramos el thought en vivo -> no duplicar
    let autoMode = false;      // ejecuta sin pedir permiso
    let planMode = false;      // planea sin modificar hasta aprobar
    let smartMind = false;     // memoria narrativa: recuerda el hilo y aprende preferencias
    let parallelMode = false;  // modelos en paralelo: la IA despacha 1-3 editores a la vez
    const MODEL_PROFILE_ORDER = ['little', 'custom', 'pro'];
    const normalizeModelProfile = (profile) => {
      const normalized = String(profile || 'little').trim().toLowerCase();
      return MODEL_PROFILE_ORDER.includes(normalized) ? normalized : 'little';
    };
    let modelProfile = 'little';   // perfil de modelo: little (default) | custom | pro
    try { modelProfile = normalizeModelProfile(localStorage.getItem('lthcode.modelProfile') || 'little'); } catch {}
    let clearTodosOnNextUserRequest = false;
    let lastTodosComplete = false;
    let usageMeter = { calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimatedCredits: 0, rows: [] };
    let usagePanelVisible = false;
    let usageShortcutPrimedAt = 0;
    const showUndoButton = false; // checkpoint interno activo, boton oculto por preferencia del usuario
    try {
      const m = JSON.parse(localStorage.getItem('lthcode.modes') || '{}');
      autoMode = m.auto === true; planMode = m.plan === true; smartMind = m.mind === true; parallelMode = m.parallel === true;
    } catch {}

    function setStatus(text, cls) {
      statusPill.textContent = text;
      statusPill.className = 'lthc-pill static' + (cls ? ' ' + cls : '');
    }
    function setBusy(v) {
      busy = v;
      sendBtn.textContent = v ? 'Detener' : 'Enviar';
      sendBtn.classList.toggle('stop', v);
      sendBtn.disabled = v ? false : !input.value.trim();
      setStatus(v ? 'trabajando' : 'listo', v ? 'busy' : 'ok');
    }
    async function sendToEngine(text, errorPrefix = 'No se pudo enviar') {
      try {
        const response = await code.sendMessage({ sessionId, text });
        if (response?.success) return true;
        if (Number(response?.status || 0) === 401 || response?.signedIn === false) {
          revokeAccess(response?.error);
        } else {
          clearWorkIndicators();
          addNote(`${errorPrefix}: ${response?.error || 'error del motor'}`, true);
          setBusy(false);
        }
        return false;
      } catch (error) {
        clearWorkIndicators();
        addNote(`${errorPrefix}: ${error?.message || error}`, true);
        setBusy(false);
        return false;
      }
    }    // Auto-scroll pegajoso (estilo Claude Code)
    // Mientras el usuario no toque el hilo, seguimos pegados abajo para que vea
    // en vivo lo que llega por streaming. En cuanto desliza hacia arriba, dejamos de
    // saltarlo abajo (para que pueda leer en paz) y avisamos con una pildora
    // "N mensajes nuevos" cuantos mensajes se agregaron mientras tanto. Al volver
    // cerca del final (o tocar la pildora) se reengancha solo.
    let stickToBottom = true;
    let unseenCount = 0;
    const NEAR_BOTTOM_PX = 72;
    function isNearBottom() { return thread.scrollHeight - thread.scrollTop - thread.clientHeight < NEAR_BOTTOM_PX; }
    function updateJumpPill() {
      const show = unseenCount > 0 && !stickToBottom;
      jumpBtn.classList.toggle('show', show);
      if (show) jumpCount.textContent = unseenCount > 9 ? '9+' : String(unseenCount);
    }
    function goToBottom() {
      stickToBottom = true;
      unseenCount = 0;
      updateJumpPill();
      thread.scrollTop = thread.scrollHeight;
    }
    function resetStick() { stickToBottom = true; unseenCount = 0; updateJumpPill(); }
    jumpBtn.addEventListener('click', goToBottom);
    thread.addEventListener('scroll', () => {
      if (isNearBottom()) {
        if (!stickToBottom) { stickToBottom = true; unseenCount = 0; updateJumpPill(); }
      } else if (stickToBottom) {
        stickToBottom = false;
      }
    });
    // Cuenta mensajes NUEVOS de verdad (nodos agregados al hilo), no cada token
    // de streaming: el pensamiento en vivo reutiliza el mismo nodo, asi que no
    // infla el contador mientras entra texto.
    new MutationObserver((mutations) => {
      if (stickToBottom) return;
      let added = 0;
      for (const m of mutations) added += m.addedNodes.length;
      if (added > 0) { unseenCount += added; updateJumpPill(); }
    }).observe(thread, { childList: true });

    function scroll() { if (stickToBottom) thread.scrollTop = thread.scrollHeight; }
    function clearEmpty() { if (empty && empty.parentNode) empty.remove(); }

    function addUser(text) { clearEmpty(); const el = document.createElement('div'); el.className = 'lthc-msg lthc-user'; el.textContent = text; thread.appendChild(el); scroll(); }
    function mdLite(text) {
      let h = esc(text);
      h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
      return h;
    }
    function addAssistant(text) { const el = document.createElement('div'); el.className = 'lthc-msg lthc-assistant'; el.innerHTML = mdLite(text); thread.appendChild(el); scroll(); }
    function addThought(text) { if (!text) return; const el = document.createElement('div'); el.className = 'lthc-msg lthc-thought'; el.textContent = '- ' + text; thread.appendChild(el); scroll(); }
    function addNote(text, isErr) { const el = document.createElement('div'); el.className = 'lthc-msg lthc-note' + (isErr ? ' err' : ''); el.textContent = text; thread.appendChild(el); scroll(); }
    function showThinking() {
      clearEmpty();
      if (thinkingEl && thinkingEl.isConnected) return;
      thinkingEl = document.createElement('div');
      thinkingEl.className = 'lthc-msg lthc-thinking';
      thinkingEl.innerHTML = '<span class="orb"></span><span class="label">Pensando<span class="dots"><i></i><i></i><i></i></span></span>';
      thread.appendChild(thinkingEl);
      scroll();
    }
    function clearThinking() {
      if (thinkingEl) {
        try { thinkingEl.remove(); } catch {}
        thinkingEl = null;
      }
    }
    function fmtInt(value) {
      const n = Math.max(0, Math.round(Number(value) || 0));
      try { return n.toLocaleString('en-US'); } catch { return String(n); }
    }
    function fmtCredits(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(2) : '--';
    }
    function shortModel(model) {
      const s = String(model || '').trim();
      if (!s) return 'modelo';
      const i = s.lastIndexOf('/');
      return i >= 0 ? s.slice(i + 1) : s;
    }
    function resetUsageMeter() {
      usageMeter = { calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimatedCredits: 0, rows: [] };
      if (usageBox) renderUsageMeter();
    }
    function setUsagePanelVisible(nextVisible) {
      usagePanelVisible = nextVisible === true;
      renderUsageMeter();
    }
    function renderUsageMeter() {
      if (!usageBox) return;
      if (!usagePanelVisible) {
        usageBox.classList.remove('show');
        usageBox.innerHTML = '';
        return;
      }
      usageBox.classList.add('show');
      if (!usageMeter.calls) {
        usageBox.innerHTML = `
          <div class="lthc-usage-head">
            <div class="lthc-usage-title">
              <b>Telemetria de llamadas</b>
              <span>Atajo: Ctrl+P, luego V</span>
            </div>
            <button class="lthc-usage-close" data-usage-close type="button" title="Ocultar panel">X</button>
          </div>
          <div class="lthc-usage-empty">Aun no hay llamadas registradas en esta sesion.</div>`;
        usageBox.querySelector('[data-usage-close]')?.addEventListener('click', () => setUsagePanelVisible(false));
        return;
      }
      const rows = usageMeter.rows.map((row) => {
        const transportTag = row.transportMode === 'fallback_no_stream'
          ? 'fallback'
          : (row.transportMode === 'stream' ? 'stream' : 'json');
        const cls = row.ok
          ? ((row.inputTokens >= 20000 || row.estimatedInputTokens >= 20000 || row.transportMode === 'fallback_no_stream') ? ' warn' : '')
          : ' err';
        const inputShown = row.inputTokens || row.estimatedInputTokens || 0;
        const outputShown = row.outputTokens || 0;
        const freshInput = Math.max(0, inputShown - row.cachedTokens);
        const cacheShown = row.cachedTokens > 0 ? ` / total ${fmtInt(inputShown)} (cache ${fmtInt(row.cachedTokens)})` : '';
        const creditShown = row.walletDelta != null ? row.walletDelta : row.estimatedCredits;
        const tag = row.silent ? 'interna' : 'visible';
        const title = [row.model || '', row.fallbackReason || ''].filter(Boolean).join('\n');
        return `
          <div class="lthc-usage-row${cls}" title="${esc(title)}">
            <span class="idx">#${fmtInt(row.callIndex)}</span>
            <span class="main">${esc(shortModel(row.model))} - in fresco ${fmtInt(freshInput)}${cacheShown} / out ${fmtInt(outputShown)} - ${esc(tag)} / ${esc(transportTag)}</span>
            <span class="meta">${fmtCredits(creditShown)} cr - ${fmtInt(row.elapsedMs)}ms</span>
          </div>`;
      }).join('');
      usageBox.innerHTML = `
        <div class="lthc-usage-head">
          <div class="lthc-usage-title">
            <b>Telemetria de llamadas</b>
            <span>Atajo: Ctrl+P, luego V</span>
          </div>
          <button class="lthc-usage-close" data-usage-close type="button" title="Ocultar panel">X</button>
        </div>
        <div class="lthc-usage-inner">
          <div class="lthc-usage-summary">
            <div class="lthc-usage-kpi"><b>Llamadas</b><span>${fmtInt(usageMeter.calls)}</span></div>
            <div class="lthc-usage-kpi"><b>Input</b><span>${fmtInt(usageMeter.inputTokens)}</span></div>
            ${usageMeter.cachedTokens > 0 ? `<div class="lthc-usage-kpi"><b>Input fresco</b><span>${fmtInt(Math.max(0, usageMeter.inputTokens - usageMeter.cachedTokens))}</span></div>` : ''}
            ${usageMeter.cachedTokens > 0 ? `<div class="lthc-usage-kpi"><b>Cache</b><span>${fmtInt(usageMeter.cachedTokens)}</span></div>` : ''}
            <div class="lthc-usage-kpi"><b>Output</b><span>${fmtInt(usageMeter.outputTokens)}</span></div>
            <div class="lthc-usage-kpi"><b>Creditos est.</b><span>${fmtCredits(usageMeter.estimatedCredits)}</span></div>
          </div>
          <div class="lthc-usage-rows">${rows}</div>
        </div>`;
      usageBox.querySelector('[data-usage-close]')?.addEventListener('click', () => setUsagePanelVisible(false));
    }
    function applyUsageEvent(e) {
      const totals = e?.totals || {};
      usageMeter.calls = Math.max(usageMeter.calls, Number(totals.calls || e.callIndex || 0) || 0);
      usageMeter.inputTokens = Math.max(0, Number(totals.inputTokens ?? (usageMeter.inputTokens + Number(e.inputTokens || 0))) || 0);
      usageMeter.outputTokens = Math.max(0, Number(totals.outputTokens ?? (usageMeter.outputTokens + Number(e.outputTokens || 0))) || 0);
      usageMeter.cachedTokens = Math.max(0, Number(totals.cachedTokens ?? (usageMeter.cachedTokens + Number(e.cachedTokens || 0))) || 0);
      usageMeter.estimatedCredits = Math.max(0, Number(totals.estimatedCredits ?? (usageMeter.estimatedCredits + Number(e.estimatedCredits || 0))) || 0);
      usageMeter.rows.unshift({
        callIndex: e.callIndex,
        ok: e.ok !== false,
        silent: e.silent === true,
        model: e.model || '',
        transportMode: String(e.transportMode || '').trim().toLowerCase() || 'unknown',
        fallbackReason: e.fallbackReason || '',
        inputTokens: Number(e.inputTokens || 0) || 0,
        outputTokens: Number(e.outputTokens || 0) || 0,
        cachedTokens: Number(e.cachedTokens || 0) || 0,
        estimatedInputTokens: Number(e.estimatedInputTokens || 0) || 0,
        estimatedCredits: Number(e.estimatedCredits || 0) || null,
        walletDelta: e.walletDelta == null ? null : Number(e.walletDelta),
        elapsedMs: Number(e.elapsedMs || 0) || 0
      });
      usageMeter.rows = usageMeter.rows.slice(0, 14);
      renderUsageMeter();
    }
    function isAppFocused() {
      const win = root.closest('.wm-win');
      return !win || win.classList.contains('focused');
    }
    function onGlobalKeydown(ev) {
      if (!isAppFocused()) return;
      const key = String(ev.key || '').toLowerCase();
      const combo = ev.ctrlKey || ev.metaKey;
      if (combo && !ev.altKey && !ev.shiftKey && key === 'p') {
        usageShortcutPrimedAt = Date.now();
        ev.preventDefault();
        return;
      }
      if (key === 'v' && (Date.now() - usageShortcutPrimedAt) <= 1500) {
        usageShortcutPrimedAt = 0;
        ev.preventDefault();
        if (!usagePanelVisible) setUsagePanelVisible(true);
        return;
      }
      if (!['control', 'meta', 'shift', 'alt'].includes(key)) usageShortcutPrimedAt = 0;
    }
    function addContinuationWait(e) {
      clearEmpty();
      const wrap = document.createElement('div');
      wrap.className = 'lthc-msg lthc-cont';
      const delay = Math.max(0, Number(e?.retryAfterMs || 0));
      const waitText = delay ? ` Puede reintentarse en ${Math.ceil(delay / 1000)}s.` : '';
      const message = String(e?.message || 'La ventana temporal se agoto antes de cerrar el turno.') + waitText;
      wrap.innerHTML = `
        <div class="t">Continuidad guardada</div>
        <div class="d">${esc(message)} Puedes continuar cuando se restablezca o parar aqui y retomarlo luego escribiendo "continua".</div>
        <div class="lthc-cont-actions">
          <button type="button" class="resume">Continuar</button>
          <button type="button" class="stop">Parar aqui</button>
        </div>`;
      const resume = wrap.querySelector('.resume');
      const stop = wrap.querySelector('.stop');
      let resumeCancelled = false;
      const resumeFromCheckpoint = () => {
        if (!sessionId) return;
        resume.disabled = true;
        resumeCancelled = false;
        stop.disabled = false;
        resume.textContent = delay ? 'Esperando...' : 'Continuando...';
        const run = async () => {
          if (resumeCancelled) return;
          if (busy) { setTimeout(run, 600); return; }
          wrap.remove();
          addUser('Continua desde donde te quedaste.');
          setBusy(true);
          await sendToEngine(
            'continua desde el checkpoint de continuidad. Usa la memoria reciente y avanza solo desde el paso pendiente; no reanalices todo.',
            'No se pudo continuar'
          );
        };
        setTimeout(run, delay);
      };
      resume.addEventListener('click', resumeFromCheckpoint);
      stop.addEventListener('click', () => {
        resumeCancelled = true;
        wrap.remove();
        addNote('Continuidad guardada. Puedes escribir "continua" cuando quieras retomarlo.');
      });
      thread.appendChild(wrap); scroll();
    }
    function addTool(tool, label) {
      const card = document.createElement('div');
      card.className = 'lthc-msg lthc-tool';
      card.innerHTML = `
        <div class="lthc-tool-head">
          <span class="lthc-tool-ico">${TOOL_ICON[tool] || '*'}</span>
          <span class="lthc-tool-label">${esc(label || tool)}</span>
          <span class="lthc-tool-status">...</span>
        </div>
        <pre class="lthc-tool-out"></pre>`;
      thread.appendChild(card); scroll();
      lastToolOut = { pre: card.querySelector('.lthc-tool-out'), status: card.querySelector('.lthc-tool-status') };
      return lastToolOut;
    }

    function appendToolOutput(text, stream) {
      if (!lastToolOut) return;
      const current = lastToolOut.pre.textContent || '';
      const incoming = String(text || '');
      if (current.length >= MAX_TOOL_OUTPUT_CHARS) return;
      const remaining = MAX_TOOL_OUTPUT_CHARS - current.length;
      const span = document.createElement('span');
      if (stream === 'stderr') span.className = 'err';
      else if (stream === 'add') span.className = 'add';
      else if (stream === 'del') span.className = 'del';
      span.textContent = incoming.length > remaining
        ? incoming.slice(0, remaining) + '\n... salida recortada para mantener la vista limpia\n'
        : incoming;
      lastToolOut.pre.appendChild(span);
      lastToolOut.pre.scrollTop = lastToolOut.pre.scrollHeight;
    }

    // Extrae en vivo el valor del campo "thought" mientras el JSON se va tecleando.
    function liveThoughtText(buf) {
      const m = /"thought"\s*:\s*"/.exec(buf);
      if (!m) return '';
      let out = '', esc = false;
      for (let i = m.index + m[0].length; i < buf.length; i += 1) {
        const ch = buf[i];
        if (esc) { out += (ch === 'n' || ch === 't' ? ' ' : ch); esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') break;
        out += ch;
      }
      return out;
    }
    function clearLiveThink() { if (liveThink) { liveThink.remove(); liveThink = null; } thinkBuf = ''; }
    function clearWorkIndicators() { clearThinking(); clearLiveThink(); }    // Panel de procesos en segundo plano
    function clearProcs() { procsMap.clear(); procsBox.innerHTML = ''; procsBox.classList.remove('show'); }
    function addProc(procId, command) {
      procsBox.classList.add('show');
      const card = document.createElement('div');
      card.className = 'lthc-proc';
      card.innerHTML = `
        <div class="lthc-proc-head">
          <span class="lthc-proc-cmd" title="${esc(command)}">BG ${esc(command)}</span>
          <span class="lthc-proc-st">corriendo</span>
          <button class="lthc-proc-stop" type="button">Detener</button>
        </div>
        <pre class="lthc-proc-log"></pre>`;
      procsBox.appendChild(card);
      const st = card.querySelector('.lthc-proc-st');
      const log = card.querySelector('.lthc-proc-log');
      const stop = card.querySelector('.lthc-proc-stop');
      stop.addEventListener('click', () => { stop.disabled = true; st.textContent = 'deteniendo...'; try { code.stopProcess({ sessionId, procId }); } catch {} });
      procsMap.set(procId, { card, st, log, stop });
    }
    function procOutput(procId, stream, text) {
      const p = procsMap.get(procId);
      if (!p) return;
      const span = document.createElement('span');
      if (stream === 'stderr') span.className = 'err';
      span.textContent = text;
      p.log.appendChild(span);
      // Limitar nodos para no crecer sin fin.
      while (p.log.childNodes.length > 400) p.log.removeChild(p.log.firstChild);
      p.log.scrollTop = p.log.scrollHeight;
    }
    function procExit(procId, code) {
      const p = procsMap.get(procId);
      if (!p) return;
      p.st.textContent = 'terminado (exit ' + code + ')';
      p.st.classList.add('dead');
      p.stop.disabled = true;
      setTimeout(() => {
        const cur = procsMap.get(procId);
        if (!cur || cur.card !== p.card) return;
        p.card.remove();
        procsMap.delete(procId);
        if (!procsMap.size) procsBox.classList.remove('show');
      }, 8000);
    }

    function renderTodos(items) {
      const ul = todosBox.querySelector('ul');
      if (!Array.isArray(items) || !items.length) { lastTodosComplete = false; todosBox.classList.remove('show'); ul.innerHTML = ''; return; }
      const mark = { pending: '', in_progress: '', completed: '' };
      const cls = { pending: '', in_progress: 'doing', completed: 'done' };
      ul.innerHTML = items.map((it) =>
        `<li class="${cls[it.status] || ''}"><span class="m">${mark[it.status] || ''}</span><span>${esc(it.content)}</span></li>`
      ).join('');
      lastTodosComplete = items.length > 0 && items.every((it) => it && it.status === 'completed');
      todosBox.classList.add('show');
    }

    function clearTodosNotification() {
      const ul = todosBox.querySelector('ul');
      lastTodosComplete = false;
      todosBox.classList.remove('show');
      if (ul) ul.innerHTML = '';
    }

    // Señal de trabajo en paralelo: subagentes activos (id -> descripcion).
    const activeAgents = new Map();
    function renderAgents() {
      if (!agentsBox) return;
      const n = activeAgents.size;
      if (n <= 0) { agentsBox.classList.remove('show'); return; }
      const txt = agentsBox.querySelector('.txt');
      const jobs = agentsBox.querySelector('.jobs');
      if (txt) txt.textContent = n === 1 ? '1 subagente trabajando' : `${n} subagentes trabajando en paralelo`;
      if (jobs) jobs.innerHTML = [...activeAgents.values()].map((d) => `<li>${esc(d || 'subtarea')}</li>`).join('');
      agentsBox.classList.add('show');
    }
    function agentStart(ev) {
      const id = ev.subId || `sub-${activeAgents.size + 1}`;
      activeAgents.set(id, ev.description || 'subtarea');
      renderAgents();
    }
    function agentEnd(ev) {
      if (ev.subId) activeAgents.delete(ev.subId);
      else { const first = activeAgents.keys().next().value; if (first) activeAgents.delete(first); }
      renderAgents();
    }

    function askPermission(ev) {
      const back = document.createElement('div');
      back.className = 'lthc-perm-back';
      back.innerHTML = `
        <div class="lthc-perm">
          <h4>Permiso requerido</h4>
          <p class="reason">${esc(ev.tool)} - ${esc(ev.reason || 'requiere confirmacion')}</p>
          <pre>${esc(ev.summary || ev.tool)}</pre>
          <div class="lthc-perm-actions">
            <button class="allow" data-d="allow">Permitir</button>
            <button class="always" data-d="always">Siempre</button>
            <button class="deny" data-d="deny">Rechazar</button>
          </div>
        </div>`;
      root.appendChild(back);
      const decide = (decision) => { try { code.respondPermission({ requestId: ev.requestId, decision }); } catch {} back.remove(); };
      back.querySelectorAll('button[data-d]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.d)));
    }

    function onEvent(payload) {
      if (!payload || payload.sessionId !== sessionId) return;
      const e = payload.event || {};
      switch (e.kind) {
        case 'session_ready':
          cwdLabel.textContent = e.cwd || 'proyecto'; cwdLabel.title = e.cwd || '';
          setStatus('listo', 'ok'); sendBtn.disabled = !input.value.trim();
          if (e.hasMemory) { const el = document.createElement('div'); el.className = 'lthc-msg lthc-mem'; el.textContent = 'Memoria del proyecto cargada.'; thread.appendChild(el); }
          break;
        case 'turn_start': setBusy(true); streamedThoughtShown = false; clearLiveThink(); showThinking(); break;
        case 'think_token': {
          clearEmpty();
          clearThinking();
          if (!liveThink) {
            streamedThoughtShown = false;
            thinkBuf = '';
            liveThink = document.createElement('div');
            liveThink.className = 'lthc-msg lthc-thought live';
            thread.appendChild(liveThink);
          }
          thinkBuf += e.text || '';
          const t = liveThoughtText(thinkBuf);
          liveThink.textContent = '- ' + (t || 'pensando...');
          scroll();
          break;
        }
        case 'think_end': {
          if (liveThink) {
            const t = liveThoughtText(thinkBuf).trim();
            if (t) { liveThink.textContent = '- ' + t; liveThink.classList.remove('live'); streamedThoughtShown = true; liveThink = null; }
            else { clearLiveThink(); }
          }
          thinkBuf = '';
          break;
        }
        case 'thought':
          // Si ya lo mostramos en vivo (streaming), no duplicar.
          clearThinking();
          if (streamedThoughtShown) { streamedThoughtShown = false; break; }
          addThought(e.text); break;
        case 'tool_start': clearThinking(); addTool(e.tool, e.label); break;
        case 'tool_output':
          appendToolOutput(e.text, e.stream); break;
        case 'tool_result':
          if (lastToolOut) {
            const ok = e.ok !== false;
            lastToolOut.status.textContent = ok ? 'ok' : (e.exitCode != null ? 'exit ' + e.exitCode : 'error');
            lastToolOut.status.className = 'lthc-tool-status ' + (ok ? 'ok' : 'err');
            if (ok && !lastToolOut.pre.childNodes.length) {
              const span = document.createElement('span');
              span.className = 'summary';
              span.textContent = 'Resultado: ' + (e.label || e.tool || 'ok') + '\n';
              lastToolOut.pre.appendChild(span);
            }
            // Mostrar el mensaje de error real (para diagnosticar), no solo "error".
            if (!ok && e.error) {
              const span = document.createElement('span');
              span.className = 'err';
              span.textContent = String(e.error) + '\n';
              lastToolOut.pre.appendChild(span);
            }
            if (busy) showThinking();
          } break;
        case 'tool_denied': addNote('Accion rechazada: ' + (e.summary || e.tool)); break;
        case 'plan_blocked': addNote('Plan: omiti ' + (e.summary || e.tool) + ' (no modifico en modo Plan).'); break;
        case 'checkpoint_unavailable': addNote('No pude crear puntos de "Deshacer" en esta carpeta (permiso/bloqueo). Sigo trabajando igual, pero sin deshacer aqui.'); break;
        case 'memory_updated': { if (e.auto) break; const el = document.createElement('div'); el.className = 'lthc-msg lthc-mem'; el.textContent = 'Memoria del proyecto actualizada.'; thread.appendChild(el); scroll(); break; }
        case 'memory_learned': { const el = document.createElement('div'); el.className = 'lthc-msg lthc-mem'; el.textContent = 'Memoria de intencion aprendida: ' + (e.note || 'el agente guarde una correccion del usuario.'); thread.appendChild(el); scroll(); break; }
        case 'memory_error': addNote('No pude actualizar memoria: ' + (e.message || ''), true); break;
        case 'memory_health':
          if (e.quarantined) addNote(`Descontaminacion automatica: ${e.quarantined} memoria(s) movida(s) a cuarentena reversible.`);
          if (e.errors) addNote(`La auditoria de memoria termino con ${e.errors} error(es).`, true);
          break;
        case 'subagent_start': {
          agentStart(e);
          if (e.mode === 'edit') { parallelLaneStart(e); scroll(); break; }
          const el = document.createElement('div'); el.className = 'lthc-msg lthc-sub'; el.textContent = 'Delegando a subagente' + (e.active > 1 ? ' (' + e.active + ' en paralelo)' : '') + ': ' + (e.description || 'subtarea') + '...'; thread.appendChild(el); scroll(); break;
        }
        case 'subagent_end': {
          agentEnd(e);
          if (parallelLaneEnd(e)) { scroll(); break; }
          const el = document.createElement('div'); el.className = 'lthc-msg lthc-sub done'; el.textContent = 'Subagente termino: ' + (e.result || ''); thread.appendChild(el); scroll(); break;
        }
        case 'context_pruned': {
          const kb = Math.round((e.savedChars || 0) / 1000);
          if (e.reason === 'prompt_budget') {
            if (kb >= 2) addNote(`Prompt podado: -${kb}k caracteres de historial viejo.`);
          } else if (kb >= 25) {
            addNote(`Contexto optimizado: -${kb}k caracteres de historial viejo.`);
          }
          break;
        }
        case 'prompt_budget_exhausted': addNote('Se alcanzo el presupuesto global de prompts; el motor cerro el turno sin seguir llamando subagentes.'); break;
        case 'model_fallback': {
          modelProfile = normalizeModelProfile(e.to);
          if (modelSelect) modelSelect.value = modelProfile;
          try { localStorage.setItem('lthcode.modelProfile', modelProfile); } catch {}
          addNote(`El modelo ${e.from || 'actual'} fallo repetidas veces (${e.reason || 'sin detalle'}); cambie automaticamente a ${e.toLabel || e.to} y sigo con la tarea.`, true);
          break;
        }
        case 'context_seeded': addNote(`Retomando con la memoria operativa del turno anterior (${e.files || 0} archivo(s) ya conocidos${e.todos ? `, plan de ${e.todos} tarea(s)` : ''}); no reinvestigo desde cero.`); break;
        case 'compacting': addNote('Compactando el contexto (resumiendo lo anterior para seguir sin limite)...'); break;
        case 'compacted': { const kb = Math.round((e.charsBefore - e.charsAfter) / 1000); addNote('Contexto compactado' + (kb > 0 ? ` (-${kb}k caracteres)` : '') + '. Sigo con el resumen.'); break; }
        case 'assistant':
          clearThinking();
          if (e.final) {
            addAssistant(e.final);
            // Solo ofrecer "Aprobar plan" cuando el motor confirma que el final
            // PRESENTA un plan; si es una pregunta al usuario, se responde normal.
            if (planMode && e.planProposal === true) addApproveButton();
          }
          break;
        case 'turn_done':
          clearThinking();
          setBusy(false);
          activeAgents.clear(); renderAgents();
          if (lastTodosComplete) setTimeout(() => { if (lastTodosComplete) clearTodosNotification(); }, 1500);
          if (showUndoButton && e.checkpointId) addUndoButton(e.checkpointId, e.checkpointLabel);
          break;
        case 'checkpoint_undone':
          if (e.ok) addNote('Cambios revertidos' + (e.restored?.length ? ` (${e.restored.length} archivo(s))` : '') + '.');
          else addNote('No se pudo deshacer: ' + (e.error || ''), true);
          break;
        case 'aborted': clearWorkIndicators(); addNote('Detenido.'); setBusy(false); break;
        case 'continuity_checkpoint': addNote('Continuidad guarde al ' + (e.pct || 90) + '%. Si se corta, podre retomar desde aqui.'); break;
        case 'continuation_wait': clearWorkIndicators(); addContinuationWait(e); setBusy(false); break;
        case 'error': clearWorkIndicators(); addNote(e.message || 'Error', true); setBusy(false); break;
        case 'engine_down': clearWorkIndicators(); addNote('El motor se detuvo.', true); setBusy(false); break;
        case 'llm_usage': applyUsageEvent(e); break;
        case 'credits': try { auth?.applyCredits?.(e.credits); } catch {} break;
        case 'todo': renderTodos(e.items); break;
        case 'bg_started': addProc(e.procId, e.command); break;
        case 'bg_output': procOutput(e.procId, e.stream, e.text); break;
        case 'bg_exit': procExit(e.procId, e.code); break;
        case 'bg_stopping': { const p = procsMap.get(e.procId); if (p) p.st.textContent = 'deteniendo...'; break; }
        case 'permission_request': askPermission(e); break;
        case 'connect_request': handleConnectRequest(e); break;
        default: break;
      }
    }    // Sesion / proyectos
    function renderRecents(selectedPath) {
      const list = readRecents();
      if (!list.length) { projSelect.innerHTML = '<option value="">(sin proyecto)</option>'; return; }
      projSelect.innerHTML = list.map((r) =>
        `<option value="${esc(r.path)}"${r.path === selectedPath ? ' selected' : ''} title="${esc(r.path)}">${esc(r.name)}</option>`
      ).join('');
    }

    async function startSession(cwd, name) {
      if (busy) { try { code.abort({ sessionId }); } catch {} }
      if (sessionId) { try { code.endSession({ sessionId }); } catch {} }  // mata procesos bg de la sesion anterior
      thread.innerHTML = '';
      resetStick();
      resetUsageMeter();
      clearProcs();
      sessionId = 'code_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      setStatus('iniciando', 'busy');
      pushRecent(cwd, name);
      renderRecents(cwd);
      const r = await code.startSession({ sessionId, cwd, fundingSource: 'plan', autoApprove: autoMode, planMode, smartMind, parallelMode, modelProfile });
      if (!r?.success) {
        if (Number(r?.status || 0) === 401 || r?.signedIn === false) revokeAccess(r?.error);
        else { setStatus('error', 'err'); addNote('No se pudo iniciar: ' + (r?.error || ''), true); }
      }
    }

    // Abrir una carpeta existente como proyecto.
    async function openFolder() {
      if (!fsApi?.selectFolder) { addNote('Selector de carpetas no disponible.', true); return; }
      const r = await fsApi.selectFolder().catch(() => null);
      if (!r?.success || !r.path) return;
      await startSession(r.path, baseName(r.path));
    }

    // Crear un proyecto nuevo: pide nombre y DONDE guarde (carpeta padre).
    // window.prompt() NO esta implementado en Electron (no muestra dialogo, solo
    // devuelve null en silencio) -> usamos un modal propio en vez de window.prompt.
    function newProject() {
      const back = document.createElement('div');
      back.className = 'lthc-perm-back';
      back.innerHTML = `
        <div class="lthc-integ">
          <h4>Nuevo proyecto</h4>
          <p class="sub">Elige donde guarde en tu PC y ponle nombre. Se creara una carpeta nueva ahi.</p>
          <form data-npform>
            <input data-np-name placeholder="Nombre del proyecto" autocomplete="off" value="proyecto" required>
            <div class="two">
              <button type="button" class="close" data-np-pick style="text-align:left">Elegir carpeta...</button>
              <span class="hint" data-np-path style="align-self:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">(usara la carpeta por defecto de la app)</span>
            </div>
            <div class="acts">
              <button type="button" class="close" data-np-close>Cancelar</button>
              <button type="submit" class="save">Crear proyecto</button>
            </div>
          </form>
        </div>`;
      root.appendChild(back);

      let basePath = '';
      const nameInput = back.querySelector('[data-np-name]');
      const pathLabel = back.querySelector('[data-np-path]');
      const close = () => back.remove();

      back.querySelector('[data-np-close]').addEventListener('click', close);
      back.addEventListener('click', (ev) => { if (ev.target === back) close(); });

      back.querySelector('[data-np-pick]').addEventListener('click', async () => {
        if (!fsApi?.selectFolder) return;
        const picked = await fsApi.selectFolder().catch(() => null);
        if (picked?.success && picked.path) {
          basePath = picked.path;
          pathLabel.textContent = picked.path;
          pathLabel.title = picked.path;
        }
      });

      back.querySelector('[data-npform]').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        const submitBtn = back.querySelector('.save');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';
        const created = await code.ensureProject({ name, basePath }).catch((e) => ({ success: false, error: e?.message }));
        if (!created?.success) {
          addNote('No se pudo crear el proyecto: ' + (created?.error || ''), true);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear proyecto';
          return;
        }
        close();
        await startSession(created.path, created.name);
      });

      nameInput.focus();
      nameInput.select();
    }

    projSelect.addEventListener('change', async () => {
      if (!accessOk) return;
      const path = projSelect.value;
      if (!path) return;
      const name = readRecents().find((r) => r.path === path)?.name;
      await startSession(path, name);
    });
    openBtn.addEventListener('click', () => { if (accessOk) openFolder(); });
    newProjBtn.addEventListener('click', () => { if (accessOk) newProject(); });
    // Selector de perfil del motor nuevo.
    // Perfiles del motor v2.
    let modelLabels = { little: 'LTH Mini', custom: 'LTH Custom', pro: 'LTH Pro' };
    async function loadModelProfiles() {
      try {
        const r = await code.modelsList();
        const profiles = Array.isArray(r?.profiles) ? r.profiles : [];
        if (!profiles.length) return;
        for (const p of profiles) {
          if (MODEL_PROFILE_ORDER.includes(String(p?.profile || ''))) modelLabels[p.profile] = String(p.label || modelLabels[p.profile] || p.profile);
        }
        modelSelect.innerHTML = MODEL_PROFILE_ORDER.map((k) =>
          `<option value="${k}"${k === modelProfile ? ' selected' : ''}>${esc(modelLabels[k])}</option>`
        ).join('');
        modelSelect.title = 'Perfil del motor v2.';
      } catch {}
    }
    modelSelect.value = modelProfile;
    loadModelProfiles();
    modelSelect.addEventListener('change', () => {
      modelProfile = normalizeModelProfile(modelSelect.value);
      try { localStorage.setItem('lthcode.modelProfile', modelProfile); } catch {}
      if (sessionId) { try { code.setModelProfile({ sessionId, profile: modelProfile }); } catch {} }
      addNote(`Perfil cambiado a ${modelLabels[modelProfile] || modelProfile}.`);
    });    // Modos Auto / Plan / Mente
    function reflectModes() {
      autoBtn.classList.toggle('active', autoMode);
      planBtn.classList.toggle('active', planMode);
      if (mindBtn) mindBtn.classList.toggle('active', smartMind);
      try { localStorage.setItem('lthcode.modes', JSON.stringify({ auto: autoMode, plan: planMode, mind: smartMind, parallel: parallelMode })); } catch {}
    }
    reflectModes();
    autoBtn.addEventListener('click', () => {
      autoMode = !autoMode; reflectModes();
      if (sessionId) { try { code.setMode({ sessionId, autoApprove: autoMode }); } catch {} }
      addNote(autoMode ? 'Modo Auto preparado para Fase 3.' : 'Modo Auto desactivado.');
    });
    planBtn.addEventListener('click', () => {
      planMode = !planMode; reflectModes();
      if (sessionId) { try { code.setMode({ sessionId, planMode }); } catch {} }
      addNote(planMode ? 'Modo Plan preparado para Fase 3.' : 'Modo Plan desactivado.');
    });
    if (mindBtn) mindBtn.addEventListener('click', () => {
      smartMind = !smartMind; reflectModes();
      if (sessionId) { try { code.setMode({ sessionId, smartMind }); } catch {} }
      addNote(smartMind
        ? 'Mente Inteligente activada: recordare en que quedamos, retomare planes y aprendere tus preferencias (se auto-limpia).'
        : 'Mente Inteligente desactivada: vuelvo al modo normal.');
    });

    // Panel de comandos: se abre escribiendo "/" en la caja de texto.
    // Primer comando: Modelos en paralelo (1-3 subagentes editores a la vez).
    function toggleParallel() {
      parallelMode = !parallelMode; reflectModes();
      if (sessionId) { try { code.setMode({ sessionId, parallelMode }); } catch {} }
      addNote(parallelMode
        ? 'Modelos en paralelo: ACTIVADO. Cuando un cambio toque varios archivos independientes, la IA despachara 1-3 editores a la vez y luego verificara todo.'
        : 'Modelos en paralelo: desactivado. La IA edita todo directamente.');
    }
    function listCommands() {
      return [
        { id: 'paralelo', label: 'Modelos en paralelo', state: parallelMode, desc: 'La IA despacha 1-3 subagentes editores a la vez (archivos distintos)', run: toggleParallel },
        { id: 'auto', label: 'Modo Auto', state: autoMode, desc: 'Ejecuta acciones sin pedir permiso', run: () => autoBtn.click() },
        { id: 'plan', label: 'Modo Plan', state: planMode, desc: 'Investiga y propone; no modifica hasta aprobar', run: () => planBtn.click() },
        { id: 'mente', label: 'Mente Inteligente', state: smartMind, desc: 'Memoria narrativa: recuerda el hilo entre sesiones', run: () => { if (mindBtn) mindBtn.click(); } }
      ];
    }
    let cmdIndex = 0;
    function paletteQuery() {
      const value = input.value;
      if (!value.startsWith('/') || /\n/.test(value)) return null;
      return value.slice(1).trim().toLowerCase();
    }
    function filteredCommands() {
      const q = paletteQuery();
      if (q === null) return [];
      return listCommands().filter((c) => !q || c.id.includes(q) || c.label.toLowerCase().includes(q));
    }
    function hideCmdPanel() { cmdPanel.hidden = true; cmdIndex = 0; }
    function renderCmdPanel() {
      const list = filteredCommands();
      if (!list.length) { hideCmdPanel(); return; }
      if (cmdIndex >= list.length) cmdIndex = list.length - 1;
      cmdPanel.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'ttl';
      title.textContent = 'Comandos';
      cmdPanel.appendChild(title);
      list.forEach((c, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'cmd' + (i === cmdIndex ? ' sel' : '');
        const name = document.createElement('span'); name.className = 'name'; name.textContent = `/${c.id}`;
        const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = c.label;
        const st = document.createElement('span'); st.className = 'st' + (c.state ? ' on' : ''); st.textContent = c.state ? 'ON' : 'OFF';
        const desc = document.createElement('span'); desc.className = 'desc'; desc.textContent = c.desc;
        item.append(name, lbl, st, desc);
        item.addEventListener('click', () => activateCmd(c));
        cmdPanel.appendChild(item);
      });
      cmdPanel.hidden = false;
    }
    function activateCmd(command) {
      input.value = '';
      hideCmdPanel();
      input.dispatchEvent(new Event('input'));
      input.focus();
      command.run();
    }
    function handleCmdPanelKey(ev) {
      if (cmdPanel.hidden) return false;
      const list = filteredCommands();
      if (!list.length) { hideCmdPanel(); return false; }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); cmdIndex = (cmdIndex + 1) % list.length; renderCmdPanel(); return true; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); cmdIndex = (cmdIndex - 1 + list.length) % list.length; renderCmdPanel(); return true; }
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); activateCmd(list[cmdIndex] || list[0]); return true; }
      if (ev.key === 'Escape') { ev.preventDefault(); hideCmdPanel(); return true; }
      return false;
    }

    // Vista de paralelo en el chat: cuando el motor despacha editores (mode
    // 'edit'), el chat lo muestra DISTINTO — un bloque violeta con un carril
    // por editor en vivo, en vez de las lineas normales de subagente.
    let parallelBlock = null;
    let parallelCount = 0;
    let parallelActive = 0;
    const parallelLanes = new Map();
    function parallelLaneStart(e) {
      if (!parallelBlock || !thread.contains(parallelBlock) || parallelBlock.classList.contains('done')) {
        parallelBlock = document.createElement('div');
        parallelBlock.className = 'lthc-parallel';
        const hd = document.createElement('div'); hd.className = 'hd';
        const pulse = document.createElement('span'); pulse.className = 'pulse';
        const txt = document.createElement('span'); txt.className = 'txt'; txt.textContent = 'Editores en paralelo';
        hd.append(pulse, txt);
        parallelBlock.appendChild(hd);
        thread.appendChild(parallelBlock);
        parallelCount = 0;
      }
      parallelCount++;
      parallelActive++;
      const header = parallelBlock.querySelector('.hd .txt');
      if (header) header.textContent = `Editores en paralelo ×${parallelCount}`;
      const lane = document.createElement('div');
      lane.className = 'lane';
      const who = document.createElement('span'); who.className = 'who'; who.textContent = `Editor ${parallelCount}`;
      const desc = document.createElement('span'); desc.textContent = (e.description || 'cambio') + '...';
      lane.append(who, desc);
      parallelBlock.appendChild(lane);
      parallelLanes.set(e.subId, lane);
      setStatus(`en paralelo ×${parallelActive}`, 'busy');
    }
    function parallelLaneEnd(e) {
      const lane = parallelLanes.get(e.subId);
      if (!lane) return false;
      parallelLanes.delete(e.subId);
      parallelActive = Math.max(0, parallelActive - 1);
      lane.classList.add('done');
      const res = document.createElement('span'); res.className = 'res'; res.textContent = e.result || 'listo';
      lane.appendChild(res);
      if (!parallelActive && parallelBlock) parallelBlock.classList.add('done');
      setStatus(parallelActive ? `en paralelo ×${parallelActive}` : 'trabajando', 'busy');
      return true;
    }    // Conectores / Integraciones
    async function getConnectors() {
      try { const r = await window.electron.code.connectorsList(); return (r?.connectors) || []; } catch { return []; }
    }
    function extractSupabaseRef(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const m = /^https?:\/\/([a-z0-9]{8,})\.supabase\.co(?:\/|$)/i.exec(raw);
      if (m) return m[1];
      return /^[a-z0-9]{8,}$/i.test(raw) ? raw : '';
    }
    function looksLikeSupabaseUrl(value) {
      return /^https?:\/\/[a-z0-9]{8,}\.supabase\.co(?:\/|$)/i.test(String(value || '').trim());
    }
    function looksLikeSupabasePat(value) {
      return /^sbp_[a-z0-9._-]+$/i.test(String(value || '').trim());
    }
    function looksLikeSupabaseProjectKey(value) {
      const raw = String(value || '').trim();
      if (/^sb_publishable_[a-z0-9._-]+$/i.test(raw)) return true;
      if (!/^eyJ[a-zA-Z0-9._-]+$/i.test(raw)) return false;
      try {
        const payload = raw.split('.')[1] || '';
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
        return String(claims?.role || '').toLowerCase() === 'anon';
      } catch { return false; }
    }
    function decodeSupabaseJwt(value) {
      const raw = String(value || '').trim();
      if (!/^eyJ[a-zA-Z0-9._-]+$/.test(raw)) return null;
      try {
        const payload = raw.split('.')[1] || '';
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
      } catch { return null; }
    }
    function looksLikeSupabaseUserToken(value, ref = '') {
      const claims = decodeSupabaseJwt(value);
      if (String(claims?.role || '').toLowerCase() !== 'authenticated') return false;
      if (claims?.exp && Number(claims.exp) < Math.floor(Date.now() / 1000) - 60) return false;
      let claimRef = String(claims?.ref || '').toLowerCase();
      if (!claimRef && claims?.iss) {
        try { claimRef = extractSupabaseRef(String(claims.iss)) || ''; } catch {}
      }
      if (claimRef && ref && claimRef !== String(ref).toLowerCase()) return false;
      return true;
    }
    function redactSupabaseSecrets(text) {
      return String(text || '')
        .replace(/https?:\/\/[a-z0-9]{8,}\.supabase\.co(?:\/[^\s]*)?/ig, '[SUPABASE_URL]')
        .replace(/\bsbp_[a-z0-9._-]+\b/ig, '[SUPABASE_PAT]')
        .replace(/\bsb_(?:publishable|secret)_[a-z0-9._-]+\b/ig, '[SUPABASE_KEY]')
        .replace(/\beyJ[a-zA-Z0-9._-]{20,}\b/g, '[SUPABASE_JWT]');
    }
    function extractSupabaseChatCredentials(text) {
      const raw = String(text || '');
      const urls = Array.from(raw.matchAll(/https?:\/\/[a-z0-9]{8,}\.supabase\.co(?:\/[^\s]*)?/ig)).map((m) => m[0]);
      const pats = Array.from(raw.matchAll(/\bsbp_[a-z0-9._-]+\b/ig)).map((m) => m[0]);
      const projectKeys = Array.from(raw.matchAll(/\bsb_(?:publishable|secret)_[a-z0-9._-]+\b/ig)).map((m) => m[0]);
      const legacyKeys = Array.from(raw.matchAll(/\beyJ[a-zA-Z0-9._-]{20,}\b/g)).map((m) => m[0]);
      const refs = urls.map(extractSupabaseRef).filter(Boolean);
      const ref = refs[0] || extractSupabaseRef(raw);
      const safeApiKey = [...projectKeys, ...legacyKeys].find((value) => looksLikeSupabaseProjectKey(value)) || '';
      const userAccessToken = legacyKeys.find((value) => value !== safeApiKey && looksLikeSupabaseUserToken(value, ref)) || '';
      const pat = pats.find(Boolean) || '';
      const payloads = [];
      if (ref && safeApiKey) {
        payloads.push({
          name: 'supabase',
          baseUrl: `https://${ref}.supabase.co/rest/v1`,
          authHeaders: [{ header: 'apikey', scheme: '' }, { header: 'Authorization', scheme: 'Bearer' }],
          token: safeApiKey,
          accessToken: userAccessToken,
          connector: 'supabase',
          note: `Supabase Data API del proyecto ${ref}. La base ya incluye /rest/v1, asi que usa rutas como /part_requests o /rpc/funcion. No sirve para gestion de cuenta.`
        });
      }
      if (pat && looksLikeSupabasePat(pat)) {
        payloads.push({
          name: 'supabase-management',
          baseUrl: 'https://api.supabase.com/v1',
          authHeaders: [{ header: 'Authorization', scheme: 'Bearer' }],
          token: pat,
          connector: 'supabase-management',
          note: ref
            ? `Supabase Management API (PAT de cuenta). Proyecto de referencia: ${ref}. La base ya incluye /v1, asi que usa rutas como /projects y /projects/${ref}/database/query. No sirve para /rest/v1 de tablas.`
            : 'Supabase Management API (PAT de cuenta). La base ya incluye /v1, asi que usa rutas como /projects y /projects/{ref}/database/query. No sirve para /rest/v1 de tablas.'
        });
      }
      const redacted = redactSupabaseSecrets(raw).trim();
      if (!payloads.length && redacted === raw.trim()) return null;
      return {
        payloads,
        redactedText: redacted,
        summary: [
          payloads.some((p) => p.name === 'supabase') ? 'Supabase del proyecto' : '',
          payloads.some((p) => p.name === 'supabase-management') ? 'Supabase Management' : ''
        ].filter(Boolean).join(' + ') || 'Supabase no reconocido'
      };
    }
    // Construye el payload de integracion a partir de un preset + valores del form.
    function buildConnectorPayload(conn, values) {
      if (conn.id === 'supabase') {
        const ref = extractSupabaseRef(values.ref || values.baseUrl || '');
        const token = String(values.token || '').trim();
        if (looksLikeSupabasePat(token)) {
          return {
            name: values.name || 'supabase-management',
            baseUrl: 'https://api.supabase.com/v1',
            authHeaders: [{ header: 'Authorization', scheme: 'Bearer' }],
            token,
            connector: 'supabase-management',
            note: ref
              ? `Supabase Management API (PAT de cuenta). Proyecto de referencia: ${ref}. La base ya incluye /v1, asi que usa rutas como /projects y /projects/${ref}/database/query. No sirve para /rest/v1 de tablas.`
              : 'Supabase Management API (PAT de cuenta). La base ya incluye /v1, asi que usa rutas como /projects y /projects/{ref}/database/query. No sirve para /rest/v1 de tablas.'
          };
        }
        return {
          name: values.name || conn.id,
          baseUrl: `https://${ref}.supabase.co/rest/v1`,
          authHeaders: conn.authHeaders,
          token,
          accessToken: String(values.accessToken || '').trim(),
          connector: conn.id,
          note: ref
            ? `Supabase Data API del proyecto ${ref}. La base ya incluye /rest/v1, asi que usa rutas como /part_requests o /rpc/funcion. No sirve para gestion de cuenta.`
            : conn.name
        };
      }
      if (conn.id === 'supabase-management') {
        return {
          name: values.name || conn.id,
          baseUrl: 'https://api.supabase.com/v1',
          authHeaders: conn.authHeaders,
          token: String(values.token || '').trim(),
          connector: conn.id,
          note: 'Supabase Management API (PAT de cuenta). La base ya incluye /v1, asi que usa rutas como /projects y /projects/{ref}/database/query. No sirve para /rest/v1 de tablas.'
        };
      }
      let baseUrl = String(conn.baseUrlTemplate || values.baseUrl || '');
      (conn.fields || []).forEach((f) => { baseUrl = baseUrl.replace('{' + f.key + '}', String(values[f.key] || '').trim()); });
      return { name: values.name || conn.id, baseUrl, authHeaders: conn.authHeaders, token: values.token, connector: conn.id, note: conn.name };
    }
    async function syncSessionIntegrations() {
      if (!sessionId || !window.electron?.code?.syncIntegrations) return;
      try { await window.electron.code.syncIntegrations({ sessionId }); } catch {}
    }
    function validateConnectorValues(conn, values) {
      const next = { ...(values || {}) };
      if (conn.id === 'supabase') {
        const rawRef = String(next.ref || next.baseUrl || '').trim();
        const ref = extractSupabaseRef(rawRef);
        const token = String(next.token || '').trim();
        const accessToken = String(next.accessToken || '').trim();
        if (!token) {
          return { ok: false, error: 'Falta la key publica del proyecto (sb_publishable_... o equivalente).' };
        }
        if (looksLikeSupabasePat(token)) {
          if (ref) next.ref = ref;
          next.__connectorOverride = 'supabase-management';
          return {
            ok: true,
            values: next,
            hint: ref
              ? `Detecte un PAT de cuenta; guarde Supabase Management usando el proyecto ${ref} como referencia.`
              : 'Detecte un PAT de cuenta; guarde Supabase Management.'
          };
        }
        if (!ref) {
          return { ok: false, error: 'Pega el Project Ref o la URL completa del proyecto de Supabase.' };
        }
        next.ref = ref;
        if (!looksLikeSupabaseProjectKey(token)) {
          return { ok: false, error: 'La key no parece valida para Supabase. Usa la clave publicable del proyecto.' };
        }
        if (accessToken && !looksLikeSupabaseUserToken(accessToken, ref)) {
          return { ok: false, error: 'El JWT de usuario debe estar vigente, tener rol authenticated y pertenecer al mismo proyecto.' };
        }
        return {
          ok: true,
          values: next,
          hint: looksLikeSupabaseUrl(rawRef)
            ? `Detecte una URL completa y usare el ref ${ref}.`
            : `Usare el ref ${ref}.`
        };
      }
      if (conn.id === 'supabase-management') {
        const token = String(next.token || '').trim();
        if (!token) return { ok: false, error: 'Falta el Personal Access Token (sbp_...).'}; 
        if (!looksLikeSupabasePat(token)) {
          return { ok: false, error: 'Supabase Management usa un Personal Access Token de cuenta (sbp_...).' };
        }
        return { ok: true, values: next, hint: 'Usare el PAT de cuenta para la Management API.' };
      }
      return { ok: true, values: next, hint: '' };
    }
    // Modal-formulario guiado para un conector preset (Supabase, etc.).
    function openConnectorForm(conn, { onSaved, onCancel } = {}) {
      const back = document.createElement('div');
      back.className = 'lthc-perm-back';
      const fieldsHtml = (conn.fields || []).map((f) =>
        `<div><input data-f="${esc(f.key)}" type="${f.secret ? 'password' : 'text'}" placeholder="${esc(f.label)}" autocomplete="off">${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`
      ).join('');
      back.innerHTML = `
        <div class="lthc-integ">
          <h4>${conn.logoSvg || 'API'} Conectar ${esc(conn.name)}</h4>
          <p class="sub">${esc(conn.description || '')}</p>
          <form data-cform>
            ${fieldsHtml}
            <div class="hint" data-c-status></div>
            <div class="hint">El token se guarde <b>encriptado</b> en tu equipo. El agente <b>nunca lo ve</b>.</div>
            <div class="acts">
              <button type="button" class="close" data-c-close>Cancelar</button>
              <button type="submit" class="save">Conectar</button>
            </div>
          </form>
        </div>`;
      root.appendChild(back);
      const statusEl = back.querySelector('[data-c-status]');
      const submitBtn = back.querySelector('.save');
      const fieldEls = Array.from(back.querySelectorAll('[data-f]'));
      const getValues = () => {
        const values = {};
        fieldEls.forEach((el) => { values[el.dataset.f] = el.value; });
        return values;
      };
      const applySupabaseRefAutofix = () => {
        if (conn.id !== 'supabase') return;
        const refInput = back.querySelector('[data-f="ref"]');
        if (!refInput) return;
        const raw = String(refInput.value || '').trim();
        const ref = extractSupabaseRef(raw);
        if (ref && raw !== ref) refInput.value = ref;
      };
      const refreshValidation = () => {
        applySupabaseRefAutofix();
        const verdict = validateConnectorValues(conn, getValues());
        if (!statusEl) return verdict;
        if (verdict.ok) {
          statusEl.textContent = verdict.hint || '';
          statusEl.style.color = verdict.hint ? '#7ef0c0' : '';
          submitBtn.disabled = false;
        } else {
          statusEl.textContent = verdict.error || '';
          statusEl.style.color = verdict.error ? '#ff9b9b' : '';
          submitBtn.disabled = true;
        }
        return verdict;
      };
      back.querySelector('[data-c-close]').addEventListener('click', () => { back.remove(); onCancel && onCancel(); });
      fieldEls.forEach((el) => {
        el.addEventListener('input', refreshValidation);
        el.addEventListener('blur', refreshValidation);
        el.addEventListener('paste', () => setTimeout(refreshValidation, 0));
      });
      refreshValidation();
      back.querySelector('[data-cform]').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const verdict = refreshValidation();
        if (!verdict?.ok) {
          addNote(verdict?.error || 'Revisa los datos de conexion.', true);
          return;
        }
        const payload = buildConnectorPayload(conn, verdict.values || getValues());
        const res = await window.electron.code.integrationsAdd(payload).catch((e) => ({ success: false, error: e.message }));
        if (res?.success) {
          await syncSessionIntegrations();
          back.remove();
          addNote((payload.connector === 'supabase-management' ? 'Supabase Management' : conn.name) + ' conectado.');
          onSaved && onSaved(payload.name);
        }
        else { addNote('No se pudo conectar: ' + (res?.error || ''), true); }
      });
    }

    async function openIntegrations() {
      const [connectors, listRes] = await Promise.all([getConnectors(), window.electron.code.integrationsList().catch(() => ({ integrations: [] }))]);
      const recommended = connectors.filter((c) => c.recommended);
      const buildQuickTokenPayload = (token) => {
        const trimmed = String(token || '').trim();
        if (looksLikeSupabasePat(trimmed)) {
          return {
            name: 'supabase-management',
            baseUrl: 'https://api.supabase.com/v1',
            authHeaders: [{ header: 'Authorization', scheme: 'Bearer' }],
            token: trimmed,
            connector: 'supabase-management',
            note: 'Supabase Management API (PAT de cuenta). La base ya incluye /v1, asi que usa rutas como /projects y /projects/{ref}/database/query. No sirve para /rest/v1 de tablas.'
          };
        }
        return null;
      };
      const back = document.createElement('div');
      back.className = 'lthc-perm-back';
      back.innerHTML = `
        <div class="lthc-integ">
          <h4>Integraciones</h4>
          <p class="sub">Conecta servicios externos por token. Se guarde <b>encriptado</b>; el agente <b>nunca lo ve</b>.</p>
          ${recommended.length ? '<div class="sub" style="color:#7ef0c0;margin-top:2px">Recomendados</div><div class="reco" data-reco></div>' : ''}
          <div class="sub" style="color:#7ef0c0;margin-top:10px">Pegar token rapido</div>
          <form data-qform style="margin-top:8px">
            <input data-q-token placeholder="Pega aqui...)" type="password" autocomplete="off">
            <div class="hint" data-q-status>Si detectamos un PAT de Supabase (sbp_...), lo guarde automaticamente como Supabase Management.</div>
            <div class="acts"><button type="submit" class="save">Guardar token</button></div>
          </form>
          <div class="sub" style="margin-top:10px">Tus servicios</div>
          <div class="list" data-ilist></div>
          <p class="hint">Este panel muestra solo conectores que el motor puede ejecutar actualmente; no marca como conectados servicios decorativos.</p>
          <div class="acts" style="margin-top:12px"><button type="button" class="close" data-i-close>Cerrar</button></div>
        </div>`;
      root.appendChild(back);
      const listEl = back.querySelector('[data-ilist]');
      const recoEl = back.querySelector('[data-reco]');

      async function refresh() {
        let r = { integrations: [] };
        try { r = await window.electron.code.integrationsList(); } catch {}
        const items = (r?.integrations) || [];
        listEl.innerHTML = items.length ? '' : '<p class="sub">Aun no hay servicios.</p>';
        items.forEach((it) => {
          const row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = `<div class="n"><b>${esc(it.name)}</b><span>${esc(it.baseUrl)}</span></div><button type="button">Quitar</button>`;
          row.querySelector('button').addEventListener('click', async () => {
            try { await window.electron.code.integrationsRemove({ name: it.name }); } catch {}
            await syncSessionIntegrations();
            refresh();
          });
          listEl.appendChild(row);
        });
      }
      refresh();

      if (recoEl) recommended.forEach((c) => {
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'reco-card';
        card.innerHTML = `<span class="lg">${c.logoSvg || 'API'}</span><span class="tx"><b>${esc(c.name)}</b><i>${esc((c.description || '').slice(0, 60))}</i></span>`;
        card.addEventListener('click', () => openConnectorForm(c, { onSaved: () => refresh() }));
        recoEl.appendChild(card);
      });

      back.querySelector('[data-i-close]').addEventListener('click', () => back.remove());
      const quickTokenInput = back.querySelector('[data-q-token]');
      const quickStatusEl = back.querySelector('[data-q-status]');
      const quickForm = back.querySelector('[data-qform]');
      const refreshQuickToken = () => {
        const token = String(quickTokenInput?.value || '').trim();
        if (!quickStatusEl) return;
        if (!token) {
          quickStatusEl.textContent = 'Si detectamos un PAT de Supabase (sbp_...), lo guarde automaticamente como Supabase Management.';
          quickStatusEl.style.color = '';
          return;
        }
        if (looksLikeSupabasePat(token)) {
          quickStatusEl.textContent = 'Detecte un PAT de Supabase. Lo guarde como Supabase Management.';
          quickStatusEl.style.color = '#7ef0c0';
          return;
        }
        quickStatusEl.textContent = 'Ese token rapido no es un PAT. Para una key de proyecto usa la tarjeta Supabase Data API.';
        quickStatusEl.style.color = '#ffcf7e';
      };
      if (quickTokenInput) {
        quickTokenInput.addEventListener('input', refreshQuickToken);
        quickTokenInput.addEventListener('blur', refreshQuickToken);
        quickTokenInput.addEventListener('paste', () => setTimeout(refreshQuickToken, 0));
        refreshQuickToken();
      }
      quickForm?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const payload = buildQuickTokenPayload(quickTokenInput?.value || '');
        if (!payload) {
          addNote('Ese token rapido no se reconoce. Si es PAT de Supabase debe empezar con sbp_; para una key publicable usa la tarjeta Data API.', true);
          return;
        }
        const res = await window.electron.code.integrationsAdd(payload).catch((e) => ({ success: false, error: e.message }));
        if (res?.success) {
          await syncSessionIntegrations();
          if (quickTokenInput) quickTokenInput.value = '';
          refreshQuickToken();
          addNote('Supabase Management conectado.');
          refresh();
        } else {
          addNote('No se pudo guarde el token: ' + (res?.error || ''), true);
        }
      });
    }
    integrationsBtn.addEventListener('click', () => { if (accessOk) openIntegrations(); });

    // Cuando LTH Code pide conectar un servicio (tool connect): ventana segura para el token.
    async function handleConnectRequest(ev) {
      const connectors = await getConnectors();
      const conn = connectors.find((c) => c.id === String(ev.service || '').toLowerCase())
        || { id: ev.service, name: ev.service, logoSvg: 'API', description: 'Conecta este servicio para continuar.', fields: [{ key: 'baseUrl', label: 'URL base (https://...)' }, { key: 'token', label: 'Token', secret: true }] };
      addNote('LTH Code pide conectar "' + conn.name + '"' + (ev.reason ? ': ' + ev.reason : '') + '. Pega tu token en la ventana.');
      openConnectorForm(conn, {
        onSaved: (name) => { try { window.electron.code.respondConnect({ requestId: ev.requestId, connected: true, name }); } catch {} },
        onCancel: () => { try { window.electron.code.respondConnect({ requestId: ev.requestId, connected: false }); } catch {} }
      });
    }

    function addApproveButton() {
      const wrap = document.createElement('div');
      wrap.className = 'lthc-msg lthc-approve';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Aprobar plan y ejecutar';
      btn.addEventListener('click', async () => {
        planMode = false; reflectModes();
        try { await code.setMode({ sessionId, planMode: false }); } catch {}
        wrap.remove();
        addUser('Aprobado. Ejecuta el plan paso a paso.');
        setBusy(true);
        await sendToEngine('Aprobado. Ejecuta el plan que presentaste, paso a paso.', 'No se pudo ejecutar el plan');
      });
      wrap.appendChild(btn);
      thread.appendChild(wrap); scroll();
    }

    function addUndoButton(checkpointId, label) {
      const wrap = document.createElement('div');
      wrap.className = 'lthc-msg lthc-undo';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Deshacer estos cambios';
      if (label) btn.title = 'Revierte los archivos que cambie en: ' + label;
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = 'Revirtiendo...';
        try { code.undo({ sessionId, id: checkpointId }); } catch {}
      });
      wrap.appendChild(btn);
      thread.appendChild(wrap); scroll();
    }    // Adjuntar imagenes (vision)
    function renderAttachments() {
      attachBox.innerHTML = pendingImages.map((img, i) =>
        `<div class="lthc-chip"><img src="${img.dataUrl}" alt=""><button class="x" data-rm="${i}" type="button" title="Quitar">x</button></div>`
      ).join('');
      attachBox.classList.toggle('show', pendingImages.length > 0);
      attachBox.querySelectorAll('button[data-rm]').forEach((b) =>
        b.addEventListener('click', () => { pendingImages.splice(Number(b.dataset.rm), 1); renderAttachments(); if (!busy) sendBtn.disabled = !input.value.trim() && !pendingImages.length; }));
    }
    function addImageFile(file) {
      if (!file || !/^image\//.test(file.type)) return;
      if (pendingImages.length >= 4) { addNote('Maximo 4 imagenes por mensaje.'); return; }
      const reader = new FileReader();
      reader.onload = () => { pendingImages.push({ dataUrl: String(reader.result), name: file.name || 'imagen' }); renderAttachments(); if (!busy) sendBtn.disabled = false; };
      reader.readAsDataURL(file);
    }
    attachBtn.addEventListener('click', () => { if (accessOk && !busy) fileInput.click(); });
    fileInput.addEventListener('change', () => { Array.from(fileInput.files || []).forEach(addImageFile); fileInput.value = ''; });
    input.addEventListener('paste', (ev) => {
      const items = ev.clipboardData?.items || [];
      for (const it of items) { if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) { addImageFile(f); ev.preventDefault(); } } }
    });
    ['dragover', 'drop'].forEach((evt) => root.addEventListener(evt, (ev) => { ev.preventDefault(); }));
    root.addEventListener('drop', (ev) => { Array.from(ev.dataTransfer?.files || []).forEach(addImageFile); });    // Describe imagenes con un modelo de vision (gemini-flash-lite) -> texto para el agente.
    async function describeImages(images) {
      const parts = [{ type: 'text', text: 'Eres los OJOS de un agente de programacion. Describe estas imagenes con detalle UTIL para construir o modificar codigo: tipo (captura de app, diseno/mockup, error, diagrama), layout y estructura, componentes y su disposicion, colores aproximados en hex, TODOS los textos visibles (transcribelos), y que se deberia crear o cambiar. Se concreto y accionable. Si es un mensaje de error, transcribelo completo.' }];
      images.forEach((img) => parts.push({ type: 'image_url', image_url: { url: img.dataUrl } }));
      const r = await window.electron.ai.openrouterChat({
        routerBypass: true, model: 'google/gemini-2.5-flash-lite', fundingSource: 'plan',
        messages: [{ role: 'user', content: parts }], maxTokens: 1400, timeoutMs: 60000
      });
      if (r && r.success !== false && r.text) { try { auth?.applyCredits?.(r.credits); } catch {} return r.text; }
      throw new Error(r?.error || 'No pude analizar la imagen.');
    }    // Input
    function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; }
    input.addEventListener('input', () => { autosize(); if (!busy) sendBtn.disabled = !input.value.trim() && !pendingImages.length; renderCmdPanel(); });
    input.addEventListener('keydown', (ev) => {
      if (handleCmdPanelKey(ev)) return;
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); doSend(); }
    });
    input.addEventListener('blur', () => { setTimeout(() => { if (!cmdPanel.matches(':hover')) hideCmdPanel(); }, 150); });

    async function doSend() {
      if (!accessOk) return;
      if (busy) { try { code.abort({ sessionId }); } catch {} return; }
      const text = input.value.trim();
      const imgs = pendingImages.slice();
      if (!text && !imgs.length) return;
      if (!sessionId) { addNote('Primero abre o crea un proyecto.', true); return; }
      let credentialCapture = null;
      if (text) {
        credentialCapture = extractSupabaseChatCredentials(text);
        if (credentialCapture) {
          const results = [];
          for (const payload of (credentialCapture.payloads || [])) {
            const res = await window.electron.code.integrationsAdd(payload).catch((e) => ({ success: false, error: e.message }));
            results.push({ payload, res });
          }
          const ok = results.filter((item) => item.res?.success).map((item) => item.payload.name);
          const fail = results.filter((item) => !item.res?.success);
          if (ok.length) addNote(`Credenciales de ${credentialCapture.summary} guardadas de forma segura en Integraciones (${ok.join(', ')}).`);
          fail.forEach((item) => addNote(`No pude guardar ${item.payload.name}: ${item.res?.error || ''}`, true));
          if (ok.length) {
            await syncSessionIntegrations();
            credentialCapture.savedNames = ok;
            credentialCapture.savedSummary = ok.join(', ');
          } else if (!credentialCapture.payloads?.length) {
            addNote('Detecte y redacte una credencial, pero no es un formato seguro compatible. No se envio al modelo ni se guardo.', true);
          }
        }
      }
      const bubbleText = credentialCapture
        ? `Compartiste credenciales de ${credentialCapture.summary} por chat. Redacte los secretos antes de enviarlos al agente${credentialCapture.savedNames?.length ? ' y guarde las compatibles en Integraciones' : ''}.${imgs.length ? `  (${imgs.length} imagen(es))` : ''}`
        : text + (imgs.length ? `  (${imgs.length} imagen(es))` : '');
      addUser(bubbleText);
      input.value = ''; autosize(); pendingImages = []; renderAttachments(); sendBtn.disabled = true; setBusy(true); showThinking();

      let finalText = text;
      if (credentialCapture) {
        const safePrelude = credentialCapture.savedNames?.length
          ? [
              `[El usuario compartio credenciales de Supabase por chat. Ya fueron guarde de forma segura en Integraciones como: ${credentialCapture.savedSummary}.]`,
              '[Los secretos reales NO viajan en este mensaje. Si necesitas Supabase, usa la integracion correcta segun su nombre/nota.]'
            ].join('\n')
          : '[Se detectaron credenciales en el mensaje y se redactaron antes de enviarlo. No fueron guarde ni estan disponibles para el agente.]';
        finalText = credentialCapture.redactedText
          ? `${safePrelude}\n\n[Mensaje del usuario redactado]\n${credentialCapture.redactedText}`
          : safePrelude;
      }
      if (imgs.length) {
        addNote('Analizando ' + imgs.length + ' imagen(es)...');
        try {
          const desc = await describeImages(imgs);
          finalText = (finalText ? finalText + '\n\n' : '') + `[El usuario adjunto ${imgs.length} imagen(es). Descripcion:]\n${desc}`;
        } catch (e) {
          finalText = (finalText ? finalText + '\n\n' : '') + `[El usuario adjunto ${imgs.length} imagen(es) pero no pude analizarlas (${e.message}). Si necesitas saber que contienen, preguntale al usuario.]`;
          addNote('No pude analizar la(s) imagen(es): ' + e.message, true);
        }
      }
      await sendToEngine(finalText);
    }
    sendBtn.addEventListener('click', doSend);
    // Controles del motor v2.
    function setControls(on) {
      input.disabled = !on;
      openBtn.disabled = !on;
      newProjBtn.disabled = !on;
      projSelect.disabled = !on;
      if (attachBtn) attachBtn.disabled = !on;
      if (integrationsBtn) integrationsBtn.disabled = !on;
      if (!on) sendBtn.disabled = true;
    }
    function revokeAccess(message = '') {
      accessOk = false;
      started = false;
      busy = false;
      clearWorkIndicators();
      try { sessionId && code.endSession({ sessionId }); } catch {}
      sessionId = null;
      setControls(false);
      setStatus('sesion requerida', 'err');
      resetStick();
      thread.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'lthc-empty';
      const title = document.createElement('h3');
      title.textContent = 'Inicia sesion para usar LTH Code';
      const detail = document.createElement('div');
      detail.className = 'paths';
      detail.textContent = message || 'LTH Code valida tu access token con Supabase antes de abrir el motor.';
      card.append(title, detail);
      thread.appendChild(card);
    }
    async function grantAccess() {
      if (started) return;
      started = true;
      accessOk = true;
      setControls(true);
      setStatus('iniciando', 'busy');
      resetStick();
      thread.innerHTML = `
        <div class="lthc-empty" data-empty>
          <h3>Motor v2 conectado</h3>
          Fase 3 activa: agente regulado, Supabase y memoria segura.
          Prueba: lista archivos, leer package.json o buscar "texto".
          <div class="paths">Usa <b>Abrir...</b> para una carpeta existente o <b>Nuevo...</b> para crear desde cero.</div>
        </div>`;
      const recents = readRecents();
      if (recents.length) {
        renderRecents(recents[0].path);
        await startSession(recents[0].path, recents[0].name);
      } else {
        const created = await code.ensureProject({ name: 'proyecto-1' }).catch(() => null);
        if (created?.success) await startSession(created.path, created.name);
        else { setStatus('listo', 'ok'); renderRecents(); }
      }
    }

    async function evaluateAccess() {
      const state = await auth?.getState?.({ force: true }).catch(() => null);
      if (!state?.signedIn || !state?.user?.id) {
        revokeAccess(state?.error || 'Tu sesion no existe, expiro o no pudo validarse con Supabase.');
        return;
      }
      await grantAccess();
    }    // Arranque
    unsub = code.onEvent(onEvent);
    document.addEventListener('keydown', onGlobalKeydown, true);
    setControls(false);
    // El logout tambien debe revocar las herramientas locales inmediatamente.
    try {
      unsubAuth = auth?.onChange?.((state) => {
        if (state?.signedIn && state?.user?.id) {
          if (!accessOk) evaluateAccess();
        } else if (accessOk || started) {
          revokeAccess(state?.error || 'La sesion de Supabase se cerro o dejo de ser valida.');
        }
      });
    } catch {}
    await evaluateAccess();

    // Limpieza al cerrar la app.
    const cleanup = () => {
      try { document.removeEventListener('keydown', onGlobalKeydown, true); } catch {}
      try { unsub && unsub(); } catch {}
      try { unsubAuth && unsubAuth(); } catch {}
      try { sessionId && code.endSession({ sessionId }); } catch {}
    };
    const mo = new MutationObserver(() => { if (!document.body.contains(root)) { cleanup(); mo.disconnect(); } });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch {}
  }

  window.LTH_APPS = window.LTH_APPS || {};
  window.LTH_APPS[APP_ID] = {
    id: APP_ID,
    name: APP_NAME,
    iconUrl: APP_ICON_URL,
    icon: APP_ICON_HTML,
    iconBackground: 'transparent',
    iconStyle: APP_ICON_STYLE,
    titlebarIconWrapStyle: APP_TITLEBAR_ICON_WRAP_STYLE,
    titlebarIconStyle: APP_TITLEBAR_ICON_STYLE,
    chipIconStyle: APP_CHIP_ICON_STYLE,
    gradient: GRADIENT,
    position: 5,
    render
  };

  try {
    window.AppLoader?.registerApp?.({
      id: APP_ID,
      name: APP_NAME,
      iconUrl: APP_ICON_URL,
      icon: APP_ICON_HTML,
      iconBackground: 'transparent',
      iconStyle: APP_ICON_STYLE,
      titlebarIconWrapStyle: APP_TITLEBAR_ICON_WRAP_STYLE,
      titlebarIconStyle: APP_TITLEBAR_ICON_STYLE,
      chipIconStyle: APP_CHIP_ICON_STYLE,
      gradient: GRADIENT,
      position: 5
    });
  } catch (_) {}
})();



