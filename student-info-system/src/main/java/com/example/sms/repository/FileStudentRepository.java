package com.example.sms.repository;

import com.example.sms.model.Student;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class FileStudentRepository implements StudentRepository {
    private final Path filePath;
    private final Map<String, Student> store = new LinkedHashMap<>();

    public FileStudentRepository(Path filePath) {
        this.filePath = filePath;
        initialize();
    }

    @Override
    public List<Student> findAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public Optional<Student> findById(String id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public void save(Student student) {
        store.put(student.getId(), student);
        persist();
    }

    @Override
    public void deleteById(String id) {
        store.remove(id);
        persist();
    }

    @Override
    public boolean existsById(String id) {
        return store.containsKey(id);
    }

    private void initialize() {
        try {
            if (!Files.exists(filePath.getParent())) {
                Files.createDirectories(filePath.getParent());
            }
            if (!Files.exists(filePath)) {
                Files.createFile(filePath);
                return;
            }
            List<String> lines = Files.readAllLines(filePath, StandardCharsets.UTF_8);
            for (String line : lines) {
                if (line == null || line.isBlank()) {
                    continue;
                }
                Student student = Student.fromLine(line);
                store.put(student.getId(), student);
            }
        } catch (IOException e) {
            throw new IllegalStateException("初始化学生数据仓库失败: " + filePath, e);
        }
    }

    private void persist() {
        List<String> lines = store.values().stream()
                .map(Student::toLine)
                .toList();
        try {
            Files.write(filePath, lines, StandardCharsets.UTF_8, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException e) {
            throw new IllegalStateException("写入学生数据失败: " + filePath, e);
        }
    }
}
