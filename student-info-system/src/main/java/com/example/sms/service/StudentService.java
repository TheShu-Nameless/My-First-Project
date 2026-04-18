package com.example.sms.service;

import com.example.sms.model.Student;
import com.example.sms.repository.StudentRepository;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class StudentService {
    private final StudentRepository repository;

    public StudentService(StudentRepository repository) {
        this.repository = repository;
    }

    public void addStudent(Student student) {
        validateStudent(student);
        if (repository.existsById(student.getId())) {
            throw new IllegalArgumentException("学号已存在，不能重复添加: " + student.getId());
        }
        repository.save(student);
    }

    public void updateStudent(String id, String name, String gender, Integer age, String major, String className, String phone,
                              Double gpa, LocalDate enrollmentDate) {
        Student student = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("学号不存在: " + id));

        if (name != null) {
            student.setName(name);
        }
        if (gender != null) {
            student.setGender(gender);
        }
        if (age != null) {
            student.setAge(age);
        }
        if (major != null) {
            student.setMajor(major);
        }
        if (className != null) {
            student.setClassName(className);
        }
        if (phone != null) {
            student.setPhone(phone);
        }
        if (gpa != null) {
            student.setGpa(gpa);
        }
        if (enrollmentDate != null) {
            student.setEnrollmentDate(enrollmentDate);
        }
        validateStudent(student);
        repository.save(student);
    }

    public void deleteStudent(String id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("学号不存在: " + id);
        }
        repository.deleteById(id);
    }

    public Optional<Student> findById(String id) {
        return repository.findById(id);
    }

    public List<Student> listAllStudents() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(Student::getId))
                .toList();
    }

    public List<Student> searchByNameKeyword(String keyword) {
        String normalized = keyword == null ? "" : keyword.trim().toLowerCase();
        return repository.findAll().stream()
                .filter(s -> s.getName().toLowerCase().contains(normalized))
                .sorted(Comparator.comparing(Student::getId))
                .toList();
    }

    public List<Student> searchByMajor(String major) {
        String normalized = major == null ? "" : major.trim().toLowerCase();
        return repository.findAll().stream()
                .filter(s -> s.getMajor().toLowerCase().contains(normalized))
                .sorted(Comparator.comparing(Student::getId))
                .toList();
    }

    public List<Student> sortByGpaDesc() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(Student::getGpa).reversed()
                        .thenComparing(Student::getId))
                .toList();
    }

    public Map<String, Long> countByMajor() {
        return repository.findAll().stream()
                .collect(Collectors.groupingBy(Student::getMajor, LinkedHashMap::new, Collectors.counting()));
    }

    private void validateStudent(Student student) {
        if (isBlank(student.getId())) {
            throw new IllegalArgumentException("学号不能为空");
        }
        if (isBlank(student.getName())) {
            throw new IllegalArgumentException("姓名不能为空");
        }
        if (student.getAge() < 10 || student.getAge() > 80) {
            throw new IllegalArgumentException("年龄范围应在10到80之间");
        }
        if (student.getGpa() < 0 || student.getGpa() > 4.0) {
            throw new IllegalArgumentException("GPA范围应在0.0到4.0之间");
        }
        if (student.getEnrollmentDate() == null || student.getEnrollmentDate().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("入学日期非法");
        }
        if (isBlank(student.getMajor())) {
            throw new IllegalArgumentException("专业不能为空");
        }
        if (isBlank(student.getClassName())) {
            throw new IllegalArgumentException("班级不能为空");
        }
    }

    private boolean isBlank(String text) {
        return text == null || text.trim().isEmpty();
    }
}
