# 打工生活模拟器 - 本地离线版 v2.1.9

## 启动方法

### 方法一：一键启动（推荐）
```bash
cd game-local
node start.js
```
启动后会自动打开浏览器，默认地址：http://localhost:8080

### 方法二：指定端口
```bash
node start.js 3000
```

### 方法三：使用其他HTTP服务器
```bash
# Python
python3 -m http.server 8080

# Node.js http-server
npx http-server -p 8080

# PHP
php -S localhost:8080
```

## 系统要求
- Node.js 12+ 或任意HTTP服务器
- 现代浏览器（Chrome 80+, Firefox 75+, Edge 80+）
- 需要WebGL支持
- 磁盘空间：~750MB

## 移植说明
- 原始平台：Android (Cocos Creator 2.4.0 + JSB)
- 目标平台：Web Desktop (Cocos Creator 2.4.0 Web Runtime)
- 已移除：Ultralisk SDK、广告SDK、支付SDK、热更新系统、云端存档
- 已替换：jsb原生桥接 → 本地桩代码，云存档 → localStorage
- 资源文件：30,391个资源（纹理、音频、动画、场景）
- 游戏脚本：16MB编译后JavaScript

## 已知限制
- 部分UI界面可能因FairyGUI包缺失而显示异常
- 广告相关的游戏功能（看广告获得奖励）已自动跳过
- 云存档和排行榜功能不可用
- 小游戏入口（其他游戏推荐）图片无法加载
