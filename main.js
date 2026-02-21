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
        return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // 按句子拆分（处理换行/空格，避免拆分小数）
    function splitSentences(text) {
        if (!text) return [];

        // 1. 统一换行符
        let clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 2. 临时保护小数点
        //    把数字间的点换成占位符，避免被拆分
        clean = clean.replace(/(\d)\.(\d)/g, '$1###DOT###$2');

        // 3. 按句子边界拆分
        //    边界：。！？.!? 以及换行符，后面可以跟空白字符
        //    使用捕获分组保留分隔符
        const rawSentences = clean.split(/([。！？.!?]\s*|\n\s*)/);

        // 4. 合并分隔符到前一个句子
        const sentences = [];
        for (let i = 0; i < rawSentences.length; i++) {
            let s = rawSentences[i];
            if (!s) continue;

            // 如果当前是分隔符（标点或换行），且前一个句子存在，则合并
            if (i > 0 && /^[。！？.!?]\s*$|^\n\s*$/.test(s)) {
                if (sentences.length > 0) {
                    sentences[sentences.length - 1] += s;
                }
            }
            // 如果当前是文本内容，直接添加
            else if (!/^[。！？.!?]\s*$|^\n\s*$/.test(s)) {
                sentences.push(s);
            }
        }

        // 5. 还原小数点
        const result = sentences.map(s =>
            s.replace(/###DOT###/g, '.')
        );

        // 6. 清理多余空白，过滤空句子
        return result
            .map(s => s.replace(/\s+/g, ' ').trim())
            .filter(s => s.length > 0);
    }

    function renderContent(content, displayName, fileName) {
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
        let listHtml = '<div class="sentence-list">';
        sentences.forEach(s => {
            listHtml += `<div class="sentence-item">${escapeHtml(s)}</div>`;
        });
        listHtml += '</div>';
        readerPaper.innerHTML = header + listHtml;
    }

    // 加载具体文件内容 (fileName 是实际txt文件名，如 "gugong.txt")
    function loadFileContent(fileName, displayName) {
        if (!fileName) return;
        showLoading();
        // 构建路径：text/文件名
        const filePath = `./text/${encodeURIComponent(fileName)}`;
        fetch(filePath)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then(text => renderContent(text, displayName, fileName))
            .catch(err => {
                console.error(err);
                showError(`读取失败: ${displayName} (${err.message})`);
            });
    }

    // 加载JSON配置文件
    function loadGuideList() {
        fileSelector.disabled = true;
        fileSelector.innerHTML = '<option value="">— 加载配置 —</option>';

        // 尝试读取同级的 text/list.json 或根目录list.json，但按需求从text目录获取，这里放在 ./text/list.json
        fetch('./text/list.json?t=' + Date.now()) // 加时间戳防止缓存
            .then(response => {
                if (!response.ok) {
                    throw new Error(`无法加载list.json (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                // 支持两种格式：数组 [{name, file}] 或 {list: [...]}
                let items = [];
                if (Array.isArray(data)) {
                    items = data;
                } else if (data.list && Array.isArray(data.list)) {
                    items = data.list;
                } else if (data.guides && Array.isArray(data.guides)) {
                    items = data.guides;
                } else {
                    throw new Error('JSON格式不对，应为数组或包含list字段的数组');
                }

                // 过滤：必须有name和file字段，file以.txt结尾
                guideList = items.filter(item => item.name && item.file && item.file.toLowerCase().endsWith('.txt'));

                if (guideList.length === 0) {
                    fileSelector.innerHTML = '<option value="">— 无有效导游词 —</option>';
                    fileSelector.disabled = true;
                    showPlaceholder('list.json中无有效条目');
                    return;
                }

                // 构建下拉选项
                let options = ""
                guideList.forEach((item, index) => {
                    // 用文件名作为value，显示名称作为文本
                    const selected = (item.file === currentFile) ? 'selected' : '';
                    options += `<option value="${escapeHtml(item.file)}" data-display="${escapeHtml(item.name)}" ${selected}>${escapeHtml(item.name)}</option>`;
                });
                fileSelector.innerHTML = options;
                fileSelector.disabled = false;

                // 自动选择第一个选项（新增逻辑）
                if (guideList.length > 0 && !currentFile) {
                    const firstItem = guideList[0];
                    currentFile = firstItem.file;
                    fileSelector.value = firstItem.file; // 设置下拉框显示
                    loadFileContent(firstItem.file, firstItem.name);
                }
                // 如果当前有选中的文件且在列表中，自动加载
                else if (currentFile) {
                    const found = guideList.find(item => item.file === currentFile);
                    if (found) {
                        loadFileContent(found.file, found.name);
                    } else {
                        currentFile = '';
                        showPlaceholder('请选择导游词');
                    }
                }
            })
            .catch(err => {
                console.error('加载list.json失败:', err);
                fileSelector.innerHTML = '<option value="">— 加载失败 —</option>';
                fileSelector.disabled = false;
                showError(`无法加载文件列表: ${err.message}`);
            });
    }

    // 选择事件
    fileSelector.addEventListener('change', function(e) {
        const selectedFile = e.target.value; // 文件名
        if (!selectedFile) {
            currentFile = '';
            showPlaceholder('请选择导游词');
            return;
        }

        // 找到对应的条目
        const selectedItem = guideList.find(item => item.file === selectedFile);
        if (selectedItem) {
            currentFile = selectedItem.file;
            loadFileContent(selectedItem.file, selectedItem.name);
        } else {
            // 容错：刷新列表
            loadGuideList();
        }
    });

    refreshBtn.addEventListener('click', function() {
        loadGuideList();
        fileSelector.disable = true;
    });

    // 初始化
    loadGuideList();

})();