//  30. 高级设置入口（禁用双击标题，改由大厅「高级设置」模式进入）
        // ================================================================

        window.openAdminSettings = function() {
            const menu = document.getElementById('home-mode-menu');
            const setup = document.getElementById('game-setup');
            if (menu && setup) {
                menu.style.display = 'none';
                setup.style.display = 'block';
                setup.classList.add('settings-view');
                const title = document.getElementById('setup-title');
                if (title) title.textContent = '⚙️ 高级设置';
            }
            if (typeof window.enableAdminSettings === 'function') window.enableAdminSettings();
        };

        // 双击标题进高级设置已禁用（v10.0.23），改由大厅「高级设置」模式进入

        // ================================================================
