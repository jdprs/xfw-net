
# 小富翁股票投资游戏

这是一个使用原生 HTML、CSS 和 JavaScript 编写的股票投资模拟游戏，当前版本为 **v10.0**（新增 P2P 联机）。


## 运行方式

由于浏览器最新的安全设置，浏览器无法直接打开 HTML 运行。

建议游玩方式：
- VS Code 插件 Live Server：右键 `index.html` → Open with Live Server
- Python：`python -m http.server 8080` → 访问 `http://localhost:8080`
- Node.js：`npx serve .` → 访问 `http://localhost:3000`
- 访问[这里](jidanpirate.github.com)游玩
- 游玩[旧版](old_edition.html)(后续将不再更新）


## v10.0 联机功能

v10.0 起支持 **P2P 点对点联机对战**，无需自建服务器，浏览器通过 WebRTC 直连：

- **技术栈**：[PeerJS](https://peerjs.com/)（CDN 引入 `peerjs@1.5.4`），使用免费公共信令服务器 `0.peerjs.com` / `1.peerjs.com`，也支持填写自建信令服务器地址。
- **房间系统**：点击大厅「联机开始」→ 输入昵称 → 创建房间（生成 6 位数字房间号）或加入房间。
- **广场**：公开房间注册到免费公共 KV 存储 [kvdb.io](https://kvdb.io/)（bucket `xfw-new-rooms`，TTL 60 秒，房主每 20 秒心跳刷新），其他玩家可在「广场」浏览公开房间直接加入；KV 不可用时自动降级为仅房间号加入。
- **权威端同步**：房主端运行完整游戏引擎并维护状态，玩家端只接收 `state_sync` 快照并渲染，本地操作封装为 `player_action` 发送给房主执行。
- **聊天**：游戏右下角可折叠聊天面板，所有玩家可发送消息，房主可对刷屏玩家「禁言」（房主端过滤）。
- **房主权限**：跳过某玩家回合、强制收盘、禁言、结束游戏；所有管理操作后自动广播最新状态。
- **断线检测**：基于 ping/pong 心跳，15 秒无响应判定断线，顶部状态栏实时显示连接状态，断线自动提示并返回大厅。

### 页面结构（v10.0）

| 页面 | 作用 |
| --- | --- |
| `index.html` | 大厅 + 单机设置界面（「单机开始」「联机开始」） |
| `game_local.html` | 纯单机游玩页面（设置参数经 localStorage 传入） |
| `game_connect_master.html` | 房主游戏界面（完整引擎 + P2P 权威端） |
| `game_connect_player.html` | 非房主玩家界面（只接收状态并渲染） |

三个游戏页面共享同一套 `src/` 游戏 JS 模块，通过页面上的全局变量 `GAME_MODE = 'local' | 'master' | 'player'` 区分行为。


## 项目结构

```text
/
├── index.html                  # 大厅 + 单机设置
├── game_local.html             # 单机游玩页 (v10.0)
├── game_connect_master.html    # 房主联机页 (v10.0)
├── game_connect_player.html    # 玩家联机页 (v10.0)
├── README.md
├── assets/
│   └── css/
│       ├── style.css
│       └── modules/
│           ├── 01-foundation.css
│           ├── 02-setup.css
│           ├── 03-game.css
│           ├── 04-buttons.css
│           ├── 05-panels.css
│           ├── 06-modals.css
│           ├── 07-responsive.css
│           ├── 08-features.css
│           └── 09-multiplayer.css   # v10.0 联机/大厅/聊天样式
└── src/
    ├── main.js
    ├── core/
    ├── ui/
    ├── ai/
    ├── modules/
    ├── utils/
    ├── config/
    └── net/                          # v10.0 联机模块
        ├── 36-p2p.js                 # PeerJS 网络层 / 心跳 / 状态栏
        ├── 37-lobby.js               # 大厅、房间、广场(kvdb)、等待室
        ├── 38-game-sync.js           # 状态序列化 / 房主权威 / 玩家渲染
        └── 39-chat.js                # 聊天面板 / 禁言
```


## JavaScript 分类

- `src/core/`：状态、股票算法、交易、决策、收盘、存档和游戏生命周期。
- `src/ui/`：界面更新、玩家卡片、日志、图表、模态框和事件绑定。
- `src/ai/`：场内 AI 与外接 AI。
- `src/modules/`：彩票、自建股、预测、成就、评级和黑马股等玩法。
- `src/utils/`：工具函数与密码验证。
- `src/config/`：管理员高级设置。
- `src/net/`（v10.0）：P2P 联机层，仅在 `game_connect_*.html` 中由 `main.js` 按序加载。

每个 JavaScript 文件保留原有的编号和章节注释，`src/main.js` 按 `01` 到 `35` 的顺序加载核心模块；联机页额外追加 `net/36-39`。


## 外接 AI 说明（联机）

联机模式下，**外接 AI 仅在房主端运行**（与内置 AI 一样在权威端完成决策）。
非房主玩家端不会显示外接 AI 指令面板，也不会执行外接 AI 逻辑；所有 AI 的操作结果通过 `state_sync` 下发并渲染。


## 重要约定

- 当前 JavaScript 使用经典脚本和共享作用域，不要随意改成 ES Module，除非同步重构所有模块依赖。
- 保持 `src/main.js` 的模块加载顺序，因为各模块依赖前面模块定义的变量和函数。
- CSS 模块也要保持 `style.css` 中的导入顺序。
- 联机层（`src/net/`）通过「包装现有全局函数」实现同步，不修改 `core/` 下的游戏核心逻辑。
- 玩家 `totalAssets()` 方法依赖全局 `stocks`，状态反序列化时会重新挂载该方法。
- Chart.js 与 PeerJS 通过 CDN 加载，需要网络连接。


## 当前版本

- v10.0：新增 P2P 联机（房间号 + 广场 + 聊天 + 房主权限 + 状态同步 + 断线检测）；拆分 `index.html` / `game_local.html` / `game_connect_master.html` / `game_connect_player.html` 四个页面。
- v9.3：掠夺模式新增"封股票跑路"机制；AI 即将破产时自动撤资保命；补全封股票的存档/读档/预测拦截。
- v9.2：修复取消决策后预测押金未回滚的 bug；新增历史记录面板；新增展开图表；新增预测撤销按钮。
- v9.1：收盘统一破产检测、破产救助金、直接结束游戏、外接 AI 和模块化目录结构。

### 我们仍在不断升级中，欢迎提交 issue 讨论。
