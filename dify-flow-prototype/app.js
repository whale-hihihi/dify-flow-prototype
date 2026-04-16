// ========== Navigation ==========
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const topbarTitle = document.getElementById('topbar-title');

const viewTitles = {
  assets: '资产管理', tasks: '任务管理', agents: 'Dify 智能体管理',
  generator: '智能体生成器', settings: '个人设置'
};

function switchView(viewId) {
  navItems.forEach(i => i.classList.toggle('active', i.dataset.view === viewId));
  views.forEach(v => v.classList.toggle('active', v.id === `view-${viewId}`));
  if (viewTitles[viewId]) topbarTitle.textContent = viewTitles[viewId];
}

navItems.forEach(item => {
  item.addEventListener('click', () => { if (item.dataset.view) switchView(item.dataset.view); });
});

// ========== Tabs ==========
document.querySelectorAll('.tabs').forEach(g => {
  g.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      g.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      // Task type toggle
      if (g.id === 'task-type-tabs') {
        const sg = document.getElementById('schedule-group');
        if (sg) sg.style.display = t.dataset.type === 'scheduled' ? 'block' : 'none';
      }
    });
  });
});

// ========== Tree / Folders ==========
let activeFolderMenu = null;

function selectFolder(el) {
  document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  closeFolderMenu();
}

function showFolderMenu(btn) {
  closeFolderMenu();
  const item = btn.closest('.tree-item');
  const menu = document.createElement('div');
  menu.className = 'folder-context-menu';
  menu.style.top = (btn.offsetTop + btn.offsetHeight + 4) + 'px';
  menu.style.left = '30px';
  menu.innerHTML = `
    <button onclick="renameFolderPrompt(this)">✏️ 重命名</button>
    <button class="danger" onclick="deleteFolderPrompt()">🗑️ 删除文件夹</button>
  `;
  item.style.position = 'relative';
  item.appendChild(menu);
  activeFolderMenu = menu;
}

function closeFolderMenu() {
  if (activeFolderMenu) { activeFolderMenu.remove(); activeFolderMenu = null; }
}

document.addEventListener('click', e => {
  if (activeFolderMenu && !activeFolderMenu.contains(e.target) && !e.target.classList.contains('tree-action')) {
    closeFolderMenu();
  }
});

function createFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) return;
  const tree = document.querySelector('.folder-tree');
  const allItem = tree.querySelector('.tree-item');
  const newItem = document.createElement('div');
  newItem.className = 'tree-item';
  newItem.setAttribute('onclick', 'selectFolder(this)');
  newItem.innerHTML = `<span class="icon">📂</span><span class="tree-label">${name}</span><button class="tree-action" onclick="event.stopPropagation();showFolderMenu(this)">⋮</button>`;
  // Insert before the last section or at end
  allItem.parentNode.insertBefore(newItem, allItem.parentNode.querySelector('.tree-item:last-child'));
  closeModal('folder-modal');
  document.getElementById('new-folder-name').value = '';
}

let renamingItem = null;
function renameFolderPrompt(btn) {
  closeFolderMenu();
  renamingItem = btn.closest('.tree-item') || document.querySelector('.tree-item.active');
  if (!renamingItem) return;
  const label = renamingItem.querySelector('.tree-label');
  if (label) document.getElementById('rename-folder-name').value = label.textContent;
  openModal('folder-rename-modal');
}

function renameFolder() {
  const name = document.getElementById('rename-folder-name').value.trim();
  if (!name || !renamingItem) return;
  const label = renamingItem.querySelector('.tree-label');
  if (label) label.textContent = name;
  closeModal('folder-rename-modal');
  renamingItem = null;
}

let deletingItem = null;
function deleteFolderPrompt() {
  deletingItem = activeFolderMenu ? activeFolderMenu.closest('.tree-item') : null;
  closeFolderMenu();
  if (!deletingItem) return;
  openModal('folder-delete-modal');
}

function deleteFolder() {
  if (deletingItem) { deletingItem.remove(); deletingItem = null; }
  closeModal('folder-delete-modal');
}

// ========== Modals ==========
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
});

