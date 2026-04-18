package com.example.sms.repository;

import com.example.sms.model.Student;

import java.util.List;
import java.util.Optional;

public interface StudentRepository {
    List<Student> findAll();

    Optional<Student> findById(String id);

    void save(Student student);

    void deleteById(String id);

    boolean existsById(String id);
}
