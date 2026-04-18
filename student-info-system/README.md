# 学生信息管理系统（Java 期末作业）

本项目是一个基于 Java 17 + Maven 的图形界面（Swing）学生信息管理系统，支持学生信息的增删改查、条件查询、排序统计和本地持久化。

## 1. 功能清单

- 添加学生信息
- 修改学生信息
- 删除学生信息
- 按学号查询
- 查看全部学生
- 按姓名关键字查询
- 按专业关键字查询
- 按 GPA 降序排序
- 按专业统计人数
- 数据持久化（保存在 `data/students.db`，重启程序后仍保留）
- 桌面图形界面操作（表格展示、弹窗表单输入）

## 2. 技术栈

- JDK 17
- Maven 3.8+
- JUnit 5（单元测试）

## 3. 项目结构

```text
student-info-system
├─ src/main/java/com/example/sms
│  ├─ app            # 程序入口（Swing/Console）
│  ├─ model          # 学生实体
│  ├─ repository     # 数据访问层（文件持久化）
│  ├─ service        # 业务逻辑层
│  ├─ ui             # Swing图形界面
│  └─ util           # 输入与文本编解码工具
├─ src/test/java     # 单元测试
├─ data              # 运行时数据目录
└─ pom.xml
```

## 4. 本地运行

### 4.1 编译 + 测试

```bash
mvn clean test
```

### 4.2 打包可执行 Jar

```bash
mvn clean package
```

打包后可执行文件为：

```text
target/student-info-system-1.0.0.jar
```

### 4.3 运行图形界面程序（默认）

```bash
java -jar target/student-info-system-1.0.0.jar
```

### 4.4 运行控制台程序（可选）

```bash
java -cp target/student-info-system-1.0.0.jar com.example.sms.app.MainApp
```

## 5. 打包提交建议

给老师提交两个文件（最稳妥）：

1. `student-info-system.zip`（整个项目源码压缩包）
2. `student-info-system-1.0.0.jar`（可执行 jar，双击或 `java -jar` 都可运行）

以上两个文件由一键脚本生成，位于**本目录**（与 `pom.xml` 同级），不会出现在仓库最外层根目录。

可使用一键脚本自动生成提交物：

```bash
package-submit.bat
```

## 6. 演示建议

课堂演示时可按以下流程：

1. 添加 2~3 条学生记录
2. 编辑其中一条记录（例如 GPA 或班级）
3. 按姓名/专业进行搜索
4. 展示 GPA 排序
5. 展示按专业统计
6. 删除一条记录
7. 退出再启动，证明数据已持久化
