package com.example.sms.ui;

import com.example.sms.model.Student;
import com.example.sms.service.StudentService;

import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.SwingConstants;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class StudentManagerFrame extends JFrame {
    private static final String[] COLUMNS = {"学号", "姓名", "性别", "年龄", "专业", "班级", "电话", "GPA", "入学日期"};

    private final StudentService service;
    private final DefaultTableModel tableModel;
    private final JTable table;
    private final JComboBox<String> searchTypeComboBox;
    private final JTextField keywordField;
    private final JLabel statusLabel;

    public StudentManagerFrame(StudentService service) {
        this.service = service;
        this.tableModel = new DefaultTableModel(COLUMNS, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        this.table = new JTable(tableModel);
        this.searchTypeComboBox = new JComboBox<>(new String[]{"按学号", "按姓名", "按专业"});
        this.keywordField = new JTextField(20);
        this.statusLabel = new JLabel("就绪");
        initFrame();
        initActions();
        refreshAll();
    }

    private void initFrame() {
        setTitle("学生信息管理系统 - 图形界面版");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1100, 680);
        setLocationRelativeTo(null);
        setLayout(new BorderLayout(8, 8));

        JPanel topPanel = createTopPanel();
        add(topPanel, BorderLayout.NORTH);

        table.setRowHeight(24);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        add(new JScrollPane(table), BorderLayout.CENTER);

        JPanel bottomPanel = new JPanel(new BorderLayout());
        bottomPanel.setBorder(BorderFactory.createEmptyBorder(0, 8, 8, 8));
        statusLabel.setHorizontalAlignment(SwingConstants.LEFT);
        bottomPanel.add(statusLabel, BorderLayout.WEST);
        add(bottomPanel, BorderLayout.SOUTH);
    }

    private JPanel createTopPanel() {
        JPanel container = new JPanel();
        container.setLayout(new BoxLayout(container, BoxLayout.Y_AXIS));
        container.setBorder(BorderFactory.createEmptyBorder(8, 8, 0, 8));

        JPanel queryPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 4));
        queryPanel.add(new JLabel("查询方式:"));
        queryPanel.add(searchTypeComboBox);
        queryPanel.add(new JLabel("关键字:"));
        keywordField.setPreferredSize(new Dimension(220, 28));
        queryPanel.add(keywordField);

        JButton searchButton = new JButton("查询");
        searchButton.addActionListener(e -> searchStudents());
        queryPanel.add(searchButton);

        JButton resetButton = new JButton("重置");
        resetButton.addActionListener(e -> {
            keywordField.setText("");
            refreshAll();
        });
        queryPanel.add(resetButton);

        JPanel actionPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 4));
        JButton addButton = new JButton("添加");
        addButton.addActionListener(e -> addStudent());
        actionPanel.add(addButton);

        JButton editButton = new JButton("编辑");
        editButton.addActionListener(e -> editStudent());
        actionPanel.add(editButton);

        JButton deleteButton = new JButton("删除");
        deleteButton.addActionListener(e -> deleteStudent());
        actionPanel.add(deleteButton);

        JButton sortButton = new JButton("按GPA排序");
        sortButton.addActionListener(e -> loadStudents(service.sortByGpaDesc(), "已按 GPA 降序排序"));
        actionPanel.add(sortButton);

        JButton statsButton = new JButton("专业统计");
        statsButton.addActionListener(e -> showMajorStats());
        actionPanel.add(statsButton);

        JButton refreshButton = new JButton("刷新");
        refreshButton.addActionListener(e -> refreshAll());
        actionPanel.add(refreshButton);

        container.add(queryPanel);
        container.add(actionPanel);
        return container;
    }

    private void initActions() {
        keywordField.addActionListener(e -> searchStudents());
    }

    private void refreshAll() {
        loadStudents(service.listAllStudents(), "已加载全部学生数据");
    }

    private void searchStudents() {
        String keyword = keywordField.getText().trim();
        if (keyword.isEmpty()) {
            refreshAll();
            return;
        }
        String type = (String) searchTypeComboBox.getSelectedItem();
        List<Student> result = new ArrayList<>();
        if ("按学号".equals(type)) {
            Optional<Student> student = service.findById(keyword);
            student.ifPresent(result::add);
        } else if ("按姓名".equals(type)) {
            result = service.searchByNameKeyword(keyword);
        } else if ("按专业".equals(type)) {
            result = service.searchByMajor(keyword);
        }
        loadStudents(result, "查询完成，共 " + result.size() + " 条结果");
    }

    private void addStudent() {
        StudentFormDialog.FormData formData = StudentFormDialog.showDialog(this, "添加学生", null);
        if (formData == null) {
            return;
        }
        try {
            Student student = new Student(
                    formData.id(),
                    formData.name(),
                    formData.gender(),
                    formData.age(),
                    formData.major(),
                    formData.className(),
                    formData.phone(),
                    formData.gpa(),
                    formData.enrollmentDate()
            );
            service.addStudent(student);
            refreshAll();
            showInfo("添加成功");
        } catch (Exception e) {
            showError("添加失败: " + e.getMessage());
        }
    }

    private void editStudent() {
        String selectedId = getSelectedStudentId();
        if (selectedId == null) {
            showError("请先选择要编辑的学生");
            return;
        }
        Optional<Student> found = service.findById(selectedId);
        if (found.isEmpty()) {
            showError("未找到该学生");
            return;
        }
        StudentFormDialog.FormData formData = StudentFormDialog.showDialog(this, "编辑学生", found.get());
        if (formData == null) {
            return;
        }
        try {
            service.updateStudent(
                    selectedId,
                    formData.name(),
                    formData.gender(),
                    formData.age(),
                    formData.major(),
                    formData.className(),
                    formData.phone(),
                    formData.gpa(),
                    formData.enrollmentDate()
            );
            refreshAll();
            showInfo("编辑成功");
        } catch (Exception e) {
            showError("编辑失败: " + e.getMessage());
        }
    }

    private void deleteStudent() {
        String selectedId = getSelectedStudentId();
        if (selectedId == null) {
            showError("请先选择要删除的学生");
            return;
        }
        int choice = JOptionPane.showConfirmDialog(this, "确认删除学号 " + selectedId + " 的学生吗？", "删除确认",
                JOptionPane.YES_NO_OPTION);
        if (choice != JOptionPane.YES_OPTION) {
            return;
        }
        try {
            service.deleteStudent(selectedId);
            refreshAll();
            showInfo("删除成功");
        } catch (Exception e) {
            showError("删除失败: " + e.getMessage());
        }
    }

    private void showMajorStats() {
        Map<String, Long> stats = service.countByMajor();
        if (stats.isEmpty()) {
            showInfo("暂无学生数据");
            return;
        }
        StringBuilder sb = new StringBuilder("专业人数统计:\n");
        stats.forEach((major, count) -> sb.append("- ").append(major).append(": ").append(count).append(" 人\n"));
        JOptionPane.showMessageDialog(this, sb.toString(), "统计结果", JOptionPane.INFORMATION_MESSAGE);
    }

    private void loadStudents(List<Student> students, String statusText) {
        tableModel.setRowCount(0);
        for (Student student : students) {
            tableModel.addRow(new Object[]{
                    student.getId(),
                    student.getName(),
                    student.getGender(),
                    student.getAge(),
                    student.getMajor(),
                    student.getClassName(),
                    student.getPhone(),
                    String.format("%.2f", student.getGpa()),
                    student.getEnrollmentDate()
            });
        }
        statusLabel.setText(statusText + " | 当前显示 " + students.size() + " 条");
    }

    private String getSelectedStudentId() {
        int row = table.getSelectedRow();
        if (row < 0) {
            return null;
        }
        Object value = tableModel.getValueAt(row, 0);
        return value == null ? null : value.toString();
    }

    private void showInfo(String text) {
        JOptionPane.showMessageDialog(this, text, "提示", JOptionPane.INFORMATION_MESSAGE);
    }

    private void showError(String text) {
        JOptionPane.showMessageDialog(this, text, "错误", JOptionPane.ERROR_MESSAGE);
    }
}
