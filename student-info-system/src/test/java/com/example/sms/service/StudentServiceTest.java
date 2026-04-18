package com.example.sms.service;

import com.example.sms.model.Student;
import com.example.sms.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StudentServiceTest {
    private StudentService service;

    @BeforeEach
    void setUp() {
        service = new StudentService(new InMemoryRepo());
    }

    @Test
    void shouldAddStudentSuccessfully() {
        Student student = createStudent("2024001", "张三", 3.7);
        service.addStudent(student);
        assertTrue(service.findById("2024001").isPresent());
    }

    @Test
    void shouldRejectDuplicateId() {
        service.addStudent(createStudent("2024001", "张三", 3.7));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.addStudent(createStudent("2024001", "李四", 3.6)));
        assertTrue(ex.getMessage().contains("学号已存在"));
    }

    @Test
    void shouldSortByGpaDesc() {
        service.addStudent(createStudent("2024001", "张三", 3.7));
        service.addStudent(createStudent("2024002", "李四", 3.9));
        service.addStudent(createStudent("2024003", "王五", 3.2));

        List<Student> list = service.sortByGpaDesc();
        assertEquals("2024002", list.get(0).getId());
        assertEquals("2024003", list.get(2).getId());
    }

    @Test
    void shouldUpdateSpecifiedFieldsOnly() {
        service.addStudent(createStudent("2024001", "张三", 3.7));
        service.updateStudent("2024001", "张三丰", null, null, null,
                null, null, 3.8, null);
        Student updated = service.findById("2024001").orElseThrow();
        assertEquals("张三丰", updated.getName());
        assertEquals(3.8, updated.getGpa());
    }

    private Student createStudent(String id, String name, double gpa) {
        return new Student(id, name, "男", 20, "计算机科学与技术",
                "计科2301", "13800000000", gpa, LocalDate.of(2023, 9, 1));
    }

    static class InMemoryRepo implements StudentRepository {
        private final Map<String, Student> db = new HashMap<>();

        @Override
        public List<Student> findAll() {
            return new ArrayList<>(db.values());
        }

        @Override
        public Optional<Student> findById(String id) {
            return Optional.ofNullable(db.get(id));
        }

        @Override
        public void save(Student student) {
            db.put(student.getId(), student);
        }

        @Override
        public void deleteById(String id) {
            db.remove(id);
        }

        @Override
        public boolean existsById(String id) {
            return db.containsKey(id);
        }
    }
}
