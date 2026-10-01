//  2. 工具函数
        // ================================================================

        /** 格式化金额（整数，带货币符号） */
        function fmt(v) { return '¥' + Math.round(v).toLocaleString(); }

        /** 限制数值范围 */
        function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

        /** 随机浮点数 */
        function rand(mn, mx) { return mn + Math.random() * (mx - mn); }

        /** 随机整数（包含两端） */
        function randInt(mn, mx) { return Math.floor(rand(mn, mx + 1)); }

        /** 四舍五入取整（金额单位） */
        function toInt(v) { return Math.round(v); }

        // ================================================================
