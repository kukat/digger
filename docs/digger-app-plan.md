# React Native DNS 工具技术实现计划

## 1. 目标

开发一款 iOS/Android DNS 查询工具，提供比移动端现有 `dig` 类 App 更清晰的交互，同时保留专业诊断信息。

首版采用：

> React Native UI + C++ Turbo Native Module + c-ares

不嵌入或执行 `dig`。Native 层返回结构化 DNS 数据；React Native 同时提供卡片视图和 `dig` 风格文本视图。

## 2. MVP 范围

### 查询能力

- RR 类型：A、AAAA、CNAME、MX、TXT、NS、SOA、PTR、SRV、CAA、HTTPS、SVCB
- 使用系统 DNS，或指定 DNS server 与端口
- UDP 查询及响应截断后的 TCP fallback
- 强制 TCP
- EDNS、DO bit、超时、重试和取消
- 展示 rcode、flags、question/answer/authority/additional、响应耗时、服务器和报文大小
- 保存最近查询的名称与 RR 类型，不保存查询结果
- 支持复制和分享当前结果

### 暂不包含

- `+trace`
- DNSSEC 本地验证
- DoH/DoT
- AXFR、TSIG、动态更新
- 设备级 DNS 代理或 VPN

这些能力不应阻塞 MVP，也不为它们提前增加 UI、持久化或复杂领域模型。

## 3. 总体架构

```text
React Native
  ├─ 查询表单、结果视图、历史与设置
  ├─ dig 文本 formatter
  └─ NativeDns TypeScript API
                │
        Turbo Native Module
                │
        C++ DNS Service Layer
  ├─ 查询生命周期、超时与取消
  ├─ c-ares channel 管理
  ├─ wire response → 结构化结果
  └─ platform network adapter
                │
             c-ares
```

原则：JS 不传 shell 命令，不解析 stdout；Native API 使用明确、有类型的查询参数和结果。

## 4. Native API

```ts
type DnsQuery = {
  name: string;
  type: string;
  resolver:
    | { mode: 'system' }
    | { mode: 'custom'; address: string; port: number };
  transport: 'auto' | 'udp' | 'tcp';
  timeoutMs: number;
  retries: number;
  dnssecOk: boolean;
  ednsUdpSize?: number;
};

type DnsEndpoint = {
  address: string;
  port: number;
};

type DnsResult = {
  rcode: string;
  flags: string[];
  question: DnsQuestion[];
  answer: DnsRecord[];
  authority: DnsRecord[];
  additional: DnsRecord[];
  server?: DnsEndpoint;
  transport: 'udp' | 'tcp';
  elapsedMs: number;
  wireBytes: number;
};

query(queryId: string, request: DnsQuery): Promise<DnsResult>;
cancel(queryId: string): void;
```

JS 在调用前生成 `queryId`，使运行中的 Promise 可以被取消。Native 返回本次查询实际使用的 `server`；平台无法可靠提供地址时留空，UI 显示 `System resolver`。API 不暴露 exchange trace、raw packet 或历史持久化模型。

错误统一分类为：输入错误、超时、取消、网络不可达、协议解析失败和 Native 内部错误。NXDOMAIN、SERVFAIL、REFUSED 等 rcode 是正常收到的 DNS 响应，不属于 transport error。

## 5. 平台实现

### iOS

- 用 CocoaPods 或项目构建脚本编译 c-ares 静态库，支持真机 arm64 和模拟器 arm64/x86_64。
- 用 Objective-C++ 注册 C++ TurboModule。
- 查询放在专用队列，不阻塞主线程。
- 监听网络变化；切换 Wi-Fi、蜂窝或 VPN 后刷新 resolver/channel。
- 用户指定局域网 DNS server 时配置并验证 Local Network 权限说明。

### Android

- 用 NDK + CMake 为 arm64-v8a、armeabi-v7a、x86_64 构建 c-ares 和 C++ module。
- 通过 c-ares Android 初始化接口传入 JVM 与 `ConnectivityManager`。
- 声明 `INTERNET` 和 `ACCESS_NETWORK_STATE`。
- 监听默认 Network 变化，避免继续使用旧网络的 resolver。
- 以 AAB 发布，由商店按设备 ABI 下发 native library。

### c-ares 集成规则

- 每个查询必须有唯一 ID、截止时间和取消句柄。
- 首版可使用共享配置加独立 query context；若 channel 并发/取消边界复杂，优先每批查询使用独立 channel，先保证正确性。
- 自行构造/解析完整 DNS packet，以保留 flags 和四个 section；不要只使用返回 IP 地址的简化接口。
- 系统 DNS 与用户指定 server 是两个明确模式。

## 6. UI 与交互规格

当前界面参考：[Digger wireframe](wireframe/digger-wireframe.html)。首要目标是漂亮、小巧，不把 MVP 做成查询结果管理或深度诊断平台。

### 6.1 导航结构

底部保留三个一级 Tab：

1. **Query**：构造并运行查询。
2. **History**：浏览最近查询过的名称与 RR 类型。
3. **Settings**：清理本地数据并查看隐私与 App 信息。

**Result 不是 Tab**。Query 点击 **Run Query** 后 push Result；查询期间显示 loading 与 Cancel。返回 Query 后保留表单但丢弃 Result，Result 不写入 History 或其他持久化存储。

### 6.2 Query 页面

首屏只突出三个元素：Name、RR type 和 **Run Query**。

