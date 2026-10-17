//  32. 健康忠告
        // ================================================================

        function showHealthModal() {
            const modal = document.getElementById('health-modal');
            if (!modal) { document.body.classList.add('health-dismissed'); return; }
            const timerEl = document.getElementById('health-timer');
            let seconds = 5;
            timerEl.textContent = `⏳ ${seconds} 秒后自动进入游戏...`;
            const interval = setInterval(() => {
                seconds--;
                if (seconds <= 0) {
                    clearInterval(interval);
                    modal.classList.add('hidden');
                    setTimeout(() => { modal.style.display = 'none'; }, 500);
                    document.body.classList.add('health-dismissed');
                } else {
                    timerEl.textContent = `⏳ ${seconds} 秒后自动进入游戏...`;
                }
            }, 1000);
            modal.addEventListener('click', function() {
                clearInterval(interval);
                modal.classList.add('hidden');
                setTimeout(() => { modal.style.display = 'none'; }, 500);
                document.body.classList.add('health-dismissed');
            });
        }

        // ================================================================
