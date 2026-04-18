# 提交清单（期末作业）

## 你最终要提交给老师的文件

在 `student-info-system` 目录下运行打包脚本后，会在**该目录内**生成：

1. `student-info-system.zip`（项目源码压缩包）
2. `student-info-system-1.0.0.jar`（可执行程序）

## 一键生成方式

在 `student-info-system` 目录执行：

```bash
package-submit.bat
```

执行成功后，上述两个文件会出现在 `student-info-system` 文件夹中（与 `pom.xml` 同级）。

说明：Git 仓库根目录不再保留重复的 zip/jar；需要交给老师时，在本目录运行脚本即可重新生成。

## 提交前自检

- 能运行：`java -jar student-info-system-1.0.0.jar`（在 `student-info-system` 目录下）
- 能新增、编辑、删除学生
- 能查询、排序、统计
- 重启程序后数据仍保留