- 常用类型直接显示 `A`、`AAAA`、`CNAME`、`MX`、`TXT`；`More…` 打开包含 NS、SOA、PTR、SRV、CAA、HTTPS、SVCB 的完整列表。
- Resolver、Transport、EDNS、DO bit、Timeout 与 Retries 收进可展开的 **Advanced** 区域。
- 内置默认值：System resolver、Auto transport、EDNS on（UDP size 1232）、DO off、每次 timeout 3 秒、retries 1。
- Custom resolver 只属于当前表单，不提供常用服务器收藏或管理。
- PTR 允许输入 IP 地址并转换为 reverse-mapping name；普通查询不从 URL 猜测 hostname。

点击 Run Query 前进行输入校验。运行期间锁定会改变请求语义的字段，并提供 Cancel。输入校验通过并开始查询后，将 name + RR type 写入 Recent Queries，不论最终得到 DNS 响应还是查询错误。

### 6.3 Result 页面

Result 只展示当前查询。顶部显示 query name、RR type、实际 transport，以及 Native 可提供的单一 **Server** endpoint；地址不可用时显示 `System resolver`。

摘要展示 rcode、耗时和 wire size；正文可在 **Structured** 与 **dig** 两种视图间切换：

- Structured：flags、Question、Answer、Authority、Additional；空 section 仍显示记录数。
- dig：从同一份 `DnsResult` 生成熟悉的 `dig` 风格文本，但不承诺与 BIND `dig` 逐字节一致。
- NXDOMAIN、SERVFAIL、REFUSED 等 rcode 仍按 DNS 响应展示；timeout、cancelled、network error 和 invalid response 显示简洁错误状态，不伪造 DNS sections。
- Copy 与 Share 处理当前选中的视图。Structured 使用人类可读文本，dig 使用完整 dig 风格文本；不提供 JSON、raw packet 或导出文件。

### 6.4 History 页面

History 是最近查询快捷入口，不是结果档案。

- 每条只保存 `name + RR type`，不保存 response、rcode、耗时、resolver 或错误。
- 按规范化 name + RR type 去重；再次查询时移到顶部。
- 最多保留 50 条，超出后自动移除最旧项。
- 点击记录返回 Query，只回填 name 与 RR type，不自动执行；当前 resolver 与 Advanced 选项保持不变。
- 不提供收藏。支持单条删除；Clear History 放在 Settings。

### 6.5 Settings 页面

- **Privacy & Data**：明确说明查询不上传、Recent Queries 仅保存在本机；提供 Clear History。
- **About**：版本、开源许可证和第三方 notices。
- MVP 不提供持久化 Query defaults。

`dig` 文本只是展示层，不是 Native API；用 snapshot tests 固定格式，并确保 Structured 与 dig 始终来自同一份当前结果数据。

## 7. 实施阶段

### 阶段一：Native spike（约 1 周）

- 两端真机完成 A/AAAA 查询
- 支持系统 DNS和指定 server
- 验证 UDP、TCP、超时、取消、IPv6 和网络切换
- 测量 native 包体增量

通过条件：两端连续/并发查询稳定，切换网络后不复用失效 resolver，无 UI 线程阻塞。

### 阶段二：MVP 核心（约 2 周）

- 完成 TurboModule typed API
- 支持目标 RR 类型、完整 sections、EDNS 和 TCP fallback
- 完成查询页、结构化结果页和 dig formatter
- 建立单元测试与固定 DNS 测试区

### 阶段三：产品完善（约 1 周）

- Recent Queries、复制、分享和错误提示
- 权限、隐私、开源 notices
- 真机兼容、性能与发布构建测试

单人熟悉 React Native/C++ 时，MVP 预估 4 周；若首次接触 TurboModule 或移动端 CMake，预留额外 1–2 周。

## 8. 测试与验收

- DNS packet 编解码 golden tests：正常、NXDOMAIN、SERVFAIL、截断、未知 RR、压缩指针异常
- Native tests：超时、取消、并发、UDP→TCP fallback、IPv4/IPv6 server
- UI tests：输入校验、错误状态、结果渲染、dig formatter snapshots
- 真机矩阵：iOS Wi-Fi/蜂窝/VPN；Android Wi-Fi/蜂窝/VPN及 API 最低版本
- 使用自有 authoritative test zone 和可控 mock DNS server；公网 resolver 测试只作为补充

MVP 验收标准：

- 两端功能一致且不崩溃
- 查询可取消，不阻塞界面
- 完整展示原始响应四个 section 和关键元数据
- UDP 截断时可靠回退 TCP
- 网络切换后查询使用当前网络
- 不上传查询内容或历史；日志不记录敏感完整报文

## 9. 主要风险

- **系统 resolver 获取差异**：使用 c-ares 官方 Android 初始化路径；iOS 通过平台 adapter 管理，真机验证 VPN/split DNS。
- **网络切换导致旧 channel 失效**：监听网络变化并重建 channel，禁止长期缓存 resolver。
- **未知/新 RR 类型**：保留 raw RDATA，解析器无法识别时仍能展示类型号和十六进制内容。
- **DNSSEC 误导**：首版只标注 DO、AD、RRSIG 等观察值，明确声明“未进行本地验证”。
- **范围膨胀**：`+trace`、DoH/DoT、DNSSEC validation 分别作为独立里程碑，不混入 MVP。

## 10. 首个决策点

先完成阶段一 spike，再依据三项指标决定进入正式开发：

1. iOS/Android 真机网络切换与取消是否稳定；
2. 完整 DNS packet API 是否覆盖目标 RR 和 metadata；
3. native 包体增量与构建维护成本是否可接受。

若全部通过，保持 c-ares 作为统一核心；DoH 后续优先使用平台 HTTP/TLS transport，不替换现有 DNS 数据模型。
