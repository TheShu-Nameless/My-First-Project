package com.example.sms.ui;

import com.example.sms.model.Student;

import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTextField;
import java.awt.GridLayout;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

public final class StudentFormDialog {
    private StudentFormDialog() {
    }

    public static FormData showDialog(JFrame parent, String title, Student init) {
        JTextField idField = new JTextField(init == null ? "" : init.getId(), 18);
        JTextField nameField = new JTextField(init == null ? "" : init.getName(), 18);
        JTextField genderField = new JTextField(init == null ? "" : init.getGender(), 18);
        JTextField ageField = new JTextField(init == null ? "" : String.valueOf(init.getAge()), 18);
        JTextField majorField = new JTextField(init == null ? "" : init.getMajor(), 18);
        JTextField classField = new JTextField(init == null ? "" : init.getClassName(), 18);
        JTextField phoneField = new JTextField(init == null ? "" : init.getPhone(), 18);
        JTextField gpaField = new JTextField(init == null ? "" : String.valueOf(init.getGpa()), 18);
        JTextField enrollmentDateField = new JTextField(init == null ? LocalDate.now().toString() : init.getEnrollmentDate().toString(), 18);

        if (init != null) {
            idField.setEditable(false);
        }

        JPanel panel = new JPanel(new GridLayout(0, 2, 8, 8));
        panel.add(new JLabel("学号:"));
        panel.add(idField);
        panel.add(new JLabel("姓名:"));
        panel.add(nameField);
        panel.add(new JLabel("性别:"));
        panel.add(genderField);
        panel.add(new JLabel("年龄(10-80):"));
        panel.add(ageField);
        panel.add(new JLabel("专业:"));
        panel.add(majorField);
        panel.add(new JLabel("班级:"));
        panel.add(classField);
        panel.add(new JLabel("联系电话:"));
        panel.add(phoneField);
        panel.add(new JLabel("GPA(0.0-4.0):"));
        panel.add(gpaField);
        panel.add(new JLabel("入学日期(yyyy-MM-dd):"));
        panel.add(enrollmentDateField);

        while (true) {
            int option = JOptionPane.showConfirmDialog(parent, panel, title, JOptionPane.OK_CANCEL_OPTION,
                    JOptionPane.PLAIN_MESSAGE);
            if (option != JOptionPane.OK_OPTION) {
                return null;
            }

            try {
                String id = idField.getText().trim();
                String name = nameField.getText().trim();
                String gender = genderField.getText().trim();
                int age = Integer.parseInt(ageField.getText().trim());
                String major = majorField.getText().trim();
                String className = classField.getText().trim();
                String phone = phoneField.getText().trim();
                double gpa = Double.parseDouble(gpaField.getText().trim());
                LocalDate date = LocalDate.parse(enrollmentDateField.getText().trim());
                return new FormData(id, name, gender, age, major, className, phone, gpa, date);
            } catch (NumberFormatException | DateTimeParseException e) {
                JOptionPane.showMessageDialog(parent, "输入格式错误，请检查年龄/GPA/日期格式。", "错误",
                        JOptionPane.ERROR_MESSAGE);
            }
        }
    }

    public record FormData(String id, String name, String gender, int age, String major, String className, String phone,
                           double gpa, LocalDate enrollmentDate) {
    }
}
