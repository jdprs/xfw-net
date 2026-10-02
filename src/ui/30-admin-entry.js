//  30. 高级设置入口（双击标题）
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

        const mainTitle = document.getElementById('main-title');
        if (mainTitle) mainTitle.addEventListener('dblclick', window.openAdminSettings);

        // ================================================================
