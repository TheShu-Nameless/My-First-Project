package com.example.sms.app;

import com.example.sms.model.Student;
import com.example.sms.repository.FileStudentRepository;
import com.example.sms.service.StudentService;
import com.example.sms.util.ConsoleInput;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Scanner;

public class MainApp {
    private final StudentService studentService;
    private final ConsoleInput input;

    public MainApp(StudentService studentService, ConsoleInput input) {
        this.studentService = studentService;
        this.input = input;
    }

    public static void main(String[] args) {
        Path dataFile = Path.of("data", "students.db");
        StudentService service = new StudentService(new FileStudentRepository(dataFile));
        Scanner scanner = new Scanner(System.in);
        ConsoleInput input = new ConsoleInput(scanner);
        MainApp app = new MainApp(service, input);
        app.run();
    }

    public void run() {
        printWelcome();
        while (true) {
            printMenu();
            String choice = input.readOptional("请输入菜单编号: ");
            try {
                switch (choice) {
                    case "1" -> addStudent();
                    case "2" -> updateStudent();
                    case "3" -> deleteStudent();
                    case "4" -> queryById();
                    case "5" -> listStudents();
                    case "6" -> searchByName();
                    case "7" -> searchByMajor();
                    case "8" -> sortByGpa();
                    case "9" -> statisticsByMajor();
                    case "0" -> {
                        System.out.println("系统已退出，感谢使用。");
                        return;
                    }
                    default -> System.out.println("无效菜单编号，请重试。");
                }
            } catch (Exception e) {
                System.out.println("操作失败: " + e.getMessage());
            }
            System.out.println();
        }
    }

    private void printWelcome() {
        System.out.println("==============================================");
        System.out.println("      学生信息管理系统 (Student Manager)");
        System.out.println("==============================================");
    }

    private void printMenu() {
        System.out.println("1. 添加学生");
        System.out.println("2. 修改学生");
        System.out.println("3. 删除学生");
        System.out.println("4. 按学号查询");
        System.out.println("5. 查看全部学生");
        System.out.println("6. 按姓名关键字查询");
        System.out.println("7. 按专业查询");
        System.out.println("8. 按 GPA 降序排序");
        System.out.println("9. 按专业统计人数");
        System.out.println("0. 退出系统");
    }

    private void addStudent() {
        String id = input.readNonBlank("学号: ");
        String name = input.readNonBlank("姓名: ");
        String gender = input.readNonBlank("性别: ");
        int age = input.readInt("年龄(10-80): ", 10, 80);
        String major = input.readNonBlank("专业: ");
        String className = input.readNonBlank("班级: ");
        String phone = input.readNonBlank("联系电话: ");
        double gpa = input.readDouble("GPA(0.0-4.0): ", 0, 4.0);
        LocalDate enrollmentDate = input.readDate("入学日期(yyyy-MM-dd): ");

        Student student = new Student(id, name, gender, age, major, className, phone, gpa, enrollmentDate);
        studentService.addStudent(student);
        System.out.println("添加成功。");
    }

    private void updateStudent() {
        String id = input.readNonBlank("请输入要修改的学号: ");
        Optional<Student> existing = studentService.findById(id);
        if (existing.isEmpty()) {
            System.out.println("未找到该学号对应的学生。");
            return;
        }
        Student s = existing.get();
        System.out.println("当前信息: " + s);
        String name = blankToNull(input.readOptional("新姓名(回车保留): "));
        String gender = blankToNull(input.readOptional("新性别(回车保留): "));
        String ageText = input.readOptional("新年龄(10-80，回车保留): ");
        String major = blankToNull(input.readOptional("新专业(回车保留): "));
        String className = blankToNull(input.readOptional("新班级(回车保留): "));
        String phone = blankToNull(input.readOptional("新电话(回车保留): "));
        String gpaText = input.readOptional("新GPA(0.0-4.0，回车保留): ");
        String dateText = input.readOptional("新入学日期(yyyy-MM-dd，回车保留): ");

        Integer age = input.parseOptionalInt(ageText, 10, 80);
        Double gpa = input.parseOptionalDouble(gpaText, 0, 4.0);
        LocalDate date = input.parseOptionalDate(dateText);
        studentService.updateStudent(id, name, gender, age, major, className, phone, gpa, date);
        System.out.println("修改成功。");
    }

    private void deleteStudent() {
        String id = input.readNonBlank("请输入要删除的学号: ");
        studentService.deleteStudent(id);
        System.out.println("删除成功。");
    }

    private void queryById() {
        String id = input.readNonBlank("请输入学号: ");
        Optional<Student> student = studentService.findById(id);
        if (student.isPresent()) {
            System.out.println(student.get());
        } else {
            System.out.println("未找到该学生。");
        }
    }

    private void listStudents() {
        List<Student> students = studentService.listAllStudents();
        printStudents(students);
    }

    private void searchByName() {
        String keyword = input.readNonBlank("请输入姓名关键字: ");
        List<Student> students = studentService.searchByNameKeyword(keyword);
        printStudents(students);
    }

    private void searchByMajor() {
        String keyword = input.readNonBlank("请输入专业关键字: ");
        List<Student> students = studentService.searchByMajor(keyword);
        printStudents(students);
    }

    private void sortByGpa() {
        List<Student> students = studentService.sortByGpaDesc();
        printStudents(students);
    }

    private void statisticsByMajor() {
        Map<String, Long> stats = studentService.countByMajor();
        if (stats.isEmpty()) {
            System.out.println("暂无学生数据。");
            return;
        }
        System.out.println("专业人数统计:");
        stats.forEach((major, count) -> System.out.printf("- %s: %d 人%n", major, count));
    }

    private void printStudents(List<Student> students) {
        if (students.isEmpty()) {
            System.out.println("暂无匹配数据。");
            return;
        }
        System.out.printf("共 %d 条记录:%n", students.size());
        students.forEach(s -> System.out.println("- " + s));
    }

    private String blankToNull(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        return text;
    }
}
