package com.example.sms.app;

import com.example.sms.repository.FileStudentRepository;
import com.example.sms.service.StudentService;
import com.example.sms.ui.StudentManagerFrame;

import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import java.nio.file.Path;

public class SwingApp {
    public static void main(String[] args) {
        setLookAndFeel();
        StudentService service = new StudentService(new FileStudentRepository(Path.of("data", "students.db")));
        SwingUtilities.invokeLater(() -> {
            StudentManagerFrame frame = new StudentManagerFrame(service);
            frame.setVisible(true);
        });
    }

    private static void setLookAndFeel() {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {
            // 回退到默认样式，避免因主题设置导致程序启动失败
        }
    }
}
