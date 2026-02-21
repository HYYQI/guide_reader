(function() {
    const fileSelector = document.getElementById('fileSelector');
    const refreshBtn = document.getElementById('refreshBtn');
    const readerPaper = document.getElementById('readerPaper');

    // 数据结构: 存储从json解析的条目 [{ name: "故宫", file: "gugong.txt" }, ...]
    let guideList = [];
    let currentFile = ''; // 当前选中的文件名（实际txt文件名）

    function showPlaceholder(msg) {
        readerPaper.innerHTML = `<div class="placeholder">${msg || '📁 选择文件'}</div>`;
    }

    function showError(msg) {
        readerPaper.innerHTML = `<div class="error">❌ ${msg}</div>`;
    }

    function showLoading() {
        readerPaper.innerHTML = `<div class="loading">⏳ 加载中...</div>`;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 按句子拆分（处理换行/空格，避免拆分小数）
    function splitSentences(text) {
        if (!text) return [];

        // 1. 统一换行符
        let clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 2. 临时保护小数点（如 3.14、2024.5）
        clean = clean.replace(/(\d)\.(\d)/g, '$1###DOT###$2');

        // 3. 按句子边界拆分（中文标点 + 英文标点 + 换行）
        // 支持：。！？.!? …… ——
        const rawSentences = clean.split(/([。！？.!?…—]+(?:\s*|\n\s*)|\n\s*)/);

        // 4. 合并分隔符到前一个句子
        const sentences = [];
        for (let i = 0; i < rawSentences.length; i++) {
            let s = rawSentences[i];
            if (!s) continue;

            // 如果当前是分隔符，合并到前一个句子
            if (/^[。！？.!?…—]+\s*$|^\n\s*$/.test(s)) {
                if (sentences.length > 0) {
                    sentences[sentences.length - 1] += s;
                }
            } else {
                sentences.push(s);
            }
        }

        // 5. 还原小数点并清理
        return sentences
            .map(s => s.replace(/###DOT###/g, '.').replace(/\s+/g, ' ').trim())
            .filter(s => s.length > 0);
    }

    function renderContent(content, displayName) {
        if (!content || content.trim() === '') {
            readerPaper.innerHTML = `
                <div class="file-header">
                    <span class="file-name">${escapeHtml(displayName)}</span>
                    <span class="count">空文件</span>
                </div>
                <div class="placeholder">📭 没有内容</div>
            `;
            return;
        }

        const sentences = splitSentences(content);
        const header = `
            <div class="file-header">
                <span class="file-name">${escapeHtml(displayName)}</span>
                <span class="count">${sentences.length} 句</span>
            </div>
        `;
        
        const listHtml = sentences.reduce((html, s) => 
            html + `<div class="sentence-item">${escapeHtml(s)}</div>`, 
            '<div class="sentence-list">'
        ) + '</div>';
        
        readerPaper.innerHTML = header + listHtml;
    }

    // 加载具体文件内容
    function loadFileContent(fileName, displayName) {
        if (!fileName) return;
        showLoading();
        
        const filePath = `./text/${encodeURIComponent(fileName)}`;
        
        fetch(filePath)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then(text => renderContent(text, displayName))
            .catch(err => {
                console.error('加载文件失败:', err);
                showError(`读取失败: ${displayName} (${err.message})`);
            });
    }

    // 加载JSON配置文件
    function loadGuideList() {
        fileSelector.disabled = true;
        fileSelector.innerHTML = '<option value="">— 加载配置 —</option>';

        fetch(`./text/list.json?t=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`无法加载list.json (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                // 支持多种格式
                let items = [];
                if (Array.isArray(data)) {
                    items = data;
                } else if (data.list && Array.isArray(data.list)) {
                    items = data.list;
                } else if (data.guides && Array.isArray(data.guides)) {
                    items = data.guides;
                } else {
                    throw new Error('JSON格式应为数组或包含list/guides字段的对象');
                }

                // 过滤有效条目
                guideList = items.filter(item => 
                    item.name && 
                    item.file && 
                    item.file.toLowerCase().endsWith('.txt')
                );

                if (guideList.length === 0) {
                    fileSelector.innerHTML = '<option value="">— 无有效导游词 —</option>';
                    showPlaceholder('list.json中无有效条目');
                    return;
                }

                // 构建下拉选项
                fileSelector.innerHTML = guideList.map(item => {
                    const selected = item.file === currentFile ? 'selected' : '';
                    return `<option value="${escapeHtml(item.file)}" ${selected}>${escapeHtml(item.name)}</option>`;
                }).join('');
                
                fileSelector.disabled = false;

                // 自动加载逻辑
                const targetItem = currentFile 
                    ? guideList.find(item => item.file === currentFile)
                    : guideList[0];

                if (targetItem) {
                    currentFile = targetItem.file;
                    fileSelector.value = currentFile;
                    loadFileContent(targetItem.file, targetItem.name);
                }
            })
            .catch(err => {
                console.error('加载list.json失败:', err);
                fileSelector.innerHTML = '<option value="">— 加载失败 —</option>';
                showError(`无法加载文件列表: ${err.message}`);
            })
            .finally(() => {
                fileSelector.disabled = false;
            });
    }

    // 事件监听
    fileSelector.addEventListener('change', function(e) {
        const selectedFile = e.target.value;
        if (!selectedFile) {
            currentFile = '';
            showPlaceholder('请选择导游词');
            return;
        }

        const selectedItem = guideList.find(item => item.file === selectedFile);
        if (selectedItem) {
            currentFile = selectedItem.file;
            loadFileContent(selectedItem.file, selectedItem.name);
        } else {
            loadGuideList(); // 数据不一致，刷新列表
        }
    });

    refreshBtn.addEventListener('click', function() {
        loadGuideList();
    });

    // 初始化
    loadGuideList();
})();
