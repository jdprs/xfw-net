//  30. 密码入口（双击标题）— 仅设置页存在密码模态框
        // ================================================================

        const pwModal = document.getElementById('password-modal');
        if (pwModal) {
            document.getElementById('main-title').addEventListener('dblclick', function() {
                document.getElementById('password-modal').style.display = 'flex';
                document.getElementById('admin-password-input').value = '';
                document.getElementById('admin-password-input').focus();
                document.body.classList.add('modal-open');
            });
        }

        // ================================================================