function toggleApiKey() {
  const inp = document.getElementById('api-key-input');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ========== Generator - Step by Step ==========
const genMessages = document.getElementById('gen-messages');
const genInput = document.getElementById('gen-user-input');
const genYamlOutput = document.getElementById('gen-yaml-output');
const genSteps = document.getElementById('gen-steps');

let genStep = 0;

const conversation = [
  {
    ai: '你好！我是 Dify 智能体生成助手。我会通过几个问题帮你明确需求，然后自动生成可导入 Dify 的 YAML 配置文件。\n\n首先，你想要创建什么类型的智能体？',
    options: [
      { label: '💬 Chat（对话型）', value: 'chat' },
      { label: '🔧 Completion（补全型）', value: 'completion' },
      { label: '🔄 Workflow（工作流型）', value: 'workflow' }
    ],
    step: 0
  },
  {
    ai: '很好，Workflow 类型适合多步骤的自动化任务。\n\n请描述这个智能体的核心功能是什么？例如："从文本中提取实体关系并构建知识图谱"。',
    free: true,
    placeholder: '描述你想要的功能...',
    step: 1
  },
  {
    ai: '收到！一个「图谱提取」工作流 —— 从文本中提取实体和关系，输出结构化的 JSON。\n\n接下来，输入格式是什么样的？',
    options: [
      { label: '📝 纯文本段落', value: 'paragraph' },
      { label: '📄 长文档（分段处理）', value: 'long_doc' },
      { label: '📊 结构化数据', value: 'structured' }
    ],
    step: 2
  },
  {
    ai: '好的，用户输入纯文本段落。\n\n你希望输出什么格式的数据？',
    options: [
      { label: '{ } JSON', value: 'json' },
      { label: '📋 表格/CSV', value: 'csv' },
      { label: '🏷️ Markdown', value: 'markdown' }
    ],
    step: 3
  },
  {
    ai: 'JSON 输出，包含 nodes（实体节点）和 edges（关系边）。\n\n最后，关于模型选择：你有偏好吗？',
    options: [
      { label: '🧠 GLM-4（推荐）', value: 'glm4' },
      { label: '🌐 GPT-4', value: 'gpt4' },
      { label: '⚡ Claude 3.5', value: 'claude' }
    ],
    step: 4
  },
  {
    ai: '完美！我已经收集到所有必要信息。正在为你生成「图谱提取」工作流的 YAML 配置...\n\n✅ 类型：Workflow\n✅ 输入：纯文本段落\n✅ 输出：JSON（nodes + edges）\n✅ 模型：GLM-4\n\nYAML 已生成，你可以在右侧面板查看和下载！',
    generate: true,
    step: 5
  }
];

function addAiMessage(text, options, free, placeholder) {
  const msg = document.createElement('div');
  msg.className = 'gen-msg gen-msg-ai';
  let optionsHtml = '';
  if (options) {
    optionsHtml = '<div class="gen-msg-options">';
    options.forEach(o => {
      optionsHtml += `<button class="gen-option-btn" onclick="selectOption('${o.value}','${o.label}')">${o.label}</button>`;
    });
    optionsHtml += '</div>';
  }
  const inputDisplay = free ? 'flex' : 'none';
  msg.innerHTML = `
    <div class="gen-msg-avatar">🤖</div>
    <div>
      <div class="gen-msg-bubble">${text.replace(/\n/g, '<br>')}</div>
      ${optionsHtml}
    </div>
  `;
  genMessages.appendChild(msg);
  if (free) {
    genInput.parentElement.style.display = 'flex';
    genInput.placeholder = placeholder || '输入你的回答...';
    genInput.focus();
  } else if (!options) {
    genInput.parentElement.style.display = 'none';
  } else {
    genInput.parentElement.style.display = 'none';
  }
  genMessages.scrollTop = genMessages.scrollHeight;
}

function addUserMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'gen-msg gen-msg-user';
  msg.innerHTML = `
    <div class="gen-msg-avatar">👤</div>
    <div class="gen-msg-bubble">${text}</div>
  `;
  genMessages.appendChild(msg);
  genMessages.scrollTop = genMessages.scrollHeight;
}

function selectOption(value, label) {
  addUserMessage(label);
  advanceStep();
}

function handleGenInput() {
  const text = genInput.value.trim();
  if (!text) return;
  addUserMessage(text);
  genInput.value = '';
  advanceStep();
}

function advanceStep() {
  genStep++;
  updateSteps();

  if (genStep < conversation.length) {
    setTimeout(() => {
      const c = conversation[genStep];
      addAiMessage(c.ai, c.options, c.free, c.placeholder);
      if (c.generate) generateFinalYaml();
    }, 600);
  }
}

function updateSteps() {
  const dots = genSteps.querySelectorAll('.gen-step-dot');
  dots.forEach((d, i) => {
    d.classList.remove('done', 'active');
    if (i < genStep) d.classList.add('done');
    else if (i === genStep) d.classList.add('active');
  });
}

function resetGenerator() {
  genStep = 0;
  genMessages.innerHTML = '';
  genYamlOutput.innerHTML = `
    <div style="color:#6C7086;text-align:center;padding-top:60px">
      <div style="font-size:28px;margin-bottom:10px;opacity:0.4">✨</div>
      <div style="font-size:12px">完成对话后将在此生成 YAML</div>
    </div>`;
  updateSteps();
  startGenerator();
}

function startGenerator() {
  const c = conversation[0];
  addAiMessage(c.ai, c.options, c.free, c.placeholder);
}

