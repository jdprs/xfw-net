//  25. 日志面板控制
        // ================================================================

        function showLogPanel() {
            let panel = document.getElementById('game-history');
            panel.classList.remove('hidden');
            panel.classList.remove('collapsed');
            logPanelVisible = true;
            document.getElementById('show-log-btn').style.display = 'none';
            if (typeof window.placeNetStatusBar === 'function') window.placeNetStatusBar();
        }

        function hideLogPanel() {
            let panel = document.getElementById('game-history');
            panel.classList.add('hidden');
            panel.classList.remove('collapsed');
            logPanelVisible = true;
            document.getElementById('show-log-btn').style.display = 'none';
            if (typeof window.placeNetStatusBar === 'function') window.placeNetStatusBar();
        }

        function toggleLogPanel() {
            let panel = document.getElementById('game-history');
            if (panel.classList.contains('hidden')) return;
            panel.classList.toggle('collapsed');
            logPanelVisible = !panel.classList.contains('collapsed');
            let showBtn = document.getElementById('show-log-btn');
            if (panel.classList.contains('collapsed')) {
                showBtn.style.display = 'flex';
            } else {
                showBtn.style.display = 'none';
            }
            if (typeof window.placeNetStatusBar === 'function') window.placeNetStatusBar();
        }

        // ================================================================
