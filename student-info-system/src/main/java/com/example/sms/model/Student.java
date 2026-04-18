package com.example.sms.model;

import com.example.sms.util.TextCodec;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

public class Student {
    private String id;
    private String name;
    private String gender;
    private int age;
    private String major;
    private String className;
    private String phone;
    private double gpa;
    private LocalDate enrollmentDate;

    public Student(String id, String name, String gender, int age, String major, String className, String phone, double gpa,
                   LocalDate enrollmentDate) {
        this.id = id;
        this.name = name;
        this.gender = gender;
        this.age = age;
        this.major = major;
        this.className = className;
        this.phone = phone;
        this.gpa = gpa;
        this.enrollmentDate = enrollmentDate;
    }

    public String toLine() {
        return TextCodec.joinFields(
                id,
                name,
                gender,
                String.valueOf(age),
                major,
                className,
                phone,
                String.valueOf(gpa),
                enrollmentDate.toString()
        );
    }

    public static Student fromLine(String line) {
        List<String> parts = TextCodec.splitFields(line);
        if (parts.size() != 9) {
            throw new IllegalArgumentException("学生数据格式错误: " + line);
        }
        return new Student(
                parts.get(0),
                parts.get(1),
                parts.get(2),
                Integer.parseInt(parts.get(3)),
                parts.get(4),
                parts.get(5),
                parts.get(6),
                Double.parseDouble(parts.get(7)),
                LocalDate.parse(parts.get(8))
        );
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getGender() {
        return gender;
    }

    public int getAge() {
        return age;
    }

    public String getMajor() {
        return major;
    }

    public String getClassName() {
        return className;
    }

    public String getPhone() {
        return phone;
    }

    public double getGpa() {
        return gpa;
    }

    public LocalDate getEnrollmentDate() {
        return enrollmentDate;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public void setAge(int age) {
        this.age = age;
    }

    public void setMajor(String major) {
        this.major = major;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public void setGpa(double gpa) {
        this.gpa = gpa;
    }

    public void setEnrollmentDate(LocalDate enrollmentDate) {
        this.enrollmentDate = enrollmentDate;
    }

    @Override
    public String toString() {
        return String.format("学号=%s, 姓名=%s, 性别=%s, 年龄=%d, 专业=%s, 班级=%s, 电话=%s, GPA=%.2f, 入学日期=%s",
                id, name, gender, age, major, className, phone, gpa, enrollmentDate);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Student student)) {
            return false;
        }
        return Objects.equals(id, student.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