// ========== YAML Generation ==========
function generateFinalYaml() {
  const K = s => `<span class="yaml-key">${s}</span>`;
  const S = s => `<span class="yaml-string">${s}</span>`;
  const C = s => `<span class="yaml-comment">${s}</span>`;
  const B = s => `<span class="yaml-bool">${s}</span>`;
  const N = s => `<span class="yaml-number">${s}</span>`;
  const NU = `<span class="yaml-null">null</span>`;

  const yamlLines = [
    C('# Dify Workflow DSL — 图谱提取'),
    C('# 由 DifyFlow AI 自动生成'),
    '',
    K('app:'),
    `  ${K('description:')} ${S("'从文本中提取实体关系，输出结构化 JSON'")}`,
    `  ${K('icon:')} ${S('🤖')}`,
    `  ${K('icon_background:')} ${S("'#FFEAD5'")}`,
    `  ${K('mode:')} ${S('workflow')}`,
    `  ${K('name:')} ${S('图谱提取')}`,
    `  ${K('use_icon_as_answer_icon:')} ${B('false')}`,
    '',
    K('dependencies:'),
    `  - ${K('current_identifier:')} ${NU}`,
    `    ${K('type:')} ${S('marketplace')}`,
    `    ${K('value:')}`,
    `      ${K('marketplace_plugin_unique_identifier:')} ${S('langgenius/zhipuai:0.0.23@7e6213...')}`,
    `      ${K('version:')} ${NU}`,
    '',
    K('kind:') + ' ' + S('app'),
    K('version:') + ' ' + S('0.5.0'),
    '',
    K('workflow:'),
    `  ${K('conversation_variables:')} ${S('[]')}`,
    `  ${K('environment_variables:')} ${S('[]')}`,
    `  ${K('features:')}`,
    `    ${K('file_upload:')}`,
    `      ${K('enabled:')} ${B('false')}`,
    `    ${K('opening_statement:')} ${S("'请输入需要提取图谱的文本'")}`,
    `    ${K('retriever_resource:')}`,
    `      ${K('enabled:')} ${B('true')}`,
    `    ${K('suggested_questions:')}`,
    `      - ${S("'请分析这段军事新闻中的实体关系'")}`,
    `      - ${S("'提取这篇报告中的人物和组织'")}`,
    '',
    `  ${K('graph:')}`,
    `    ${K('edges:')}`,
    `      - ${K('id:')} ${S('start-to-llm')}`,
    `        ${K('source:')} ${S("'1775090453336'")}`,
    `        ${K('sourceHandle:')} ${S('source')}`,
    `        ${K('target:')} ${S("'1775090526405'")}`,
    `        ${K('targetHandle:')} ${S('target')}`,
    `        ${K('type:')} ${S('custom')}`,
    `      - ${K('id:')} ${S('llm-to-end')}`,
    `        ${K('source:')} ${S("'1775090526405'")}`,
    `        ${K('target:')} ${S("'1775090685433'")}`,
    `        ${K('type:')} ${S('custom')}`,
    '',
    `    ${K('nodes:')}`,
    `      - ${K('data:')}`,
    `          ${K('title:')} ${S('用户输入')}`,
    `          ${K('type:')} ${S('start')}`,
    `          ${K('variables:')}`,
    `            - ${K('label:')} ${S('context')}`,
    `              ${K('type:')} ${S('paragraph')}`,
    `              ${K('required:')} ${B('true')}`,
    `              ${K('max_length:')} ${N('20480')}`,
    `        ${K('id:')} ${S("'1775090453336'")}`,
    '',
    `      - ${K('data:')}`,
    `          ${K('title:')} ${S('LLM')}`,
    `          ${K('type:')} ${S('llm')}`,
    `          ${K('model:')}`,
    `            ${K('completion_params:')}`,
    `              ${K('temperature:')} ${N('0.5')}`,
    `            ${K('mode:')} ${S('chat')}`,
    `            ${K('name:')} ${S('glm-4')}`,
    `            ${K('provider:')} ${S('langgenius/zhipuai/zhipuai')}`,
    `          ${K('prompt_template:')}`,
    `            - ${K('role:')} ${S('system')}`,
    `              ${K('text:')} ${S('|')}`,
    `                ${S('你是一个专业的实体关系提取引擎。')}`,
    `                ${S('从文本中提取所有实体和关系。')}`,
    `                ${S('输出 JSON: {nodes, edges}')}`,
    `        ${K('id:')} ${S("'1775090526405'")}`,
    '',
    `      - ${K('data:')}`,
    `          ${K('title:')} ${S('输出')}`,
    `          ${K('type:')} ${S('end')}`,
    `          ${K('outputs:')}`,
    `            - ${K('value_selector:')}`,
    `              - ${S("'1775090526405'")}`,
    `              - ${S('text')}`,
    `              ${K('variable:')} ${S('text')}`,
    `        ${K('id:')} ${S("'1775090685433'")}`,
  ];

  genYamlOutput.innerHTML = '';
  let i = 0;

  function typeLine() {
    if (i >= yamlLines.length) return;
    const line = document.createElement('div');
    line.className = 'yaml-line';
    line.innerHTML = yamlLines[i] || '&nbsp;';
    genYamlOutput.appendChild(line);
    genYamlOutput.scrollTop = genYamlOutput.scrollHeight;
    i++;
    setTimeout(typeLine, 30 + Math.random() * 20);
  }

  typeLine();
  genInput.parentElement.style.display = 'none';
}

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  startGenerator();
});
